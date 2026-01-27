# MCP Brunella Core

Központi MCP szerver a Brunella rendszer számára, amely biztonságos és felügyelt hozzáférést biztosít a fájlrendszerhez, tudásbázishoz, rendszerparancsokhoz és webes tartalmakhoz.

## Funkciók

-   **Workspace Tool:** Biztonságos fájlműveletek a `Brunella_es_en` könyvtárban.
-   **Knowledge Tool:** Keresés és kontextusépítés a projektekből és tudásbázisból.
-   **System Tool:** Whitelistelt parancsok futtatása (`ls`, `dir`, verzióellenőrzés) naplózással.
-   **Interpreter Tool:** Python és Node.js kód futtatása sandboxolt környezetben.
-   **Browser Tool:** Biztonságos HTTP GET kérések (lokális hálózat tiltva).
-   **AnythingLLM Tool:** Lokális AnythingLLM workspace elérés (listázás, chat).
 -   **Agent Registry:** JSON alapú agent definíciók és strukturált `agent_list` kimenet.

### Egyéb Modulok
-   **Health Check:** Rendszerállapot ellenőrző segédprogram (`src/utils/health_check.ts`).
-   **Agent Registry:** `src/agents/registry.json` alapján tölti az agent metaadatokat.

## Telepítés és Használat

### 1. Telepítés
```bash
npm install
npm run build
```

### 2. Regisztráció a Gemini CLI-ben

Add hozzá az alábbi konfigurációt a `.gemini/settings.json` fájlod `mcpServers` szekciójához (vagy a projekt szintű `settings.json`-hoz):

```json
{
  "mcpServers": {
    "mcp-brunella-core": {
      "command": "node",
      "args": [
        "F:\[ACTIVE]_mcp-brunella-core\\build\\index.js"
      ],
      "env": {
        "NODE_ENV": "production"
      }
    }
  }
}
```

### 3. Logolás
A rendszer parancsok naplózása a `logs/system_commands.log` fájlba történik a projekt könyvtárában.

### 4. Biztonság
- A szerver csak a konfigurált `workspaceRoot` alatt engedélyez fájlműveleteket.
- Érzékeny fájlok (pl. `.env`, `_br_secrets`) olvasása tiltott.
- A kód futtatás idő- és méretkorlátokkal rendelkezik.

### 5. AnythingLLM konfiguráció
Alapértelmezett: `http://localhost:3001`

Beállítható környezeti változókkal:

- `ANYTHINGLLM_BASE_URL`
- `ANYTHINGLLM_WORKSPACE`
- `ANYTHINGLLM_API_KEY`

### 6. Web UI kapcsolo
- `WEB_UI_ENABLED=0` letiltja a web UI-t
- `WEB_UI_PORT=3000` atallitja a portot

### 7. Smoke teszt
MCP ping + AnythingLLM elerhetoseg ellenorzese:

```bash
npm run smoke
```
