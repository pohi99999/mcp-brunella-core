# Track: Master Track 3 - Green Market Watcher B2B

**Track ID:** `master_track_3_market_watcher_20260223`
**Status:** PROPOSED
**Priority:** HIGH (Immediate Monetization Value)
**Created:** 2026-02-23

---

## 🎯 Célkitűzés

A "Green Lightning" (EV Hunter) és az "Industrial Machine Hunter" ágensek alapul vételével egy általános, B2B piacra szabott piaci/konkurencia figyelő szolgáltatás létrehozása. A szolgáltatás képes lesz folyamatosan monitorozni a célpiacot (pl. e-kereskedelem, ingatlan), azonosítani az alulárazott/magas potenciálú termékeket/szolgáltatásokat, versenytársak árazását, készletét, majd automatikus riasztásokat és napi jelentéseket küldeni (email, Slack).

---

## 🛠️ Érintett Fájlok és Komponensek

-   **`src/agents/MarketIntelAgent.ts`**: Fő orchestrátor ágens a piaci figyeléshez.
-   **`src/agents/ResearcherAgent.ts`**: Web scraping és adatgyűjtés.
-   **`src/agents/DataScientistAgent.ts`**: Értékbecslés, pontozás és adatelemzés.
-   **`myai/workers/market_scraper.py`**: Általános Python worker weboldalak strukturált adatainak kinyerésére.
-   **`myai/refiners/product_valuation.py`**: Python worker a termékek/szolgáltatások értékbecsléséhez és pontozásához.
-   **`src/tools/googleWorkspace.ts`**: Google Sheets export és dokumentum generálás (riportokhoz).
-   **`src/tools/n8n_webhook.ts`**: n8n workflow-k indítása és paraméterezése az értesítésekhez.
-   **`n8n/workflows/market_watcher_report.json`**: n8n workflow napi/heti riportok küldésére.
-   **`conductor/tracks/archive/green_lightning_20260212/spec.md`**: Az EV Hunter logika referencia.
-   **`conductor/tracks/archive/industrial_machine_hunter_20260216/spec.md`**: Ipari gépek figyelési logikája referencia.

---

## 📋 Megvalósítási Terv (Phases)

### Phase 1: Általános Piaci Scraper Worker (Python)
-   **Cél:** Egy rugalmas Python worker létrehozása, ami képes bármilyen weboldalról (előre definiált selectorok alapján) adatokat kinyerni.
-   **Feladatok:**
    1.  Implementáld a `myai/workers/market_scraper.py` scriptet, ami:
        *   URL-t és CSS/XPath selectorokat fogad paraméterként.
        *   Képes terméknevet, árat, elérhetőséget, leírást kinyerni.
        *   Strukturált JSON kimenetet ad vissza.
    2.  Integráld a `MarketIntelAgent.ts`-be a `market_scraper.py` meghívását.

### Phase 2: Értékbecslés & Potenciál Pontozás (Data Scientist)
-   **Cél:** A kinyert adatok alapján a termékek/szolgáltatások valós piaci értékének és potenciáljának becslése.
-   **Feladatok:**
    1.  Implementáld a `myai/refiners/product_valuation.py` scriptet, ami:
        *   `MarketIntelAgent`-től kapott strukturált termékadatokat (ár, leírás, kategória) fogad.
        *   Képes összevetni korábbi adatokkal (LanceDB).
        *   Kiszámol egy "potenciál score"-t (pl. alulárazottság, ritkaság, kereslet).
        *   `BUY`/`WATCH`/`IGNORE` ajánlást ad (akár ML modell segítségével).
    2.  A `DataScientistAgent.ts` hívja meg a `product_valuation.py`-t és tárolja az eredményeket LanceDB-ben.

### Phase 3: LanceDB Adattárolás és Históriák
-   **Cél:** A monitorozott adatok és a pontszámok hosszú távú tárolása elemzés céljából.
-   **Feladatok:**
    1.  Definiáld a LanceDB schema-t a `market_intel_data` táblához, ami tartalmazza a kinyert adatokat, a pontszámokat és a timestamp-et.
    2.  A `MarketIntelAgent.ts` írja be a `DataScientistAgent.ts` által feldolgozott adatokat a LanceDB-be.
    3.  Implementáld a historikus adatok lekérdezését a `product_valuation.py`-be a pontosabb pontszámokhoz.

### Phase 4: Automatikus Riasztások és Jelentések (n8n & Email/Slack)
-   **Cél:** Napi jelentések és azonnali riasztások küldése a kliensnek.
-   **Feladatok:**
    1.  Készíts egy `n8n/workflows/market_watcher_report.json` workflow-t, ami:
        *   Napi szinten fut (cron trigger).
        *   Lekérdezi az elmúlt 24 óra `BUY` ajánlásokat LanceDB-ből.
        *   Összefoglaló emailt generál Google Docs/Markdown formátumban.
        *   Slack üzenetet küldhet.
    2.  A `MarketIntelAgent.ts` vagy egy új `AlertingAgent.ts` képes legyen riasztást küldeni az n8n workflow-nak (pl. ha valaki ára 10%-ot esik).

### Phase 5: Service Packaging & Client Portal
-   **Cél:** A szolgáltatás csomagolása és az ügyfélportál/konfiguráció felkészítése.
-   **Feladatok:**
    1.  Definiáld a havidíjas üzleti modellt (pl. 50-150 ezer Ft/hó).
    2.  Készítsd el az ügyfél dokumentációt (`docs/services/green-market-watcher.md`), ami leírja a szolgáltatás működését, a konfigurációs lehetőségeket (figyelt piac, kulcsszavak, értesítések).
    3.  Fejleszd ki az ügyfélportál felületet (minimalista Dashboard komponens), ahol az ügyfél beállíthatja a figyelt kulcsszavakat, versenytársakat és értesítési preferenciákat.

---

## ✅ Definition of Done

- [ ] Rugalmas Python web scraper működik és releváns adatokat szed le.
- [ ] Pontozó rendszer azonosítja az alulárazott/magas potenciálú termékeket.
- [ ] LanceDB tárolja a historikus piaci adatokat.
- [ ] Napi jelentések és riasztások küldése működik.
- [ ] Ügyfél dokumentáció és konfigurációs felület elkészült.
- [ ] `npm test` és `npm run build` PASS.

---

## 🔗 Függőségek

-   Működő `RobotkezV2Agent` (a scraper használatához).
-   Működő `MarketIntelAgent`, `ResearcherAgent`, `DataScientistAgent`.
-   LanceDB inicializálva.
-   n8n workflow engine fut.

---

## 📝 Megjegyzések

-   A scraper rugalmassága kulcsfontosságú. AI-vezérelt selector detektálás egy jövőbeli fejlesztés lehet.
-   Az árképzési modellnek figyelembe kell vennie a scraper "költségét" (proxy, anti-bot).
-   Javasolt egy "human-in-the-loop" review folyamat az első időszakban a pontosság ellenőrzésére.

---

**Track Spec Version:** 1.0  
**Last Updated:** 2026-02-23  
**Maintained By:** BAS Market Intelligence Team
