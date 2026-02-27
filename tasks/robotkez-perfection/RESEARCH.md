# Kutatási Jelentés: Robotkéz Pro (OS + Böngésző Agent) Tökéletesítése
**Készült:** 2026. február 27.
**Téma:** A "Robotkéz" projekt továbbfejlesztése egy "Comet-szintű", operációs rendszert (Windows) és böngészőt is folyékony magyarsággal kezelő, n8n/Langflow integrációra képes ágenssé.

---

## 1. A Jelenlegi Állapot és a Célkitűzés
A jelenlegi `RobotkezV2Agent` már képes böngésző automatizálásra (Playwright + Python bridge), és rendelkezik egy Live View Dashboarddal.
**A Cél:** Ezt kiterjeszteni teljes "Computer Use" (számítógép-használat) képességekre, azaz a Windows asztalon való kattintásra, gépelésre, n8n és Langflow node-ok vizuális beállítására, miközben az Orchestrator folyamatosan irányítja és magyar nyelven kommunikál a felhasználóval az Overlay Chaten.

## 2. State-of-the-Art (SOTA) Technológiák 2026-ban
A kutatás alapján a jelenlegi legjobb eszközök a cél eléréséhez:

### 2.1. Böngésző Automatizálás (Browser-Use)
*   **A Standard:** A `browser-use` nyílt forráskódú Python könyvtár a jelenlegi iparági standard. Nem csak HTML-t olvas, hanem "látja" a képernyőt (Vision-Language Models), így a dinamikus UI elemeken (pl. egy n8n canvas) is tud tájékozódni.
*   **Előny:** Sokkal stabilabb, mint a hagyományos CSS szelektoros Playwright scriptek. Képes a "Comet" szintű vizuális interakciókra.

### 2.2. OS Szintű Computer Use (Windows UI Vezérlés)
A teljes Windows-vezérléshez két irány lehetséges:
1.  **Anthropic Computer Use API:** A legfejlettebb, beépített megoldás (Claude 3.5 Sonnet használatával). Képes screenshotokat elemezni és X/Y koordinátákon kattintani, gépelni.
2.  **Open Source Alternatívák (Agent S2, OmniParser, UI-TARS):** Ezek a VLM (Vision-Language) modellek kifejezetten a Windows asztal megértésére és a `pyautogui` / `pynput` könyvtárak vezérlésére lettek kiképezve. A Microsoft OmniParser-je kiválóan alakítja a Windows UI-t kattintható bounding boxokká az LLM számára.

### 2.3. n8n és Langflow Vizuális Kezelése
Az n8n node-ok beállítása hagyományos DOM manipulációval nehéz a canvas alapú felület (React Flow / Vue Flow) miatt.
*   **Megoldás:** Vizuális "Bounding Box" felismerés. A képernyőképet a Vision modell elemzi, azonosítja a "Set Node" vagy "HTTP Request" dobozokat, és a Computer Use API segítségével odamozgatja az egeret, majd fizikai kattintást szimulál.

## 3. Integrációs Stratégia a Brunella Rendszerbe (BVAB - Brunella Vision & Action Bridge)

### 3.1. Hibrid Action Server (Python)
A meglévő `myai/server.py` kiterjesztése:
*   **Playwright Engine:** A webes feladatokhoz (böngésző).
*   **OS Engine:** A Windows feladatokhoz (PyAutoGUI + MSS képernyőlopás).
*   **Vision Parser:** Minden lépés előtt screenshot készül. A képet elküldjük a Vision modellnek (GPT-4o / Gemini 2.0 Flash / Claude), ami visszaadja a kattintandó X/Y koordinátákat.

### 3.2. Az Orchestrator és a Robotkéz Kapcsolata
A felhasználó az Orchestratorral beszél. Az Orchestrator ismeri a kontextust (pl. tudja, hogy a felhasználó egy Lead Mining n8n workflow-t épít).
*   **Folyamat:** 
    1. Felhasználó: "Állítsd be a HTTP node-ot az n8n-ben erre az API-ra."
    2. Orchestrator: Lebontja lépésekre ("Keresd meg a HTTP node-ot -> Dupla kattintás -> Válaszd ki a Method dropdown-t -> Írd be a URL-t").
    3. Robotkéz: Végrehajtja a lépéseket a Computer Use API-n keresztül, vizuális visszacsatolással.

### 3.3. Folyékony Magyar Kontextus és Overlay Chat
*   A Dashboardon már meglévő `RobotkezV2Chat` React komponens továbbfejlesztése.
*   A folyamat közben a Robotkéz státuszüzeneteket küld vissza (pl.: "Látom az n8n vásznat. Rákattintok a webhook node-ra...").

## 4. Javaslatok a Megvalósításhoz (Következő Lépések - Plan fázis)
1.  **Computer Use Modul:** Integrálni a `pyautogui`-t és az Anthropic/OpenAI Vision API-kat a Python szerverbe a pontos képernyő-koordináta alapú kattintásokhoz.
2.  **Ágens Kommunikáció:** Az Orchestrator agent képességeinek bővítése egy `delegate_to_robotkez` funkcióval, ami strukturált JSON formában adja át az UI navigációs lépéseket.
3.  **n8n Tesztkörnyezet:** Készíteni egy dedikált tesztet, ahol a Robotkéz egy üres n8n workflow-ban létrehoz és összeköt két node-ot, pusztán a képernyő "látása" alapján.

---
*A kutatás lezárult. Készen áll a tervezési (Plan) fázisra.*