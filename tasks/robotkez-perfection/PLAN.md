# Megvalósítási Terv: Robotkéz Pro (BVAB - Brunella Vision & Action Bridge)
**Verzió:** 1.0
**Cél:** A Brunella Robotkéz továbbfejlesztése egy autonóm, OS-szintű és böngésző-vezérlésre képes ágenssé, kiemelt fókusszal az n8n és Langflow vizuális konfigurálására.

---

## 1. Fázis: Python Action Server Bővítése (OS & Vision)
**Cél:** A technikai alapok megteremtése a Windows-vezérléshez és a vizuális tájékozódáshoz.

- **1.1 OS Control Modul:** 
  - Függőségek telepítése: `pyautogui`, `mss`, `pygetwindow`.
  - Új végpontok a `myai/server.py`-ban: `/os/click`, `/os/type`, `/os/screenshot`.
- **1.2 Vision-to-Coordinate Pipeline:**
  - Integráció a Gemini 2.0 Pro vagy GPT-4o Vision API-val.
  - Olyan függvény készítése, ami egy screenshotból és egy szöveges leírásból (pl. "n8n Set node") visszaadja a képernyő-koordinátákat.

## 2. Fázis: Orchestrator-Robotkéz Bridge (Node.js)
**Cél:** Az Orchestrator felruházása az irányítás képességével.

- **2.1 UI Delegation Protocol:**
  - Egy új JSON alapú protokoll definiálása az Orchestrator és a Robotkéz között.
  - Példa: `{ "action": "click_ui_element", "label": "Add Node button", "context": "n8n canvas" }`.
- **2.2 Orchestrator Agent bővítés:**
  - Az `OrchestratorAgent` tanítása a komplex UI folyamatok (pl. n8n workflow építés) lépésekre bontására.

## 3. Fázis: Dashboard és Overlay Chat (UI/UX)
**Cél:** Az élő "Comet-szintű" élmény és a vizuális visszacsatolás.

- **3.1 Live Stream Component:**
  - A Dashboardon egy alacsony FPS-ű, valós idejű képfolyam megjelenítése a vezérelt képernyőről (Socket.IO-n keresztül).
- **3.2 Shadow DOM Overlay Chat:**
  - A Playwright által nyitott böngészőablakba egy lebegő, React-alapú chat ablak injektálása, ahol a Robotkéz magyarul "beszél" munka közben.

## 4. Fázis: Domain-Specific Specialist (n8n/Langflow)
**Cél:** Specifikus tudás az automatizációs eszközökhöz.

- **4.1 n8n Node Configurator:**
  - Speciális promptok és koordináta-adatbázis az n8n canvas és a beállító panelek (JSON, HTTP Request, Set nodes) kezeléséhez.
- **4.2 Hibatűrés és Öngyógyítás:**
  - Ha egy kattintás nem hozza el a várt UI változást, a Robotkéz automatikusan új screenshotot készít, elemzi a hibát és újra próbálkozik.

---

## Ellenőrzési Pontok (Definition of Done)
- [ ] A Robotkéz képes egy natív Windows ablakot (pl. Notepad) megnyitni és gépelni bele.
- [ ] Az n8n-ben képes önállóan létrehozni és elnevezni egy node-ot.
- [ ] A felhasználó élőben látja a Robotkéz "gondolatait" és a képernyőjét a Dashboardon.
- [ ] Az Orchestrator sikeresen átadja a technikai részfeladatokat a Robotkéznek.

---
**Következő lépés:** `/blueprint:define` a feladatok részletes, checkbox-alapú lebontásához.