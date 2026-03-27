# Domain & Tunnel Rollout Checklist

## Phase 2 — Domain/Tunnel stabilizáció

- [x] Domain hostnames véglegesítése (prod/stage)
  - [x] `api.<domain>` terv: `api.bas.peterpohanka.com`
  - [x] `edge.<domain>` jelenlegi kanonikus host: `cean-orchestrator.iam-dd1.workers.dev`
  - [x] `chat.<domain>` jelenlegi kanonikus host: `bas-orchestrator.peterpohankapersonal.workers.dev`
- [x] DNS + Cloudflare route mapping dokumentálása
- [x] `CLOUDFLARE_D1_WORKER_URL` kanonikus host validálása
- [x] `CLOUDFLARE_CHAT_SYNC_URL` kanonikus host validálása
- [x] `CLOUDFLARE_WORKER_URL` fallback használat visszaszorítása

## Tunnel hardening
- [x] `CLOUDFLARE_TUNNEL_ENABLED=true` eset teljes health check
- [x] Fallback policy dokumentálása (`domain -> tunnel -> local`)
- [x] Tunnel endpointok (api/n8n/browser/dashboard) validálása *(connector online, custom DNS zone-reconciliation külön follow-up trackben)*

## Auth policy egységesítés
- [x] `Authorization: Bearer <token>` kötelező útvonalak listája
- [x] `X-BAS-API-Key` kompatibilitási policy
- [x] `X-CEAN-API-Key` használati kör szűkítése/egységesítése

## Smoke gates
- [x] `npm run smoke` PASS
- [x] `/api/v1/cloudflare/agents` PASS
- [x] `/api/v1/cloudflare/task` → `/status/:id` flow PASS
- [x] Chat sync (`/chat/messages`) roundtrip PASS
- [x] D1 bridge (`/d1/query`) PASS

## Deprecation / cleanup
- [x] Legacy route és URL alias lista lezárása
- [x] Deprecated változók és fallback-ek jelölése
- [x] Track progress + acceptance evidence rögzítése
