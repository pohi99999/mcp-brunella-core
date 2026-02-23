# KÉRÉS: Új Track Generálása - Dashboard V3 "Command Center"

Kérlek, hozz létre egy új fejlesztési tracket a következő paraméterekkel az EPP v2 protokoll szerint:

**Track Neve:** `dashboard_v3_command_center_20260219`
**Típus:** UI/UX & System Architecture Refactor
**Prioritás:** HIGH

**Célkitűzés:**
A jelenlegi Mission Control Dashboard (v2.1) átalakítása egy teljesen moduláris, testreszabható és mély integrációval rendelkező „Parancsnoki Központtá”. A cél, hogy a felhasználó minden háttérfolyamatot valós időben lásson és beavatkozhasson, miközben a kódháttér (wiring) egységes és karbantartható marad.

**Főbb Fázisok és Követelmények:**

1. **Phase 1: A „Smart Grid” Architektúra (Layout & Positioning)**
   - **Probléma:** A jelenlegi panelek fixek vagy nehezen átláthatók sok ügynök esetén.
   - **Megoldás:** Implementálj egy **Context-Aware Layout Engine**-t.
   - **Funkció:** A Dashboard automatikusan rendezze át a modulokat az aktuális fókusz alapján (pl. „Dev Mode” -> Terminal & Editor nagyban; „Ops Mode” -> Health & Metrics nagyban).
   - **Tech:** React Context API + CSS Grid Area dinamikus manipuláció.

2. **Phase 2: Unified Signal Bus (A „Bekötés” Tökéletesítése)**
   - **Probléma:** A Socket.IO eventek és a REST API hívások néhol redundánsak vagy nem szinkronizáltak.
   - **Megoldás:** Hozz létre egy **`useSystemSignal`** nevű központi React hook-ot.
   - **Funkció:** Ez az egyetlen hook feleljen az összes valós idejű adat (Logs, AgentStatus, TaskQueue) szinkronizálásáért. Ha a Socket megszakad, automatikusan váltson REST pollingra (Fallback), majd vissza. Garantáld a „Single Source of Truth” elvet a frontend állapotkezelésében (Zustand store).

3. **Phase 3: The Process Governor (Vezérlés minden szinten)**
   - **Probléma:** Látjuk a feladatokat, de nehézkes a beavatkozás.
   - **Megoldás:** Fejleszd ki a **`ProcessControlWidget`** komponenst.
   - **Funkció:**
     - **Live Intervenció:** Gombok a folyamatokhoz: [PAUSE], [RESUME], [KILL], [RETRY w/ DEBUG].
     - **Mélyfúrás:** Egy folyamatra kattintva mutassa a teljes Trace-t (LangSmith/OpenTelemetry adatok vizualizációja).
     - **Prioritás váltás:** Drag-and-drop a Task Queue-ban a sorrend megváltoztatásához.

4. **Phase 4: Self-Maintenance & Health (Karbantartás)**
   - **Megoldás:** Integrálj egy **UI Test Suite**-ot a Dashboardon belül.
   - **Funkció:** Egy rejtett „Admin/Self-Check” fül, ahol gombnyomásra lefuttatható egy kliens oldali diagnosztika (eléri-e a backendet, renderelődnek-e a komponensek, válaszolnak-e a socketek).

**Elvárt Kimenet (Definition of Done):**
- A `src/dashboard/components/dashboard/` mappa újradrukturálása moduláris widgetekké.
- A `MissionControlLayout.tsx` refaktorálása az új Grid Engine használatára.
- Minden API hívás típusbiztos (Type-Safe) és hibatűrő.
- A CLI-ből is elérhető legyen a dashboard állapotának lekérdezése (`brunella dashboard status`).

Generáld le a `spec.md`, `plan.md` és `meta.json` fájlokat, majd indítsd el az első fázist!