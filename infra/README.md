# Infrastructure

All Azure resources are defined in `main.bicep` and deployed with `deploy.sh`.

## Resources

### Static Web App (Standard)

Hosts the SvelteKit SPA. The Standard tier is required because the Free tier doesn't support **linked backends** — the feature that connects a standalone Function App to the SWA so `/api/*` requests are proxied.

The SWA has `skipGithubActionWorkflowGeneration: true` because we manage the CI/CD workflow ourselves.

### Function App + App Service Plan (B1)

A standalone Node.js 22 Function App on a Basic B1 plan. The B1 plan was chosen over Consumption (Y1) to eliminate cold starts (5-15 seconds on Consumption). B1 is always-on at ~€12/month.

**Linked backend**: The `Microsoft.Web/staticSites/linkedBackends` resource connects the Function App to the SWA. This has two effects:
1. The SWA proxies all `/api/*` requests to the Function App
2. The Function App rejects direct HTTP requests with 401 — only the SWA can call it

This second effect is why the **Web PubSub upstream URL must go through the SWA** (`https://<swa>/api/eventhandler`) rather than directly to the Function App (`https://<func>.azurewebsites.net/api/eventhandler`).

### Two Storage Accounts

| Account | Name pattern | Purpose |
|---|---|---|
| App data | `weddingst*` | Holds the `wedding-data` container with `state.json` |
| Functions runtime | `weddingfn*` | Internal Azure Functions storage (trigger state, leases, logs) |

These are separated to keep concerns distinct. Azure Functions writes frequently to its storage account for internal coordination — mixing this with app data could cause confusion when debugging.

### Azure Web PubSub (Free F1)

Manages WebSocket connections and message routing. Key configuration:

**Hub `wedding`** with:
- `anonymousConnectPolicy: allow` — clients don't need Azure AD tokens (they get access via the negotiate endpoint's short-lived JWT)
- `eventHandlers` — tells Web PubSub to forward `connect`, `connected`, `disconnected`, and all user events (`*`) to the upstream URL
- `urlTemplate` — points to `https://<swa>/api/eventhandler` (must go through SWA, see linked backend note above)

**Abuse protection**: When the upstream URL is configured, Web PubSub sends a preflight OPTIONS request to validate it. If this returns anything other than 200 with the `webhook-allowed-origin` header, all client connections will fail. The eventhandler function handles this.

### Application Insights + Log Analytics

Provides logging, tracing, and metrics for the Function App. Connected via the `APPLICATIONINSIGHTS_CONNECTION_STRING` app setting. Logs can be streamed with:

```bash
az functionapp log tail --name <func-name> --resource-group rg-wedding-page
```

## deploy.sh

The deployment script handles the full flow:

1. Checks Azure CLI login
2. Creates resource group + deploys Bicep (or skips with `-s`)
3. Builds frontend (SvelteKit) and API (TypeScript)
4. Zip deploys Function App via `az functionapp deployment source config-zip`
5. Deploys frontend to SWA via SWA CLI

```bash
./deploy.sh           # Full deploy (infra + app)
./deploy.sh -s        # Skip infra, deploy app only
./deploy.sh -g my-rg  # Custom resource group
./deploy.sh -l eastus # Custom location
```

## What's not strictly necessary

| Config | Verdict | Notes |
|---|---|---|
| `cors: { allowedOrigins: ['*'] }` on Function App | **Not needed** | The SWA proxy handles CORS. Direct browser→Function App requests are blocked by the linked backend (401). Could be removed. |
| `WEBSITE_NODE_DEFAULT_VERSION` app setting | **Redundant** | `nodeVersion: '~22'` in `siteConfig` already sets this. Both exist for belt-and-suspenders compatibility. Could remove one. |
| `buildProperties` on SWA | **Not needed in production** | Only used if deploying via the SWA GitHub Action's built-in build. Since we pre-build and deploy artifacts, these properties are informational only. |
| `api/.funcignore` | **Not needed** | The deploy script explicitly lists files to include in the zip rather than using funcignore exclusions. |
