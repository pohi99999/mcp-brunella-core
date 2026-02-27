# Design Document: Brunella Robotkéz Pro (BVAB - Brunella Vision & Action Bridge)
**Dátum:** 2026-02-27
**Státusz:** Validált (Brainstorming után)

## 1. Absztrakt
A Robotkéz Pro célja a Brunella Agent System felruházása egy olyan autonóm operátori képességgel, amely képes a Windows operációs rendszeren és a Chrome böngészőben végrehajtani komplex munkafolyamatokat (különös tekintettel az n8n és Langflow beállítására). A rendszer a képalapú (Vision) és a szoftveralapú (UI Tree) vezérlést ötvözi a maximális precizitás érdekében.

## 2. Rendszerarchitektúra
A rendszer egy Python-alapú mikroszolgáltatásból (Action Server) áll, amely a következő komponenseket kezeli:
- **Playwright (Visible Mode):** Élő böngésző ablak, amelyben az AI látja a DOM struktúrát és a koordinátákat.
- **Windows UI Automation:** Natív ablakok és rendszerszintű elemek (pl. tálca, fájlkezelő) elérése.
- **Vision Integration:** GPT-4o vagy Gemini 2.0 API-n keresztüli screenshot-elemzés a vizuális megerősítéshez.

## 3. Működési Protokoll (COMET-style)
1. **Feladatfogadás:** Az Orchestrator lebontja a magyar nyelvű kérést elemi lépésekre.
2. **Környezetfelmérés:** Snapshot készül az aktuális UI állapotról (szemantikus fa + kép).
3. **Végrehajtás:** Az Action Server elvégzi a kattintást/gépelést a kiszámolt koordinátákon.
4. **Validálás:** Új snapshot készül. Ha az állapot nem változott az elvárt módon, a rendszer **3-szor újrapróbálkozik** különböző stratégiákkal (pl. lassabb kattintás, ablak frissítése).
5. **Jelentés:** A végrehajtás után strukturált Markdown összefoglalót küld a chaten.

## 4. Technikai Követelmények
- **Vision Model:** GPT-4o vagy Gemini 2.0 Pro (a térbeli tájékozódáshoz).
- **Backend:** Node.js (Orchestrator) <-> Python (Action Server) híd.
- **Képzés:** Automatizált vizuális regressziós tesztek n8n és Langflow felületeken.

## 5. Sikerességi Kritériumok
- 100% pontosság n8n node-ok összekötésénél.
- Alacsony késleltetésű élő nézet a Dashboard-on.
- Természetes, szakszerű magyar nyelvű kommunikáció a feladat állásáról.
