# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [Unreleased]

### Added

- **Python Copilot SDK environment alignment** (`pyproject.toml`, `uv.lock`): Added `github-copilot-sdk>=0.2.1` to the Python dependency manifest and lockfile so the `myai/` environment can follow the newer Copilot orchestration/runtime integration work without ad-hoc local installs.

- **Copilot Orchestrator + kernel pipeline observability surface** (`.github/agents/copilot-cli-orchestrator.agent.md`, `.github/agents/brunella-orchestrator.agent.md`, `src/core/{kernelTypes,conductor,intentRouter,planner,toolExecutor,guardrail,copilotOrchestratorBridge}.ts`, `src/server/routes/{copilotOrchestratorRoute,kernelRoute}.ts`, `src/dashboard/components/dashboard/{CopilotOrchestratorPanel,KernelPipelinePanel}.tsx`, `src/dashboard/lib/navigation.tsx`, `src/server/routes/index.ts`): Added a model-agnostic Copilot orchestration contract and a supervisor-style kernel pipeline surface. The backend now exposes in-memory orchestration session/step logs plus kernel run/status endpoints, and the dashboard gained dedicated panels for real-time Copilot delegation traces and the multi-stage kernel pipeline ledger.

- **P-Sales human-in-loop slice — persistent SQLite storage, pause/resume/audit/weekly-status endpoints** (`src/data/psales_db.ts`, `src/agents/StrategyPlannerAgent.ts`, `src/server/routes/psales-strategy.ts`, `src/dashboard/components/dashboard/PSalesStrategyPanel.tsx`, `test/integration/psales.strategy.integration.test.ts`): Replaced the in-memory strategy plan store with a persistent SQLite database (`better-sqlite3`) and extended the P-Sales strategy API with human-in-loop controls:
  - **`src/data/psales_db.ts`** (new): Complete persistence layer with two tables — `psales_strategy_plans` (planId, approvalState `pending|approved|rejected|paused`, JSON-serialised channels/segments/steps, resumeToken for stateless webhook callbacks) and `psales_audit_events` (full event log). Key exports: `initPSalesDb`, `closePSalesDb`, `insertStrategyPlan`, `getStrategyPlan`, `listStrategyPlans`, `updatePlanApprovalState`, `pauseStrategyPlan`, `resumeStrategyPlan`, `insertPSalesAuditEvent`, `listPSalesAuditEvents`, `getPSalesStatusSummary`. Automatically uses `:memory:` in test/CI environments.
  - **`src/agents/StrategyPlannerAgent.ts`** (modified): Removed in-memory `planStore = new Map()`. `createPlan` and `approvePlan` now persist via `psales_db` and write audit events on every state transition.
  - **`src/server/routes/psales-strategy.ts`** (modified): Expanded from 2 to 6 endpoints — `POST /plan` (201), `POST /approve` (200/400/404/409), `POST /pause` (200/400/404/409), `POST /resume` (200/400/404), `GET /audit` (200, optional `?planId=`, `?limit=`), `GET /weekly-status` (200, counts by state + last 10 audit events). All responses use `{ ok, ... }` shape; error bodies return `{ ok: false, error }`.
  - **`src/dashboard/components/dashboard/PSalesStrategyPanel.tsx`** (modified): Adapted to new `{ ok, plan }` API wrapper — `generatePlan` reads `data.plan`, `handleApproval` reads `data.plan`, error toasts on `ok: false`. Added `paused` state support (blue badge, `PauseCircle` icon). Added Pause button to the pending-plan action row (`handlePause` → `POST /pause`).
  - **`test/integration/psales.strategy.integration.test.ts`** (new): 30 integration tests (Vitest + supertest + `:memory:` DB) covering all endpoints, state transition guards (409), full create→pause→resume→approve lifecycle.

### Fixed

- **pytest Windows permission errors** (`myai/pytest.ini`, `myai/tests/conftest.py`, `myai/workers/lancedb_batch.py`, `myai/tests/test_media_factory.py`, `myai/tests/test_workers_lancedb_batch.py`, `myai/.gitignore`): Resolved all `PermissionError: [WinError 5] Access denied` failures on Windows by implementing a comprehensive fix:
  - Created `pytest.ini` configuration to use local `.pytest_tmp` directory instead of system TEMP (avoids Windows permission issues)
  - Added Windows-specific fixtures in `conftest.py` for proper cleanup and garbage collection
  - Fixed critical LanceDB connection leaks in `lancedb_batch.py` by adding `try...finally` blocks with explicit `db.close()` and garbage collection (prevents file locks on Windows)
  - Enhanced `tmp_campaigns_dir` fixture in `test_media_factory.py` to use `yield` pattern with explicit cleanup
  - Updated `test_batch_ingestion` to use isolated database paths via new `isolated_lancedb_path` fixture
  - All affected tests now pass consistently on Windows: 19 passed, 2 skipped (integration tests requiring external dependencies)
  - See `myai/PYTEST_WINDOWS_FIX_REPORT.md` for detailed root cause analysis and technical documentation

### Added — continued

- **HR onboarding dry-run helper split** (`src/utils/hrOnboardingDryRun.ts`, `src/server/routes/hrOnboarding.ts`, `src/dashboard/lib/hrOnboardingApi.ts`, `src/dashboard/components/dashboard/HROnboardingWidget.tsx`, `src/cli/commands/hr-onboarding-hu.ts`): Added a dedicated dry-run module wrapper and routed the dashboard, API, CLI, and HTTP flow through it so the HR onboarding slice has the requested file boundary.

- **Runtime learning + harvest hardening** (`src/core/goldenDatasetBridge.ts`, `src/server/registry.ts`, `src/config/paiosConfig.ts`, `src/server/routes/tts.ts`, `src/dashboard/components/dashboard/PAIOSOrchestratorChat.tsx`, `myai/agents/tech_harvester.py`): Golden mirror sync now falls back to the Python incubator when the D1 worker returns malformed HTML/JSON, curated golden samples normalize legacy `candidate` rows into `pending`, local golden samples automatically appear in the approval queue, MCP tools are now instrumented into `tool_runs`, PAIOS exposes/configures a Nova-first voice profile end-to-end, and the harvester safely supports Apify targets without `url` while avoiding unnecessary browser startup.

- **Conductor legacy task sync** (`conductor/tracks/system_wide_zero_mock_20260301`,
  `conductor/archive/*_research_*`, `conductor/archive/deep_market_research_20260227`,
  `conductor/archive/revenue_acceleration_20260227`): Audited the eight legacy root `tasks/*`
  folders and synchronized the missing historical/completed records into the conductor system.
  Added one new completed canonical track for the system-wide Zero-Mock/ReAct rollout and five
  archival entries for research-only or duplicate legacy task packs.

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

- **Modular state follow-up — LanceDB lifecycle + RAG route DI hardening** (`src/utils/lancedb_client.ts`, `src/server/routes/files.ts`, `conductor/project_state.json`, `conductor/tracks.md`, `conductor/tracks/modular_state_refactor_20260404/{meta.json,plan.md}`): Continued the `modular_state_refactor_20260404` track by moving the LanceDB module/connection cache behind `LanceDBClient` instance lifecycle (`dispose()` included), preserving the backward-compatible `lanceDBClient` / `invoiceStore` exports, and converting `/api/v1/rag/*` to an explicit dependency-injected route factory (`RagServiceDeps`, `DEFAULT_RAG_DEPS`) instead of per-request dynamic imports. The conductor state was synced to reflect the Phase 3 completion marker (50% progress).

- **Unknown-safe parsing follow-up in browser + wrangler utilities** (`src/utils/persistentBrowser.ts`, `src/utils/wranglerHelper.ts`): Replaced residual `safeJsonParse<any>` usage with `unknown`-based narrowing and local guard helpers so malformed browser-process / Wrangler CLI payloads no longer flow through these utility boundaries as unchecked `any` values.

- **Archived browser/wrangler helper follow-up track** (`conductor/archive/type_safety_followup_browser_wrangler_20260406/{meta.json,plan.md,spec.md}`): Moved the completed helper-only type-safety follow-up into the conductor archive after build verification, keeping the cleanup separated from the main DB/RAG type-safety slices while preserving the reasoning and acceptance notes for future contributors.

- **HR leave/timesheet audit hardening + logistics boundary split** (`src/server/routes/{hrLeave,hrTimesheet,index,logistics}.ts`, `test/{hrLeaveRoutes,hrTimesheetRoutes,logisticsRoutes}.test.ts`, `conductor/tracks/logistics_vertical_20260222/{meta.json,plan.md}`, `conductor/tracks/logistics_vertical_repo_local_20260407/{meta.json,plan.md,spec.md}`, `conductor/tracks/{kkv_hr_leave_approvals_20260405,kkv_hr_timesheet_culture_20260405}/meta.json`, `conductor/tracks/kkv_hr_leave_wait_resume_20260407/{meta.json,plan.md,spec.md}`, `conductor/tracks/kkv_hr_timesheet_export_and_alerts_20260407/{meta.json,plan.md,spec.md}`): The leave route now normalizes leave types, persists the submitted request, delegates the approval workflow to `DigitalHeadhunter`, records audit events, updates the job outcome, and opportunistically creates a calendar event when the agent reports `calendarSyncStatus: synced`. The timesheet route now records audit events on both success and failure paths. The related KKV HR tracks were advanced (`leave approvals` → active/70%, `timesheet culture` → active/35%) and two explicit follow-up tracks were created for wait/resume orchestration plus export/alerts gaps. Separately, the original cross-repo logistics track was archived because the PohiAIProt2 frontend is not present in this workspace, and a new repo-local follow-up track plus a read-only `/api/v1/logistics/*` status/capability surface were added to document the boundary cleanly. Focused validation: `npm run build` and `npx vitest run test/hrLeaveRoutes.test.ts test/hrTimesheetRoutes.test.ts test/logisticsRoutes.test.ts test/lancedb_client.test.ts test/ragRoutes.test.ts test/projectMaintainerRoutes.test.ts` → 22 passed.

- **RAG engine lifecycle isolation** (`src/utils/rag.ts`, `test/rag-engine.test.ts`): Refactored the LanceDB-backed RAG helper into an instance-scoped `RagEngine` with injectable loader/database path dependencies and an explicit `dispose()` lifecycle hook. `HybridMemory` now subclasses `RagEngine`, preserving the old public surface while avoiding shared module/connection globals and making the engine easier to test in isolation.

- **Runtime hardening follow-up + orchestration guardrail alignment** (`src/core/reactLoop.ts`, `src/agents/OrchestratorAgent.ts`, `test/reactLoop.test.ts`, `test/orchestratorReact.test.ts`, `test/guardrails/outputGuard.test.ts`, `test/universalOrchestratorService.test.ts`, `conductor/tracks/agent_runtime_hardening_20260406/{meta.json,plan.md,spec.md}`): Synced the completed runtime-hardening slice with the current orchestration flow, keeping the ReAct loop, guardrail/output-path checks, and conductor metadata aligned with the stabilized runtime contract.

- **Current type-safety + technical-debt cleanup batch** (`src/agents/{CampaignGeneratorAgent,ConflictMediatorAgent,DeveloperAgent,DigitalHeadhunterAgent,GrantWatcherAgent,KKVCrmAgent,LogisticsDispatcher,RobotkezV2Agent,SpecWriterAgent}.ts`, `src/utils/{db,inventoryDb}.ts`, `src/server/routes/kkvCrm.ts`, `src/server/services/kkvCrmService.ts`, `src/tools/crm_create_lead.ts`, `src/dashboard/{context/SocketContext.tsx,components/dashboard/MachineHunterWidget.tsx,store/systemSignalStore.ts,types/dashboard.ts}`, `src/{cli-hu.ts,cli.ts,cli/tracksCommands.ts,vendor.d.ts}`, `conductor/tracks/{type_safety_enforcement_20260404,technical_debt_cleanup_20260404}/*`): Removed additional unsafe casts and legacy typing shortcuts across the active cleanup batch, tightened KKV CRM and dashboard signal handling, and kept the relevant conductor tracks in sync with the verified progress markers.

- **BookkeepingWidget live status** (`src/dashboard/components/dashboard/BookkeepingWidget.tsx`):
  Widget now calls `getBookkeepingStatus` on mount and sets up a 30-second polling interval
  (`setInterval`) with proper `clearInterval` cleanup on unmount. Displays live total transaction
  count, pending count (`"Várakozó tételek: N"`), and exception count (`"Kivételek: N"`). Status is
  also refreshed after a successful reconciliation run.

### Tests

- Added focused regression coverage for the modular-state follow-up: `test/lancedb_client.test.ts` now verifies the instance-scoped LanceDB cache/dispose lifecycle and backward-compatible singleton exports, `test/ragRoutes.test.ts` exercises the dependency-injected `/api/v1/rag/*` surface, and the fast pre-push route coverage stayed aligned via `test/hrTimesheetRoutes.test.ts` and `test/projectMaintainerRoutes.test.ts`.

- Added or refreshed focused regression coverage for the runtime hardening, kernel/orchestrator, and type-safety cleanup slices (`test/{reactLoop,orchestratorReact,universalOrchestratorService}.test.ts`, `test/guardrails/outputGuard.test.ts`, `test/{DeveloperAgent,conflictMediatorAgent,digitalHeadhunterAgent,grantWatcherAgent,phase4_supply_chain,robotkezV2Agent}.test.ts`, `test/dashboard/components/{InventoryCatalog,InventoryRadarWidget}.test.tsx`, `src/dashboard/store/systemSignalStore.test.ts`).

- Added targeted regression coverage for the runtime fixes: `test/goldenDatasetBridge.test.ts` now verifies Python fallback during mirror sync, `test/paiosConfig.test.ts` now validates Nova voice defaults and invalid voice speed rejection, and `myai/tests/test_tech_harvester.py` covers Apify target execution without a `url` or browser bootstrap.

- Added 2 new fuzzy-matching tests to `test/MatchingAgent.test.ts`:
  `should return a FUZZY_MATCH when partner partially matches and amounts are identical` and
  `should NOT return a FUZZY_MATCH when score is below threshold`.

- Added 3 new reconciliation-events DB tests to `test/bookkeeping_db.test.ts` covering: save +
  retrieve, filter by `runId`, and exception counting.

- All 18 tests pass (16 backend + 2 dashboard widget). `tsc --noEmit` → 0 errors.
