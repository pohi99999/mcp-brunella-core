# Worker Fleet Consolidation — 2026-03-25

## Kanonikus szerepkörök

### 1. `cean-orchestrator`
**Elsődleges felelősség:** edge orchestrator + task/status/history + D1 bridge + Workers AI generate

Kanonikus endpointok:
- `GET /health`
- `POST /task`
- `GET /status/:taskId`
- `GET /history`
- `POST /d1/query`
- `POST /ai/generate`

### 2. `bas-orchestrator`
**Elsődleges felelősség:** chat sync storage / app-facing sync channel

Kanonikus endpointok:
- `GET /chat/messages`
- `POST /chat/messages`

### 3. Tunnel layer (`bas-tunnel`)
**Elsődleges felelősség:** domain-alapú fallback a lokális BAS/N8N/Python szolgáltatásokhoz

Dokumentált ingress:
- `api.bas.peterpohanka.com` -> `localhost:3000`
- `n8n.bas.peterpohanka.com` -> `localhost:5678`
- `browser-use.bas.peterpohanka.com` -> `localhost:8000`

## Kivezetett drift-ek
- A Cloudflare route-ok már nem használnak szétszórt env-prioritásokat.
- A legacy `/api/v1/cloudflare/agents` shadow route megszüntetve.
- A chat proxy nem fogad el többé 200-as HTML login/landing page-et érvényes AI válaszként.

## Legacy / megfigyelendő elemek
- `CLOUDFLARE_WORKER_URL` továbbra is kompatibilitási fallback, de már nem elsődleges D1/task/history célpont.
- A custom-domain DNS route-olás külön Cloudflare zone-reconciliation follow-upként kezelendő.
