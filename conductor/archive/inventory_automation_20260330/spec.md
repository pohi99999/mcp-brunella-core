# Specifikáció: Autonóm Készlet- és Leltárkezelési Rendszer — KKV

**Track ID:** `inventory_automation_20260330`
**Prioritás:** MEDIUM
**Tulajdonos:** Pohánka Péter
**Létrehozva:** 2026-03-30
**Kapcsolódó track:** `konyveles_kognitiv_bovites_20260330` (könyvelési korrekciók fogadója)

---

## 1. Célkitűzés

Teljesen autonóm, KKV-méretű készletkezelő rendszer építése, amely:
- Számvitelileg helyes **FIFO és Súlyozott Átlagár (WAC)** alapú értékelést végez
- **AI-alapú kereslet-előrejelzéssel** proaktívan generál rendelési javaslatokat
- **Leltáregyeztető nyomozó ágenssel** döntési fa mentén azonosítja az eltérések okát
- Teljes integráció a Brunella Dashboard-dal és CLI-vel (EPP v2 protokoll)

---

## 2. Architektúra

```
KÜLSŐ ADATFORRÁSOK
  ├── Szállítói szállítólevél (webhook / Google Form)
  ├── Vevői szállítólevél / Értékesítés
  ├── Fizikai leltárfelvétel (vonalkód app → webhook)
  └── Google Calendar (szállítói határidők)
         ↓
n8n ORKESZTRÁTOR (WF-INV-1..5)
  ├── WF-INV-1: Google Sheets szinkron (15 percenként)
  ├── WF-INV-2: WAC napi frissítés (éjfél Cron)
  ├── WF-INV-3: Kereslet-előrejelzés (heti Cron)
  ├── WF-INV-4: PO jóváhagyás (Human-in-Loop)
  └── WF-INV-5: Leltáradat befogadás (Webhook)
         ↓
BAS ÁGENSEK (src/agents/)
  ├── InventoryFifoAgent.ts        (FIFO értékelés)
  ├── InventoryWacAgent.ts         (WAC értékelés)
  ├── DemandForecastAgent.ts       (kereslet-előrejelzés)
  ├── SafetyStockAgent.ts          (biztonsági készlet számítás)
  ├── PurchaseOrderAgent.ts        (PO generálás)
  ├── StocktakeReconciliationAgent.ts  (leltár nyomozás)
  ├── StocktakeReportAgent.ts      (leltárjelentés)
  └── InventoryAdjustmentAgent.ts  (könyvelési korrekció)
         ↓
ADATRÉTEG (Redundáns)
  ├── SQLite (data/inventory.db) — tranzakciós igazságforrás
  └── Google Sheets — vizuális dashboard az ügyfélnek
         ↓
LANGFLOW (Kognitív motor)
  ├── inventory-demand-forecast
  ├── inventory-po-generator
  └── inventory-stocktake-report
```

---

## 3. Adatbázis Séma

### inventory_items (törzsadat)
```sql
CREATE TABLE inventory_items (
  id TEXT PRIMARY KEY,
  sku TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  unit TEXT NOT NULL,              -- db, kg, liter, stb.
  category TEXT,
  valuation_method TEXT DEFAULT 'FIFO',  -- FIFO | WAC
  min_stock REAL DEFAULT 0,
  reorder_point REAL DEFAULT 0,
  safety_stock REAL DEFAULT 0,
  current_wac_price REAL,          -- WAC módszernél frissítve
  lead_time_days INTEGER DEFAULT 7,
  supplier_id TEXT,
  created_at TEXT,
  updated_at TEXT
);
```

### inventory_batches (FIFO batch-ek)
```sql
CREATE TABLE inventory_batches (
  id TEXT PRIMARY KEY,
  item_id TEXT REFERENCES inventory_items(id),
  purchase_date TEXT NOT NULL,     -- ISO 8601 — FIFO sorrend alapja!
  quantity REAL NOT NULL,
  remaining_qty REAL NOT NULL,     -- csökken kiadásnál
  unit_price REAL NOT NULL,        -- egységár ebből a szállítmányból
  supplier_id TEXT,
  delivery_note_ref TEXT,
  closed INTEGER DEFAULT 0         -- 1 ha remaining_qty = 0
);
```

### inventory_movements (audit trail)
```sql
CREATE TABLE inventory_movements (
  id TEXT PRIMARY KEY,
  item_id TEXT REFERENCES inventory_items(id),
  movement_type TEXT NOT NULL,     -- IN | OUT | TRANSFER | SCRAP | ADJUSTMENT
  quantity REAL NOT NULL,
  unit_price REAL,                 -- FIFO szerint kalkulált kiadásnál
  total_value REAL,                -- quantity * unit_price
  reference TEXT,                  -- szállítólevél szám, vevői rendelés stb.
  counterparty TEXT,               -- partner neve
  location_from TEXT,
  location_to TEXT,
  created_by TEXT,
  timestamp TEXT NOT NULL
);
```

---

## 4. FIFO Algoritmus Részletes Specifikáció

```typescript
// Pseudo-code a kiadás logikájához
async function issueFifo(itemId: string, qty: number, reference: string) {
  let remaining = qty;
  let totalCogs = 0;
  const batchesConsumed = [];

  // Legkorábbi nyitott batch-ek lekérdezése
  const batches = await db.query(
    `SELECT * FROM inventory_batches
     WHERE item_id = ? AND closed = 0
     ORDER BY purchase_date ASC`,
    [itemId]
  );

  for (const batch of batches) {
    if (remaining <= 0) break;

    const consume = Math.min(remaining, batch.remaining_qty);
    totalCogs += consume * batch.unit_price;
    remaining -= consume;

    // Batch frissítése
    await db.run(
      `UPDATE inventory_batches SET remaining_qty = ?, closed = ?
       WHERE id = ?`,
      [batch.remaining_qty - consume, batch.remaining_qty - consume === 0 ? 1 : 0, batch.id]
    );

    batchesConsumed.push({ batchId: batch.id, qty: consume, unitPrice: batch.unit_price });
  }

  if (remaining > 0) throw new Error('Insufficient stock');

  // Mozgás rekord mentése
  await logMovement({ itemId, type: 'OUT', quantity: qty, totalValue: totalCogs, reference });

  return { totalCogs, batchesConsumed };
}
```

---

## 5. Kereslet-Előrejelzés Prompt Sablon (Langflow)

```
Te egy tapasztalt készletkezelési szakértő vagy, aki kis- és középvállalkozások számára optimalizál.

FELADAT: Elemezd az alábbi termék értékesítési adatait és készíts kereslet-előrejelzést.

TERMÉK ADATOK:
{sku} — {name}
Átlagos szállítói átfutási idő: {lead_time_days} nap
Jelenlegi készlet: {current_stock} {unit}
Biztonsági készlet szint: {safety_stock} {unit}

HISTORIKUS ÉRTÉKESÍTÉSI ADATOK (elmúlt 90 nap, napi bontásban):
{sales_history_json}

FELADAT:
1. Azonosítsd az értékesítési trendet (növekvő/csökkenő/stabil/szezonális)
2. Becsüld meg a következő 30 nap várható keresletét
3. Számítsd ki a javasolt rendelési mennyiséget
4. Jelezd a konfidencia szintet és az indoklást

KÖTELEZŐ JSON KIMENET (semmi más, csak ez):
{
  "trend": "growing|declining|stable|seasonal",
  "predicted_demand_30d": <number>,
  "recommended_order_qty": <number>,
  "optimal_order_date": "<ISO 8601>",
  "confidence": <0.0-1.0>,
  "reasoning": "<max 3 mondat magyarul>"
}
```

---

## 6. Google Sheets Struktúra

| Lap neve | Tartalom | Frissítési frekvencia |
|---|---|---|
| Készlet Dashboard | SKU, Név, Aktuális készlet, Min. szint, Státusz (OK/ALACSONY/KRITIKUS) | 15 percenként |
| Mozgások | Utolsó 500 mozgás, típus, dátum, mennyiség, érték | Valós idejű |
| Rendelések | Függő és teljesített PO-k, szállító, összeg, státusz | Valós idejű |
| Leltáreltérések | Nyitott eltérések, ok, konfidencia, státusz | Valós idejű |
| Értékelés | FIFO vs WAC összehasonlítás, ELÁBÉ havi bontásban | Napi |

---

## 7. Kapcsolat a Könyvelési Track-kel

A `konyveles_kognitiv_bovites_20260330` track az egyetlen fogyasztója a következő adatoknak:
- `InventoryAdjustmentAgent` → könyvelési bizonylat → `ReconciliationIngestionAgent`
- FIFO ELÁBÉ kalkuláció → `matching_engine.ts` bevételcsökkentő tétel
- Leltárhiány → `AnomalyDetectionAgent` anomália jelzés

Interfész: `POST /api/v1/inventory/adjustment` → BAS belső bus → könyvelési ágensek.

---

## 8. Magyar Számviteli Törvény Megfelelés

| Szabály | Implementáció |
|---|---|
| FIFO értékelés megengedett | `InventoryFifoAgent` kronológiai batch-követéssel |
| WAC megengedett | `InventoryWacAgent` napi aggregáló ciklussal |
| Folyamatos mennyiségi nyilvántartás (B módszer) | `inventory_movements` minden tranzakciót rögzít |
| ELÁBÉ elszámolása 814. számlán | `InventoryAdjustmentAgent` előkészíti a könyvelési tételt |
| Leltárhiány egyéb ráfordítás (8xx) | Döntési fa végpontján automatikus javaslat |
| Selejtezési bizonylat kötelező | `POST /api/v1/inventory/scrap` endpoint bizonylat referenciát vár |
