# Plan — system_grand_audit_20260429

## Fázis 0 — Stabilizáció ✅
- [x] Build baseline ellenőrzés → ZÖLD
- [x] Targeted vitest probe → 17/17 zöld
- [x] `.gitignore` bővítés Vite cache-re
- [x] Aktív track scaffold

## Fázis 1 — Refaktor zárás (folyamatban)
- [ ] C1 commit: `.gitignore` + Vite cache untracking
- [ ] C2 commit: `@packages/*` import refaktor (apps/ + tests/)
- [ ] C3 commit: track scaffold + audit jelentés

## Fázis 2 — Read-only Audit
- [ ] Route ↔ dashboard mapping (94 route ↔ 287 panel)
- [ ] PAIOS chat e2e flow ellenőrzés
- [ ] MCP autostart racionalizáció (17 entry → minimum)
- [ ] dashboard.bat smoke gap dokumentálás
- [ ] Cloudflare szétaprózottság konszolidációs javaslat

## Fázis 3 — Validáció
- [ ] `npm run build:stable` zöld
- [ ] `npm run test:fast` zöld
- [ ] `git push origin main` sikeres

## Fázis 4 — Lezárás
- [ ] Track meta status `completed` + DoD evidence
- [ ] `python ops/scripts/sync_foszal.py`
- [ ] Final checkpoint

## DoD kritériumok
- tests_pass: pending
- build_clean: ✅ true
- code_committed: pending
- no_verify_used: false (cél: nem használunk)
