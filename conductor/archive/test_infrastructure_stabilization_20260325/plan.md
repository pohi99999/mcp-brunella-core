# Plan — Test Infrastructure Stabilization

## Status: COMPLETED | Priority: HIGH | Assignee: Copilot

## Leírás

A teszt infrastruktúra stabilizálása: törött tesztek javítása, pre-commit/pre-push hook optimalizáció, flaky teszt izoláció.

## Phase 1 — Törött tesztek javítása ✅

- [x] `cloudflare_integration.test.ts` hibás checkStatus assertion javítva
- [x] Minden `--no-verify` nélkül is zöld CI biztosítása

## Phase 2 — test:fast finomítás ✅

- [x] `lint_fixer.test.ts` kizárása test:fast-ból (6x ESLint futtatás a teljes src/-n)
- [x] `robotkez_integration.test.ts` kizárása test:fast-ból (lassú, külső függőség)
- [x] test:fast gyorsított exclude listával stabilan fut

## Phase 3 — Flaky teszt izoláció ✅

- [x] Flaky tesztek ellenőrizve — jelen validációban nem reprodukálható instabil teszt
- [x] Izolált retry mechanizmus konfigurálása vitest-ben (`VITEST_RETRY`)

## Definition of Done

- [x] `npm test` 0 failing test
- [x] `npm run test:fast` stabilan zöld
- [x] Pre-commit / pre-push hookok optimalizáltak és zöldek

## Validation

- [x] `npx vitest run test/cloudflare_integration.test.ts test/zeroPromptRoutes.test.ts test/agent_health_matrix.test.ts`
- [x] `npm run test:fast`
- [x] `npm test`
