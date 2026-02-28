# Track: Master Track 1 - RobotkezV2 & Lead Mining Integration

**Track ID:** `master_track_1_lead_mining_20260223`
**Status:** PROPOSED
**Priority:** HIGH (Immediate Monetization Value)
**Created:** 2026-02-23

---

## 🎯 Célkitűzés

A `RobotkezV2` ágens képességeinek és a `Sales Hunter` ágens céljainak integrálása egy önálló, bevételszerző B2B lead generáló szolgáltatás létrehozása érdekében. Az új szolgáltatás feladata, hogy célzott cégeket találjon, azok weboldalát és profiljait elemezze (RobotkezV2), majd releváns, MI által generált "jégtörő" mondatokkal ellátott potenciális ügyfél listát (Google Sheets formátumban) szállítson.

---

## 🛠️ Érintett Fájlok és Komponensek

-   **`src/agents/RobotkezV2Agent.ts`**: A böngésző vezérléséért és webes adatok szkeneléséért felelős.
-   **`src/agents/SalesHunterAgent.ts`**: Lead scoring, CRM export és email draftolás logikája.
-   **`myai/workers/google_maps_scraper.py`**: Új Python worker a Google Maps és cégjegyzékek adatainak lekérdezéséhez.
-   **`myai/workers/icebreaker_generator.py`**: Python worker az egyedi "jégtörő" mondatok generálásához LLM használatával.
-   **`src/tools/googleWorkspace.ts`**: Google Sheets írási és fájlkezelési eszközök.
-   **`conductor/tracks/master_track_1_lead_mining_20260223/spec.md`**: Ez a fájl.
-   **`conductor/tracks/master_track_1_lead_mining_20260223/plan.md`**: A megvalósítási terv.

---

## 📋 Megvalósítási Terv (Phases)

### Phase 1: RobotkezV2 Képességek Bővítése (Web & Maps Scraping)
- **Cél:** A `RobotkezV2` legyen képes célzottan céges weboldalakat, LinkedIn profilokat és Google Maps releváns adatait (cím, elérhetőség, weboldal, tevékenység) lekérdezni.
- **Feladatok:**
    1.  Fejleszd a `RobotkezV2Agent.ts`-t, hogy tudjon specifikus weboldalakról cégadatokat (név, cím, weboldal, LinkedIn URL) lekérni.
    2.  Implementáld a `myai/workers/google_maps_scraper.py` scriptet, ami képes Google Maps keresést végezni (pl. "magyar fogorvosok Budapesten") és strukturált JSON-ban visszaadni az eredményeket (név, cím, weboldal).
    3.  Teszteld az új képességeket célzott `brunella` parancsokkal.

### Phase 2: Icebreaker Generator & Data Scientist Integration
- **Cél:** Generálj egyedi, kontextusfüggő "jégtörő" mondatokat a cég weboldaláról és a talált releváns információkból.
- **Feladatok:**
    1.  Implementáld a `myai/workers/icebreaker_generator.py` scriptet, ami elfogadja a cég weboldalának vagy profiljának szöveges tartalmát, és LLM (pl. Gemini Flash) segítségével generál egy személyre szabott jégtörő mondatot.
    2.  Integráld a `SalesHunterAgent.ts`-be vagy egy új `LeadEnrichmentAgent.ts`-be a `icebreaker_generator` és `google_maps_scraper` (vagy más releváns scraper) használatát.
    3.  A `DataScientistAgent.ts` legyen képes a scraper eredményeit feldolgozni és előkészíteni a Google Sheets exportra.

### Phase 3: Lead List Generation & CRM Export
- **Cél:** A feldolgozott lead adatok (céginfó, kontakt, jégtörő) strukturált Google Sheets fájlba mentése.
- **Feladatok:**
    1.  A `SalesHunterAgent.ts` vagy egy dedikált `LeadExportAgent.ts` használja a `googleWorkspace.ts` eszközeit a Google Sheets generálásához.
    2.  A generált Sheet-ben legyenek oszlopok a cég nevének, releváns kontakt adatainak, weboldalának és az MI által generált jégtörő mondatának.
    3.  Biztosítsd a megosztási jogokat a kliens számára (dokumentáció vagy automatikus megosztási beállítás).

### Phase 4: Service Packaging & Documentation
- **Cél:** A teljes folyamat csomagolása egy eladható szolgáltatásként, dokumentációval és árképzési modellel.
- **Feladatok:**
    1.  Definiáld a szolgáltatás üzleti modelljét: "Setup fee" + havidíj az aktív lead szállításért?
    2.  Készítsd el az ügyfél dokumentációt (`docs/services/lead-generation-service.md`), ami leírja a folyamatot és az igényelt bemeneteket (célcsoport leírása).
    3.  Konfiguráld a BAS-t, hogy képes legyen ezt a szolgáltatást "Track"-ként kezelni és automatikusan elindítani.
    4.  Készítsd el az első 3 "aranybánya" ügyfél case study-t.

---

## ✅ Definition of Done

- [ ] RobotkezV2 képes cégadatokat és Google Maps infókat lekérdezni.
- [ ] Icebreaker generator működik és releváns mondatokat generál.
- [ ] A kinyert lead adatok (cég, kontakt, icebreaker) Google Sheetbe kerülnek mentésre.
- [ ] Létrejött a szolgáltatás dokumentációja és ajánlata.
- [ ] Az első 3 teszt ügyfélre (pl. magyar fogorvosok) sikeres listát generáltunk.

---

## 🔗 Függőségek

- Működő `RobotkezV2Agent`.
- Hozzáférés a Google Workspace API-hoz (Sheets, Drive).
- Hozzáférés egy LLM-hez az icebreaker generáláshoz.

---

## 📝 Megjegyzések

- A "jégtörő" mondatok minősége kritikus az ügyfél-elégedettség szempontjából. Ezt iteratívan kell fejleszteni.
- A Google Maps scrapinghez be kell tartani a használati feltételeket (rate limiting).
- A leadok validitásának ellenőrzése (email cím létezése) egy jövőbeli fejlesztés lehet.

---

**Track Spec Version:** 1.0  
**Last Updated:** 2026-02-23  
**Maintained By:** BAS Orchestration Team
