# Specification: Fejlesztői Környezet Helyreállítása

## 1. Overview
A projekt jelenlegi fejlesztői környezete instabil Windows alatt. A Python virtuális környezet (`.venv`) hibás útvonalra mutat, ami lehetetlenné teszi a `pytest` futtatását. Emellett a PowerShell "Execution Policy" beállításai blokkolják az `npm test` script futtatását, ami közvetlen `node` hívásokat igényel. Ez a track ezen technikai akadályok elhárítását célozza.

## 2. Goals
- Működőképes Python virtuális környezet létrehozása (`.venv`).
- Függőségek sikeres telepítése (`requirements.txt` és `pyproject.toml` alapján).
- A `pytest` parancs sikeres futtatásának biztosítása.
- Az `npm test` script Windows-kompatibilissé tétele (Execution Policy bypass vagy node-alapú hívás).
- A rendszerstátusz frissítése "Zöld"-re a `mag.md`-ben.

## 3. Requirements
- **Python:**
    - Régi `.venv` teljes törlése.
    - Új `.venv` létrehozása a projekt gyökerében.
    - Csomagok telepítése: `fastapi`, `fastmcp`, `uvicorn`, `pytest` stb.
- **Node.js:**
    - A `package.json` `test` scriptjének ellenőrzése és módosítása, hogy ne függjön a PowerShell script futtatási jogaitól (pl. `npm run` helyett közvetlen node hívások vagy `cross-env` használata, ha releváns).
- **Verifikáció:**
    - Mindkét tesztkészletnek (JS és Python) hiba nélkül kell lefutnia.

## 4. Out of Scope
- A tesztek kódjának módosítása (kivéve ha szintaktikai hiba miatt nem futnak).
- Új tesztek írása.
