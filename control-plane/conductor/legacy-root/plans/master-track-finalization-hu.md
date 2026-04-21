# Megvalósítási Terv: Master Track Lezárás & Dashboard V3 Integráció

**Cél:** A `master_track_1_lead_mining_20260223` track 80%-ról 100%-ra emelése, mock adatok lecserélése valós folyamatokra, és az eredmények perzisztens megjelenítése a Dashboard V3-ban.

---

### 1. Fázis: Adatmodell és Perzisztencia (Backend)

**Cél:** Egy olyan struktúra létrehozása, ahol a bányászati kampányok eredményei mentésre kerülnek, így a Dashboard frissítése után is láthatóak maradnak.

- **Lépés 1.1: SQLite séma bővítése**
  - Módosítandó fájl: `src/utils/db.ts`
  - Feladat: Új `business_jobs` tábla létrehozása (id, type, status, query, results_json, created_at).
- **Lépés 1.2: API végpontok létrehozása**
  - Új fájl: `src/server/routes/businessJobs.ts`
  - Feladat: GET (lista), POST (új indítása), GET /:id (részletek) végpontok.
  - Regisztráció a `src/server/web.ts`-ben.

---

### 2. Fázis: LeadMiningAgent Valódi Logika (Agent)

**Cél:** A `LeadMiningAgent.ts` átalakítása, hogy ne mock Python kódot futtasson, hanem valódi külső eszközöket használjon.

- **Lépés 2.1: Apify Integráció**
  - Módosítandó fájl: `src/agents/LeadMiningAgent.ts`
  - Feladat: A `google_maps_scraper.py` hívása helyett az `apify-lead-generation` skill vagy közvetlen `call-actor` használata.
- **Lépés 2.2: RobotkezV2 Fallback**
  - Feladat: Ha az Apify hibaüzenetet küld (pl. nincs kredit), az ágens automatikusan váltson a `RobotkezV2`-re a helyi bányászathoz.
- **Lépés 2.3: Eredmények mentése**
  - Feladat: A folyamat végén a `db.saveBusinessJob` hívása a lementett lead listával.

---

### 3. Fázis: Dashboard V3 UI Finomítás (Frontend)

**Cél:** A `LeadMiningWidget.tsx` összekötése a valós backenddel.

- **Lépés 3.1: Állapotkezelés (Zustand)**
  - Feladat: Új `useBusinessStore` létrehozása a kampányok állapotának követésére.
- **Lépés 3.2: Widget refaktor**
  - Módosítandó fájl: `src/dashboard/components/dashboard/LeadMiningWidget.tsx`
  - Feladat: A fix 3 másodperces timer törlése. Helyette SSE vagy periodikus polling a `/api/v1/business-jobs` végponton a valós állapot (pl. "Scraping...", "Enriching...") megjelenítéséhez.
- **Lépés 3.3: Export gomb implementálása**
  - Feladat: A "CRM-be küldés" helyett egy "Exportálás Google Sheets-be" gomb, ami meghívja a `googleWorkspace.ts` funkcióit.

---

### 4. Fázis: Verifikáció és Tesztelés

- **Lépés 4.1: E2E Teszt**
  - Új fájl: `test/e2e/lead_mining_flow.test.ts`
  - Feladat: Teljes folyamat tesztelése: Indítás a UI-ról -> Ágens futás -> Mentés DB-be -> Megjelenítés a listában.
- **Lépés 4.2: Biztonsági Audit**
  - Feladat: Ellenőrizni, hogy a Google API tokenek és Apify kulcsok nem szivárognak-e ki a kliens oldalra.

---

### Következő lépés a felhasználónak:
Futtasd az `/exit_plan_mode` parancsot a jóváhagyáshoz és az implementáció megkezdéséhez.
