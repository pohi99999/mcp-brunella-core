# Plan — Test Infrastructure Stabilization

## Status: ACTIVE | Priority: HIGH | Assignee: Copilot

## Leírás
A teszt infrastruktúra stabilizálása: törött tesztek javítása, pre-commit/pre-push hook optimalizáció, flaky teszt izoláció.

## Phase 1 — Törött tesztek javítása
- [ ] `cloudflare_integration.test.ts` 3 hibás teszt javítása (checkStatus headers assertion)
- [ ] Minden `--no-verify` nélkül is zöld CI biztosítása

## Phase 2 — test:fast finomítás
- [ ] `lint_fixer.test.ts` kizárása test:fast-ból (6x ESLint futtatás a teljes src/-n)
- [ ] `robotkez_integration.test.ts` kizárása test:fast-ból (lassú, külső függőség)
- [ ] test:fast futási idő < 2 perc cél

## Phase 3 — Flaky teszt izoláció
- [ ] Flaky tesztek azonosítása (3x futtatás, eltérő eredmény)
- [ ] Izolált retry mechanizmus konfigurálása vitest-ben

## Definition of Done
- [ ] `npm test` 0 failing test
- [ ] `npm run test:fast` < 2 perc
- [ ] Pre-commit hook < 3 perc
