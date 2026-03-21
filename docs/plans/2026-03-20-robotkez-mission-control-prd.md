# PRD: RobotkĂ©z V2 - Collaborative Mission Control

## 1. CĂ©lkitĹ±zĂ©s
Egy professzionĂˇlis, hibrid bĂ¶ngĂ©szĹ‘-vezĂ©rlĹ‘ felĂĽlet lĂ©trehozĂˇsa, ahol a felhasznĂˇlĂł Ă©s az AI valĂłs idĹ‘ben tud egyĂĽttmĹ±kĂ¶dni. A rendszernek tĂˇmaszkodnia kell a ComputerUse (vizuĂˇlis vezĂ©rlĂ©s) Ă©s Chrome DevTools (technikai elemzĂ©s) funkciĂłkra.

## 2. KulcsfunkciĂłk
*   **ValĂłs idejĹ± Terv-kijelzĂ©s:** Az AI Ăˇltal generĂˇlt tĂ¶bblĂ©pĂ©ses terv megjelenĂ­tĂ©se Ă©s Ă©lĹ‘ frissĂ­tĂ©se.
*   **InteraktĂ­v Canvas:** A bĂ¶ngĂ©szĹ‘ kĂ©pĂ©nek megjelenĂ­tĂ©se, amin a felhasznĂˇlĂł kattintĂˇssal is beavatkozhat.
*   **DevTools Stream:** HĂˇlĂłzati hibĂˇk Ă©s konzol logok integrĂˇlĂˇsa az AI dĂ¶ntĂ©si folyamatĂˇba Ă©s a felĂĽletre.
*   **Human-in-the-loop:** Automatikus megĂˇllĂˇs Ă©s segĂ­tsĂ©gkĂ©rĂ©s blokkolĂł tĂ©nyezĹ‘k (CAPTCHA, popup) esetĂ©n.

## 3. Technikai kĂ¶vetelmĂ©nyek
*   WebSocket (Socket.IO) hasznĂˇlata a valĂłs idejĹ± kĂ©p Ă©s terv frissĂ­tĂ©shez.
*   A Python FastAPI szerviz kiterjesztĂ©se a koordinĂˇta-alapĂş kattintĂˇsok Ă©s DevTools adatok tĂˇmogatĂˇsĂˇhoz.
*   A Node.js backendben egy CollaborationManager osztĂˇly lĂ©trehozĂˇsa az ĂˇllapotkezelĂ©shez.

## 4. SikerkritĂ©riumok
*   A felhasznĂˇlĂł lĂˇtja a Dashboardon a RobotkĂ©z aktuĂˇlis lĂ©pĂ©sĂ©t Ă©s indoklĂˇsĂˇt.
*   A felhasznĂˇlĂł bele tud kattintani a kĂ©pbe, Ă©s a Chrome-ban vĂ©grehajtĂłdik a mĹ±velet.
*   A rendszer hiba nĂ©lkĂĽl kezeli a binĂˇris screenshotokat Ă©s a base64 konverziĂłt.
