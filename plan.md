# ContextFusion Integration Layer — Plan

## 2026-04-09 Hook Infrastructure ✓

- [x] `src/core/hookEngine.ts` — `fireHooks()` orchestrator (circuit breaker + audit + DLQ); `skipCircuitBreaker`, `disabled`, `enabled` options
- [x] `src/core/hookAuditTrail.ts` — SQLite audit trail; `hook_executions` table; `recordHookExecution`, `getRecentExecutions`, `getFailureStats`
- [x] `src/core/hookDlq.ts` — DLQ with exponential backoff (60 * 5^attempt s, max 5 attempts); `pushToDlq`, `listDlqEntries`, `retryAllDlq`, `clearDlq`, `processDlqQueue`, `getRetryableCount`
- [x] `src/core/hookCircuitBreaker.ts` — standalone circuit breaker (threshold=3, cooldown=60s); `guardWithCircuitBreaker`, `getCircuitState`, `getAllCircuitStates`, `resetCircuit`, `resetAllCircuits`
- [x] `src/cli/hookCommands.ts` — `brunella hooks list/fire/status/enable/disable/dlq/circuit/audit`
- [x] `src/server/routes/hooks.ts` — 8 REST endpoints via `createHooksRoutes()`; registered under `/hooks`
- [x] `src/utils/hooks.ts` — re-export barrel + `listHookDefinitions()` helper
- [x] `src/core/hookRegistry.ts` — enhanced: priority, per-handler timeout, enable/disable, `force` option in `runHooks()`
- [x] `src/agents/BaseAgent.ts` — `fireHooks` wired at `SessionStart`, `BeforeModel`, `AfterModel`
- [x] `test/hooks.test.ts` — 39 tests; priority, timeout, enable/disable, audit, DLQ, circuit breaker state machine, engine integration, snapshots
- [x] `npm run build` → 0 TypeScript errors
- [x] `npx vitest run test/hooks.test.ts` → 39/39 tests pass
- [x] `CHANGELOG.md` updated

---


- [x] Golden mirror sync now retries through the Python incubator path when the D1 worker returns malformed/HTML responses, so legacy failed samples can be recovered safely.
- [x] Curated golden dataset normalization now migrates legacy `candidate` state to `pending` and automatically mirrors local golden samples into the approval queue.
- [x] MCP tool registration now wraps handlers with tool-run capture so successful tool executions start landing in `tool_runs` for later curation.
- [x] PAIOS voice configuration now exposes a first-class `voice` section, defaults to female Nova, and the orchestrator chat honors that config for backend TTS plus browser fallback.
- [x] Harvest pipeline now supports Apify targets without `url`, skips unnecessary browser boot for pure Apify runs, and respects both `output_dir` and `outputDir` config keys.
- [x] Validation completed: `npm run build`, `npx vitest run test/goldenDatasetBridge.test.ts test/paiosConfig.test.ts`, `python -m pytest myai/tests/test_tech_harvester.py`.

## Elvégzett munkák ✓

- [x] `src/core/contextFusion.ts` létrehozva — `buildContextFusionCard()`, `buildBrowserDiagnosticsCard()` exportálva; minden alrendszer hívás try/catch-vel védve
- [x] `src/core/assistantBlueprint.ts` kibővítve — `fusionCard?: ContextFusionCard` mező, `buildContextFusionCard({ initGraphRag: false })` hívás az építőben
- [x] `src/utils/llmPlanner.ts` kibővítve — `fusionContext?: string` opció a `generateExecutionPlan()` függvénybe; kontextus injektálás a prompt elé
- [x] `src/services/BrowserCopilotSessionService.ts` kibővítve — `getFusionContext?: () => Promise<string>` dep; fusion-aware plan closure
- [x] `src/server/routes/assistant.ts` — `GET /context-fusion` végpont hozzáadva
- [x] `src/dashboard/lib/apiService.ts` — `ContextFusionCard` interfész, `fusionCard` mező, `getContextFusion()` függvény
- [x] `src/dashboard/components/dashboard/AssistantBlueprintPanel.tsx` — 3 oszlopos fusion stats rács, `GitMerge`/`Network` ikonok
- [x] `src/cli.ts` — `"Fúziós kontextus összefoglaló"` menüpont, `printFusionCard()` helper
- [x] `myai/server.py` — 7 bare import cserélve `try/except` + `HAS_*` feature flag mintára
- [x] `test/contextFusion.test.ts` — 14 Vitest unit teszt (happy path, alrendszer hibák, browser fallback)
- [x] `npm run build` → 0 TypeScript hiba
- [x] `npm run test:fast` → 218 tesztfájl, 1956 teszt ÁTMENT, 0 regresszió
- [x] `CHANGELOG.md` frissítve
- [x] `plan.md` frissítve

## Opcionális/követő lépések

- [ ] `myai/server.py` route handlerek: `if not HAS_RAG: raise HTTPException(503)` védelmi feltételek hozzáadása a `rag_service` / `refiner` használó végpontokhoz
- [ ] BrowserCopilot session factory: `getFusionContext` alapértelmezett bekötése az inicializálásba (jelenleg opcionálisan kell `deps`-ben átadni)

---

## Korábbi CLI scripting és multi-agent orchestration — Elvégzett munkák

- CLI: `workflow run` parancs hozzáadva (JSON/YAML támogatás, egyszerű `steps` → belső DAG konverzió, elsődleges endpoint: `/api/v1/workflow/run`, fallback: `/api/v1/tasks/workflow/run`).
- Backend: `src/server/routes/workflow.ts` létrehozva — `/list`, `/status`, `/run` végpontok, delegál az `agentManager.executeWorkflow`-re és a `decomposeToDAGAsync`-re.
- Tesztek/build: `npm run build` sikeres; manuális futtatás indított példaworkflow-t (status: running).
