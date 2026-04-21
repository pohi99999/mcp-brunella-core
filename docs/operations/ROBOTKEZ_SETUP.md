# 🤖 Robotkéz (Browser-Use) - Teljes Setup & Használati Útmutató
**Verzió:** 1.0
**Dátum:** 2026-02-08
**Cél:** Automatikus, intelligens böngésző-vezérlés a Brunella Agent System számára. Beállításokhoz, monitoring-hoz, adatgyűjtéshez és teszteléshez.

---

## 📋 Tartalomjegyzék
1.  [Gyors Start](#-gyors-start-copy-paste-parancsok)
2.  [Tesztelés (3 Szint)](#-tesztelés-3-szint)
3.  [Használati Esetek](#-használati-esetek-praktikus-példák)
4.  [CLI Referencia](#-gyors-referencia)
5.  [Hibaelhárítás](#-hibaelhárítás)

---

## ⚡ Gyors Start (Copy-Paste Parancsok)

### 1️⃣ Telepítés (5 perc)

> **Előfeltétel:** A projekt gyökérkönyvtárában vagy (`F:\mcp-brunella-core`).

**# 1. Terminál: Függőségek telepítése**
```powershell
# Lépj be a Python alrendszer mappájába
cd F:\mcp-brunella-core\myai

# Telepítsd a szükséges csomagokat az uv-val (gyors)
uv pip install browser-use playwright httpx asyncio

# Telepítsd a Playwright böngészőjét (Chromium)
# Fontos: a .venv-ben lévő python-t használd!
..\.venv\Scripts\python.exe -m playwright install chromium
```

**# 2. Terminál: Szerver indítása**
```powershell
# Lépj be a Python alrendszer mappájába
cd F:\mcp-brunella-core\myai

# Indítsd el a FastAPI szervert a Robotkéz API-val
uvicorn server:app --reload --port 8000
```

**Ellenőrzés:** Nyisd meg a böngésződben a `http://localhost:8000/docs` címet. Látnod kell a FastAPI dokumentációt. Vagy futtasd:
```powershell
curl http://localhost:8000/health
# Várható kimenet: {"status":"ok","browser_use":"available"}
```

---

## 🧪 Tesztelés (3 Szint)

> **Előfeltétel:** A `Robotkéz API`-nak futnia kell a `http://localhost:8000` címen.

### Level 1: Alapvető Navigáció (2 perc)
Ez a teszt ellenőrzi a legalapvetőbb funkciókat.
```powershell
cd F:\mcp-brunella-core
python scripts\robotkez_test_level1.py
```
**Mit tesz:**
- ✅ Google keresést indít a "github playwright" kifejezésre.
- ✅ Kinyeri a GitHub trending repókat.
- ✅ Ellenőrzi egy weboldal tartalmát.

**Sikeres, ha:** Minden `[OK]` státusszal fut le.

---
### Level 2: n8n Workflow Management (5 perc)
Ez a teszt egy valós use case-t szimulál: bejelentkezik egy külső szolgáltatásba és műveleteket végez.
```powershell
cd F:\mcp-brunella-core
python scripts\robotkez_test_level2_n8n.py
```
**Mit tesz:**
- ✅ Bejelentkezik az n8n demó felületére (`.env` fájlban definiált adatokkal).
- ✅ Létrehoz egy új, véletlenszerű nevű workflow-t.
- ✅ Listázza a workflow-kat a létrehozás ellenőrzéséhez.

**Sikeres, ha:** A bejelentkezés sikeres és az új workflow megjelenik a listában.
**Debug:** Ha a login sikertelen, ellenőrizd az `.env` fájlban az `N8N_TEST_USER` és `N8N_TEST_PASSWORD` változókat.

---
### Level 3: Website Monitoring (1 perc)
Ez a teszt párhuzamosan ellenőriz több weboldalt, hogy működnek-e.
```powershell
cd F:\mcp-brunella-core
python scripts\robotkez_test_level3_monitoring.py
```
**Mit tesz:**
- ✅ Ellenőrzi a Cloudflare Worker health endpointot.
- ✅ Ellenőrzi az n8n szerver health endpointot.
- ✅ Ellenőrzi a helyi Node.js backendet.
- ✅ Riasztást szimulál, ha valamelyik nem elérhető.

**Sikeres, ha:** Mind a 3/3 oldal `ONLINE` státuszú.

---

## 💼 Használati Esetek (Praktikus Példák)

### 🎯 1. Egyszerű Parancsok a `robotkez_cli.py`-vel
A CLI wrapper a leggyakoribb feladatokat egyszerűsíti le.
```powershell
cd F:\mcp-brunella-core

# Futtasd le az összes tesztet
python scripts/robotkez_cli.py test

# Nyiss meg egy URL-t és készíts képernyőképet
python scripts/robotkez_cli.py go https://github.com/trending

# Keress a Google-ben
python scripts/robotkez_cli.py search "Python async tutorial"

# Jelentkezz be az n8n-be
python scripts/robotkez_cli.py n8n-login
```

---
### 🔧 2. Beállítások Kezelése (Példa: Cloudflare Dashboard)
A Robotkéz képes bejelentkezni és adatokat kinyerni komplex, authentikációt igénylő oldalakról.

**Példa script (`scripts/cloudflare_check_workers.py`):**
```python
import asyncio
import httpx

async def check_cloudflare_workers():
    async with httpx.AsyncClient(timeout=180.0) as client:
        response = await client.post(
            "http://localhost:8000/api/task",
            json={
                "taskId": "cf-workers-check",
                "type": "browser",
                "payload": {
                    "instruction": """
                    1. Login to dash.cloudflare.com using environment variables for username and password.
                    2. Navigate to the 'Workers & Pages' section.
                    3. Extract the names, URLs, and deployment statuses of all workers.
                    4. Return the data as a JSON array: [{"name": "...", "url": "...", "status": "..."}]
                    """,
                    "context": { "headless": False, "extract_json": True }
                },
            }
        )
        result = response.json()
        workers = result.get('result', {}).get('extractedData', [])
        print(f"Found {len(workers)} workers:")
        for w in workers:
            print(f" - {w.get('name')}: {w.get('status')}")

asyncio.run(check_cloudflare_workers())
```
**Futtatás:** `python scripts/cloudflare_check_workers.py`
*(Megjegyzés: Ehhez be kell állítanod a Cloudflare belépési adatokat az `.env` fájlban.)*

---
### 📊 3. Weboldal Figyelés (Automatikus)
Egy egyszerű script, ami 10 percenként ellenőrzi a kritikus weboldalak állapotát.

**Példa script (`scripts/monitor_loop.py`):**
```python
# ... (a script tartalma a feladat leírásában szerepel) ...
```
**Háttérben futtatás (PowerShell):**
```powershell
Start-Process python -ArgumentList "scripts/monitor_loop.py" -WindowStyle Hidden
```

---

## 📋 Gyors Referencia

| Parancs | Mit csinál |
|---|---|
| `robotkez_cli.py test` | Teljes tesztcsomag futtatása (Level 1-3). |
| `robotkez_cli.py go <url>` | URL megnyitása és képernyőkép készítése. |
| `robotkez_cli.py search <term>` | Keresés a Google-ben. |
| `robotkez_cli.py n8n-login` | Bejelentkezés az n8n rendszerbe. |
| `robotkez_test_level1.py` | Alapvető navigációs és adatkinyerési teszt. |
| `robotkez_test_level2_n8n.py` | n8n workflow menedzsment teszt. |
| `robotkez_test_level3_monitoring.py` | Több weboldal állapotának monitorozása. |

---

## 🚨 Hibaelhárítás

- **"Cannot connect to localhost:8000"**
  - **Ok:** A Robotkéz API szerver nem fut.
  - **Megoldás:** Indítsd el a 2. terminálban: `cd F:\mcp-brunella-core\myai && uvicorn server:app --reload --port 8000`

- **"browser-use not found" / "No module named playwright"**
  - **Ok:** A Python függőségek nincsenek (megfelelően) telepítve.
  - **Megoldás:** Futtasd újra a telepítési lépéseket, ügyelve a virtuális környezet használatára.
    ```powershell
    cd F:\mcp-brunella-core\myai
    uv pip install browser-use playwright httpx asyncio --force-reinstall
    ..\.venv\Scripts\python.exe -m playwright install chromium
    ```

- **"Task timeout"**
  - **Ok:** A feladat végrehajtása tovább tartott, mint a default 60 másodperces limit.
  - **Megoldás:** Növeld a timeout-ot a `context` objektumban:
    ```json
    "context": { "timeout": 120000 } // 2 perc
    ```

- **Debugging (Látható böngészővel)**
  - **Probléma:** Nem tudod, mit csinál a böngésző a háttérben.
  - **Megoldás:** Kapcsold ki a headless módot:
    ```json
    "context": { "headless": False, "save_screenshot": True }
    ```
  - A képernyőképek a `myai/screenshots/task-<taskId>.png` helyre mentődnek.