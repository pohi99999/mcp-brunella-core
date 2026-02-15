# RobotkezV2 - Full Comet Checklist

**Track ID:** `robotkezv2-full-comet-20260215`
**Created:** 2026-02-15
**Target:** 2026-02-22

---

## 📋 EPP v2 Rule #4 Compliance Checklist

### Phase 0: Pre-Implementation ✅

- [x] Track mappa létrehozva (`conductor/tracks/robotkezv2-full-comet-20260215/`)
- [x] `meta.json` elkészítve
- [x] `spec.md` elkészítve (Technical Specification)
- [x] `plan.md` elkészítve (Implementation Plan)
- [x] `checklist.md` létrehozva (ez a fájl)
- [ ] `diary.md` inicializálva
- [ ] `conductor/tracks.md` frissítve (Active track hozzáadása)
- [ ] Dependency audit (`npm audit`, `pip check`)
- [ ] **Build checkpoint:** `npm run build` ✅
- [ ] **Test checkpoint:** `npm test` ✅ (baseline)

---

### Phase 1: Jules Persistent Browser Integration ✅

#### 1.1 Python Controller Migration ✅
- [x] `myai/interactive_browser.py` áthozva `robotkezv2/jules_session/`-ből
- [x] `scroll` action implementálva
- [x] `wait` action implementálva
- [x] `extract` action implementálva
- [x] Manuális teszt (interactive_browser.py)
- [x] **Checkpoint:** Python syntax valid (`python -m py_compile myai/interactive_browser.py`)

#### 1.2 TypeScript Bridge Update ✅
- [x] `src/utils/persistentBrowser.ts` áthozva
- [x] `BrowserCommand` interface frissítve (új actions)
- [x] `BrowserResponse` interface frissítve (`data` field)
- [x] Error handling javítva (timeout, crash recovery)
- [x] **Checkpoint:** TypeScript compile ✅

#### 1.3 MCP Tools Registration ✅
- [x] `src/tools/persistentBrowserTools.ts` áthozva
- [x] `pb_scroll` tool regisztrálva
- [x] `pb_wait` tool regisztrálva
- [x] `pb_extract` tool regisztrálva
- [x] `src/server/registry.ts` frissítve (registerPersistentBrowserTools call)
- [x] **Checkpoint:** Server starts without errors

#### 1.4 Tests ✅
- [x] `test/persistentBrowser.test.ts` létrehozva
- [x] Navigate test ✅
- [x] Scroll test ✅
- [x] Wait test ✅
- [x] Extract test ✅
- [x] Screenshot test ✅
- [x] **Checkpoint:** `npm test` ✅ (all persistent browser tests pass)

---

### Phase 2: Core RobotkezV2Agent ✅

#### 2.1 Agent Class Implementation ✅
- [x] `src/agents/RobotkezV2Agent.ts` létrehozva
- [x] `BaseAgent` extend implementálva
- [x] `parseHungarianIntent()` method (regex-based)
- [x] `executeSimplePlan()` method (Phase 2 MVP)
- [x] `executeTask()` main entry point
- [x] Magyar nyelvű logging (logInfo, logError)
- [x] **Checkpoint:** Agent file compiles ✅

#### 2.2 Agent Registration ✅
- [x] `src/agents/registry.json` frissítve (RobotkezV2 entry)
- [x] `src/server/registry.ts` frissítve (RobotkezV2Agent import + register)
- [x] **Checkpoint:** Agent megjelenik `/api/agents` endpoint-on

#### 2.3 Unit Tests ✅
- [x] `test/robotkezV2Agent.test.ts` létrehozva
- [x] Intent parsing tests (navigate, search, click, type, screenshot)
- [x] `executeTask` mock tests
- [x] Error handling tests
- [x] **Checkpoint:** `npm test` ✅ (14/14 tests pass)

---

### Phase 3: LLM Planning ✅

#### 3.1 LLM Client Wrapper ✅
- [x] `src/utils/llmPlanner.ts` létrehozva
- [x] `generateExecutionPlan()` function
- [x] System prompt template (magyar instructions)
- [x] JSON response parsing + validation
- [x] Error handling (LLM hallucination, invalid JSON)
- [x] **Checkpoint:** Standalone LLM call test

#### 3.2 Agent Update (LLM Integration) ✅
- [x] `RobotkezV2Agent.executeTask()` frissítve (LLM planning)
- [x] `executeStep()` private method implementálva
- [x] Multi-step execution loop
- [x] Step-by-step logging
- [x] LLM fallback to Phase 2 simple parsing (error recovery)
- [x] **Checkpoint:** Agent compiles ✅

#### 3.3 LLM Mock Tests ✅
- [x] `test/llmPlanner.test.ts` létrehozva (17 tests)
- [x] Mock LLM responses (happy path)
- [x] Invalid JSON handling test
- [x] Hallucination detection test
- [x] Plan validation tests (executeStep requirements)
- [x] **Checkpoint:** `npm test` ✅ (17/17 pass, 100% coverage)

---

### Phase 4: Background Task Manager

#### 4.1 Task Manager Class ✅
- [x] `src/utils/backgroundTaskManager.ts` létrehozva
- [x] `BackgroundTaskManager` class implementálva
- [x] `startTask()` method (async execution)
- [x] `getTaskStatus()` method
- [x] `cancelTask()` method
- [x] In-memory task storage (Map<string, BackgroundTask>)
- [x] **Checkpoint:** Task manager compiles ✅

#### 4.2 Database Schema
- [ ] `src/utils/tasksDb.ts` frissítve (robotkez_background_tasks table)
- [ ] SQLite migration script
- [ ] Task persistence (save/load from DB)
- [ ] **Checkpoint:** DB migration sikeres

#### 4.3 Checkpoint System ✅
- [x] `createCheckpoint()` method (every 3 steps)
- [x] `loadLastCheckpoint()` method
- [x] `replaySteps()` method (Phoenix recovery)
- [x] **Checkpoint:** Checkpoint creation/load test

#### 4.4 Agent Integration
- [ ] `RobotkezV2Agent.executeInBackground()` implementálva
- [ ] Background task delegation (> 30s estimated duration)
- [ ] Task status polling (Socket.IO events)
- [ ] **Checkpoint:** Background task execution test (manual)

---

### Phase 5: REST API Endpoints

#### 5.1 Routes Implementation
- [ ] `src/server/routes/robotkezRoutes.ts` létrehozva
- [ ] `POST /api/v1/robotkez/chat` endpoint
- [ ] `POST /api/v1/robotkez/plan` endpoint (plan preview)
- [ ] `POST /api/v1/robotkez/exec` endpoint (direct action)
- [ ] `GET /api/v1/robotkez/status` endpoint
- [ ] `GET /api/v1/robotkez/tasks` endpoint (background tasks list)
- [ ] `GET /api/v1/robotkez/tasks/:id` endpoint (task status)
- [ ] `DELETE /api/v1/robotkez/tasks/:id` endpoint (cancel task)
- [ ] **Checkpoint:** All routes compile ✅

#### 5.2 Router Integration
- [ ] `src/server/routes/index.ts` frissítve (robotkezRoutes import)
- [ ] `src/server/web.ts` frissítve (router mount)
- [ ] **Checkpoint:** Server starts, routes accessible

#### 5.3 API Tests (Postman/cURL)
- [ ] Chat endpoint test (simple instruction)
- [ ] Plan endpoint test (plan preview without execution)
- [ ] Exec endpoint test (direct navigate)
- [ ] Status endpoint test
- [ ] Tasks list test
- [ ] Task cancel test
- [ ] **Checkpoint:** All API tests pass ✅

---

### Phase 6: Dashboard UI (Comet-style)

#### 6.1 Chat Component
- [ ] `src/dashboard/components/dashboard/RobotkezV2Chat.tsx` létrehozva
- [ ] Chat input + message history
- [ ] Comet-style message bubbles
- [ ] Typing indicator (loading state)
- [ ] **Checkpoint:** Chat component renders

#### 6.2 Execution Timeline
- [ ] Execution plan visualization (step-by-step progress)
- [ ] Step status icons (✅ completed, ⏳ running, ⚪ pending, ❌ error)
- [ ] Progress bar
- [ ] **Checkpoint:** Timeline updates dynamically

#### 6.3 Live Browser View
- [ ] Screenshot display (`/api/browser/snapshot`)
- [ ] Auto-refresh (2s interval)
- [ ] Toggle show/hide
- [ ] Current URL display
- [ ] **Checkpoint:** Live View frissül automatikusan

#### 6.4 Background Tasks Panel
- [ ] Background tasks dropdown
- [ ] Task list (active + completed)
- [ ] Task status badges
- [ ] Cancel button
- [ ] **Checkpoint:** Background tasks megjelennek

#### 6.5 Layout Integration
- [ ] `src/dashboard/components/dashboard/MissionControlLayout.tsx` frissítve
- [ ] Új tab: "Robotkéz V2"
- [ ] Route: `/robotkez`
- [ ] **Checkpoint:** Dashboard navigáció működik

---

### Phase 7: CLI Commands

#### 7.1 CLI Commands File
- [ ] `src/cli/robotkezCommands.ts` létrehozva
- [ ] `registerRobotkezCommands()` function
- [ ] `brunella robotkez chat <instruction>` command
- [ ] `brunella robotkez exec` command
- [ ] `brunella robotkez status` command
- [ ] `brunella robotkez screenshot` command
- [ ] `brunella robotkez tasks list` command
- [ ] `brunella robotkez tasks status <id>` command
- [ ] `brunella robotkez tasks cancel <id>` command
- [ ] `brunella robotkez interactive` command (REPL mode)
- [ ] **Checkpoint:** CLI file compiles ✅

#### 7.2 CLI Integration
- [ ] `src/cli.ts` frissítve (registerRobotkezCommands import + call)
- [ ] **Checkpoint:** `brunella robotkez --help` működik

#### 7.3 CLI Tests (Manual)
- [ ] `brunella robotkez chat "navigálj a google.com-ra"` teszt
- [ ] `brunella robotkez exec --action navigate --url https://google.com` teszt
- [ ] `brunella robotkez status` teszt
- [ ] `brunella robotkez interactive` teszt (REPL mode)
- [ ] **Checkpoint:** Minden CLI parancs működik ✅

---

### Phase 8: Integration Testing (E2E)

#### 8.1 E2E Test Scenarios
- [ ] **Scenario 1:** Google search ("Keress rá az AI hírekre")
- [ ] **Scenario 2:** Form fill ("Töltsd ki a nevet 'Test User'-rel")
- [ ] **Scenario 3:** Multi-step workflow ("Navigálj a google.com-ra, keress rá a 'TypeScript', kattints az első találatra")
- [ ] **Scenario 4:** Background task (long-running, > 30s)
- [ ] **Scenario 5:** Error recovery (selector not found)
- [ ] **Scenario 6:** LLM hallucination (invalid plan)
- [ ] **Scenario 7:** Browser crash recovery (Phoenix protocol)
- [ ] **Scenario 8:** Screenshot capture
- [ ] **Scenario 9:** Data extraction (extract text from page)
- [ ] **Scenario 10:** Parallel tasks (3+ background tasks)
- [ ] **Checkpoint:** All E2E scenarios pass ✅

#### 8.2 Performance Testing
- [ ] Plan generation < 3s (LLM response time)
- [ ] Single step execution < 2s (average)
- [ ] Screenshot capture < 500ms
- [ ] Dashboard load time < 2s
- [ ] **Checkpoint:** Performance targets met ✅

#### 8.3 Stress Testing
- [ ] 10+ parallel tasks without crash
- [ ] 100+ sequential steps without memory leak
- [ ] Browser restart after 50+ operations (Phoenix)
- [ ] **Checkpoint:** System stable under load ✅

---

### Phase 9: Documentation

#### 9.1 User Documentation (Magyar)
- [ ] `docs/robotkezv2-user-guide.md` létrehozva
- [ ] Használati példák (10+ scenario)
- [ ] CLI parancsok dokumentálása
- [ ] Dashboard UI guide (screenshots)
- [ ] Troubleshooting section
- [ ] **Checkpoint:** Docs review by user ✅

#### 9.2 Developer Documentation
- [ ] `docs/robotkezv2-dev-guide.md` létrehozva
- [ ] Architecture overview
- [ ] API reference (REST endpoints)
- [ ] Agent extension guide (custom actions)
- [ ] LLM prompt engineering tips
- [ ] **Checkpoint:** Dev docs complete ✅

#### 9.3 README Update
- [ ] `README.md` frissítve (RobotkezV2 section)
- [ ] Quick start guide
- [ ] Example usage
- [ ] Links to detailed docs
- [ ] **Checkpoint:** README review ✅

---

### Phase 10: Final Polish & Deployment

#### 10.1 Code Quality
- [ ] Eslint futtatás (`npm run lint`)
- [ ] Prettier futtatás (`npm run format`)
- [ ] TODO/FIXME comments tisztítása
- [ ] Dead code removal
- [ ] **Checkpoint:** Code quality tools pass ✅

#### 10.2 Bug Fixes
- [ ] Known bugs lista (GitHub Issues)
- [ ] P0/P1 bugs fixed
- [ ] P2 bugs triaged
- [ ] **Checkpoint:** Zero P0/P1 bugs ✅

#### 10.3 Performance Optimization
- [ ] LLM caching (repeated instructions)
- [ ] Screenshot compression
- [ ] Database indexing (background tasks)
- [ ] **Checkpoint:** Performance benchmarks green ✅

#### 10.4 Final Testing
- [ ] **Build:** `npm run build` ✅
- [ ] **Tests:** `npm test` ✅ (100% pass, 95%+ coverage)
- [ ] **Smoke test:** Full workflow (Dashboard + CLI)
- [ ] **User acceptance test:** Pohánka Péter approval ✅

---

## ✅ EPP v2 Final Checklist

- [ ] **Rule #1:** Track Required ✅ (track létrehozva)
- [ ] **Rule #2:** Fix Bugs ✅ (P0/P1 bugs fixed)
- [ ] **Rule #3:** Commit Often ✅ (minden fázis után commit)
- [ ] **Rule #4:** TODO List ✅ (ez a fájl frissítve)
- [ ] **Rule #5:** All Tests Green ✅ (`npm run build && npm test` pass)
- [ ] **Rule #6:** Dashboard + CLI ✅ (mindkettő implementálva)
- [ ] **Rule #7:** Final Docs ✅ (`.ai/claude.md` + `sync_foszal.py`)

---

## 🚀 Deployment Checklist

- [ ] `.env` frissítve (ROBOTKEZ_* változók)
- [ ] `config/robotkez.json` létrehozva (default config)
- [ ] Git commit (részletes üzenet)
- [ ] Git push (main branch)
- [ ] Production build test (`NODE_ENV=production npm run build`)
- [ ] Server restart test (uptime check)
- [ ] Dashboard live test (production URL)
- [ ] **Checkpoint:** Deployment successful ✅

---

## 📊 Success Metrics (Post-Deployment)

- [ ] 10+ example workflows work ✅
- [ ] LLM plan accuracy > 80% ✅
- [ ] Task success rate > 95% ✅
- [ ] Zero critical bugs (P0) ✅
- [ ] User feedback > 4.5/5 ✅

---

**Last Updated:** 2026-02-15
**Status:** ⚪ Not Started → Will update as work progresses
