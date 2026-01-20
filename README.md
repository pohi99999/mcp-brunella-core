# MCP Brunella Core

Központi MCP szerver a Brunella rendszer számára, amely biztonságos és felügyelt hozzáférést biztosít a fájlrendszerhez, tudásbázishoz, rendszerparancsokhoz és webes tartalmakhoz.

## Funkciók

-   **Workspace Tool:** Biztonságos fájlműveletek a konfigurált workspace könyvtárban.
-   **Knowledge Tool:** Keresés és kontextusépítés a projektekből és tudásbázisból (LanceDB RAG).
-   **System Tool:** Whitelistelt parancsok futtatása (`ls`, `dir`, verzióellenőrzés) naplózással.
-   **Interpreter Tool:** Python és Node.js kód futtatása sandboxolt környezetben (vm2).
-   **Browser Tool:** Playwright alapú böngészési eszközök (navigate, screenshot, extract text).
-   **AnythingLLM Tool:** Lokális AnythingLLM workspace elérés (listázás, chat).
-   **Agent Registry:** JSON alapú agent definíciók és strukturált `agent_list` kimenet.
-   **Self-Healing Pipeline:** Automatikus kódgenerálás és javítás Ollama segítségével.
-   **LLM Tools:** Ollama, Claude, és Copilot CLI integrációk.
-   **Google Workspace:** Google Drive és Docs integráció.

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
        "F:\\OneDrive\\Desktop\\Brunella_es_en\\02_PROJECTS\[ACTIVE]_mcp-brunella-core\\build\\index.js"
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

### 4. Környezeti változók

- `WORKSPACE_ROOT` - A workspace gyökérkönyvtár (alapértelmezett: hardcoded útvonal)
- `NODE_ENV` - Környezet mód (production/development)

**AnythingLLM:**
- `ANYTHINGLLM_BASE_URL` - AnythingLLM szerver URL (alapértelmezett: `http://localhost:3001`)
- `ANYTHINGLLM_WORKSPACE` - Workspace ID
- `ANYTHINGLLM_API_KEY` - API kulcs

**Web UI:**
- `WEB_UI_ENABLED` - Web UI engedélyezése (0/1, alapértelmezett: 1)
- `WEB_UI_PORT` - Web UI port (alapértelmezett: 3000)

### 5. Biztonság
- A szerver csak a konfigurált `workspaceRoot` alatt engedélyez fájlműveleteket.
- Érzékeny fájlok (pl. `.env`, `_br_secrets`) olvasása tiltott.
- A kód futtatás idő- és méretkorlátokkal rendelkezik (vm2 sandbox).
- Whitelistelt rendszerparancsok csak biztonságos műveletekhez.

### 6. Web UI
A web felület Socket.IO-val valós idejű kommunikációt biztosít:
- Chat interfész Ollama integrációval
- Self-Healing Pipeline futtatás
- Üzenetek mentése SQLite adatbázisba

Letiltás: `WEB_UI_ENABLED=0`
Port változtatás: `WEB_UI_PORT=3000`

### 7. Smoke teszt
MCP ping + AnythingLLM elerhetoseg ellenorzese:

```bash
npm run smoke
```
