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
- **E2E Tesztek:** ✅ SIKERES.
- **RAG (Tudásbázis):** Az indexelő script (`scripts/index_knowledge.ts`) elkészült. A projekt alapdokumentumai indexelve lettek a LanceDB-be. 
- **Ismert problémák:**
    - **Ollama hiányzik:** Az embedding szolgáltatás nem érhető el, ezért a szemantikus keresés jelenleg üres találatokat ad (null vektorok). Az indexelés újraindítása szükséges, ha az Ollama fut.
    - PowerShell script futtatási szabályzata korlátozza az `npm` hívásokat.

## Development Log
### 2026.01.26 - Tudásbázis Indexelése
- `scripts/index_knowledge.ts` létrehozása.
- Alapdokumentumok (`README`, `mag`, `conductor/*`) indexelése LanceDB-be.
- Szemantikus keresés tesztelése (üres eredmény az Ollama hiánya miatt).

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

