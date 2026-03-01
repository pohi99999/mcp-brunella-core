# Kutatási Jelentés: DeveloperAgent Real Execution & Live Studio Mode

**Dátum:** 2026. március 1.
**Téma:** A `DeveloperAgent` átalakítása "Zero-Mock" protokollra, ahol szöveg generálása helyett közvetlenül fájlokat manipulál, tesztel és önműködően javít a ReAct (Tool Calling) logika segítségével.

---

## 1. A Jelenlegi Állapot Elemzése (`src/agents/DeveloperAgent.ts`)

A jelenlegi `DeveloperAgent` így működik kódgeneráláskor (`handleCodeGeneration`):
1.  Összeállít egy promptot (feladat leírása + kontextus).
2.  Meghívja a `generateResponse` függvényt (amely csak szöveget ad vissza).
3.  Ha kapott `filePath`-t a kontextusban, egy az egyben elmenti a visszaadott szöveget abba a fájlba.
4.  Megpróbálja lefordítani (`tryBuild`), és ha elszáll, egy egyszerű, 3-lépéses újrapróbálkozási hurkot hajt végre.

**Problémák (Amiért "Mock" élményt ad):**
*   **Nem interaktív:** Nem tud önállóan tájékozódni a kódbázisban (nem tud fájlokat olvasni, vagy listázni). Vak repülésben van, csak azt látja, amit a kontextusban megkapott.
*   **Csak egy fájlt tud írni:** A visszatérési értéket egy az egyben írja ki a fájlba. Ha egy új komponenst és a hozzá tartozó CSS-t, vagy routingot is módosítani kéne, nem tudja megtenni egy lépésben.
*   **Nincs valós idejű visszajelzés:** Nem logol vissza a Dashboard/Live Studio felületre a kódolás közben (nincs "Ügynök gépel..." típusú üzenet).

## 2. A "Zero-Mock" Protokoll (Megoldási Irány)

Ahogy az OrchestratorAgent-nél tettük, a DeveloperAgent-et is át kell kapcsolni a **Bifrost Gateway Tool Calling (ReAct) ciklusára**. 

### Elérhető Eszközök (Tools) a Developer számára:
Ahhoz, hogy valódi szoftvermérnökként dolgozzon, a következő eszközökre van szüksége (JSON Schema formában definiálva):
1.  `read_file(path)`: Egy adott fájl tartalmának beolvasása.
2.  `write_file(path, content)`: Egy fájl létrehozása vagy felülírása.
3.  `replace_in_file(path, old_string, new_string)`: Egy meglévő fájl egy részének módosítása.
4.  `run_shell_command(command)`: Parancsok futtatása (pl. `npm run test`, `npm run lint`, `npx tsc`).
5.  `send_status_message(message)`: Élő logok küldése a Dashboardra a kódolás alatt.

### Az Új Developer ReAct Ciklus:
1.  A modell megkapja a feladatot.
2.  **Tájékozódik:** Meghívja a `read_file` vagy shell eszközöket.
3.  **Kódol:** Meghívja a `write_file` vagy `replace_in_file` eszközöket (akár több fájlon is). Minden mentésnél meghívja a `send_status_message`-t ("Fájl mentve: src/components/Valami.tsx").
4.  **Tesztel:** Meghívja a `run_shell_command("npm test")` eszközt.
5.  **Self-Heal:** Ha a shell parancs hibát dob, elolvassa, és visszatér a 3. lépéshez.
6.  **Kész:** Ha minden zöld, kilép a ciklusból és visszajelez.

## 3. Technikai Megvalósíthatóság és Javaslatok

*   **LLM Kliens csere:** Ahogy az Orchestratornál, itt is a `bifrost_gateway.ts`-t kell használni a `generateResponse` (ami csak stringet ad) helyett.
*   **Biztonság:** A `run_shell_command` eszközt szigorúan korlátozni vagy monitorozni kell, hogy ne futtasson destruktív parancsokat (pl. `rm -rf /`).
*   **Socket.IO integráció:** A `send_status_message` eszköz használhatja a meglévő `socketService.broadcastChatter` (vagy a TerminalLog) rendszert, hogy a felhasználó élőben lássa a munkát.

---
*A kutatás befejeződött. Készen áll a tervezési (Plan) fázisra.*