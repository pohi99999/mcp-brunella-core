# Acceptance Evidence — 2026-03-25

## Kódszintű javítások
- Központi Cloudflare config/auth resolver bevezetve: `src/utils/cloudflareConfig.ts`
- Kanonikus URL-feloldás átvezetve ide:
  - `src/utils/cloudflareClient.ts`
  - `src/utils/d1Adapter.ts`
  - `src/utils/health.ts`
  - `src/utils/cloudflareBrowser.ts`
  - `src/utils/kvCache.ts`
  - `src/utils/syncService.ts`
  - `src/server/routes/cloudflare.ts`
  - `src/server/routes/llm.ts`
  - `src/core/edgeHealthMonitor.ts`
  - `src/cli-edge.ts`
  - `src/agents/EdgeProxyAgent.ts`
- Legacy `/api/v1/cloudflare/agents` route-shadow megszüntetve (`src/server/routes/index.ts`)
- Cloudflare chat proxy HTML false-positive ellen keményítve
- Worker oldalon új `POST /d1/query` endpoint implementálva: `cloudflare/src/index.ts`

## Élő infra beavatkozások
- Remote D1 migration alkalmazva:
  - parancs: `wrangler d1 migrations apply bas-metadata --remote --config .\wrangler.jsonc`
  - eredmény: `0000_schema.sql` ✅
- Worker deploy végrehajtva:
  - parancs: `wrangler deploy --config .\wrangler.jsonc`
  - endpoint: `https://cean-orchestrator.iam-dd1.workers.dev`
  - version id: `3c3b2dce-2233-48db-96c4-b8afd68450d5`

## Validációs eredmények

### Build / smoke
- `npm run build` ✅
- `npm run smoke` ✅

### Közvetlen Cloudflare worker smoke
- `GET /health` on `cean-orchestrator` ✅
- `GET /history?limit=1` on `cean-orchestrator` ✅
- `POST /d1/query` (`SELECT 1 as ok`) on `cean-orchestrator` ✅
- `GET /chat/messages` on `bas-orchestrator` ✅

### Lokális gateway smoke (`http://localhost:3001/api/v1/cloudflare/*`)
- `GET /config` ✅
- `GET /agents` ✅ (7 worker inventory, 3 online a mérés pillanatában)
- `GET /history?limit=3` ✅
- `POST /task` → `GET /status/:id` ✅
- `POST /chat` ✅ (`pong`, endpoint: `https://cean-orchestrator.iam-dd1.workers.dev/ai/generate`)

## Következő ops follow-up

- Named tunnel connector elindult és Cloudflare felé regisztrált (`bas-tunnel`) ✅
- Custom domain DNS route automatizálása még blokkolt:
  - próbált parancs: `cloudflared tunnel route dns bas-tunnel api.bas.peterpohanka.com`
  - eredmény: `code: 10000, reason: Authentication error`
- A témára külön follow-up track készült: `cloudflare_dns_zone_reconciliation_20260325`

## Konklúzió
- A Cloudflare kódréteg, worker-réteg, D1 bridge és lokális API gateway konzisztensen működik.
- A custom-domain DNS binding kérdése külön zone-reconciliation ops feladatként leválasztva.