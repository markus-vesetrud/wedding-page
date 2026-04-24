# Frontend — SvelteKit SPA

The wedding page frontend, built with SvelteKit 2 and Svelte 5, compiled to a static site using `@sveltejs/adapter-static`.

## Key Files

| File | Purpose |
|---|---|
| `src/routes/+page.svelte` | Main page — gift registry, guest list, and cake list with real-time sync |
| `src/lib/websocket.ts` | WebSocket client — negotiates connection, sends/receives state |
| `src/lib/types.ts` | Shared TypeScript types (`AppState`, `ListItem`, `WsMessage`) |
| `static/staticwebapp.config.json` | SWA routing — SPA fallback + API route permissions |

## How real-time sync works

1. On mount, the page calls `createWebSocket()` which POSTs to `/api/negotiate`
2. The API returns a `wss://` URL pointing to Azure Web PubSub
3. The browser opens a WebSocket with the `json.webpubsub.azure.v1` subprotocol
4. On connection, the server sends the current state (`{ type: "state", data: ... }`)
5. When a user modifies a list, the client calls `POST /api/lists/{list}/{action}`
6. The server persists the mutation and broadcasts an item-level delta update
7. All browsers patch their local list reactively via Svelte 5's `$state`

Mutations go through server HTTP endpoints (`add`, `checked`, `unchecked`) so the app avoids sending full list payloads for each change while still persisting to blob storage.

## staticwebapp.config.json

```json
{
  "navigationFallback": { "rewrite": "/index.html" },
  "routes": [{ "route": "/api/*", "allowedRoles": ["anonymous"] }]
}
```

- **`navigationFallback`**: Required for SPA routing — any unmatched path serves `index.html` so SvelteKit's client-side router handles it
- **`routes`**: Explicitly allows unauthenticated access to `/api/*`. Without this, the SWA would require authentication for API calls

## Development

```bash
npm ci
npm run dev    # Vite dev server on :5173
npm run build  # Static build to build/
```

During local dev, `swa start` proxies `/api/*` to `http://localhost:7071` (the local Function App).

## Build Output

`npm run build` produces a static site in `build/` which is deployed directly to the SWA. No server-side rendering — everything runs in the browser.

## Building

To create a production version of your app:

```sh
npm run build
```

You can preview the production build with `npm run preview`.

> To deploy your app, you may need to install an [adapter](https://svelte.dev/docs/kit/adapters) for your target environment.
