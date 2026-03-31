# Végrehajtási Terv: Autonóm Készlet- és Leltárkezelési Rendszer — KKV

**Track ID:** `inventory_automation_20260330`
**Jelleg:** Zöldmezős, önálló modul a Brunella ökoszisztémán belül
**Kapcsolódó track:** `konyveles_kognitiv_bovites_20260330` (könyvelési korrekciók forrása)
**Becsült idő:** Phase 1: 6 nap · Phase 2: 6 nap · Phase 3: 5 nap · Phase 4: 3 nap

---

## Phase 1 — Alapadatbázis és Számviteli Készletértékelés (30%)

**Cél:** Stabil adatstruktúra és a Számviteli Törvénynek (2000. évi C. törvény) megfelelő értékelési algoritmusok.

### 1.1 Adatréteg kialakítása (redundáns)
- [ ] `src/db/inventoryDb.ts` létrehozása (SQLite séma, WAL mód)
- [ ] Séma migrációs fájl: `data/migrations/inventory_001_initial.sql`
  - `inventory_items` tábla: `id, sku, name, unit, category, min_stock, reorder_point, lead_time_days`
  - `inventory_batches` tábla: `id, item_id, purchase_date, quantity, unit_price, remaining_qty, supplier_id`
  - `inventory_movements` tábla: `id, item_id, type (IN/OUT/TRANSFER/SCRAP), quantity, unit_price, reference, timestamp`
  - `inventory_stocktakes` tábla: `id, item_id, physical_count, system_count, discrepancy, status, created_at`
- [ ] n8n WF-INV-1: Google Sheets szinkronizáció (n8n Schedule Trigger + Google Sheets node)
  - Szinkron iránya: SQLite (forrás) → Google Sheets (megjelenítés)
  - Szinkron frekvencia: 15 percenként
  - Lapok: "Készlet Dashboard", "Mozgások", "Rendelések"
- [ ] `src/server/routes/inventory.ts` REST API végpontok regisztrálása

### 1.2 Tranzakciós API végpontok (n8n webhook-ok)
- [ ] `POST /api/v1/inventory/receive` — bevételezés (szállítói szállítólevél alapján)
  - Input: `{ sku, quantity, unit_price, supplier_id, delivery_note_ref, date }`
  - Létrehoz: új `inventory_batches` rekordot (FIFO batch-hoz)
- [ ] `POST /api/v1/inventory/issue` — kiadás (vevői szállítólevél vagy belső felhasználás)
  - Input: `{ sku, quantity, reference, date }`
  - FIFO motor: legkorábbi batch-ek kimerítése → ELÁBÉ számítás
- [ ] `POST /api/v1/inventory/transfer` — raktárközi mozgás
- [ ] `POST /api/v1/inventory/scrap` — selejtezés
- [ ] `GET /api/v1/inventory/status` — aktuális készlet állapot (JSON)
- [ ] `GET /api/v1/inventory/valuation` — FIFO / WAC aktuális értékelés

### 1.3 FIFO Algoritmus implementálása
- [ ] `src/agents/InventoryFifoAgent.ts` létrehozása
  - Kiadáskor: kronológiai batch iteráció (`ORDER BY purchase_date ASC`)
  - Részleges batch kimerítés: `remaining_qty` csökkentése, ha 0 → batch lezárása
  - ELÁBÉ számítás: `SUM(consumed_qty * batch_unit_price)` batch-enként
  - Output: `{ total_cogs: number, batches_consumed: [...], remaining_stock_value: number }`
- [ ] Teszt: 30 db @ 6000 Ft + 70 db @ 5000 Ft → 50 db kiadás = 280.000 Ft ELÁBÉ helyes

### 1.4 Súlyozott Átlagár (WAC) Algoritmus implementálása
- [ ] `src/agents/InventoryWacAgent.ts` létrehozása
  - n8n WF-INV-2: Schedule Trigger (napi éjfél) → aggregáló lekérdezés → WAC frissítés
  - Képlet: `WAC = (opening_stock_value + period_purchases_value) / (opening_qty + period_purchases_qty)`
  - SQLite `inventory_items` tábla `current_wac_price` mező frissítése
- [ ] Konfiguráció: vállalkozásonként állítható értékelési módszer (FIFO / WAC)

---

## Phase 2 — Prediktív Újrarendelési Ágens (AI Replenishment) (30%)

**Cél:** Statikus újrarendelési szabályok helyett dinamikus, AI-vezérelt kereslet-előrejelzés és autonóm Purchase Order generálás.

### 2.1 Értékesítési Trend Elemző (Sales Velocity)
- [ ] `src/agents/DemandForecastAgent.ts` — historikus adatok elemzése
  - Input: utolsó 90 nap mozgási adatai per SKU
  - Szezonalitás detektálás: heti/havi mintázatok azonosítása
  - n8n WF-INV-3: heti cron → DemandForecastAgent → Langflow AI predikció
- [ ] Langflow flow: `inventory-demand-forecast`
  - Prompt: "Elemezd az alábbi SKU értékesítési adatait, azonosítsd a trendet és szezonalitást, becsüld meg a következő 30 nap szükséges készletét."
  - Input JSON: `{ sku, sales_history: [{ date, qty }], lead_time_days, current_stock }`
  - Output JSON: `{ predicted_demand_30d, recommended_order_qty, confidence, reasoning }`

### 2.2 Biztonsági Készlet (Safety Stock) Kalkulátor
- [ ] `src/agents/SafetyStockAgent.ts` implementálása
  - Képlet: `Safety Stock = Z * σ_demand * sqrt(lead_time)`
    - Z = 1.65 (95%-os service level alapértelmezett)
    - σ_demand = kereslet szórása az elmúlt 90 napból
    - lead_time = szállító átlagos átfutási ideje napban
  - Újrarendelési pont: `ROP = (average_daily_demand * lead_time) + safety_stock`
  - SQLite frissítés: `inventory_items.reorder_point`, `inventory_items.safety_stock`

### 2.3 Autonóm Purchase Order (PO) Generátor
- [ ] `src/agents/PurchaseOrderAgent.ts` — rendelési e-mail draft generálás
  - Trigger: aktuális készlet < `reorder_point`
  - LLM prompt (Langflow `inventory-po-generator` flow): professzionális rendelési e-mail
  - E-mail tartalom: cikkszám, elvárt mennyiség, preferált szállítási határidő, cég adatai
  - Output: e-mail draft + PDF melléklet opció

### 2.4 Human-in-the-Loop Jóváhagyási Workflow
- [ ] n8n WF-INV-4: "Send and wait for response" PO jóváhagyás
  - Trigger: PurchaseOrderAgent PO draftet generál
  - Slack/email üzenet a vásárlási vezetőnek: PO összefoglaló + interaktív gombok
  - Gombok: "Jóváhagyom és elküldöm" / "Elutasítom" / "Módosítom"
  - Jóváhagyás esetén: Gmail node elküldi a PO-t a szállítónak + Google Sheets "Rendelések" lap frissítése
  - Elutasítás esetén: oktatási loop — az ágens tanulja a preferenciát (TOML config frissítés)
- [ ] Dashboard: "Függő Rendelések" panel `InventoryRadarWidget.tsx`-ben

---

## Phase 3 — Leltáregyeztető és Nyomozó Ágens (Stocktake) (25%)

**Cél:** Fizikai leltár és szoftveres nyilvántartás eltéréseinek intelligens, autonóm felderítése.

### 3.1 Leltáradat Befogadási Webhook
- [ ] n8n WF-INV-5: Webhook végpont fizikai leltáradatok fogadásához
  - Forrás: Google Form (vonalkód olvasó app) → n8n webhook
  - Input JSON: `{ sku, physical_count, counted_by, timestamp, location }`
  - Azonnali összehasonlítás a SQLite `inventory_items` aktuális értékével
  - Eltérés > 0 → leltáreltérés rekord létrehozása, Nyomozó Ágens indítása
- [ ] `POST /api/v1/inventory/stocktake` BAS API végpont regisztrálása

### 3.2 Eltérés Analizátor Ágens (Root Cause Analysis)
- [ ] `src/agents/StocktakeReconciliationAgent.ts` — döntési fa alapján nyomoz
  - Input: `{ sku, discrepancy_qty, discrepancy_value, stocktake_timestamp }`
  - **Döntési fa (Langflow-ban vizualizálva):**
    ```
    Eltérés detected
        ├── Időbeli eltolódás? → Nyitott szállítólevél az elmúlt 48 órában?
        │       YES → "Valószínűleg átmeneti, bevételezés folyamatban"
        │       NO  → tovább
        ├── Raktárközi mozgás? → Van rögzítetlen transfer az elmúlt 7 napban?
        │       YES → "Átvezetés hiányzik, korrekció szükséges"
        │       NO  → tovább
        ├── Selejtezési esemény? → Van rögzítetlen selejt?
        │       YES → "Selejtezési bizonylat hiányzik"
        │       NO  → tovább
        └── Valós leltárhiány → Könyvelési korrekció előkészítése
    ```
  - Természetes nyelvű indoklás generálása (LLM)
  - Confidence score minden hipotézishez

### 3.3 Természetes Nyelvű Leltárjelentés
- [ ] `src/agents/StocktakeReportAgent.ts` — vezetői összefoglaló generálás
  - Langflow flow: `inventory-stocktake-report`
  - Tartalom: eltérések listája, valószínű okok, ajánlott akciók, pénzügyi hatás
  - Output: Markdown + PDF export (Puppeteer)
  - Automatikus emailküldés: Google Drive-ba mentés + email a raktárvezetőnek

### 3.4 Könyvelési Korrekció Előkészítése
- [ ] `src/agents/InventoryAdjustmentAgent.ts`
  - Valós leltárhiány esetén: `egyéb ráfordítás` könyvelési tétel előkészítése
  - Interfész a `konyveles_kognitiv_bovites_20260330` track könyvelési rendszerével
  - Output: jóváhagyásra váró könyvelési bizonylat (Human-in-Loop)
  - Könyvelési számla: hiány → T: 8-as számlaosztály (egyéb ráfordítás) / K: 2-es számlaosztály (készlet)

---

## Phase 4 — Integráció, Dashboard és CLI (15%)

### 4.1 Dashboard Widget
- [ ] `src/dashboard/components/dashboard/InventoryRadarWidget.tsx` létrehozása
  - "Kritikus készletek" szekció: piros/sárga/zöld jelzőkkel
  - "Folyamatban lévő rendelések" szekció: PO státusz tracker
  - "Legutóbbi leltáreltérések" szekció: nyomozás státusza, konfidencia
  - "Készletérték összesítő": FIFO vs WAC érték grafikon (Recharts)
- [ ] Navigation.tsx frissítése: InventoryRadarWidget regisztrálása új "Logistics" NavGroup-ban

### 4.2 CLI Parancsok (magyar, inquirer.js)
- [ ] `brunella inventory status` — aktuális készlet állapot táblázat
- [ ] `brunella inventory valuation` — FIFO / WAC értékelés lekérdezés
- [ ] `brunella inventory order-review` — függő PO jóváhagyások listája
- [ ] `brunella inventory stocktake` — leltárfelvétel indítása (interaktív)
- [ ] `brunella inventory forecast [sku]` — kereslet-előrejelzés egy termékre

### 4.3 Tesztek
- [ ] `test/inventoryFifo.test.ts` — FIFO batch-kimerítés, ELÁBÉ számítás helyessége
- [ ] `test/inventoryWac.test.ts` — WAC frissítési ciklus helyes működése
- [ ] `test/stocktakeReconciliation.test.ts` — döntési fa minden ága szimulálva
- [ ] `test/purchaseOrderApproval.test.ts` — Human-in-Loop workflow mock
- [ ] `npm run test:fast` minden commit előtt zöld

---

## Acceptance Kritériumok

| # | Kritérium | Mérési módszer |
|---|---|---|
| AC-1 | FIFO kalkuláció: 30 db @ 6000 Ft + 70 db @ 5000 Ft → 50 db kiadás = 280.000 Ft ELÁBÉ | Unit teszt |
| AC-2 | WAC napi frissítés: Schedule trigger pontosan fut, eredmény helyes | n8n Execution log |
| AC-3 | PO generálás jóváhagyással: Draft e-mail elkészül, interaktív gombok működnek | E2E teszt |
| AC-4 | Leltáreltérés 100%-ban detektálva és döntési fán végigvezetve | Szimulált leltáreltérés teszt |
| AC-5 | Google Sheets szinkron: SQLite változás 15 percen belül tükröződik Sheets-ben | Manual ellenőrzés |
