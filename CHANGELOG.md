# Changelog - Brunella Agent System (BAS)

## [2026-01-30] - Revízió, biztonság és tesztstabilitás

### 🔒 Biztonság
- **vm2 eltávolítva:** A kritikus CVE-ket tartalmazó, elavult vm2 sandboxot subprocess-alapú futtatás váltotta a `pipeline_self_healing_gen` toolban (temp fájl + `child_process.spawn` timeouttal).
- **Path traversal javítva:** A `monitor_tail_logs` tool `path.resolve` + `path.relative` ellenőrzéssel biztosítja, hogy a log fájl a `logs/` alatt maradjon.
- **SQL injection kiküszöbölve:** Az `AgentManager.executePlan` task lekérdezés paraméterezett (`?` placeholderek) lett.

### 🔧 Javítva (Fixed)
- **Config:** `workspaceRoot` és `systemLogDir` mostantól `BRUNELLA_WORKSPACE_ROOT` / `BRUNELLA_SYSTEM_LOG_DIR` env változókból vagy `process.cwd()` alapján.
- **Fetch timeoutok:** Az Ollama és AnythingLLM API hívásokhoz (`/api/ollama/*`, `/api/anythingllm/*`) `AbortSignal.timeout` került.
- **PythonShell:** `exec` timeout (60s) és `maxBuffer` beállítva.
- **Monitor tool:** Zod schema egyszerűsítve (`.describe()` eltávolítva) az MCP SDK kompatibilitás érdekében.

### 🧪 Tesztek
- **`scripts/test_prepare.cjs`:** Új script; biztosítja a `test_build` és `logs` mappákat.
- **Tesztfuttatás:** `npm test` a Core Tools (node --test) és a Monitor teszteket (ts-node) futtatja; a PythonShell tesztek `npm run test:python`-nel futtathatók (.venv szükséges).
- **Pytest:** `test_dependencies` már nem követeli a `pytest_cov` dev függőséget.

### 📦 Függőségek
- **vm2** eltávolítva a `package.json`-ból.

---

## [2026-01-30] - Skálázási javaslatok megvalósítva

### ✅ Elvégzett javaslatok (REPORT_REVISION)
1. **Vitest** – `vitest.config.ts`, `test/smoke.vitest.ts`, `test/monitor.vitest.ts`, `npm run test:vitest`.
2. **CI (GitHub Actions)** – `.github/workflows/ci.yml`: Node build + `npm test`, Vitest, Pytest (`myai/tests`), PythonShell tesztek (.venv).
3. **Health check** – `src/utils/health.ts`: strukturált válasz (`HealthResponse`), retry + timeout (env: `HEALTH_*`), naplózás. `/api/health` ezt használja.
4. **CORS whitelist** – `CORS_ORIGINS` (vesszővel elválasztva). Üres = `*`. Middleware + Socket.IO.
5. **Kulcsok ellenőrzése** – `validateSecrets()` induláskor; figyelmeztet, ha pl. `ANYTHINGLLM_API_KEY` hiányzik. Kihagyható: `BRUNELLA_SKIP_SECRETS_CHECK=1`.
6. **Rate limiting** – `express-rate-limit` a `/api` alatt. Env: `RATE_LIMIT_WINDOW_MS`, `RATE_LIMIT_MAX_PER_WINDOW`.
7. **Structured logging** – `Logger.structured(level, message, meta)` JSON sorokkal; HTTP middleware `requestId` + structured request log (`http.log`).
8. **Pipeline** – `PIPELINE_SANDBOX_TIMEOUT_MS` env; opcionális erősebb izoláció dokumentálva.

### 🔧 Egyéb
- **PythonShell** – `.venv/bin/python` Linuxon, `.venv/Scripts/python.exe` Windows-on.
- **README** – „Környezeti változók” táblázat bővítve.
- **Dashboard** – Health API kompatibilitás az új `services.*.status` formátummal.

---

## [2026-01-30] - Dashboard & System Integration Complete

### 🚀 Hozzáadva (Added)
- **Backend REST API Endpoints:**
  - `/api/health` - System health check (Ollama, AnythingLLM, Agents, MCP)
  - `/api/agents` - Agent list and execution endpoints
  - `/api/tasks` - Task queue management (GET/POST)
  - `/api/ollama/*` - Ollama models and generation
  - `/api/anythingllm/*` - Workspace list and RAG chat
  - `/api/chat/messages` - Chat history
  - `/api/tools/*` - Tool list and execution

- **Dashboard UI Components:**
  - `SystemHealthCard.tsx` - Real-time health monitoring (15s refresh)
  - `AnythingLLMIntegration.tsx` - Workspace selector + RAG interface
  - `apiService.ts` - Centralized API communication module
  - `useDashboardData.ts` - Automatic data initialization hook

- **Integration Features:**
  - Ollama connectivity check és model listing
  - AnythingLLM workspace management from Dashboard
  - Agent system fully connected to UI
  - Socket.IO real-time updates (metrics, agents, tasks)

### 🔧 Javítva (Fixed)
- **TypeScript Type Safety:** node-fetch type annotations fixed
- **Duplicate Code:** Removed duplicate functions in `useMCP.ts`
- **Health Check:** Added async health check functions for external services
- **Dashboard Layout:** Grid layout for Overview tab (SystemHealth + AnythingLLM)

### 📋 Dokumentáció
- **`DASHBOARD_INTEGRATION_REPORT.md`** - Teljes integrációs riport elkészítve
  - API végpontok dokumentálva
  - Frontend komponensek leírva
  - Indítási útmutató
  - Hibaelhárítási útmutató

### ✅ Build Status
- Backend build: 0 hiba
- Dashboard build: 9.10s, sikeres
- TypeScript type check: Passed

---

## [2026-01-29] - Infrastructure & CLI Stabilization

### 🚀 Hozzáadva (Added)
- **Automatizált Start Script:** `start.bat` mostantól kezeli az Ollama, AnythingLLM és MCP Szerver indítását.
- **Brunella CLI Conductor Integráció:** `/conductor:status` és `/conductor:setup` parancsok implementálva a CLI-be.
- **Rendszer Dokumentáció:**
  - `konyvtarfa.md`: Automatizált könyvtárszerkezet térkép.
  - `Toolskeszlet.md`: MCP eszközök és CLI parancsok leltára.
  - `mag.md`: Rendszer-szintű kontextus és útvonal-térkép.
- **Swarm Ingestion:** `swarm_ingest` tool (Playwright + Python Refiner) webes adatgyűjtéshez.

### 🔧 Javítva (Fixed)
- **CLI Entry Point:** A `bin` beállítás a `package.json`-ben most helyesen a `build/cli.js`-re mutat.
- **Build Rendszer:** `src/cli.ts` helyes fordítása és `src/cli` mappa konfliktus feloldása.
- **GitHub Sync:** A `.tmp.driveupload` miatti push hiba javítva (repo history tisztítás).
- **TypeScript Fordítás:** PowerShell karakterkódolási hibák (`backtick`) kiküszöbölése a fájlírásoknál.

### ⚙️ Infrastruktúra
- **Python Környezet:** Helyes `.venv` és `python.exe` útvonalak beállítása a configban.
- **Logging:** Abszolút útvonalak használata a Python scriptekben a `System32` írási hibák elkerülésére.
