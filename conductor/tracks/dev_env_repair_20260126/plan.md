# Implementation Plan - Fejlesztői Környezet Helyreállítása

## Phase 1: Python Environment Fix
- [ ] Task: Clean Up
    - [ ] Töröld a meglévő `.venv` könyvtárat.
- [ ] Task: Rebuild Environment
    - [ ] Hozz létre új virtuális környezetet (`python -m venv .venv`).
    - [ ] Aktiváld a környezetet (ellenőrzésképpen).
    - [ ] Telepítsd a függőségeket: `pip install -r requirements.txt` és `pip install pytest`.
- [ ] Task: Verify Python Tests
    - [ ] Futtasd le a teszteket: `.venv\Scripts\python -m pytest`.
    - [ ] Rögzítsd az eredményt.

## Phase 2: Node.js Script Fix
- [ ] Task: Analyze Package.json
    - [ ] Vizsgáld meg a jelenlegi `test` scriptet.
    - [ ] Azonosítsd a blokkoló tényezőt (pl. `ts-node` vagy `npm` hívás PowerShellből).
- [ ] Task: Optimize for Windows
    - [ ] Módosítsd a `package.json`-t, hogy a scriptek platformfüggetlenebbek legyenek (pl. kerüld a shell specifikus szintaxist, vagy használj közvetlen bináris hívást).
    - [ ] Teszteld az `npm test` futtatását.

## Phase 3: Final Verification
- [ ] Task: Conductor - User Manual Verification 'Python Environment' (Protocol in workflow.md)
- [ ] Task: Conductor - User Manual Verification 'Node Environment' (Protocol in workflow.md)
- [ ] Task: Update Documentation
    - [ ] Frissítsd a `mag.md` "System Status" és "Known Issues" szekcióit.
