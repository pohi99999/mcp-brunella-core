# Megvalósítási Terv: System-Wide "Zero-Mock" & ReAct Upgrade

**Dátum:** 2026. március 1.
**Cél:** A teljes Brunella Agent System (BAS) "Zero-Mock" protokollra állítása. Az Orchestrator és a kulcs-ügynökök (Developer, RobotkezV2) ne csak tervezzenek és Markdown kódokat generáljanak, hanem valódi fájlműveleteket, böngészővezérlést és shell parancsokat hajtsanak végre a ReAct (Tool Calling) logika alapján.

---

## 1. Fázis: OrchestratorAgent Szigorítás ("No More Fake Plans")
**Cél:** Az Orchestrator azonnal cselekedjen (Tool Calling), és soha ne generáljon Markdown listákat vagy "design, implementation, test" fázisú fiktív terveket.

- **1.1. System Prompt Hardening:**
  - Tiltólistára tenni a "Markdown Execution Plan" generálását.
  - Kötelezni a `delegate_task` azonnali hívására.
- **1.2. JSON Fallback Eltávolítása:**
  - A régi, JSON-szövegként visszaadott feladatlisták parse-olását eltávolítani. A kérés továbbítása *kizárólag* a ReAct `function_call` hurokon keresztül történhet.

## 2. Fázis: RobotkezV2Agent "Instant Open" Képesség
**Cél:** Képes legyen egy egyszerű "nyiss meg egy böngészőt" kérésre elindítani a Playwright-ot a chat overlay-el, hiba (hiányzó URL) nélkül.

- **2.1. Alapértelmezett URL:** Ha a feladat nem tartalmaz cél URL-t, nyissa meg a `about:blank` oldalt (vagy a Google-t), és injektálja a chatet.
- **2.2. Kényszerített Navigáció (Force Launch):** A `llmPlanner`-t felkészíteni arra, hogy egy "nyisd meg a böngészőt" kérésből egy egy lépéses `{ action: "navigate", url: "about:blank" }` tervet generáljon.

## 3. Fázis: DeveloperAgent "Zero-Mock" (A Fejlesztő Műhely)
**Cél:** A DeveloperAgent kapjon igazi "kezeket" a fájlrendszerhez, és ne csak chaten küldjön kódrészleteket.

- **3.1. ReAct Tool Hurok a Developer-nek is:**
  - Ahogy az Orchestrator megkapta a `getBifrostGateway()` tool-calling hurkát, a DeveloperAgent is megkapja.
- **3.2. Developer Eszköztár (JSON Schema Tools):**
  - `read_file(path)`
  - `write_file(path, content)`
  - `replace_in_file(path, old, new)`
  - `run_shell_command(command)` (Teszteléshez, buildeléshez)
- **3.3. Végrehajtási Ciklus:**
  - Kódolás (write_file) -> Tesztelés (run_shell_command) -> Öngyógyítás (ha a teszt fail) -> Válasz a usernek ("A fájl mentve, a build sikeres").

## 4. Fázis: Általános Ügynök Tool-Kiképzés
**Cél:** A többi létező ügynök (pl. Evaluator) ne adjon vissza fiktív "a tesztek lefutottak" üzeneteket, hanem kötelezően hívja meg a `run_shell_command("npm test")` tool-t, és annak a kimenetét elemezze.

---

## Ellenőrzési Pontok (Definition of Done)
- [ ] Az Orchestrator a "Nyisd meg a böngészőt" kérésre azonnal, szöveges litánia nélkül elindítja a RobotkezV2-t.
- [ ] A RobotkezV2 képes egy üres ablakot nyitni az Overlay Chattel, URL megadása nélkül is.
- [ ] A DeveloperAgent képes egy kérésre ("Írj egy test komponenst") *ténylegesen* létrehozni a `.tsx` fájlt a lemezen, majd szólni, hogy kész.
- [ ] Az Evaluator a valós `npm test` kimenetét adja vissza.

---
**Következő lépés:** `/blueprint:define` a feladatok részletes lebontásához.