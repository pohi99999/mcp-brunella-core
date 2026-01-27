# Implementation Plan - End-to-End (E2E) Tesztelési Keretrendszer

## Phase 1: Test Harness Setup
- [x] Task: Create Test Script Skeleton
    - [x] Hozz létre egy `scripts/e2e_runner.ts` fájlt.
    - [x] Implementáld a szerver indítását (subprocess) és leállítását.
    - [x] Implementálj egy egyszerű MCP klienst, ami csatlakozik a szerverhez (stdio vagy SSE).

## Phase 2: Implement Test Cases
- [x] Task: Basic Connectivity
    - [x] Teszteld a `tools/list` funkciót (meg kell jelennie a Python eszközöknek is).
- [x] Task: Python Integration Test
    - [x] Hívd meg az `automation_status` eszközt és ellenőrizd a választ.
    - [x] Hívd meg a `list_scheduled_jobs` eszközt.

## Phase 3: Execution & Verification
- [x] Task: NPM Script
    - [x] Adj hozzá egy `test:e2e` scriptet a `package.json`-hoz.
- [x] Task: Run Tests
    - [x] Futtasd le a teszteket és javítsd az esetleges időzítési/kapcsolódási hibákat.
- [x] Task: Update Documentation
    - [x] Frissítsd a `mag.md` System Status szekcióját az E2E eredményekkel.
