# Endpoint Inventory — Cloudflare Full Optimization

## Inventory Scope
- Backend API routes (Express): `src/server/routes/cloudflare.ts`, mounted via `src/server/routes/index.ts`
- Worker client/fallback URLs: `src/utils/cloudflareClient.ts`, `src/utils/syncService.ts`
- Health and D1 bridge touchpoints: `src/utils/health.ts`, `src/utils/d1Adapter.ts`
- Dashboard/CLI references: chat modes + edge status callsites

---

## 1) Backend API (canonical Node entry)
A Cloudflare route modul a `createV1Router()`-ben kerül felcsatolásra:
- `/api/v1/cloudflare/*`
- `/api/cloudflare/*` (compat alias)

### Implementált endpointok
- `GET /cloudflare/config`
- `GET /cloudflare/agents`
- `POST /cloudflare/agents/:workerId/task`
- `GET /cloudflare/status`
- `POST /cloudflare/task`
- `GET /cloudflare/status/:taskId`
- `GET /cloudflare/history`
- `POST /cloudflare/chat`

Megjegyzés: a route-fájlban az endpointok `router.*` formában vannak definiálva, az API prefixet a router mount adja.

---

## 2) Worker-side expected endpoints (kliens elvárás)
A backend kliens és proxy logika alapján az orchestrator worker felé elvárt útvonalak:
- `GET /health`
- `POST /task`
- `GET /status/:id`
- `GET /history`

Chat sync elvárt worker útvonal:
- `GET /chat/messages`
- `POST /chat/messages`

D1 bridge elvárt útvonal:
- `POST /d1/query`

---

## 3) URL források és fallback láncok

### Orchestrator/task/history/status
- `CLOUDFLARE_D1_WORKER_URL`
- fallback: `CLOUDFLARE_WORKER_URL`
- fallback default: `https://cean-orchestrator.iam-dd1.workers.dev`

### Chat route/proxy
- `CLOUDFLARE_CHAT_URL`
- fallback: `CLOUDFLARE_D1_WORKER_URL`
- fallback: `CLOUDFLARE_WORKER_URL`
- fallback: `CLOUDFLARE_CHAT_SYNC_URL`
- fallback default: `https://llm-chat-app-template.iam-dd1.workers.dev`

### Sync service
- `CLOUDFLARE_CHAT_SYNC_URL`
- fallback: `CLOUDFLARE_CHAT_URL`
- fallback: `CLOUDFLARE_WORKER_URL`
- fallback default: `https://bas-orchestrator.peterpohankapersonal.workers.dev`

---

## 4) Inkonzisztencia pontok (Phase 2/3 input)
1. Többszörös URL fallback lánc chat és task útvonalra (drift veszély).
2. `CLOUDFLARE_CHAT_URL` és `CLOUDFLARE_CHAT_SYNC_URL` szerepkör részben átfed.
3. Egyes helyeken `CLOUDFLARE_WORKER_URL` még generikus catch-allként működik.
4. Auth header policy több helyen ismétlődik (`Authorization`, `X-BAS-API-Key`, `X-CEAN-API-Key`).

Ezeket a következő fázisban egy központi contract + env policy szerint kell egységesíteni.
