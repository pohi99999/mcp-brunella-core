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

### 5. AnythingLLM konfiguráció
Alapértelmezett: `http://localhost:3001`

Beállítható környezeti változókkal:

- `ANYTHINGLLM_BASE_URL`
- `ANYTHINGLLM_WORKSPACE`
- `ANYTHINGLLM_API_KEY`

### 6. Web UI kapcsolo
- `WEB_UI_ENABLED=0` letiltja a web UI-t
- `WEB_UI_PORT=3000` atallitja a portot

### 7. Brunella CLI (Gemini-paritás)

A beépített CLI a `brunella` parancs alatt érhető el, és a Gemini CLI parancskészletéhez igazodik.

**Példák:**
```bash
npm run build && node build/cli.js --version
node build/cli.js about
node build/cli.js config list
node build/cli.js config get serverUrl
node build/cli.js tools [--json] [--desc] [--schema]
node build/cli.js run <toolName> [args...] [--json]
node build/cli.js chat [-m model]
node build/cli.js agents [--json] | agents describe <name>
node build/cli.js delegate <agentName> <task> [--json]
node build/cli.js memory show | memory list | memory refresh
node build/cli.js directory add <paths> | directory show
```

**Beállítások:** Rétegek: rendszer alapértelmezések → `~/.brunella/settings.json` (felhasználó) → `.brunella/settings.json` (projekt) → rendszer felülírás → env. Környezeti változók: `BRUNELLA_SERVER_URL`, `BRUNELLA_TELEMETRY_*`, `BRUNELLA_MODEL`, `BRUNELLA_SANDBOX`, `BRUNELLA_CLI_SYSTEM_*`. Sémá: `schemas/settings.schema.json`.

**Telemetria:** `telemetry.enabled`, `telemetry.target` (local/gcp), `telemetry.outfile`. Lokális: NDJSON `~/.brunella/telemetry.log`. Gemini-szerű eseménynevek és env felülírások.

**Kontextus/memory:** BRUNELLA.md / GEMINI.md felderítés (cwd → projekt gyökér, opcionális alkönyvtárak), `@path/to/file.md` importok. Parancsok: `memory show | list | refresh | add`.

**Approval / sandbox:** `--approval-mode`, `tools.approvalMode`, `tools.allowed` / `tools.exclude`. `--sandbox` / `BRUNELLA_SANDBOX` / `tools.sandbox`.

**Parancs-paritás mátrix:** `conductor/tracks/CLI_PARITY_MATRIX.md`. **Baseline (változatlan felületek):** `conductor/tracks/BASELINE_CLI.md`. **Referencia:** `conductor/tracks/Brunella-CLI.md.txt` (Gemini CLI parancslista), `conductor/tracks/config.md.txt`, `conductor/tracks/telemetria.md.txt`.

**Tesztek:** `npm test` – config, telemetry, memory, hooks, skills, CLI config réteg. Smoke: `npm run smoke` (MCP ping + CLI `--help`, `config list`).

### 8. Smoke teszt
MCP ping + AnythingLLM elerhetoseg ellenorzese:

```bash
npm run smoke
```
