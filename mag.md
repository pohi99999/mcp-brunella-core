# MAG - MCP Brunella Core Központi Dokumentáció

## Project Overview
Az MCP Brunella Core a Brunella rendszer központi MCP szervere, amely biztonságos hozzáférést biztosít a fájlrendszerhez, tudásbázishoz, rendszerparancsokhoz és webes tartalmakhoz. Támogatja az AI ágensek integrációját és valós idejű monitorozását.

## Technical Architecture
- **Monorepo szerkezet:** Node.js (TypeScript) szerver és React dashboard.
- **Backend:** Express.js, MCP SDK, FastMCP (Python), Socket.io.
- **Frontend:** React, Vite, Tailwind CSS, Radix UI.
- **Adattárolás:** LanceDB (vektoros), SQLite (metaadatok).
- **Biztonság:** Sandboxolt kód futtatás (vm2), korlátozott fájlműveletek.

## System Status
- **Node.js Tests:** Sikeres.
- **Python Tests:** Nincs tesztfájl, környezet OK.
- **E2E Tesztek:** ✅ SIKERES. A `scripts/e2e_runner.ts` ellenőrizte a Node.js szervert, a Python Automation szervert és a Google Workspace szervert. Minden rendszer működőképes.
- **CLI Rendszer:** ✅ SIKERES. A `scripts/test_cli.ts` verifikálta a `brunella` parancs működését (help, version, subcommands).
- **RAG (Tudásbázis):** ✅ TELJESEN MŰKÖDŐKÉPES. Az indexelő script (`scripts/index_knowledge.ts`) lefutott az Ollama (nomic-embed-text) segítségével. A szemantikus keresés verifikálva.
- **Integrációk:**
    - **Google Workspace:** `src/servers/google_workspace.py` (Gmail, Drive) implementálva. Hitelesítés `src/utils/google_auth.py`-n keresztül.
    - **Vertex AI:** `src/servers/vertex_ai.py` (Gemini modellek) implementálva.
    - **Feladatütemező (Scheduler):** `src/servers/automation.py` bővítve APScheduler-rel és SQLite perzisztenciával (`scheduler.db`).
- **Ismert problémák:**
    - PowerShell script futtatási szabályzata korlátozza az `npm` hívásokat.

## Development Log
### 2026.01.27 - Gemini-fication & Web UI 2.0 (Phase 1 - COMPLETE)
- **CLI Megújítása**: Teljesen újraírt `src/commands/chat.ts`, interaktív chat streaming támogatással és kontextuskezeléssel.
- **LLM Kliens**: Egységesített `LLMClient` osztály (`src/core/llm_client.ts`), amely támogatja az Ollama streaminget és a tool calling-ot.
- **Web UI Szinkronizáció**: A Dashboard (`src/server/web.ts`) mostantól ugyanazt a logikát használja, mint a CLI.
- **Auto-Connect**: Indításkor a rendszer automatikusan csatlakozik a konfigurált MCP szerverekhez (`mcp_servers.json`).
- **Magyar Modell**: Alapértelmezett modell váltása `llava-llama3:latest`-re a jobb magyar nyelvi támogatásért.

### 2026.01.26 - Agent Factory Core Implementation (Phase 3)
- `supervisor.ts`: Node.js alapú folyamatmenedzser létrehozása, amely kezeli az ügynökök indítását és a JSON-RPC kommunikációt StdIO csatornákon.

### 2026.01.26 - Agent Factory Core Implementation (Phase 2)
- `buap.ts`: TypeScript interfészek definiálása a BUAP protokoll üzeneteihez.
- `router.ts`: Alapvető Message Router implementálása, amely kezeli a regisztrációt és az üzenettovábbítást az `AgentsDB` segítségével.

### 2026.01.26 - Agent Factory Core Implementation (Phase 1)
- `agents_schema.sql`: SQLite séma definiálása az ügynökök, üzenetek és feladatok tárolására.
- `agents_db.ts`: `better-sqlite3` alapú adatbázis-kezelő osztály implementálása az állapotok perzisztálásához.

### 2026.01.26 - Agent Protocol Architecture (Phase 3 - KÉSZ)
- `prototype_example.md`: Konkrét példa ("Junior Python Developer") a teljes működési láncra (Manifest -> Router -> MCP -> UI).
- `terv.md` frissítése: Új "Agent Factory Roadmap" szekció felvétele.
- Lezárult a BUAP (Brunella Universal Agent Protocol) tervezési fázisa.

### 2026.01.26 - Agent Protocol Architecture (Phase 2)
- `runtime_design.md`: Folyamat-alapú (Process-based) futtatókörnyezet specifikálása (Supervisor szerepkör, életciklus).
- `integration_strategy.md`: Adapter minták kidolgozása külső keretrendszerekhez (LangGraph, AutoGen) és CoPilotKit "Generative UI" integrációs stratégia.
- `architecture_diagram.mermaid`: Rendszerkomponensek vizualizációja.

### 2026.01.26 - Agent Protocol Architecture (Phase 1)
- `agent_manifest_schema.json` létrehozása: Hibrid ügynök definíció (JSON + Script), CoPilot UI komponensek támogatása.
- `a2a_protocol_spec.md` létrehozása: Hub & Spoke architektúra, JSON-RPC alapú üzenetküldés, Handshake és Delegálási folyamatok definiálása.

### 2026.01.26 - Gemini CLI Bővítése (Phase 4 - KÉSZ)
- Interaktív menürendszer implementálása (`src/cli/index.ts`) az `inquirer` könyvtárral.
- Funkciók: Szerverek automatikus felderítése, Csatlakozás, Eszközök listázása, Módváltás (Safe/Full).
- Teljes integráció a `start.bat` szkripttől a Python és Node.js MCP szerverekig.
- A `gemini-cli` most már képes hibrid módon kezelni a projektben lévő eszközöket.

### 2026.01.26 - Gemini CLI Bővítése (Phase 3)
- `McpClientManager`: MCP szerverekhez való csatlakozás és eszközhívás megvalósítása az `@modelcontextprotocol/sdk` használatával.
- `ExtensionManager`: Bővítmények dinamikus felderítése és betöltési logikája.
- `DiscoveryService`: Automatikus szerver-felderítés (`src/servers` könyvtárból).

### 2026.01.26 - Gemini CLI Bővítése (Phase 2)
- `MemoryManager` implementálása a `.gemini/cli_memory.json` perzisztens tárolásához.
- `PythonBridge` osztály létrehozása a `.venv` környezetben lévő Python szkriptek futtatásához.
- Interaktív módválasztó (Safe/Full Access) integrálása az `inquirer` segítségével.
- Unit tesztek (`test/cli_unit.test.ts`) előkészítése.

### 2026.01.26 - Gemini CLI Bővítése és Finomítása (Phase 1)
- Új fejlesztési track indítása a CLI képességeinek kiterjesztésére.
- `src/cli/` struktúra kialakítása (Commander.js alapokon).
- `start.bat` gyorsindító szkript létrehozása.
- `package.json` bővítése a `cli` futtató paraccsal.

### 2026.01.26 - CLI Rendszer Validálása
- `scripts/test_cli.ts` létrehozása.
- Alapvető parancsok (help, version, tools, agents) sikeres tesztelése.
- `package.json` bővítése `test:cli` scripttel.

### 2026.01.26 - Vertex AI Integráció
- `google-cloud-aiplatform` csomag telepítése.
- `src/servers/vertex_ai.py` MCP szerver implementálása Gemini modell támogatással.
- Integrációs tesztelés E2E környezetben.

### 2026.01.26 - Tudásbázis Indexelése és RAG Javítás
- Ollama `nomic-embed-text` modell letöltése.
- `src/utils/rag.ts` javítása (lazy inicializálás a keresésnél).
- Teljes újra-indexelés valódi embeddingekkel.
- Szemantikus keresés sikeres verifikációja (`scripts/search_knowledge.ts`).

### 2026.01.26 - E2E Tesztelési Keretrendszer
- `scripts/e2e_runner.ts` létrehozása a teljes rendszer tesztelésére.
- Node.js és Python MCP szerverek párhuzamos tesztelése.
- Port ütközések és modul import hibák javítása.

### 2026.01.26 - Feladatütemező (Scheduler) Implementálása
- `apscheduler` és `sqlalchemy` telepítése.
- `src/servers/automation.py` átírása valódi ütemezővé.
- SQLite perzisztencia beállítása a feladatok megőrzéséhez.
- MCP eszközök: `schedule_reminder`, `list_scheduled_jobs`, `remove_scheduled_job`.

### 2026.01.26 - Google Workspace Integráció
- `google-api-python-client` és hitelesítési könyvtárak telepítése.
- `src/utils/google_auth.py` implementálása OAuth2 támogatással.
- `src/servers/google_workspace.py` MCP szerver létrehozása (Gmail küldés/olvasás, Drive listázás).

### 2026.01.26 - Fejlesztői Környezet Helyreállítása
- Python `.venv` törlése és újragenerálása.
- Függőségek (`requirements.txt`) sikeres telepítése.
- `package.json` teszt scriptek szétbontása (`test:build`, `test:run`) a jobb kompatibilitásért.

### 2026.01.26 - Projekt Inicializálása és Conductor Setup
- Conductor keretrendszer beállítása.
- Termékdefiníció, Tech Stack és Workflow rögzítése.
- Első track: Projekt Dokumentáció és Stabilitás megkezdése.
- `mag.md` létrehozása és alapinformációk rögzítése.
- **Rendszerellenőrzés:** Node.js tesztek rendben, Python környezet hibás.

