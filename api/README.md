# API — Azure Functions

The backend API for the wedding page, running on Azure Functions v4 (Node.js programming model v4).

## Functions

### `POST /api/negotiate`

Called by the frontend to get a WebSocket URL. Returns a `wss://` URL with an embedded access token that the browser uses to connect directly to Azure Web PubSub.

### `POST /api/lists/{list}/{action}`

Server-side list mutations. `list` must be one of `gifts`, `guests`, `cakes` and `action` must be one of:

- `add` body: `{ "name": "..." }`
- `checked` body:
      - gifts: `{ "id": "...", "gifterName": "..." }`
      - cakes: `{ "id": "...", "bakerName": "..." }`
      - guests: `{ "id": "...", "allergies": "..." }`
- `unchecked` body: `{ "id": "..." }`

Each mutation updates blob state and broadcasts an item-level delta event (`item-added`, `item-checked`, `item-unchecked`) over Web PubSub.

### `POST /api/eventhandler`

The upstream event handler for Azure Web PubSub. Web PubSub calls this endpoint (via HTTP, not WebSocket) whenever a client event occurs. Events are identified by the `ce-type` header:

| Event | `ce-type` header | What happens |
|---|---|---|
| **Connect** | `azure.webpubsub.sys.connect` | Accepts the WebSocket connection, confirms subprotocol |
| **Connected** | `azure.webpubsub.sys.connected` | Reads `state.json` from blob storage, sends it to the new client |
| **Message** | `azure.webpubsub.user.message` | Not used for app updates (handled by list HTTP endpoints) |
| **Disconnected** | `azure.webpubsub.sys.disconnected` | Logs the disconnection |

Also handles `OPTIONS`/`GET` requests for Web PubSub's abuse protection validation (returns `webhook-allowed-origin` header).

## Message Flow

```
Browser sends:
  POST /api/lists/{list}/{action}
        │
        ▼
  /api/lists/{list}/{action}
        │  1. read/modify/write state.json in blob storage
        │  2. pubsubClient.sendToAll({ type: "item-*", list, item })
        ▼
  Web PubSub broadcasts to all WebSocket clients
        │
        ▼
  All browsers receive delta updates and patch local state
```

## Environment Variables

| Variable | Description |
|---|---|
| `FUNCTIONS_WORKER_RUNTIME` | Must be `node` |
| `WEBPUBSUB_CONNECTION_STRING` | Web PubSub connection string (for generating tokens and broadcasting) |
| `STORAGE_CONNECTION_STRING` | Storage account connection string (for reading/writing `state.json`) |

For local development, these are set in `local.settings.json` (gitignored). In Azure, they're configured by Bicep as Function App application settings.

## Local Development

```bash
npm ci
func start
```

The API starts on `http://localhost:7071`. The SWA CLI proxies `/api/*` to this port.

You also need `awps-tunnel` running to receive Web PubSub upstream events locally — see the root README for details.

## Build & Deploy

```bash
# Build
npm ci && npm run build

# Deploy (zip deploy via Azure CLI)
npm ci --omit=dev
zip -rq /tmp/func.zip host.json package.json package-lock.json dist node_modules
az functionapp deployment source config-zip \
  --resource-group rg-wedding-page \
  --name <function-app-name> \
  --src /tmp/func.zip
```

Or use `./infra/deploy.sh` which handles this automatically.
