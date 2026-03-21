# TervezĂ©si Dokumentum: RobotkĂ©z V2 - Collaborative Mission Control

**DĂˇtum:** 2026-03-20  
**StĂˇtusz:** ValidĂˇlt (Brainstorming lezĂˇrva)  
**VerziĂł:** 1.0.0  

## 1. Ă–sszefoglalĂł
A projekt cĂ©lja a RobotkĂ©z ĂĽgynĂ¶k kĂ©pessĂ©geinek kiterjesztĂ©se a ComputerUse Ă©s Chrome DevTools funkciĂłk mĂ©ly integrĂˇciĂłjĂˇval. A rendszer egy hibrid munkafolyamatot tĂˇmogat, ahol az AI autonĂłm mĂłdon dolgozik a bĂ¶ngĂ©szĹ‘ben, de a Dashboard felĂĽleten keresztĂĽl valĂłs idejĹ± betekintĂ©st Ă©s beavatkozĂˇsi lehetĹ‘sĂ©get biztosĂ­t a felhasznĂˇlĂł szĂˇmĂˇra.

## 2. ArchitektĂşra (HĂˇromoldalĂş SzinkronizĂˇciĂł)
*   **Frontend (React):** Ăšj MissionControlPanel komponens Socket.IO kapcsolattal.
*   **Backend (Node.js):** CollaborationManager szerviz az ĂĽgynĂ¶k ĂˇllapotĂˇnak Ă©s a felhasznĂˇlĂłi interakciĂłknak a koordinĂˇlĂˇsĂˇra.
*   **VĂ©grehajtĂł Motor (Python):** KibĹ‘vĂ­tett FastAPI szerviz, amely a Playwright rĂ©vĂ©n kezeli a Chrome-ot, kĂ¶zvetĂ­ti a DevTools adatokat Ă©s vĂ©grehajtja a ComputerUse parancsokat.

## 3. FelhasznĂˇlĂłi FelĂĽlet (Dashboard)
### 3.1 Dinamikus Terv Panel
*   Hierarchikus feladatlista az AI aktuĂˇlis stratĂ©giĂˇjĂˇval.
*   ValĂłs idejĹ± ĂˇllapotjelzĂ©s (IDLE, WORKING, SUCCESS, ERROR).
*   IndoklĂˇsok Ă©s technikai rĂ©szletek megjelenĂ­tĂ©se minden lĂ©pĂ©snĂ©l.

### 3.2 InteraktĂ­v BĂ¶ngĂ©szĹ‘ Canvas
*   Ă‰lĹ‘ kĂ©pfolyam a bĂ¶ngĂ©szĹ‘rĹ‘l.
*   **KattintĂˇs tĂ¶bbĂ­tĂ©s:** A kĂ©pre kattintva a koordinĂˇtĂˇk (0-1000) visszakĂĽldĂ©se a Chrome-nak.
*   **VizuĂˇlis Overlay:** Az azonosĂ­tott elemek (gombok, mezĹ‘k) kiemelĂ©se a kĂ©pen.

### 3.3 DevTools Monitor
*   Kompakt sĂˇv a hĂˇlĂłzati forgalom, konzol hibĂˇk Ă©s teljesĂ­tmĂ©ny elemzĂ©sĂ©hez.

## 4. Human-in-the-loop Protokoll
1.  **FelismerĂ©s:** Az AI felismeri a blokkolĂłt (CAPTCHA, popup, 403 hiba).
2.  **FelfĂĽggesztĂ©s:** Az ĂĽgynĂ¶k 'Awaiting Help' Ăˇllapotba kerĂĽl.
3.  **BeavatkozĂˇs:** A felhasznĂˇlĂł chaten vagy kĂ¶zvetlen kattintĂˇssal segĂ­t.
4.  **FolytatĂˇs:** Az AI Ă©szleli a vĂˇltozĂˇst Ă©s Ăşjratervezi a kĂ¶vetkezĹ‘ lĂ©pĂ©st.

## 5. TechnolĂłgiai Stack
*   **Nyelv:** TypeScript (Backend/Frontend), Python (VĂ©grehajtĂł).
*   **KommunikĂˇciĂł:** Socket.IO, REST API.
*   **BĂ¶ngĂ©szĹ‘:** Playwright, Chrome DevTools Protocol.
*   **AI:** Gemini 2.0 Flash (Vision Ă©s Planning).
