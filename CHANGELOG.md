# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [Unreleased]

### Added

- **ContextFusion integration layer** (`src/core/contextFusion.ts`): New shared module that
  aggregates live signals from GraphRAG, ReflectionEngine, HybridMemory, and browser diagnostics
  into a single `ContextFusionCard`. Every subsystem call is individually guarded with try/catch
  so a failing subsystem returns `null` without blocking the card build. Exports:
  `buildContextFusionCard()`, `buildBrowserDiagnosticsCard()`, and all related interfaces.

- **AssistantBlueprint fusion field** (`src/core/assistantBlueprint.ts`): `getAssistantBlueprint()`
  now calls `buildContextFusionCard({ initGraphRag: false })` and attaches the result as
  `fusionCard?: ContextFusionCard` on the blueprint object — giving every consumer a pre-built,
  token-efficient context summary.

- **LLM Planner fusion context injection** (`src/utils/llmPlanner.ts`): `generateExecutionPlan()`
  now accepts `fusionContext?: string` in its options object. When provided, the fusion prompt is
  prepended to the planning context before the LLM call, enriching generated plans with real-time
  system state.

- **BrowserCopilot fusion-aware planning** (`src/services/BrowserCopilotSessionService.ts`):
  `BrowserCopilotDependencies` now accepts an optional `getFusionContext?: () => Promise<string>`
  callback. When provided, the session automatically fetches a fusion context snapshot and injects
  it into every `generateExecutionPlan` call. Fusion fetch errors never block plan generation.

- **`GET /api/assistant/context-fusion` route** (`src/server/routes/assistant.ts`): New endpoint
  that builds and returns a fresh `ContextFusionCard` as JSON, enabling dashboard polling and
  programmatic consumers.

- **Dashboard fusion metrics section** (`src/dashboard/components/dashboard/AssistantBlueprintPanel.tsx`):
  `AssistantBlueprintPanel` now renders a 3-column fusion stats grid (GraphRAG nodes/edges/lessons,
  Reflexió quality/health, Memória table count) when `blueprint.fusionCard` is present. Uses
  `GitMerge` and `Network` icons from lucide-react.

- **Dashboard API service fusion support** (`src/dashboard/lib/apiService.ts`): Added
  `ContextFusionCard` interface, `fusionCard?: ContextFusionCard` to the dashboard-local
  `AssistantBlueprint` type, and a `getContextFusion()` helper function.

- **CLI fusion view** (`src/cli.ts`): New `"Fúziós kontextus összefoglaló"` choice in the
  assistant interactive menu. Calls `printFusionCard(blueprint)` to display a formatted terminal
  table of all subsystem stats including GraphRAG, Reflexió, Memória, and browser diagnostics.

- **`myai/server.py` graceful startup** (`myai/server.py`): Replaced 7 bare top-level imports
  (`rag_service`, `refiner`, `browser_worker`, `dataset_manager`, `CometOrchestrator`,
  `CometTask`, `ActionMemory`) with individual `try/except` blocks and `HAS_*` feature flags
  (`HAS_RAG`, `HAS_REFINER`, `HAS_BROWSER_WORKER`, `HAS_DATASET_MANAGER`, `HAS_COMET`). The
  FastAPI server now starts successfully even when optional submodules are missing.

- **ContextFusion Vitest tests** (`test/contextFusion.test.ts`): 14 unit tests covering happy
  path, `initGraphRag: false` skip, `queryContext` invocation, `fusionPrompt` content, per-subsystem
  failure isolation, all-fail empty prompt, browser diagnostics fallback, and error-resilience of
  `buildBrowserDiagnosticsCard()`.

- **Reconciliation Events audit trail**(`src/data/bookkeeping_db.ts`): New `reconciliation_events`
  SQLite table with indexes on `run_id` and `tx_id`. Exported functions: `saveReconciliationEvent()`,
  `getReconciliationEvents(runId?, limit?)`, `getExceptionCount()`. Persistent, fault-tolerant record
  of every matching decision made by `MatchingAgent`.

- **Fuzzy matching in MatchingAgent** (`src/agents/MatchingAgent.ts`): New `fuzzyScore()` private
  method scores bank transaction / invoice pairs on amount similarity (exact +60 pts, near ±1% +20 pts),
  partner name (exact +25 pts, partial +15 pts, in-reference +10 pts), and date proximity (same-day
  +25 pts, ≤3 days +15 pts). `findMatch()` first tries the existing exact algorithm and then falls
  back to fuzzy (threshold ≥50 pts, confidence capped at 99). Fuzzy matches set task status to
  `PARTIALLY_MATCHED`.

- **Reconciliation event logging in MatchingAgent** (`src/agents/MatchingAgent.ts`): Every call to
  `executeTask()` generates a `runId` (UUID-style timestamp). A fault-tolerant `persistEvent()`
  helper writes a `ReconciliationEvent` row after each transaction decision; DB errors are caught and
  logged so they never abort a reconciliation run.

- **`GET /api/v1/bookkeeping/reconciliation-events` route** (`src/server/routes/bookkeeping.ts`):
  Returns all reconciliation events with optional `run_id` and `limit` query parameters. Response
  shape: `{ success, events, total, exceptionCount }`.

- **New types** (`src/types/bookkeeping.d.ts`): `ReconciliationOutcome` union type,
  `ReconciliationEvent` interface, and `ReconciliationEventInput` interface.

### Changed

- **BookkeepingWidget live status** (`src/dashboard/components/dashboard/BookkeepingWidget.tsx`):
  Widget now calls `getBookkeepingStatus` on mount and sets up a 30-second polling interval
  (`setInterval`) with proper `clearInterval` cleanup on unmount. Displays live total transaction
  count, pending count (`"Várakozó tételek: N"`), and exception count (`"Kivételek: N"`). Status is
  also refreshed after a successful reconciliation run.

### Tests

- Added 2 new fuzzy-matching tests to `test/MatchingAgent.test.ts`:
  `should return a FUZZY_MATCH when partner partially matches and amounts are identical` and
  `should NOT return a FUZZY_MATCH when score is below threshold`.

- Added 3 new reconciliation-events DB tests to `test/bookkeeping_db.test.ts` covering: save +
  retrieve, filter by `runId`, and exception counting.

- All 18 tests pass (16 backend + 2 dashboard widget). `tsc --noEmit` → 0 errors.
