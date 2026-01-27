# Implementation Plan - CLI Rendszer Tesztelése és Validációja

## Phase 1: Verify Build & Execution
- [x] Task: Check Build
    - [x] Ellenőrizd, hogy a `build/cli.js` létezik-e és friss-e (`tsc` futtatása).
- [x] Task: Manual Run
    - [x] Futtasd a `node build/cli.js --help` parancsot.
    - [x] Ellenőrizd a kimenetet.

## Phase 2: Create Test Script
- [x] Task: CLI Test Script
    - [x] Hozz létre egy `scripts/test_cli.ts` (vagy .js) scriptet, amely `child_process.exec` segítségével meghívja a CLI-t és ellenőrzi a kimenetet.
    - [x] Implementálj teszteket: Help, Version (ha van), Invalid command.

## Phase 3: Integration
- [x] Task: NPM Script
    - [x] Adj hozzá egy `test:cli` scriptet a `package.json`-hoz.
- [x] Task: Conductor - User Manual Verification 'CLI' (Protocol in workflow.md)
- [x] Task: Update Documentation
    - [x] Frissítsd a `mag.md` System Status szekcióját.
