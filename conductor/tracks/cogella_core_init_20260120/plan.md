# Implementation Plan - A Cogella Core alapstruktúra és aszinkron Gateway alapozása

## Phase 1: Környezet és Alapstruktúra [checkpoint: 1407716]
- [x] Task: Python környezet inicializálása és függőségek telepítése (FastAPI, FastMCP, Uvicorn). [no-commit]
    - [x] Initialize Python environment (venv/uv)
    - [x] Create requirements.txt
    - [x] Install dependencies
- [x] Task: Projekt könyvtárstruktúra kialakítása (`src/core`, `src/servers`).
    - [x] Create directory structure
- [x] Task: Conductor - User Manual Verification 'Phase 1' (Protocol in workflow.md)

## Phase 2: Gateway Implementáció [checkpoint: e69cafb]
- [x] Task: Központi `main.py` létrehozása FastAPI és FastMCP alapokon.
    - [x] Implement `lifespan` context manager
    - [x] Setup FastAPI app
    - [x] Configure SSE endpoints
- [x] Task: Health check végpont implementálása (`/health`).
    - [x] Add async health check endpoint
- [x] Task: Conductor - User Manual Verification 'Phase 2' (Protocol in workflow.md)

## Phase 3: Moduláris Routerek Vázának Létrehozása
- [x] Task: `workspace.py` modul vázának elkészítése (FastMCP példány).
    - [x] Define `mcp_workspace` server
    - [x] Add dummy tool for testing
- [x] Task: `automation.py` modul vázának elkészítése (FastMCP példány).
    - [x] Define `mcp_automation` server
    - [x] Add dummy tool for testing
- [x] Task: Modulok becsatolása (mount) a fő Gateway-be.
    - [x] Mount sub-servers in `main.py`
- [ ] Task: Conductor - User Manual Verification 'Phase 3' (Protocol in workflow.md)

## Phase 4: Ellenőrzés és Dokumentáció
- [ ] Task: Szerver indítása és SSE végpontok tesztelése (curl vagy MCP Inspector).
    - [ ] Verify server startup
    - [ ] Test SSE connection
- [ ] Task: `README.md` frissítése az új Python alapú architektúrával.
    - [ ] Update documentation
- [ ] Task: Conductor - User Manual Verification 'Phase 4' (Protocol in workflow.md)
