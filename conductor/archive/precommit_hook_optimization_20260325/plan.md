# Plan — Pre-commit Hook Optimalizáció

## Status: COMPLETED | Priority: MEDIUM | Assignee: Copilot

## Leírás

Jelenlegi pre-commit: build + teljes teszt suite = ~10 perc. Cél: pre-commit < 1 perc, pre-push = teljes suite.

## Phase 1 — Pre-commit egyszerűsítés ✅

- [x] `.husky/pre-commit` átírás: csak `npm run build` + `npm run lint` (tesztek nélkül)
- [x] Staged fájlok alapú lint megoldva saját `scripts/precommit-lint.mjs` helperrel (`lint-staged` csomag nélkül)

## Phase 2 — Pre-push megtartás ✅

- [x] `.husky/pre-push`: `npm run build` + vitest (kizárásokkal)
- [x] test:fast kizárások bővítése: `lint_fixer.test.ts` is kizárva (ESLint spam)

## Phase 3 — Dokumentáció ✅

- [x] CONTRIBUTING.md-ben hook viselkedés dokumentálása

## Definition of Done

- [x] Pre-commit path build + staged lint only
- [x] Pre-push path gyorsított kizárásokkal fut
- [x] Fejlesztői élmény drasztikusan javul

## Validation

- [x] `.husky/pre-commit`
- [x] `.husky/pre-push`
- [x] `CONTRIBUTING.md` hook dokumentáció
