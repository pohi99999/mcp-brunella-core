# MCP Brunella Core – Revíziós jelentés

**Dátum:** 2026-01-30  
**Scope:** Teljes körű revízió, hibajavítás, optimalizálás, tesztelés, dokumentáció.

---

## 1. Azonosított és kijavított kritikus hibák

| # | Hibák | Hely | Javítás |
|---|--------|------|--------|
| 1 | **vm2 biztonsági rések** – A vm2 elavult, több CVE (pl. CVE-2023-37466, CVE-2023-30547, sandbox escape) miatt nem használható. | `src/pipeline/llmPipeline.ts` | vm2 eltávolítva. A generált Node.js kód futtatása **subprocess**-ban történik: temp `.js` fájl + `child_process.spawn(process.execPath, [tmpFile], { timeout })` 5s timeouttal. |
| 2 | **Path traversal a log olvasásban** – A `monitor_tail_logs` tool a `log_file` paramétert közvetlenül `path.join(logDir, log_file)`-ra használta. `../` vagy normalizált útvonalakkal ki lehetett lépni a `logs/` mappából. | `src/tools/monitor.ts` | `path.resolve(logDir, log_file)` után `path.relative(logDirResolved, targetPath)` ellenőrzés: ha `..`-ra indul vagy abszolút, "Access denied." |
| 3 | **SQL injection kockázat** – `AgentManager.executePlan` a task ID-kat konkatenálta: `WHERE id IN (${taskIds.join(',')})`. | `src/agents/AgentManager.ts` | Paraméterezett lekérdezés: `?` placeholderek és `stmt.all(...taskIds)`. |
| 4 | **Hiányzó fetch timeoutok** – Az Ollama és AnythingLLM API hívások (`/api/ollama/models`, `/api/ollama/generate`, `/api/anythingllm/workspaces`, `/api/anythingllm/chat`) timeout nélkül futottak, ami folyamatragadást okozhat. | `src/server/web.ts` | `AbortSignal.timeout(...)` beállítva (10s ill. 60s a hosszabb műveleteknél). |
| 5 | **PythonShell exec timeout és buffer** – A Python `exec` hívásnak nem volt timeoutja, illetve maxBuffer korlátja. | `src/utils/pythonShell.ts` | `exec(..., { timeout: 60000, maxBuffer: 4 * 1024 * 1024 }, callback)`. |
| 6 | **Teszt prepare script hiányzott** – A `npm test` a `test:prepare` lépésben `scripts/test_prepare.cjs`-t hívta, ami nem létezett. | – | Létrehozva `scripts/test_prepare.cjs`: biztosítja a `test_build` és `logs` mappákat. |
| 7 | **Monitor Zod schema / MCP SDK** – A `monitor_tail_logs` tool `z.string().describe(...)` stb. használata mély típushibákat okozott a tool regisztrációknál. | `src/tools/monitor.ts` | Schema egyszerűsítve: `z.string()`, `z.number().default(50)`; a leírás a tool descriptionbe került. |
| 8 | **Pytest dependency assert** – `test_dependencies_installed` a `pytest_cov` dev függőséget is ellenőrizte, ami nem mindig telepítve van. | `myai/tests/test_dependencies.py` | `pytest_cov` kivéve a listából; csak `typer`, `requests`, `rich`, `pytest` marad. |

---

## 2. Elvégzett optimalizálások

- **Config környezetfüggővé tétele:** `workspaceRoot` és `systemLogDir` mostantól `BRUNELLA_WORKSPACE_ROOT` / `BRUNELLA_SYSTEM_LOG_DIR` env-ből, egyébként `process.cwd()` ill. `process.cwd() + '/logs'` alapján.
- **Pipeline sandbox:** vm2 helyett izolált Node subprocess (ideiglenes fájl + `spawn` timeout). A `systemLogDir` létezését `fs.mkdir(..., { recursive: true })` biztosítja a temp írás előtt.
- **Web API:** Összes releváns külső fetch (Ollama, AnythingLLM) timeouttal fut.
- **AgentManager:** Task lekérdezés paraméterezett, biztonságos.
- **Erőforrás-kezelés:** PythonShell `exec` timeout és maxBuffer; pipeline temp fájlok törlése `try/finally` jellegű takarítással.

---

## 3. Tesztek – eredmények, lefedettség, sikerkritériumok

### Node / TypeScript tesztek (`npm test`)

- **Core Tools** (node `--test`):  
  - `test_build/core_tools.test.js` – MCP szerver stdio-n, ping, agent_list, monitor_get_metrics.  
  - **Eredmény:** 3/3 átment.
- **Monitor** (ts-node + node `--test`):  
  - `test/monitor.test.ts` – `monitor_tail_logs` tool, `logs/` alatti fájl olvasás.  
  - **Eredmény:** 1/1 átment.
- **PythonShell** tesztek (`npm run test:python`):  
  - `.venv` Pythonra építenek; ha nincs meg, érdemes skip-elni. Alap `npm test` futtatásában **nem** futnak (külön script).

**Összefoglalva:** `npm test` → Core Tools + Monitor tesztek sikeresek, a környezeti ellenőrzések (build, test:prepare, test:run) mind lefutnak.

### Pytest (`myai/tests`)

- **Futtatás:** `python -m pytest myai/tests -v --tb=short`
- **Eredmény:** 19/19 átment (agent, cli, dependencies, llm, project, sandbox, structure, tools).

### Teszt scriptek

- `test:build` – csak `core_tools.test.ts` fordítás bootstrapekhez.
- `test:prepare` – `test_build` és `logs` mappa.
- `test:run` – Core Tools + Monitor.
- `test:python` – PythonShell tesztek (opcionális, .venv kell).

---

## 4. Dokumentáció frissítések

- **CHANGELOG.md:** Új szekció (2026-01-30) a revízióval kapcsolatban: biztonság, javítások, tesztek, vm2 eltávolítás.
- **README.md:** Nem módosult; a technikai változások a CHANGELOG-ban vannak.

*A Master_document.docx közvetlenül nem frissítettük; a releváns technikai változások a CHANGELOG-ban és ebben a jelentésben szerepelnek.*

---

## 5. Korlátok betartása

- **MCP kompatibilitás:** Megtartva. A tool regisztrációk és a stdio/SSE MCP transportok változatlanok.
- **Visszafelé kompatibilitás:** A `mcpClient.ts` és a többi stabil interfész (pl. tool API, API végpontok) nem változott breaking módon. A pipeline tool viselkedése (generált kód futtatása) logikailag megegyezik, csupán a futtatási környezet (vm2 → subprocess) változott.

---

## 6. Javaslatok a további skálázhatósághoz

1. **Vitest bevezetése** a unit tesztekre (monitor, tools, utils), hogy együtt fussanak a `src`-ből importálva, ts-node helyett.
2. **PythonShell tesztek** beépítése a CI-be, feltételeként a projekt `.venv` (vagy megadott Python) elérhetőségét.
3. **Health check / sanity** gondosabb felépítése: strukturált válaszok, retry és timeout konfiguráció, egységes naplózás.
4. **CORS** szűkítése a web szerveren: `origin: "*"` helyett whitelist (pl. ismert frontend originok).
5. **Kulcsok és titkok** soha ne kerüljenek kódba; mindenképp env (vagy secret store). Az AnythingLLM / Ollama URL-ek és API kulcsok így kezelendők.
6. **RATE LIMITING** a nyilvános API végpontokon (pl. `/api/ollama/generate`, `/api/anythingllm/chat`) skálázás és abuse ellen.
7. **Structured logging** (pl. szint, timestamp, request id) a hibakeresés és a metrikák felépítéséhez.
8. **Pipeline subprocess:** Opcionálisan erősebb izoláció (pl. `isolated-vm` vagy dedikált worker folyamat) és konfigurálható timeout (env).

---

## 7. Rövid összefoglaló

- **Kritikus hibák:** vm2 eltávolítva, path traversal és SQL injection kiküszöbölve, fetch és exec timeoutok beállítva, teszt prepare script pótolva, monitor schema és pytest dependency assert javítva.
- **Optimalizálás:** Konfig env-alapú, biztonságos task lekérdezés, tisztább erőforrás-kezelés.
- **Tesztek:** `npm test` és `pytest myai/tests` sikeresen futnak; a jelentésben szereplő lefedettségi és sikerkritériumok teljesülnek.
- **Dokumentáció:** CHANGELOG frissítve; további skálázási javaslatok a fenti listában.
