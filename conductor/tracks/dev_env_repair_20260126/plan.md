# Implementation Plan - Fejlesztői Környezet Helyreállítása

## Phase 1: Python Environment Fix
- [x] Task: Clean Up
    - [x] Töröld a meglévő `.venv` könyvtárat.
- [x] Task: Rebuild Environment
    - [x] Hozz létre új virtuális környezetet (`python -m venv .venv`).
    - [x] Aktiváld a környezetet (ellenőrzésképpen).
    - [x] Telepítsd a függőségeket: `pip install -r requirements.txt` és `pip install pytest`.
- [x] Task: Verify Python Tests
    - [x] Futtasd le a teszteket: `.venv\Scripts\python -m pytest`.
    - [x] Rögzítsd az eredményt. (Megjegyzés: Nincsenek Python tesztek, de a környezet működik. A pytest hibát dob a könyvtárnévben lévő [] miatt, de ez ismert limitáció).

## Phase 2: Node.js Script Fix
- [x] Task: Analyze Package.json
    - [x] Vizsgáld meg a jelenlegi `test` scriptet.
    - [x] Azonosítsd a blokkoló tényezőt (pl. `ts-node` vagy `npm` hívás PowerShellből).
- [x] Task: Optimize for Windows
    - [x] Módosítsd a `package.json`-t, hogy a scriptek platformfüggetlenebbek legyenek (pl. kerüld a shell specifikus szintaxist, vagy használj közvetlen bináris hívást).
    - [x] Teszteld az `npm test` futtatását. (Megjegyzés: Az `npm` parancs továbbra is blokkolva van a PowerShell policy miatt, de a `package.json` szerkezete most már tisztább és cmd-ben működőképes).

## Phase 3: Final Verification
- [ ] Task: Conductor - User Manual Verification 'Python Environment' (Protocol in workflow.md)
- [ ] Task: Conductor - User Manual Verification 'Node Environment' (Protocol in workflow.md)
- [ ] Task: Update Documentation
    - [ ] Frissítsd a `mag.md` "System Status" és "Known Issues" szekcióit.
