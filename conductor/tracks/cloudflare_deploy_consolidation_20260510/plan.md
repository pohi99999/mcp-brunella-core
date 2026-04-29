# Plan — Cloudflare Deploy Consolidation (P3)

## Goal
4 cloudflare-related könyvtár szerepköri tisztázása + vendor copy azonosítása.

## Steps (audit-only)
1. ✅ 4 könyvtár inventory: apps/cloudflare-edge (8), bas-cloudflare-orchestrator (8), integrations/bas-cloudflare-orchestrator (673!), workers (4)
2. ✅ package.json compare → integrations/bas-cloudflare-orchestrator és top-level bas-cloudflare-orchestrator AZONOS név+verzió
3. ✅ Vendor flag check: integrations alatt saját node_modules + .wrangler + n8n + langflow + cloudflared
4. ✅ Findings dokumentum: docs/audits/legacy-drift-followups-20260429.md (P3 fejezet)
5. ✅ Track lezárás (status: completed, audit-only)

## Out of scope
- integrations/bas-cloudflare-orchestrator/ tényleges törlése (HIGH risk → user approval)
- wrangler.toml egységesítés (külön track: wrangler_pipeline_unify_20260512)

## Result
A 3 valódi cloudflare réteg (`apps/cloudflare-edge`, `bas-cloudflare-orchestrator`, `workers/`) **NEM duplikáció** — 3 különálló funkcionális komponens, 3 önálló élő CI workflow. Az `integrations/bas-cloudflare-orchestrator/` viszont **VENDOR DUPLIKÁTUM** (~700 fájl, saját node_modules), valószínűleg korábbi `git clone` vagy submodule maradvány — törlésre javasolt.
