# 🚀 Brunella Rendszer Indítási & Karbantartási Útmutató (`USER_START.md`)

Ez a dokumentum a Brunella Agent System **összes fontos parancsát** tartalmazza. Ha elakadsz, vagy "galiba van", innen puskázhatsz!

## 🟢 1. Gyors, böngésző-kész dashboard indítás

Ha a dashboardon akarsz dolgozni, és azt szeretnéd, hogy a kritikus helyi szolgáltatások tényleg felálljanak, ezt használd először.

**Parancs (Windows parancssor/PowerShell):**

```cmd
dashboard.bat
```

**Ez mit csinál?** (sorrendben):

1. Ellenőrzi az alap toolingot (`curl`, `node`, `npm`, `node_modules`).
2. Elindítja vagy visszaellenőrzi az **Ollama** szervert (`:11434`).
3. Elindítja vagy visszaellenőrzi a **Python FastAPI** alrendszert (`:8000`).
4. Elindítja vagy megvárja a **Node.js backend** `readyz` állapotát (`:3000`).
5. Megvárja az **API health** és a **tool registry** elérhetőségét.
6. Elindítja vagy visszaellenőrzi a **Dashboard UI**-t (`:5173`).
7. Csak ezután nyitja meg a böngészőt.

Ha nem akarod automatikusan megnyitni a böngészőt:

```cmd
set BRUNELLA_DASHBOARD_NO_BROWSER=1 && dashboard.bat
```

```powershell
$env:BRUNELLA_DASHBOARD_NO_BROWSER = "1"
.\dashboard.bat
```

---

## 🟢 2. "Mindent Bele" Indítás (Ajánlott teljes rendszerhez)

Ha az egész rendszert akarod felhúzni a teljes startup-lánccal, ez a legegyszerűbb módja.

**Parancs (Windows parancssor/PowerShell):**

```cmd
start-full.bat
```

**Ez mit csinál?** (A színfalak mögött, sorrendben):

1. Ellenőrzi a környezetet (Node.js, Python, Ollama).
2. Elindítja az **Ollama** szervert (ha még nem fut).
3. Elindítja a **Python Backend**-et (`:8000` - Agy, robotkéz, hang).
4. Elindítja az **MCP Szerver**-t (`:3000` - Node.js API).
5. Elindítja a **Dashboard**-ot (`:5173` - Kezelőfelület).
6. Megnyitja a böngészőt.

---

## 🔧 3. Manuális Indítás (Fejlesztéshez / Hibakereséshez)

Ha valamelyik komponenst újra kell indítanod, vagy látni akarod a részletes hibaüzeneteit, használd a külön parancsokat külön terminál ablakokban.

### 🧠 A. Ollama (AI Motor)

A "nagy agy", ami a gépeden fut.

- **Indítás:** `ollama serve` (Hagyd futni a háttérben!)
- **Tesztelés:** `ollama run llama3.1:8b` (Vagy ami épp a modell).

### 🐍 B. Python Backend (MyAI)

Ez végzi a nehéz munkát: böngészés (robotkéz), hangfelismerés (Auralia), adatfeldolgozás.

- **Hely:** `f:\mcp-brunella-core`
- **Parancs:**

  ```bash
  cd myai && uvicorn server:app --reload --port 8000
  ```

  *(A `--reload` miatt automatikusan újraindul, ha módosítasz egy .py fájlt!)*

### 🌐 C. Node.js Backend (MCP & API)

Ez a kommunikációs központ és a CLI motorja.

- **Hely:** `f:\mcp-brunella-core`
- **Parancs:**

  ```bash
  npm run dev
  ```

  *(Port: 3000)*

### 🖥️ D. Dashboard (Frontend UI)

A grafikus felület a böngészőben.

- **Hely:** `f:\mcp-brunella-core`
- **Parancs:**

  ```bash
  npm run dev:ui
  ```

  *(Port: 5173)*

### ⌨️ E. CLI (Parancssoros Felület)

Ha a terminálból akarsz csevegni Brunellával.

- **Parancs:**

  ```bash
  npm run cli
  # VAGY ha telepítve van globálisan:
  brunella
  ```

---

## 🛠️ 4. Karbantartás, Frissítés & "Galibaelhárítás"

Ha valami nem működik, vagy piros hibákat látsz, ezeket futtasd le sorban.

### 🔄 I. Függőségek Frissítése (Ha új dolgokat töltöttél le)

Ha "module not found" hibát kapsz:

**Node.js (Frontend/Backend):**

```bash
npm install
```

**Python (MyAI):**

```bash
cd myai
# Ha 'uv'-t használsz (ajánlott):
uv sync
# VAGY sima pip-pel:
pip install -r requirements.txt
```

### 🏗️ II. Build (Ha TypeScript hibát látsz)

Ha kódot módosítottál, és a rendszer nem látja, vagy a CLI panaszkodik:

```bash
npm run build
```

*(Ez lefordítja a TypeScript fájlokat JavaScript-re a `/build` mappába.)*

### 🧹 III. Takarítás (Ha nagyon nagy a baj)

Törli a build szemetet és a node_modules-t (végső megoldás):

```bash
rmdir /s /q node_modules
rmdir /s /q build
npm install
npm run build
```

---

## 📝 Gyorslista (Cheat Sheet)

| Funkció | Parancs | Megjegyzés |
| :--- | :--- | :--- |
| **Dashboard-ready indítás** | `dashboard.bat` | Helyi dashboard munkához, readiness-várással |
| **Minden indítása** | `start-full.bat` | Kényelmes, automatikus, teljesebb boot |
| **Python Szerver** | `cd myai && uvicorn server:app --reload --port 8000` | Ha az AI/Hang nem válaszol |
| **Node Szerver** | `npm run dev` | Ha az API/Socket.IO áll |
| **UI Indítás** | `npm run dev:ui` | Ha a böngésző nem tölt be |
| **Fordítás** | `npm run build` | Kódmódosítás után kötelező! |
| **Tesztek** | `npm test` | Ha biztosra akarsz menni |

**Mentés:** Ezt a fájlt megtalálod a gyökérkönyvtárban `USER_START.md` néven. Nyisd meg bármikor, ha elakadsz! 🦾
