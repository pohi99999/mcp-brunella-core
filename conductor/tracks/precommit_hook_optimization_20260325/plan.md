# Plan — Pre-commit Hook Optimalizáció

## Status: ACTIVE | Priority: MEDIUM | Assignee: Copilot

## Leírás
Jelenlegi pre-commit: build + teljes teszt suite = ~10 perc. Cél: pre-commit < 1 perc, pre-push = teljes suite.

## Phase 1 — Pre-commit egyszerűsítés ✅
- [x] `.husky/pre-commit` átírás: csak `npm run build` + `npm run lint` (tesztek nélkül)
- [ ] Opcionális: staged fájlok alapján lint-staged használata (`lint-staged` npm csomag)

## Phase 2 — Pre-push megtartás ✅
- [x] `.husky/pre-push`: `npm run build` + vitest (kizárásokkal)
- [x] test:fast kizárások bővítése: `lint_fixer.test.ts` is kizárva (ESLint spam)

## Phase 3 — Dokumentáció
- [ ] CONTRIBUTING.md vagy README.md-ben hook viselkedés dokumentálása

## Definition of Done
- [ ] Pre-commit < 1 perc (lint + build only)
- [ ] Pre-push < 3 perc (test:fast optimalizált kizárásokkal)
- [ ] Fejlesztői élmény drasztikusan javul
