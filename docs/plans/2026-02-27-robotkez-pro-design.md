# Design Document: Brunella Robotkéz Pro (BVAB - Brunella Vision & Action Bridge)
**Dátum:** 2026-02-27
**Státusz:** Validált (Brainstorming után)

## 1. Absztrakt
A Robotkéz Pro célja a Brunella Agent System felruházása egy olyan autonóm operátori képességgel, amely képes a Windows operációs rendszeren és a Chrome böngészőben végrehajtani komplex munkafolyamatokat (különös tekintettel az n8n és Langflow beállítására). A rendszer a képalapú (Vision) és a szoftveralapú (UI Tree) vezérlést ötvözi a maximális precizitás érdekében, egy saját fejlesztésű Computer Use modullal támogatva.

## 2. Rendszerarchitektúra
A rendszer egy Python-alapú mikroszolgáltatásból (Action Server) áll, amely a következő komponenseket kezeli:
- **Playwright (Visible Mode):** Élő böngésző ablak, amelyben az AI látja a DOM struktúrát és a koordinátákat.
- **Saját Computer Use Modul:** Natív ablakok és rendszerszintű elemek elérése Python alapon (pyautogui / pygetwindow / mss integrációval, nem a külső Anthropic MCP szerverrel).
- **Vision Integration:** GPT-4o vagy Gemini 2.0 API-n keresztüli screenshot-elemzés a vizuális megerősítéshez.
- **Kettős Kommunikációs Felület:**
    - **Mission Control Dashboard:** Dedikált felület a vezérlésre és logok követésére.
    - **Browser Overlay Chat:** A Playwright által nyitott ablakba injektált, lebegő React komponens (Shadow DOM-ban), amely szinkronban van a Dashboarddal (Socket.IO).

## 3. Működési Protokoll és Kommunikáció
1. **Feladatfogadás:** A felhasználó magyarul ad utasítást (akár a Dashboardon, akár az élő böngésző feletti Overlay chaten).
2. **Orchestráció:** Az Orchestrator Agent fogadja az üzenetet, értelmezi a kontextust, és technikai lépésekre bontja.
3. **Környezetfelmérés:** Snapshot készül az aktuális UI állapotról (szemantikus fa + kép).
4. **Végrehajtás:** Az Action Server elvégzi az akciót (klikk, gépelés, görgetés).
5. **Visszajelzés élőben:** Az Overlay chaten és a Dashboardon a robot valós időben kommunikál (pl. "Rákattintottam a Beállítások gombra, most ellenőrzöm az eredményt.").

## 4. "Self-Training Loop" (Gyakorló Teszt Mód)
Egy speciális végrehajtási mód a rendszer tökéletesítésére:
- **Hosszú futás:** Képes akár órákon (pl. 4 óra) keresztül futni egy bonyolult flow betanulásán.
- **Progresszív Eszkaláció (Fallback):**
  1. Szöveges DOM vizsgálat (Gyors keresés új modal/dialog után).
  2. Kinetikus próbálkozás (Görgetés, újra-kattintás).
  3. Computer Use bevetése (Képernyő-koordinátás natív kattintás).
  4. Vision API Segítség (Képernyőkép elemzése AI-val a probléma azonosítására).
- **Hosszútávú Memória (Tanulás):** Minden sikeres "visszalépés és megoldás" bekerül a `data/robotkez_memory.json` fájlba. A következő futáskor, mielőtt nekiállna egy feladatnak, beolvassa ezt, így a korábban megtanult akadályokat már elsőre elkerüli.

## 5. Technikai Követelmények
- **Vision Model:** GPT-4o vagy Gemini 2.0 Pro.
- **Backend:** Node.js (Orchestrator, Socket.IO hub) <-> Python (Action Server).
- **Overlay Chat:** React + Shadow DOM beillesztés a Playwright oldalakba.

## 6. Sikerességi Kritériumok
- 100% pontosság n8n/Langflow node-ok összekötésénél a tanulási fázis végére.
- Stabil, valós idejű, kétirányú szinkronizáció a Dashboard és a Browser Overlay Chat között.
- Képes emberi beavatkozás nélkül regenerálódni UI hibákból a Self-Training Loop alatt.