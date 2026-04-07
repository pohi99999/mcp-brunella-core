# Implementációs Terv: Agent Runtime Hardening

## 1. Architektúra és scope

- [x] Meglévő beépítési pontok auditja (`BaseAgent`, `OrchestratorAgent`, `UniversalOrchestratorService`, `toolRunCapture`, `retryStrategy`).
- [x] Új conductor track létrehozása.

## 2. Runtime alaprétegek

- [x] `src/core/toolErrorClassifier.ts` létrehozása.
- [x] `src/core/reactLoop.ts` létrehozása.
- [x] `src/core/workingMemory.ts` létrehozása.
- [x] `src/core/outputGuard.ts` létrehozása.

## 3. Bekötések

- [x] `toolRunCapture.ts` bővítése error osztályozással.
- [x] `retryStrategy.ts` bővítése klasszifikáció-kompatibilis helperrel.
- [x] `BaseAgent.ts` guardrails és working-memory kontextus bővítése.
- [x] `OrchestratorAgent.ts` explicit ReAct scratchpad bekötése.
- [x] `UniversalOrchestratorService.ts` strukturált working memory bekötése.

## 4. Tesztek és validáció

- [x] Unit tesztek az új modulokra.
- [x] `npm run build`
- [x] célzott Vitest futtatás
- [x] `node build/cli.js conductor rescan`

## Megjegyzés

- A slice tudatosan az alap runtime rétegre fókuszál; a további agentek (pl. `DeveloperAgent`, `GitHubModelsAgent`) a következő iterációban migrálhatók a közös ReAct runtime-ra.
