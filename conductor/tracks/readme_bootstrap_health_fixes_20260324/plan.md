# Plan — README Bootstrap & Health Fixek

- [x] Hibák gyökérokának feltárása a smoke, webhook, registry és health kódban.
- [x] Smoke script javítása portütközés ellen.
- [x] Webhook indulási logika zajcsökkentése opcionális config esetén.
- [x] Registry `version` mező kompatibilitás javítása.
- [x] Python health endpoint egységesítése `/health`-re.
- [x] Build + smoke + test újrafuttatása.
- [x] Runtime health újraellenőrzése.

## Validation — 2026-03-25
- `npm run build` ✅ (cloudflareConfig.ts duplikáció javítva)
- Smoke script: port conflict handling ✅
- Webhook: optional config noise reduction ✅
- Registry: version field compatible ✅
- Python `/health` endpoint: unified ✅
- Track COMPLETED ✅