# Implementation Plan - Brunella UI & ADK Integration Dashboard

## Phase 1: Core Dashboard Extension & Layout
- [x] Task: Layout Refinement
    - [x] Bővítsd a Dashboard alapstruktúráját a `src/dashboard/` mappában, hogy helyet kapjanak az új panelek (Flow, Chat, Knowledge, Registry).
    - [x] Implementáld az oldalsávot vagy navigációs menüt az új modulok közötti váltáshoz.
- [x] Task: Socket.io Bridge
    - [x] Építsd ki a valós idejű kommunikációs csatornát a backend (`src/server/web.ts`) and a frontend között a folyamatok és logok továbbításához.
- [x] Task: Conductor - User Manual Verification 'Core Dashboard Extension & Layout' (Protocol in workflow.md)

## Phase 2: MCP Server & Tool Registry UI
- [x] Task: Registry Component
    - [x] Hozz létre egy komponenst, amely a `mcp_servers.json` és a regisztrált eszközök alapján listázza a szervereket/bővítményeket.
- [x] Task: Process Control Logic
    - [x] Implementáld a backend oldali API végpontokat a szerverek egyenkénti indításához és leállításához.
    - [x] Kösd össze a UI gombokat az indítási/leállítási logikával.
- [x] Task: Conductor - User Manual Verification 'MCP Server & Tool Registry UI' (Protocol in workflow.md)

## Phase 3: Visual Agent Flow Editor (ADK)
- [x] Task: Flow Editor Integration
    - [x] Integrálj egy React-alapú flow könyvtárat (pl. React Flow) a vizuális szerkesztőhöz.
    - [x] Definiáld az ágens-specifikus node-típusokat (Input, LLM, Tool, Output).
- [x] Task: ADK Backend Sync
    - [x] Valósítsd meg a vizuális gráf elmentését és betöltését, valamint az ágens sablonok generálását a gráf alapján.
- [x] Task: Conductor - User Manual Verification 'Visual Agent Flow Editor (ADK)' (Protocol in workflow.md)

## Phase 4: Integrated Chat & AnythingLLM
- [x] Task: Unified Chat UI
    - [x] Fejleszd tovább a chat felületet a BUAP üzenetek és a több ágenssel való párhuzamos beszélgetés támogatására.
- [x] Task: Knowledge Base UI
    - [x] Készíts felületet az AnythingLLM API integrációhoz (dokumentumkezelés, index választás).
- [x] Task: Conductor - User Manual Verification 'Integrated Chat & AnythingLLM' (Protocol in workflow.md)

## Phase 5: Live Logs & Verification
- [x] Task: Log Streamer
    - [x] Valósítsd meg a strukturált naplók (Brunella logok, ágens StdIO) szűrt megjelenítését a UI-on.
- [x] Task: E2E Verification
    - [x] Teszteld a teljes folyamatot: szerver indítás -> ágens tervezés -> chat interakció -> logok ellenőrzése.
- [x] Task: Conductor - User Manual Verification 'Live Logs & Verification' (Protocol in workflow.md)
