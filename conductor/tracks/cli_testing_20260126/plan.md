# Implementation Plan - CLI Rendszer Tesztelése és Validációja

## Phase 1: Verify Build & Execution
- [ ] Task: Check Build
    - [ ] Ellenőrizd, hogy a `build/cli.js` létezik-e és friss-e (`tsc` futtatása).
- [ ] Task: Manual Run
    - [ ] Futtasd a `node build/cli.js --help` parancsot.
    - [ ] Ellenőrizd a kimenetet.

## Phase 2: Create Test Script
- [ ] Task: CLI Test Script
    - [ ] Hozz létre egy `scripts/test_cli.ts` (vagy .js) scriptet, amely `child_process.exec` segítségével meghívja a CLI-t és ellenőrzi a kimenetet.
    - [ ] Implementálj teszteket: Help, Version (ha van), Invalid command.

## Phase 3: Integration
- [ ] Task: NPM Script
    - [ ] Adj hozzá egy `test:cli` scriptet a `package.json`-hoz.
- [ ] Task: Conductor - User Manual Verification 'CLI' (Protocol in workflow.md)
- [ ] Task: Update Documentation
    - [ ] Frissítsd a `mag.md` System Status szekcióját.
