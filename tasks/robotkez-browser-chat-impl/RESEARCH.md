# Kutatási Jelentés: RobotkezV2 Browser Chat & Kódolási Képesség Bővítés

**Dátum:** 2026. március 1.
**Téma:** A felhasználói visszajelzés alapján az Orchestrator helytelenül hívta meg a `RobotkezV2Agent`-et ("Bot kódolása Playwright segítségével"), amikor a felhasználó valójában csak egy **böngésző példány megnyitását és a böngésző chat** elindítását kérte. 

---

## 1. A Probléma Gyökere (Miért hibázott az Orchestrator?)

A felhasználói prompt ez volt (vagy ehhez hasonló): *"Nyisson meg a robotkéz egy böngésző példányt mert a böngésző chaten keresztül szeretnék kommunikálni."*

Az újonnan okosított `OrchestratorAgent` a következő hibát vétette:
1.  **Túltervezés (Over-planning):** Ahelyett, hogy egyszerűen meghívta volna a `delegate_task` eszközt a `RobotkezV2Agent`-re a böngésző indítási paranccsal, generált egy komplex, 3 lépéses tervet (`SpecWriter` -> `RobotkezV2` mint kódoló -> `Evaluator`).
2.  **Szerepzavar:** Azt feltételezte, hogy a "böngésző chat botot" le kell programozni (implementálni kell Playwright-al), ahelyett, hogy a *már létező* képességet (a böngésző megnyitását a chat overlay-el) aktiválta volna.

Ez az "elméleti tervezés" (mocking) pontosan az a viselkedés, amit a `DeveloperAgent` "Zero-Mock" protokolljával párhuzamosan az `OrchestratorAgent`-ből is teljesen ki kell irtanunk. A ReAct ciklus megvan, de a **rendszerprompt még mindig generálhat "fantom" terveket** ahelyett, hogy azonnal cselekedne.

## 2. Megoldási Irány (Az "Over-planning" megszüntetése)

Az `OrchestratorAgent.ts` rendszerpromptját szigorítani kell.

### 2.1 Prompt Engineering Szigorítások:
*   **Tiltott viselkedés:** "SOHA ne generálj Markdown execution planeket (pl. 'design', 'implementation', 'test' fázisokkal), ha a felhasználó egy azonnali, futtatható parancsot kér (pl. 'Nyisd meg a böngészőt')."
*   **Azonnali Cselekvés:** "Ha a kérés egyértelmű (pl. böngésző indítása), AZONNAL hívd meg a `delegate_task` eszközt a `robotkezv2` ügynökkel, 'start_browser' vagy 'navigate' instrukcióval."

### 2.2 RobotkezV2 Képesség Finomítás:
Biztosítani kell, hogy a `RobotkezV2Agent` helyesen értelmezze a "nyiss meg egy böngészőt a chathez" típusú feladatokat, és meghívja a `browserEngine` megfelelő metódusát anélkül, hogy leállna hibával, amiért nincs konkrét URL.

## 3. A DeveloperAgent "Zero-Mock" párhuzama

Ez a probléma rávilágít, hogy a teljes rendszer (beleértve a `DeveloperAgent`-et is) túlzottan a "leírom, mit kéne tenni" irányba hajlik a "megteszem" helyett.
Amíg az Orchestratort finomhangoljuk a fenti prompttal, a `DeveloperAgent` "Zero-Mock" átalakítása (amiről a korábbi kutatás szólt) elengedhetetlen, hogy ha tényleg kódot kell írni, az fizikailag is megtörténjen, ne csak egy tervben jelenjen meg.

---
*A kutatás és diagnózis lezárult. Készen áll a tervezési (Plan) fázisra, ahol az Orchestrator promptját kijavítjuk, és a DeveloperAgent fájl-írási képességeit is bekötjük.*