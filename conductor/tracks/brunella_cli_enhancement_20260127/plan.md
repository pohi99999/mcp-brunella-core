# Implementation Plan - Brunella CLI Enhancement & Parity

## Phase 1: Interactive Chat & Core Structure
- [x] Task: Command Structure
    - [x] Implementáld a `Commander.js` parancsokat a `src/cli/index.ts`-ben (`chat`, `extension`, `run`).
    - [x] Hozz létre külön modulokat a parancskezelőknek (`src/cli/commands/`).
- [x] Task: Interactive Chat Loop
    - [x] Hozd létre a `src/cli/commands/chat.ts`-t.
    - [x] Implementálj egy REPL (Read-Eval-Print Loop) ciklust `inquirer` vagy `readline` segítségével.
    - [x] Készíts egy egyszerű parancsértelmezőt (pl. `/help`, `/exit`, vagy sima szöveg).

## Phase 2: Extension System Integration
- [x] Task: Extension Manager Wrapper
    - [x] Bővítsd a `src/cli/extensions.ts`-t, hogy támogassa a bővítmények betöltését és parancsok regisztrálását.
    - [x] Integráld az `ExtensionService`-t a CLI indítási folyamatába.
- [x] Task: CLI Extension Commands
    - [x] Implementáld a `brunella extension list` és `brunella extension install` parancsokat.

## Phase 3: Built-in Tools
- [x] Task: Tool Registry
    - [x] Hozz létre egy belső `ToolRegistry`-t a `src/cli/tools/` alatt.
    - [x] Implementálj alapvető eszközöket: `read_file`, `list_directory`.
- [x] Task: Chat-Tool Integration
    - [x] Tedd lehetővé, hogy a chat felületen keresztül (pl. `/tool <name> <args>`) meg lehessen hívni ezeket az eszközöket.

## Phase 4: Advanced Tools & Integrations
- [x] Task: Enhanced Built-in Tools
    - [x] Implementáld a `write_file` eszközt a `fs_tools.ts`-ben.
    - [x] Hozz létre `browser_tools.ts`-t Playwright integrációval (`scrape_page`, `screenshot`).
    - [x] Hozz létre `search_tools.ts`-t (Google Search API vagy DuckDuckGo wrapper).
- [x] Task: Docker MCP Integration
    - [x] Add hozzá a Docker MCP szervert a `mcp_servers.json` alapértelmezett konfigurációjához.
- [x] Task: Agent Builder ADK Integration
    - [x] Hozz létre egy `src/cli/commands/agent.ts` parancsot az Agent Factory funkciók (ügynök létrehozása, futtatása) eléréséhez.
    - [x] Regisztráld az `agent` parancsot az `index.ts`-ben.

## Phase 5: Verification
- [x] Task: Manual Verification
    - [x] Ellenőrizd a chat működését.
    - [x] Teszteld a bővítmények listázását.
    - [x] Próbálj ki egy fájlműveletet a CLI-ből.
- [x] Task: Conductor - User Manual Verification (Protocol in workflow.md)
