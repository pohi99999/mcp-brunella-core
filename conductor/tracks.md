# Projekt Nyomkövetés (Tracks)

Ez a fájl követi nyomon a fő fejlesztési szálakat (tracks). Minden szál független egységként működik saját tervvel.

### ✅ Lezárt Szálak (Completed Tracks)

- [x] **CLI Gemini-fication & Developer Agent (2026-01-30):**
  - **Eredmény:** CLI teljesen újraírva (`src/cli.ts` + `src/interactive.ts`). Stabilitási javítások (Stdio mode). `DeveloperAgent` implementálva és regisztrálva. Orchestrator felokosítva.
  - 📂 *[./tracks/cli_gemini_fication_20260130/](./tracks/cli_gemini_fication_20260130/)*

- [x] **AI Evaluator & Self-Healing (2026-01-30):**
  - **Eredmény:** `EvaluatorAgent` implementálva (`src/agents/EvaluatorAgent.ts`). Képes auditálni (`/api/health`) és teszteket futtatni (`npm run test:vitest`). Regisztrálva a `registry.json`-ben.
  - 📂 *[./tracks/ai_evaluator_self_healing_20260130/](./tracks/ai_evaluator_self_healing_20260130/)*

- [x] **API Documentation & Swagger (2026-01-30):**
  - **Eredmény:** Swagger UI (`/api-docs`) integrálva. `swagger-jsdoc` alapú definíciók.
  - 📂 *[./tracks/docs_swagger_openapi_20260130/](./tracks/docs_swagger_openapi_20260130/)*

- [x] **Containerization & Docker Compose (2026-01-30):**
  - **Eredmény:** `Dockerfile.node`, `Dockerfile.python`, `docker-compose.yml` létrehozva.
  - 📂 *[./tracks/docker_containerization_20260130/](./tracks/docker_containerization_20260130/)*

- [x] **Python Subsystem Refactor (FastAPI/FastMCP) (2026-01-30):**
  - **Eredmény:** `myai/server.py` FastAPI szerver. `PythonShell` refaktorálva HTTP-kérés alapúra (+ fallback). `start.bat` frissítve.
  - 📂 *[./tracks/python_fastapi_refactor_20260130/](./tracks/python_fastapi_refactor_20260130/)*

- [x] **Test Infrastructure Consolidation (Vitest) (2026-01-30):**
  - **Eredmény:** Minden teszt (`node:test`) migrált Vitest-re. `test_build` mappa törölve. `npm test` = `vitest run`.
  - 📂 *[./tracks/test_consolidation_vitest_20260130/](./tracks/test_consolidation_vitest_20260130/)*

- [x] **Dashboard UI & Functionality Restoration (2026-01-30):**
  - **Eredmény:** 🎯 TÚLTELJESÍTVE! 17 REST API endpoint implementálva (health, agents, tasks, ollama, anythingllm, tools). Frontend architektúra újragondolva: apiService.ts, useDashboardData hook, SystemHealthCard (15s real-time monitoring), AnythingLLMIntegration (RAG interface). Runtime import hibák javítva. Build: 0 error (backend + frontend).
  - **Kulcsfunkciók:** Ollama connectivity check, AnythingLLM workspace management, Agent execution API, Socket.IO real-time updates.
  - **Runtime Setup:** `start.bat` automatizálja a teljes indítást (Ollama + AnythingLLM desktop app + Backend + Dashboard). Manuális: `ollama serve` + AnythingLLM.exe + `npm run dev` + `npm run dev:ui`.
  - 📂 *[./tracks/dashboard_restoration_20260130/](./tracks/dashboard_restoration_20260130/)* | [COMPLETION_REPORT.md](./tracks/dashboard_restoration_20260130/COMPLETION_REPORT.md) | [SYSTEM_STATE_ANALYSIS](../SYSTEM_STATE_ANALYSIS_20260130.md)

- [x] **Dashboard Integration & Control Center (2026-01-29):**
  - **Eredmény:** `src/server/web.ts` kibővítve (System Metrics, Agent Updates). Frontend (`src/dashboard`) ellenőrizve és sikeresen buildelve (`npm run build:ui`).
  - 📂 *[./tracks/dashboard_v2_20260129/](./tracks/dashboard_v2_20260129/)*

- [x] **Agent Swarm Core Implementation (2026-01-29):**
  - **Eredmény:** `AgentManager` refaktorálva. `DataScientist` és `Researcher` ügynökök implementálva és regisztrálva. A rendszer képes a "Swarm" logikára.
  - 📂 *[./tracks/agent_swarm_core_20260129/](./tracks/agent_swarm_core_20260129/)*

- [x] **Brunella CLI Verification & Parity (2026-01-29):**
  - **Eredmény:** `src/cli.ts` javítva, `package.json` bin korrigálva. Conductor parancsok (`status`, `setup`) implementálva. Memória és Tools funkciók tesztelve. Dokumentáció frissítve.
  - 📂 *[./tracks/cli_verification_20260129/](./tracks/cli_verification_20260129/)*

- [x] **Documentation & Infrastructure Synchronization (2026-01-29):**
  - **Eredmény:** Teljes rendszer-dokumentáció (`konyvtarfa.md`, `Toolskeszlet.md`, `mag.md`) automatizálva. GitHub szinkronizáció helyreállítva. `start.bat` integrálva Ollama/AnythingLLM-mel.
  - 📂 *[./tracks/docs_infra_sync_20260129/](./tracks/docs_infra_sync_20260129/)*

- [x] **Swarm Ingestion Foundation (2026-01-28):**
  - **Eredmény:** Harvester Swarm alapok kész. `swarm_ingest` tool implementálva (Playwright -> Python Refiner -> Knowledge Store). POC sikeresen lefutott.
  - 📂 *[./tracks/swarm_ingestion_20260128/](./tracks/swarm_ingestion_20260128/)*

- [x] **Comprehensive Testing & Fix (2026-01-28):**
  - **Eredmény:** Szigorú tesztelés sikeres. Javított hibák: `__dirname` ES modul hiba, hiányzó agent regisztráció, Ollama connectivity és .env betöltés.
  - 📂 *[./tracks/comprehensive_testing_20260128/](./tracks/comprehensive_testing_20260128/)*

- [x] **System Recovery & Refactor (2026-01-28):**
  - **Eredmény:** Build sikeres (0 hiba). Szerver elindul. Hiányzó modulok (LLM, ToolManager) stub-olva.
  - **Következő lépés:** Funkcionalitás visszaépítése (LLM kliens, MCP integráció).
  - 📂 *[./tracks/system_recovery_20260128/](./tracks/system_recovery_20260128/)*

- [x] **System Audit & Discovery (2026-01-28):**
  - **Eredmény:** 🔴 KRITIKUS HIBA feltárva. A build nem futott le, fájlstruktúra inkonzisztens volt.
  - 📂 *[./tracks/system_audit_20260128/](./tracks/system_audit_20260128/)*

### 🔧 Aktív Szálak (Active Tracks)

- [x] **Browser-Use Harvester with Structured JSON Output (2026-01-31):**
  - **Cél:** A `myai/browser_worker.py` továbbfejlesztése strukturált JSON adatgyűjtésre (Harvester) és JSON kimenetre Pydantic modellekkel.
  - 📂 *[./tracks/browser_use_harvester_20260131/](./tracks/browser_use_harvester_20260131/)*

- [x] **LangSmith Integráció & Observability (2026-01-31):**
  - **Eredmény:** LangSmith alapok és Browser-Use ágens híd implementálva. `myai/browser_worker.py` kész, Node.js híd (`browserBridge.ts`) stabilizálva. `swarm_ingest` és `swarm_browser_task` eszközök frissítve az új ágensre.
  - 📂 *[./tracks/langsmith_integration_20260130/](./tracks/langsmith_integration_20260130/)*

- [x] **Rendszerszintű leltár, takarítás, Dockerizálás és Brunella CLI ügynök integráció (2026-01-30):**
  - **Eredmény:** Teljes cleanup elvégezve, a gyökérkönyvtár tiszta. A dokumentáció centralizálva a `Brunella.md`-be. Docker Compose frissítve hibrid módhoz. `project_organizer` és `agent_architect` regisztrálva a rendszerbe és a Brunella CLI kiegészítve az `agents` paranccsal.
  - 📂 *[./tracks/system_cleanup_docker_20260130/](./tracks/system_cleanup_docker_20260130/)*

- [x] **Autonomous Reasoning & Orchestration (2026-01-29):**
  - **Eredmény:** `OrchestratorAgent` (LLM Planner) implementálva. Task Queue (SQLite) integrálva az `AgentManager`-be. `executePlan` és `startWorkerLoop` funkcionális. End-to-End folyamat (Plan -> Queue -> Execute) tesztelve.
  - 📂 *[./tracks/autonomous_reasoning_20260129/](./tracks/autonomous_reasoning_20260129/)*

---

### ⏳ Szüneteltetett / Integrált Szálak

- [x] **Dashboard & CLI SSE Fix (2026-01-27/28):**
  - *Átvezetve az Audit és Recovery szálakba.*