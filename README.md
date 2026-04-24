# Wedding Page

A real-time collaborative wedding planning app with a gift registry, guest list, and cake list. Changes sync instantly across all connected browsers via WebSockets.

Built with **SvelteKit** (frontend), **Azure Functions** (API), **Azure Web PubSub** (real-time), and **Azure Blob Storage** (persistence).

## Architecture

```
┌──────────┐   HTTPS    ┌───────────────────┐   linked    ┌──────────────────┐
│  Browser │ ──────────▶│  Static Web App   │ ──backend──▶│  Function App    │
│          │            │  (SvelteKit SPA)  │             │  (Node.js API)   │
└────┬─────┘            └───────────────────┘             └──┬───────┬───────┘
     │                                                       │       │
     │ WebSocket (wss://)   ┌───────────────────┐            │       │
     └─────────────────────▶│  Azure Web PubSub │◀───────────┘       │
                            │  (hub: "wedding") │  upstream events   │
                            └───────────────────┘  + broadcast       │
                                                                     │
                                                    ┌────────────────┘
                                                    ▼
                                            ┌───────────────┐
                                            │ Blob Storage  │
                                            │ (state.json)  │
                                            └───────────────┘
```

### How the pieces communicate

1. **Browser → SWA → Function App**: The browser loads the SvelteKit SPA from the Static Web App. API requests to `/api/*` are proxied by the SWA to the linked Function App. This happens because of the `linkedBackends` resource in Bicep — it tells the SWA to forward `/api/*` traffic to the Function App and adds authentication so only the SWA can call the Function App directly.

2. **Browser → Web PubSub (WebSocket)**: On page load, the frontend calls `POST /api/negotiate`, which returns a `wss://` URL with an access token. The browser opens a WebSocket to Web PubSub using the `json.webpubsub.azure.v1` subprotocol, which allows structured JSON messaging.

3. **Web PubSub → Function App (upstream events)**: When clients connect, disconnect, or send messages, Web PubSub forwards these as HTTP POST requests to the upstream URL configured in the hub settings. The upstream URL points to `https://<swa-hostname>/api/eventhandler` — it must go through the SWA (not directly to the Function App) because the linked backend setup blocks direct access with a 401.

4. **Function App → Blob Storage**: The eventhandler reads/writes `state.json` in a blob container to persist the gift and guest lists.

5. **Function App → Web PubSub (broadcast)**: After persisting state, the eventhandler uses the Web PubSub service SDK to broadcast the updated state to all connected clients via `sendToAll()`.

### Why each config exists

| File | Purpose | Required? |
|---|---|---|
| `api/host.json` | Azure Functions runtime config, extension bundle version | Yes — Functions won't start without it |
| `api/local.settings.json` | Local env vars (`FUNCTIONS_WORKER_RUNTIME`, connection strings) | Yes for local dev, gitignored |
| `api/.funcignore` | Excludes source files from deployment zip | Optional — deploy script handles exclusions |
| `frontend/static/staticwebapp.config.json` | SPA fallback routing, API route permissions | Yes — without `navigationFallback`, deep links return 404 |
| `swa-cli.config.json` | Local dev config — tells `swa start` where the frontend dev server and API are | Yes for local dev, not used in production |

### Environment variables (Function App)

| Variable | What it connects | Set by |
|---|---|---|
| `FUNCTIONS_WORKER_RUNTIME` | Tells the runtime to use Node.js | Bicep (app settings) |
| `FUNCTIONS_EXTENSION_VERSION` | Functions runtime version (~4) | Bicep |
| `WEBPUBSUB_CONNECTION_STRING` | Authenticates with Web PubSub to generate tokens and broadcast | Bicep (from `webPubSub.listKeys()`) |
| `STORAGE_CONNECTION_STRING` | Reads/writes state.json in blob storage | Bicep (from `storageAccount.listKeys()`) |
| `AzureWebJobsStorage` | Internal Functions runtime storage (triggers, locks) | Bicep (separate storage account) |
| `APPLICATIONINSIGHTS_CONNECTION_STRING` | Sends logs/telemetry to Application Insights | Bicep |

## Project Structure

```
wedding-page/
├── frontend/           # SvelteKit SPA (adapter-static)
│   ├── src/
│   │   ├── lib/
│   │   │   ├── types.ts        # Shared types (AppState, ListItem, WsMessage)
│   │   │   └── websocket.ts    # WebSocket client (negotiate, connect, send)
│   │   └── routes/
│   │       └── +page.svelte    # Main page (gift registry + guest list)
│   └── static/
│       └── staticwebapp.config.json  # SWA routing config
├── api/                # Azure Functions (Node.js v4 programming model)
│   ├── src/
│   │   ├── index.ts             # Entry point (registers functions)
│   │   └── functions/
│   │       ├── negotiate.ts     # POST /api/negotiate — returns wss:// URL
│   │       └── eventhandler.ts  # POST /api/eventhandler — upstream handler
│   ├── host.json                # Functions runtime config
│   └── local.settings.json      # Local environment variables (gitignored)
├── infra/              # Azure infrastructure
│   ├── main.bicep      # All Azure resources
│   └── deploy.sh       # Build + deploy script
└── .github/
    └── workflows/
        └── deploy.yml  # CI/CD pipeline
```

## Prerequisites

- [Node.js 22](https://nodejs.org/)
- [Azure CLI](https://learn.microsoft.com/cli/azure/install-azure-cli)
- [Azure Functions Core Tools v4](https://learn.microsoft.com/azure/azure-functions/functions-run-local) (`npm i -g azure-functions-core-tools@4`)
- [SWA CLI](https://github.com/Azure/static-web-apps-cli) (`npm i -g @azure/static-web-apps-cli`)

## Local Development

You need **three terminals** running simultaneously:

```bash
# Terminal 1 — API (Function App, logs visible here)
cd api && npm ci && func start

# Terminal 2 — Web PubSub tunnel (routes cloud events to local API)
awps-tunnel run \
  --hub wedding \
  --endpoint "https://<your-pubsub>.webpubsub.azure.com" \
  --upstream http://localhost:7071 \
  -s <subscription-id> \
  -g rg-wedding-page

# Terminal 3 — Frontend + SWA proxy
swa start
```

Then open http://localhost:4280.

The `swa start` command:
- Starts the Vite dev server on `:5173` (hot reload)
- Proxies `/api/*` to `:7071` (your local Function App)
- Serves on `:4280` with SWA behavior (routing rules, etc.)

The `awps-tunnel` is needed because Web PubSub runs in Azure and needs to reach your local eventhandler for `connect`/`connected`/`disconnected` events and user messages.

## Deployment

### Manual (from your machine)

```bash
# Full deploy (infra + app)
./infra/deploy.sh

# App only (skip Bicep)
./infra/deploy.sh -s
```

### CI/CD (GitHub Actions)

Push to `main` triggers the workflow in `.github/workflows/deploy.yml`. It requires three repository secrets:

| Secret | Value |
|---|---|
| `AZURE_CLIENT_ID` | App registration client ID |
| `AZURE_TENANT_ID` | Azure AD tenant ID |
| `AZURE_SUBSCRIPTION_ID` | Subscription ID |

These use [Workload Identity Federation](https://learn.microsoft.com/azure/active-directory/workload-identities/workload-identity-federation) (OIDC) — no passwords to rotate.

## Azure Resources

All resources are defined in `infra/main.bicep`:

| Resource | SKU | Purpose |
|---|---|---|
| Static Web App | Standard | Hosts SPA, proxies `/api/*` to Function App |
| Function App | B1 (Basic) | API endpoints (negotiate, eventhandler) |
| App Service Plan | B1 | Hosting plan for Function App (always-on, no cold starts) |
| Web PubSub | Free F1 | Real-time WebSocket messaging |
| Storage Account (app) | Standard LRS | Persists `state.json` in blob storage |
| Storage Account (func) | Standard LRS | Internal Functions runtime storage |
| Application Insights | Per-GB | Logging and telemetry |
| Log Analytics Workspace | Per-GB | Backing store for App Insights |

### Why Standard SWA (not Free)?

The Free SWA tier does not support linked backends (bring-your-own Function App). Standard is required for the `linkedBackends` feature.

### Why two storage accounts?

Azure Functions requires its own storage account for internal bookkeeping (trigger state, locks, etc.). The app data storage account holds the `state.json` blob. Separating them avoids conflicts and makes it clear what each is for.

### Why B1 instead of Consumption (Y1)?

Consumption plan has 5-15 second cold starts for Node.js, which makes the WebSocket connection flow painfully slow. B1 is always-on (~€12/mo) with no cold starts.
