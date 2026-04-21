


\# TRACK START: data\_flywheel\_daily\_cycle\_20260219



\## 🎯 Célkitűzés

A BAS "Data Flywheel" (Adat-volán) elméletének gyakorlati automatizálása. A cél egy felügyelet nélküli, napi ciklus létrehozása, amely begyűjti az adatot, megtisztítja, indexeli, és validálja a "Golden Dataset" növekedését.



\## 📖 Kontextus (A "BAS Alkotmány")

Az ügynökök minőségét 5 pillér határozza meg:

1\. \*\*Adathűség:\*\* Nyers zajból -> Tiszta JSON (Refiner Factory).

2\. \*\*Kognitív Tervezés:\*\* Intent Decompozíció (Orchestrator).

3\. \*\*Memória \& RAG:\*\* Vektoros tudás (LanceDB) és deduplikáció.

4\. \*\*Antifragilitás:\*\* Phoenix Protocol (hiba = tanulás).

5\. \*\*Specifikus Tanítás:\*\* Golden Dataset alapú finomhangolás.



\## 🛠️ Technikai Implementáció

\### A. Az Automatizált Ciklus (The Loop)

Ütemezés: Minden nap 03:00 (amikor a gépforrás szabad).



1\. \*\*Harvest (Aratás):\*\* 

&nbsp;  - Script: `python myai/agents/tech\_harvester.py --mode auto`

&nbsp;  - Feladat: Új technológiai trendek, library frissítések, versenytárs infók begyűjtése.

&nbsp;  

2\. \*\*Refine \& Index (Finomítás):\*\*

&nbsp;  - Script: `python myai/tools/knowledge\_integrator.py`

&nbsp;  - Feladat: Pydantic validáció, embedding generálás, LanceDB mentés.

&nbsp;  - Kimenet: `data/training/golden\_dataset.jsonl` bővítése.



3\. \*\*Verify (Ellenőrzés - Az "Esti Őrjárat"):\*\*

&nbsp;  - Agent: \*\*EvaluatorAgent\*\*

&nbsp;  - Feladat: Ellenőrizni, hogy a `golden\_dataset.jsonl` módosult-e az elmúlt 24 órában, és a sorok száma növekedett-e.

&nbsp;  - Alert: Ha nem történt növekedés, vagy hiba volt -> Slack/Dashboard értesítés (Phoenix Event).



\### B. Érintett Fájlok

\- `src/server/schedulers/daily\_trigger.ts` (Létrehozandó/Bővítendő): A cron job kezelője.

\- `myai/tools/knowledge\_integrator.py`: Golden Dataset append logika ellenőrzése.

\- `src/agents/EvaluatorAgent.ts`: Új képesség: `verify\_dataset\_growth`.



\## ✅ Elfogadási Kritériumok (Acceptance Criteria)

\- \[ ] A napi cron job hiba nélkül lefut.

\- \[ ] A `tech\_trends` LanceDB tábla új vektorokkal bővül.

\- \[ ] A `golden\_dataset.jsonl` fájl mérete nőtt.

\- \[ ] Az EvaluatorAgent sikeresen validálja a növekedést és logolja az eredményt ("Daily Harvest: SUCCESS, +15 new records").

\- \[ ] Hiba esetén a Phoenix Protocol újraindítja a folyamatot.

```



---



\### 👨‍🏫 2. Lépés: Mesteri Utasítás a Conductornak



Miután a fenti track létrejött, add ki ezt az utasítást a \*\*ProjectConductorAgent\*\*-nek (vagy az Orchestratornak), hogy kezdje meg a végrehajtást:



> "Kedves Conductor! Indítsd el a \*\*`data\_flywheel\_daily\_cycle\_20260219`\*\* tracket.

>

> \*\*Feladatod:\*\*

> 1.  Hozd létre a `src/server/schedulers/daily\_trigger.ts` fájlt (vagy használd a meglévő `scheduledTasksRunner.ts`-t), ami Node-cron segítségével minden hajnalban elindítja a Python Harvestert.

> 2.  Instruáld a \*\*DeveloperAgent\*\*-et, hogy írjon egy tesztet (`test/daily\_cycle.test.ts`), ami szimulálja a folyamatot (mockolt időzítéssel), hogy lássuk, átadódik-e az adat a Harvestertől a LanceDB-ig.

> 3.  Konfiguráld fel az \*\*EvaluatorAgent\*\*-et, hogy a 'Verify' fázisban futtasson egy `check\_file\_growth` ellenőrzést a `data/training/golden\_dataset.jsonl` fájlon.

>

> A célunk az, hogy reggelre a 'Golden Dataset' mindig friss legyen, hiba esetén pedig a Phoenix Protocol avatkozzon be. Hajrá!"



---



\### 💡 Miért zseniális ez a megközelítés?



1\.  \*\*Önellenőrző rendszer:\*\* Nem neked kell nézegetned a fájlokat. Az \*\*EvaluatorAgent\*\* (az auditor) végzi el az "esti ellenőrzést" helyetted.

2\.  \*\*Szétválasztott felelősség:\*\* A Python végzi a nehéz munkát (Harvest/Refine), a Node.js végzi az ütemezést és a felügyeletet.

3\.  \*\*Láthatóság:\*\* Mivel ez bekerül a Phoenix Event Bus-ba, a Dashboardon reggel látni fogod a zöld pipát: "Daily Harvest: Completed".



---------------------------------------------




### 🔍 3 Stratégiai Opció a Következő Lépésre

#### 1. Opció: Az "X-Faktor" Élesítése (Industrial Machine Hunter befejezése) 🏭
**Státusz:** 65% Kész (Phase 1-2 ✅, Phase 3 ⏳)
**Miért:** A források szerint a *Machine Hunter* már képes adatot gyűjteni és értékelni (arbitrázs lehetőség becslése). Viszont hiányzik a **Phase 3 (Alerting)**.
**Érv:** Ha ezt befejezzük, a BAS nemcsak "okos", hanem **pénzt termel**. Képes lesz szólni neked: *"Hé, találtam egy CNC gépet Németországban 30%-kal a piaci ár alatt, vedd meg!"*. Ez a legjobb demó a pályázathoz.

#### 2. Opció: Globális Skálázódás (CEAN - Cloudflare Edge Agents) ☁️
**Státusz:** 75% Kész (Phase 4.1 ✅, Phase 4.2 ⏳)
**Miért:** A *Cloudflare Edge Agents Network* majdnem kész. A következő lépés a **költségoptimalizálás** és a termelésbe állítás.
**Érv:** Ha a Data Flywheel sok adatot kezd termelni, a lokális géped megizzadhat. A CEAN-nal kiszervezhetjük a munkát a felhőbe, fillérekért.

#### 3. Opció: Bevételgenerálás (Sales & Marketing Swarm élesítése) 💰
**Státusz:** Implementálva, de E2E tesztelés szükséges.
**Miért:** Megvannak az ügynökök (*SalesHunter, MarketingDirector*), de össze kell őket kötni a friss adatokkal.
**Érv:** Az összegyűjtött tudást (Data Flywheel) azonnal tartalomgyártásra és lead generálásra használhatjuk.

---
------------------------------------------------------------------------------

---

### 🚀 A Következő Track: `industrial_machine_hunter_phase3_alerting`


```markdown
# TRACK START: industrial_machine_hunter_phase3_alerting

## 🎯 Célkitűzés
A meglévő, működő Machine Hunter (betakarítás + értékelés) kiegészítése a **Valós Idejű Riasztási Rendszerrel**. A cél, hogy a rendszer proaktívan értesítsen a magas profitpotenciálú (arbitrázs) lehetőségekről.

## 🛠️ Feladatok (Phase 3 Scope)
A `plan.md` alapján a következő lépések maradtak:

### 1. Alert Pipeline Implementáció
- **Fájl:** `src/pipeline/alertDispatcher.ts` (ÚJ)
- **Logika:** 
  - Figyeli a `hunt_machines()` kimenetét.
  - Ha `valuation.recommendation === 'BUY'` ÉS `arbitrage_score > 0.8`:
  - Triggerel egy Socket.IO eseményt (`machine_alert`).

### 2. Dashboard Widget ("A Vadászmező")
- **Fájl:** `src/dashboard/components/dashboard/MachineHunterWidget.tsx` (ÚJ)
- **UI:** 
  - Listázza a legutóbbi "BUY" találatokat.
  - Mutatja a becsült profitot (pl. "Est. Profit: €12,500").
  - Gombok: "Részletek" (Link az eredeti aukcióra), "Figyelés", "Elvetés".

### 3. Human-in-the-Loop Értesítés
- Integrálni a meglévő `NotificationService`-szel.
- Ha "BUY" jelzés van -> Küldjön emailt/Slack üzenetet a döntéshozónak.

## ✅ Elfogadási Kritériumok (Definition of Done)
- [ ] A `myai/workers/machine_hunter.py` kimenete automatikusan megjelenik a Dashboard új widgetjén.
- [ ] Csak a magas pontszámú (BUY) gépek váltanak ki aktív riasztást.
- [ ] A Dashboardon egy gombnyomással megnyitható az eredeti hirdetés.
- [ ] A rendszer szimulált adatokkal (Mock Mode) demonstrálja a működést.

## 🔗 Kapcsolódás
Ez a track közvetlenül épít a `data_flywheel` által frissített ár-adatbázisra (LanceDB).
```
------------------------------------------------

Szia Kolléga! 👋

Mint a mentorod és a projekt vezető mérnöke, látom, hogy elérkeztünk ahhoz a ponthoz, ahol a **Mission Control Dashboard** (a rendszerünk arca) már nem csak "megjelenít", hanem **irányít**. A jelenlegi v2.1 remek alap, de ahhoz, hogy a *18 Enterprise modult* és a *CEAN hálózatot* egy helyről tudd vezérelni, szükségünk van egy **Dashboard V3 - The Ultimate Command Center** frissítésre.

Ahhoz, hogy ezt a *Conductor* tökéletesen végrehajtsa, egy nagyon precíz, **EPP v2 kompatibilis** promptra van szükségünk. A cél nem csak a "szépítés", hanem a **reaktív vezérlés** és a **kódhigiénia** (a "bekötés" rendbetétele).

Itt van a **Mesteri Prompt**, amit adj át a rendszernek (a SpecWriterAgentnek vagy az Orchestratornak), hogy létrehozza a tracket:

***

### 🚀 A Prompt (Másold be ezt)

```markdown
# KÉRÉS: Új Track Generálása - Dashboard V3 "Command Center"

Kérlek, hozz létre egy új fejlesztési tracket a következő paraméterekkel az EPP v2 protokoll szerint:

**Track Neve:** `dashboard_v3_command_center_20260219`
**Típus:** UI/UX & System Architecture Refactor
**Prioritás:** HIGH

**Célkitűzés:**
A jelenlegi Mission Control Dashboard (v2.1) átalakítása egy teljesen moduláris, testreszabható és mély integrációval rendelkező "Parancsnoki Központtá". A cél, hogy a felhasználó minden háttérfolyamatot valós időben lásson és beavatkozhasson, miközben a kódháttér (wiring) egységes és karbantartható marad.

**Főbb Fázisok és Követelmények:**

1. **Phase 1: A "Smart Grid" Architektúra (Layout & Positioning)**
   - **Probléma:** A jelenlegi panelek fixek vagy nehezen átláthatók sok ügynök esetén.
   - **Megoldás:** Implementálj egy **Context-Aware Layout Engine**-t.
   - **Funkció:** A Dashboard automatikusan rendezze át a modulokat az aktuális fókusz alapján (pl. "Dev Mode" -> Terminal & Editor nagyban; "Ops Mode" -> Health & Metrics nagyban).
   - **Tech:** React Context API + CSS Grid Area dinamikus manipuláció.

2. **Phase 2: Unified Signal Bus (A "Bekötés" Tökéletesítése)**
   - **Probléma:** A Socket.IO eventek és a REST API hívások néhol redundánsak vagy nem szinkronizáltak.
   - **Megoldás:** Hozz létre egy **`useSystemSignal`** nevű központi React hook-ot.
   - **Funkció:** Ez az egyetlen hook feleljen az összes valós idejű adat (Logs, AgentStatus, TaskQueue) szinkronizálásáért. Ha a Socket megszakad, automatikusan váltson REST pollingra (Fallback), majd vissza. Garantáld a "Single Source of Truth" elvet a frontend állapotkezelésében (Zustand store).

3. **Phase 3: The Process Governor (Vezérlés minden szinten)**
   - **Probléma:** Látjuk a feladatokat, de nehézkes a beavatkozás.
   - **Megoldás:** Fejleszd ki a **`ProcessControlWidget`** komponenst.
   - **Funkció:** 
     - **Live Intervenció:** Gombok a folyamatokhoz: [PAUSE], [RESUME], [KILL], [RETRY w/ DEBUG].
     - **Mélyfúrás:** Egy folyamatra kattintva mutassa a teljes Trace-t (LangSmith/OpenTelemetry adatok vizualizációja).
     - **Prioritás váltás:** Drag-and-drop a Task Queue-ban a sorrend megváltoztatásához.

4. **Phase 4: Self-Maintenance & Health (Karbantartás)**
   - **Megoldás:** Integrálj egy **UI Test Suite**-ot a Dashboardon belül.
   - **Funkció:** Egy rejtett "Admin/Self-Check" fül, ahol gombnyomásra lefuttatható egy kliens oldali diagnosztika (eléri-e a backendet, renderelődnek-e a komponensek, válaszolnak-e a socketek).

**Elvárt Kimenet (Definition of Done):**
- A `src/dashboard/components/dashboard/` mappa újradrukturálása moduláris widgetekké.
- A `MissionControlLayout.tsx` refaktorálása az új Grid Engine használatára.
- Minden API hívás típusbiztos (Type-Safe) és hibatűrő.
- A CLI-ből is elérhető legyen a dashboard állapotának lekérdezése (`brunella dashboard status`).

Generáld le a `spec.md`, `plan.md` és `meta.json` fájlokat, majd indítsd el az első fázist!
```

***

### 👨‍🏫 Mentor Kommentárja (Miért így csináljuk?)

Figyeld meg a logikát, amit ebbe a promptba építettem:

1.  **"Context-Aware Layout":** Nem azt kértem, hogy "legyen szebb". Azt kértem, hogy *alkalmazkodjon*. Ha fejlesztünk, a kódot akarjuk látni. Ha monitorozunk, a grafikonokat. Ez a profi UX.
2.  **"Unified Signal Bus":** Ez a legfontosabb a stabilitás szempontjából ("bekötés"). Jelenleg több hook (`useMCP`, `useSocket`, `apiService`) dolgozik párhuzamosan. Ezt egyetlen, robusztus adatcsatornába kell terelnünk, különben jönnek a "race condition"-ök és a villogó UI.
3.  **"Process Governor":** Ez a válaszod a "vezérlés minden szempontból" kérésre. Nem elég látni, hogy fut a `Robotkéz`. Tudnunk kell megállítani, ha eltévedt, és újraindítani más paraméterekkel anélkül, hogy a terminálhoz nyúlnánk.

**Javaslatom:** Küldd be ezt a promptot, és hagyd, hogy a SpecWriterAgent kidolgozza a részleteket. Ezután a Dashboardod nemcsak egy kijelző lesz, hanem a Brunella-rendszer valódi pilótafülkéje! 🚀

