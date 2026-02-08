# Plan: Python Subsystem Refactor (FastAPI)

**Track ID:** `python_fastapi_refactor_20260130`
**Cél:** A `src/utils/pythonShell.ts` által használt subprocess-alapú Python futtatás kiváltása egy állandóan futó FastAPI szerverrel. Ez jelentősen csökkenti a latenciát (nem kell minden hívásnál interpretert indítani) és lehetővé teszi az állapotmegőrzést.

## 1. Helyzetkép
- Jelenleg minden `agent.execute` vagy `pythonShell.run` hívás egy új `python.exe` folyamatot indít.
- Ez lassú (300-500ms startup overhead) és erőforrás-igényes.
- A `myai` mappa tartalmazza a Python logikát, de nincs egységes szerver belépési pont.

## 2. Lépések

- [x] **1. FastAPI Szerver Létrehozása (`myai/server.py`):**
    - Végpontok: `/health`, `/execute` (általános kód), `/refine` (DataRefiner).
    - FastMCP integráció (opcionális, de ajánlott a jövőre nézve).
- [x] **2. Függőségek Frissítése:**
    - `pyproject.toml` és `requirements.txt` ellenőrzése (`fastapi`, `uvicorn` már elvileg benne van).
- [x] **3. `src/utils/pythonShell.ts` Átírása:**
    - `PythonShell` osztály átalakítása `PythonServerClient` jellegűvé.
    - `exec` helyett `fetch` hívások a `http://localhost:8000`-re.
    - Fallback mechanizmus: ha a szerver nem elérhető, próbálja meg elindítani? (Vagy a `start.bat` kezeli).
- [x] **4. `start.bat` Frissítése:**
    - Python API szerver indítása (`uvicorn myai.server:app --port 8000`).
- [x] **5. Verifikáció:**
    - `npm test` futtatása (különösen a `data_refiner.test.ts`).

## 3. Kockázatok
- Port ütközés (8000).
- A szerver nem indul el időben, mire a Node.js hívná. (Health check retry szükséges).