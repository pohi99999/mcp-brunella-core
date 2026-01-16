# MCP Brunella Core

Központi MCP szerver a Brunella rendszer számára, amely biztonságos és felügyelt hozzáférést biztosít a fájlrendszerhez, tudásbázishoz, rendszerparancsokhoz és webes tartalmakhoz.

## Funkciók

-   **Workspace Tool:** Biztonságos fájlműveletek a `Brunella_es_en` könyvtárban.
-   **Knowledge Tool:** Keresés és kontextusépítés a projektekből és tudásbázisból.
-   **System Tool:** Whitelistelt parancsok futtatása (`ls`, `dir`, verzióellenőrzés) naplózással.
-   **Interpreter Tool:** Python és Node.js kód futtatása sandboxolt környezetben.
-   **Browser Tool:** Biztonságos HTTP GET kérések (lokális hálózat tiltva).

### Egyéb Modulok
-   **Health Check:** Rendszerállapot ellenőrző segédprogram (`src/utils/health_check.ts`).

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

### 4. Biztonság
- A szerver csak a konfigurált `workspaceRoot` alatt engedélyez fájlműveleteket.
- Érzékeny fájlok (pl. `.env`, `_br_secrets`) olvasása tiltott.
- A kód futtatás idő- és méretkorlátokkal rendelkezik.
