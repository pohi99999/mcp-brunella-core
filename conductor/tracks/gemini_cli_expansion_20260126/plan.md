# Implementation Plan - Gemini CLI Refinement & Expansion

## Phase 1: Foundation & Quick Start
- [x] Task: Project Structure & Setup
    - [x] Hozd létre a `src/cli/` könyvtárat, ha még nem létezik.
    - [x] Inicializáld a CLI belépési pontot (`src/cli/index.ts`).
- [x] Task: Quick Start Script
    - [x] Hozd létre a `start.bat` fájlt a gyökérkönyvtárban, amely elindítja a CLI-t (pl. `npm run cli` vagy `ts-node src/cli/index.ts`).
- [x] Task: Conductor - User Manual Verification 'Foundation & Quick Start' (Protocol in workflow.md)

## Phase 2: Core Functionality (Hybrid & Memory)
- [x] Task: Role-based Access Control (RBAC)
    - [x] Implementáld az indításkori jogosultság-választót (Read-only / Full-access).
- [x] Task: Persistent Memory
    - [x] Alakítsd ki a JSON alapú tárolót a felhasználói preferenciák és előzmények mentéséhez a `.gemini/` könyvtárban.
- [x] Task: Hybrid Bridge
    - [x] Valósítsd meg a kommunikációs hidat a Node.js CLI és a Python alapú eszközök/szerverek között.
- [x] Task: Conductor - User Manual Verification 'Core Functionality' (Protocol in workflow.md)

## Phase 3: MCP & Plugin System
- [x] Task: Extension Loader
    - [x] Implementáld a dinamikus bővítménybetöltőt, amely képes felismerni a kijelölt könyvtárakban lévő pluginokat.
- [x] Task: MCP Client & On-demand Server
    - [x] Fejleszd ki az MCP kliens modult külső szerverekhez való csatlakozáshoz.
    - [x] Implementáld a belső MCP szerver igény szerinti (on-demand) indítását és leállítását.
- [x] Task: Auto-discovery Logic
    - [x] Készítsd el a helyi környezetben (fájlrendszer, futó folyamatok) lévő eszközök automatikus felderítését.
- [x] Task: Conductor - User Manual Verification 'MCP & Plugin System' (Protocol in workflow.md)

## Phase 4: Interactive UI & Integration
- [x] Task: Interactive Menu & REPL
    - [x] Építsd fel az interaktív menürendszert (pl. `inquirer` használatával) a bővítmények és szerverek kezeléséhez.
- [x] Task: Final Integration & Tests
    - [x] Teszteld a teljes folyamatot a `start.bat`-tól az MCP szerverhez való csatlakozásig.
    - [x] Frissítsd a `mag.md` dokumentációt az új CLI képességekkel.
- [x] Task: Conductor - User Manual Verification 'Interactive UI & Integration' (Protocol in workflow.md)
