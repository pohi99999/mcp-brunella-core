# MCP Brunella Core

Központi MCP szerver a Brunella rendszer számára, amely biztonságos és felügyelt hozzáférést biztosít a fájlrendszerhez, tudásbázishoz, rendszerparancsokhoz és webes tartalmakhoz.

## Funkciók

### Core Tools
-   **Workspace Tool:** Biztonságos fájlműveletek a `Brunella_es_en` könyvtárban.
-   **Knowledge Tool:** Keresés és kontextusépítés a projektekből és tudásbázisból (LanceDB RAG).
-   **System Tool:** Whitelistelt parancsok futtatása (`ls`, `dir`, verzióellenőrzés) naplózással.
-   **Interpreter Tool:** Python és Node.js kód futtatása sandboxolt környezetben (VM2).
-   **Browser Tool:** Biztonságos HTTP GET kérések Playwright-tal (lokális hálózat tiltva).

### AI Agent Integration
-   **Copilot CLI Tool:** GitHub Copilot CLI integráció
-   **Jules CLI Tool:** Jules AI agent workflow automatizáláshoz
-   **Ollama Tool:** Local LLM futtatás Ollama-val
-   **Claude Tool:** Anthropic Claude API integráció
-   **AnythingLLM Tool:** AnythingLLM platform integráció dokumentum menedzsmenthez

### Advanced Features
-   **LLM Pipeline:** Önjavító pipeline Generate → Test → Fix → Test ciklussal
-   **Google Workspace:** Drive, Gmail, Calendar integráció OAuth2-vel
-   **Health Check:** Rendszerállapot ellenőrző segédprogram
-   **Web Interface:** Socket.IO alapú webes felület

### New: Optimization & Management
-   **Tool Registry:** Intelligens eszköz menedzsment és triggering (ProcessLasso, CrystalDiskInfo, HWiNFO)
-   **Query Router:** Python alapú intelligens eszköz kiválasztás task és rendszerállapot alapján
-   **Agent Orchestrator:** AI ügynökök delegálása és priorizálása (Gemini, Claude, Jules)
-   **Task Triggers:** YAML alapú automatizált trigger rendszer CPU/memory/IO monitorozáshoz
-   **Maintenance Tools:** Automatikus tisztítás, health check, és status report szkriptek

## Telepítés és Használat

### 1. Telepítés
```bash
# Függőségek telepítése
npm install

# Build
npm run build
```

### 2. Konfiguráció

Másold le és konfiguráld a környezeti változókat:
```bash
cp .env.example .env
```

Szerkeszd a `.env` fájlt és állítsd be:
- `ANYTHINGLLM_API_KEY` - AnythingLLM API kulcs
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` - Google Workspace hitelesítéshez
- `CLAUDE_API_KEY` - Claude API kulcs (opcionális)
- `PROCESS_LASSO_PATH`, `CRYSTAL_DISK_INFO_PATH`, `HWINFO_PATH` - Eszköz útvonalak

A `config.yaml` fájl tartalmazza a központi konfigurációt:
- Workspace beállítások
- Biztonsági limitek
- Monitorozási küszöbértékek
- Engedélyezett eszközök

### 3. Regisztráció a Gemini CLI-ben

Add hozzá az alábbi konfigurációt a `.gemini/settings.json` fájlod `mcpServers` szekciójához:

```json
{
  "mcpServers": {
    "mcp-brunella-core": {
      "command": "node",
      "args": [
        "F:\\OneDrive\\Desktop\\Brunella_es_en\\02_PROJECTS\\[ACTIVE]_mcp-brunella-core\\build\\index.js"
      ],
      "env": {
        "NODE_ENV": "production"
      }
    }
  }
}
```

### 4. Futtatás

```bash
# Indítás production módban
npm start

# Development módban
npm run dev

# Health check futtatása
npm run healthcheck

# Vagy közvetlenül:
bash status_report.sh    # Linux/Mac
.\healthcheck.ps1        # Windows

# Cleanup futtatása
npm run cleanup

# Tesztek futtatása
npm test
```

## Új Funkciók Használata

### Tool Registry

A `tools_registry.json` fájl tartalmazza az elérhető eszközök definícióit:

```json
{
  "ProcessLasso": {
    "path": "C:\\Tools\\ProcessLasso\\lasso.exe",
    "trigger": {
      "cpu_threshold": 80,
      "requires_llm_active": true
    }
  }
}
```

### Query Router (Python)

Intelligens eszköz kiválasztás task alapján:

```bash
# Eszköz kiválasztása task-hoz
python3 python_modules/query_router.py optimize_cpu --cpu=85 --llm-active

# Kód generálás ügynök kiválasztása
python3 python_modules/query_router.py code_generation
```

### Agent Orchestrator (Python)

AI ügynökök menedzsmentje:

```bash
# Ügynökök listázása
python3 python_modules/agent_orchestrator.py list

# Megfelelő ügynök kiválasztása
python3 python_modules/agent_orchestrator.py select code_review

# Task delegálása
python3 python_modules/agent_orchestrator.py delegate automation "Create backup script"
```

### Task Triggers

A `task_trigger.yaml` tartalmazza az automatikus trigger szabályokat:

```yaml
tasks:
  - name: "LLM futtatás optimalizálás"
    trigger:
      conditions:
        - type: threshold
          metric: cpu_load
          operator: ">"
          value: 80
    tools:
      - ProcessLasso
```

## Dokumentáció

- `README.md` - Ez a fájl, gyors áttekintés
- `knowledge_base.md` - Részletes dokumentáció minden modulról
- `TEST_REPORT.md` - Átfogó teszt riport
- `config.yaml` - Központi konfiguráció
- `tools_registry.json` - Eszköz definíciók
- `task_trigger.yaml` - Trigger szabályok
- `CONDUCTOR_PLAN.md` - Fejlesztési roadmap
- `INTEGRATION_PLAN.md` - Integrációs terv
- `SECURITY.md` - Biztonsági irányelvek

## Logolás

A rendszer parancsok és események naplózása a `logs/` könyvtárban:
- `system_commands.log` - Rendszer parancs végrehajtások
- `health_status.json` - Health check eredmények
- `task_triggers.log` - Trigger események
- `brunella.db` - SQLite adatbázis

## Biztonsági Jellemzők

- A szerver csak a konfigurált `workspaceRoot` alatt engedélyez fájlműveleteket
- Érzékeny fájlok (pl. `.env`, `_br_secrets`) olvasása tiltott
- A kód futtatás idő- és méretkorlátokkal rendelkezik (VM2 sandbox)
- Whitelistelt parancsok csak verzióellenőrzéshez
- Teljes műveleti naplózás
- Path traversal védelem
- Lokális hálózat hozzáférés tiltva böngészőben

## Rendszer Követelmények

### Szoftver
- Node.js >= 18.x
- npm >= 8.x
- Python 3.x (Python modulokhoz)
- TypeScript 5.x

### Hardver (Ajánlott)
- CPU: 4+ magok (AMD Ryzen 7 vagy jobb)
- RAM: 16GB+ (32GB ajánlott LLM futtatáshoz)
- Tárhely: 50GB+ szabad hely
- GPU: RTX 3060 vagy jobb (opcionális, local LLM-hez)

### Monitoring Tools (Opcionális)
- **ProcessLasso** - CPU optimalizálás Windows-on
- **CrystalDiskInfo** - SSD health monitoring
- **HWiNFO** - Hardver monitorozás

## Fejlesztés

```bash
# TypeScript watch mode
npm run watch

# Tesztek futtatása
npm test

# Cleanup
npm run cleanup

# Health check
npm run healthcheck
```

## Hibaelhárítás

### Build problémák
```bash
# Függőségek újratelepítése
rm -rf node_modules package-lock.json
npm install
npm run build
```

### Eszköz nem található
Ellenőrizd a `tools_registry.json` fájlban az útvonalakat és a `config.yaml`-ban a beállításokat.

### Python modulok hibák
Győződj meg róla, hogy Python 3.x telepítve van és elérhető a PATH-ban.

## Támogatott Platformok

- ✅ Windows 10/11
- ✅ Linux (Ubuntu, Debian, etc.)
- ✅ macOS
- ✅ WSL2

## Státusz

- [x] Core MCP szerver működik
- [x] Összes eszköz integrálva
- [x] AnythingLLM integráció
- [x] Tool registry rendszer
- [x] Query router és agent orchestrator
- [x] Task trigger konfigurációk
- [x] Maintenance eszközök
- [x] Átfogó dokumentáció
- [x] Tesztelés és validálás
- [x] Build és deployment készen áll

## Licensz

ISC

## Közreműködés

Lásd `INTEGRATION_PLAN.md` és `CONDUCTOR_PLAN.md` a további fejlesztési lehetőségekhez.
