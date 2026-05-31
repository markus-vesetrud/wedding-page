# Wedding Page (Self-Hosted)

Real-time collaborative wedding planning app with:
- Gift list
- Guest list
- Cake list
- Live sync across browsers

This version runs without Azure services. It is designed for:
1. Running on your own machine with Docker
2. Optionally exposing it to the internet through Cloudflared

## Architecture

```text
Browser
  │
  ▼
HTTP + WebSocket
  │
  ▼
Docker container (Node.js)
  ├─ Serves built Svelte frontend
  ├─ REST API (/api/*)
  ├─ WebSocket endpoint (/ws)
  └─ JSON state persistence (/data/gifts.json, /data/guests.json, /data/cakes.json)

Append-only change logging is written to `/data/state-changes.log` with ISO timestamps.

Optional:
Cloudflared container -> Cloudflare Tunnel -> Public URL
```

## Project layout

- `frontend/` — SvelteKit UI
- `server/` — local backend (Express + ws + JSON file persistence)
- `docker-compose.yml` — local app (builds from Dockerfile)
- `docker-compose.tunnel.yml` — override for GHCR image + cloudflared
- `Dockerfile` — multi-stage build (frontend build + backend runtime)

## Quick start (local only)

Run only the app container:

```bash
docker compose up --build
```

Open:

```text
http://localhost:3000
```

State is persisted in a named volume: `wedding-data`.

## Optional: publish with Cloudflared

### 1) Create a Cloudflare tunnel token

In Cloudflare Zero Trust dashboard:
1. Create a tunnel
2. Add a public hostname (for example `wedding.yourdomain.com`)
3. Set service URL to `http://app:3000`
4. Copy the tunnel token

### 2) Export token locally

```bash
export CLOUDFLARED_TOKEN='your-token-here'
```

### 3) Start app + tunnel

```bash
docker compose -f docker-compose.yml -f docker-compose.tunnel.yml up -d
```

Then browse to your configured hostname.

## Common commands

```bash
# Start app only
docker compose up --build

# Start app + cloudflared
docker compose -f docker-compose.yml -f docker-compose.tunnel.yml up -d

# View logs
docker compose logs -f app
docker compose logs -f cloudflared

# Stop all services
docker compose down

# Stop and remove persisted app data
docker compose down -v
```

## Notes for learning from scratch

- API endpoints are in `server/src/server.js`
- Realtime uses plain WebSocket (`ws`) with broadcast on each list update
- Persistence is simple JSON file storage (`STATE_FILE` defines storage directory base; files are `gifts.json`, `guests.json`, `cakes.json`)
- Frontend still uses the same `/api/negotiate` and `/api/lists/*` contract, now served locally

## CI/CD to home server (Docker + SSH)

This repository includes `.github/workflows/deploy.yml` that does:
1. Build Docker image on GitHub Actions
2. Push image to GHCR (`ghcr.io/markus-vesetrud/wedding-page:latest`)
3. SSH to your home server and run `docker compose pull app && docker compose up -d app`

### Required GitHub repository secrets

- `HOME_SERVER_HOST` — server hostname or IP
- `HOME_SERVER_USER` — SSH user
- `HOME_SERVER_SSH_KEY` — private key for SSH (PEM/OpenSSH format)
- `HOME_SERVER_PORT` — SSH port (optional, defaults to 22)
- `HOME_SERVER_APP_DIR` — absolute path on server containing `docker-compose.yml`
- `GHCR_USERNAME` — GitHub username that can read GHCR package
- `GHCR_PAT` — Personal Access Token with `read:packages`
- `CLOUDFLARED_TOKEN` — optional, only if you want tunnel auto-start in deployment

### Files used for deployment mode

- `docker-compose.yml` uses local `Dockerfile` build (dev-friendly)
- `docker-compose.tunnel.yml` overrides app to GHCR image and adds cloudflared

On the home server, keep `docker-compose.yml` in `HOME_SERVER_APP_DIR` and run once manually:

```bash
docker login ghcr.io -u <GHCR_USERNAME>
docker compose -f docker-compose.yml -f docker-compose.tunnel.yml up -d
```

After that, each push to `main` will redeploy automatically.
