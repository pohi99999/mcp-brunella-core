# Feladatlista (TODO): Robotkéz Pro (BVAB - Vision & Action Bridge)

Ez a dokumentum a `PLAN.md` alapján lebontott, mérnöki szintű feladatokat tartalmazza.

---

## 🟦 1. Fázis: Python Action Server Bővítése (OS & Vision)

- [ ] **1.1 Python Környezet Előkészítése** `[python]` `[backend]`
  - [ ] `pyautogui`, `mss`, `pygetwindow`, `opencv-python` telepítése a `myai` venv-be.
  - [ ] Alapvető OS szerviz létrehozása a `myai/workers/os_worker.py` fájlban.
- [ ] **1.2 OS Műveleti Végpontok** `[python]` `[backend]`
  - [ ] `/os/screenshot` végpont (teljes képernyő mentése PNG-be).
  - [ ] `/os/click` végpont (X, Y koordináta alapú kattintás szimulálása).
  - [ ] `/os/type` végpont (billentyűleütések és szövegbevitel küldése).
- [ ] **1.3 Vision-to-Coordinate Pipeline** `[python]` `[backend]`
  - [ ] Integráció a Gemini 2.0 / GPT-4o Vision API-val.
  - [ ] `find_element_on_screen(description, image_path)` függvény implementálása.
  - [ ] Az LLM által visszaadott vizuális leírás (bounding box) koordinátává alakítása.

---

## 🟩 2. Fázis: Orchestrator-Robotkéz Bridge (Node.js)

- [ ] **2.1 UI Delegációs Protokoll Definiálása** `[backend]`
  - [ ] Strukturált JSON séma kidolgozása (Action, Target, Context, Fallback).
  - [ ] `src/services/uiDelegator.ts` szerviz létrehozása.
- [ ] **2.2 Orchestrator Agent Tanítása** `[backend]`
  - [ ] Új rendszer-prompt kiegészítés az `OrchestratorAgent` számára a vizuális lépések dekomponálásához.
  - [ ] "n8n szakértő" kontextus betöltése (hogyan néznek ki a node-ok, hol a menü).
- [ ] **2.3 Kétirányú Kommunikáció** `[backend]` `[parallel]`
  - [ ] WebSocket események kiterjesztése a Robotkéz státuszüzeneteihez (`robotkez:action`, `robotkez:vision_thought`).

---

## 🟧 3. Fázis: Dashboard és Overlay Chat (UI/UX)

- [ ] **3.1 Real-time Live View Widget** `[frontend]`
  - [ ] Egy Canvas alapú komponens, ami a Socket.IO-n érkező screenshotokat jeleníti meg (low-latency).
  - [ ] Vizualizáció a kattintási pontokról (piros kör a képernyőn, ahol a robot kattint).
- [ ] **3.2 Shadow DOM Overlay Chat Injektor** `[frontend]` `[backend]`
  - [ ] Playwright `addInitScript` használata egy lebegő React Chat ablak injektálásához.
  - [ ] Biztonságos kommunikációs csatorna kiépítése az injektált ablak és a Brunella szerver között.
- [ ] **3.3 Magyar Nyelvű Élő Kommentár** `[frontend]`
  - [ ] A Robotkéz belső monológjának ("Most a Mentés gombot keresem...") stílusos megjelenítése.

---

## 🟨 4. Fázis: Domain-Specific Specialist (n8n/Langflow)

- [ ] **4.1 n8n Vizuális Tanító Készlet** `[backend]` `[python]`
  - [ ] Ismert n8n UI elemek (Add Node, Workflow Settings, Execution Log) vizuális mintáinak rögzítése.
- [ ] **4.2 Öngyógyító Hurok (Self-Healing)** `[backend]` `[test]`
  - [ ] Logika implementálása: "Ha a kattintás után 5 másodpercig nem változik a képernyő, próbálkozz máshogy."
- [ ] **4.3 E2E Automatizációs Teszt** `[test]`
  - [ ] Feladat: "Hozz létre egy n8n workflow-t, ami 5 percenként logol egy 'Hello' üzenetet."

---

## ✅ 5. Fázis: Verifikáció és Finomhangolás

- [ ] Teljes Windows vezérlés tesztelése (pl. Notepad nyitás, írás, mentés).
- [ ] n8n node beállítás tesztelése (HTTP Request node URL kitöltése).
- [ ] Dashboard és Overlay szinkronitás ellenőrzése.

---
*A feladatok sorrendben hajtandók végre, de a Frontend és a Python alapok párhuzamosan is futhatnak.*