# Env Responsibility Matrix — Cloudflare

## Cél
Központi forrás arról, mely Cloudflare env változó milyen szerepkörre szolgál.

## Canonical env policy (javasolt)

| Variable | Responsibility | Required | Notes |
|---|---|---:|---|
| `CLOUDFLARE_D1_WORKER_URL` | Orchestrator + D1 bridge base URL | ✅ | Elsődleges task/status/history/d1 célpont |
| `CLOUDFLARE_WORKER_URL` | Legacy/fallback worker URL | ⚠️ | Kompatibilitási fallback, fokozatosan kivezetendő |
| `CLOUDFLARE_CHAT_SYNC_URL` | Chat sync worker URL | ✅ | `/chat/messages` canonical célpont |
| `CLOUDFLARE_CHAT_URL` | Chat template/proxy URL | optional | Ha külön chat worker van |
| `CLOUDFLARE_API_TOKEN` | Auth token (Bearer + X-BAS-API-Key) | ✅ | `CF_API_TOKEN` alias támogatott |
| `CF_API_TOKEN` | Legacy alias token | optional | Csak visszafelé kompat miatt |
| `CEAN_API_KEY` | CEAN worker auth header | optional | `X-CEAN-API-Key` |
| `EDGE_ENABLED` | Edge dispatch feature flag | ✅ | `true` esetén /task routing aktív |
| `CLOUDFLARE_TUNNEL_ENABLED` | Tunnel feature flag | optional | Dashboard + route config |
| `CLOUDFLARE_TUNNEL_URL` | API tunnel entry | optional | BAS local exposure |
| `CLOUDFLARE_TUNNEL_N8N_URL` | n8n tunnel endpoint | optional | n8n remote access |
| `CLOUDFLARE_TUNNEL_BROWSER_URL` | Browser automation tunnel endpoint | optional | Robotkéz / browser bridge |
| `CLOUDFLARE_TUNNEL_DASHBOARD_URL` | Dashboard tunnel URL | optional | Settings panel link |
| `BAS_LOCAL_URL` | Worker→local callback target | optional | Cloudflare worker local backend proxy |

---

## Known alias/overlap risks

1. `CLOUDFLARE_WORKER_URL` több helyen catch-all fallbackként él.
2. `CLOUDFLARE_CHAT_URL` és `CLOUDFLARE_CHAT_SYNC_URL` szerepkör-átfedés lehetséges.
3. Token oldalon `CLOUDFLARE_API_TOKEN` + `CF_API_TOKEN` kettősség van.

---

## Recommended precedence

### Orchestrator (task/status/history/d1)
1. `CLOUDFLARE_D1_WORKER_URL`
2. `CLOUDFLARE_WORKER_URL`

### Chat sync
1. `CLOUDFLARE_CHAT_SYNC_URL`
2. `CLOUDFLARE_CHAT_URL`
3. fallback: orchestrator URL (csak emergency)

### Token
1. `CLOUDFLARE_API_TOKEN`
2. `CF_API_TOKEN`
