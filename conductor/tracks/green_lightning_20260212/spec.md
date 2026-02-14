\# Track: Green Lightning (Autonomous EV Hunter)



\*\*Dátum:\*\* 2026-02-12

\*\*Prioritás:\*\* HIGH (Immediate Value)

\*\*Status:\*\* IMPLEMENTED ✅



\## 🎯 Célkitűzés

Egy "Robotkéz" (Browser-Use) alapú automatizált ügynök létrehozása, amely elektromos autókat keres (BMW i3, Nissan Leaf, stb.) a willhaben.at oldalon, szűri a találatokat ár és eladó típusa szerint, majd email értesítést küld a legjobb ajánlatokról.



\## 🛠️ Érintett Fájlok

\- `myai/tasks/ev\_hunter.py` (A Python Robotkéz)

\- `myai/prompts/ev\_hunter\_prompt.md` (A küldetés leírása)

\- `workers/scraper-worker.js` (Cloudflare HTML tisztító)

\- `n8n\_workflows/ev\_hunter.json` (Az orkesztrátor)



\## 📅 Megvalósítási Terv (Phases)



\### Phase 1: Environment Setup ("Az Izomzat")

A Python környezet és a böngésző motorok előkészítése.



1\.  \*\*Függőségek Telepítése:\*\*

&nbsp;   - `pip install browser-use langchain-openai python-dotenv playwright`

&nbsp;   - `playwright install`

2\.  \*\*Mappastruktúra:\*\*

&nbsp;   - `myai/tasks/`, `myai/prompts/`, `workers/`, `n8n\_workflows/` ellenőrzése.



\### Phase 2: Simulation Test ("Füstpróba")

A rendszer tesztelése böngésző nyitás nélkül.



1\.  \*\*Python Script:\*\*

&nbsp;   - A `myai/tasks/ev\_hunter.py` jelenleg szimulációs módban van.

&nbsp;   - Futtatás: `python myai/tasks/ev\_hunter.py`.

&nbsp;   - Elvárt kimenet: Valid JSON a terminálban (BMW i3 példa adatokkal).



\### Phase 3: Cloudflare Scraper ("A Tisztító")

A HTML tisztító worker élesítése a token spórolás érdekében.



1\.  \*\*Worker Deploy:\*\*

&nbsp;   - `workers/scraper-worker.js` tartalmának feltöltése Cloudflare-re.

&nbsp;   - URL rögzítése (pl. `scraper.peter.workers.dev`).



\### Phase 4: n8n Integration ("Az Idegrendszer")

A folyamat automatizálása és az értesítés beállítása.



1\.  \*\*Workflow Import:\*\*

&nbsp;   - `n8n\_workflows/ev\_hunter.json` importálása.

2\.  \*\*Node Konfiguráció:\*\*

&nbsp;   - `Execute EV Hunter` node: `cd F:/mcp-brunella-core \&\& python myai/tasks/ev\_hunter.py`.

&nbsp;   - `Send Email` node: Címzett ellenőrzése (`peterpohankapersonal@gmail.com`).

3\.  \*\*Teszt:\*\*

&nbsp;   - Workflow futtatása manuálisan.

&nbsp;   - Email érkezésének ellenőrzése.



\### Phase 5: Live Fire ("Élesítés")

A szimuláció kikapcsolása és a valódi vadászat indítása.



1\.  \*\*Python Script Módosítás:\*\*

&nbsp;   - `myai/tasks/ev\_hunter.py`-ban a szimulált output törlése/kommentezése.

&nbsp;   - Az `agent = Agent(...)` és `await agent.run()` sorok aktiválása.

&nbsp;   - `use\_vision=True` beállítása a képek elemzéséhez.



\## ✅ Definition of Done

\- \[ ] A `python myai/tasks/ev\_hunter.py` parancs hiba nélkül lefut.

\- \[ ] Az n8n workflow sikeresen meghívja a Python scriptet és parsolja a JSON kimenetet.

\- \[ ] A szűrő feltételek (Ár: 10k-19k, Eladó: Private) működnek.

\- \[ ] Sikeres email értesítés érkezik egy valid találatról.

