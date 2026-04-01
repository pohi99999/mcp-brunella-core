-- ============================================================
-- Inventory Module — Kezdeti Séma Migráció
-- Track: inventory_automation_20260330
-- Létrehozva: 2026-04-01
-- ============================================================

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- ----------------------------------------------------------
-- inventory_items — Törzsadat (SKU szintű)
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS inventory_items (
  id                  TEXT PRIMARY KEY,
  sku                 TEXT UNIQUE NOT NULL,
  name                TEXT NOT NULL,
  unit                TEXT NOT NULL,              -- db, kg, liter, csomag stb.
  category            TEXT,
  valuation_method    TEXT NOT NULL DEFAULT 'FIFO', -- FIFO | WAC
  min_stock           REAL NOT NULL DEFAULT 0,
  reorder_point       REAL NOT NULL DEFAULT 0,
  safety_stock        REAL NOT NULL DEFAULT 0,
  current_wac_price   REAL,                        -- WAC módszernél napi frissítés
  current_stock       REAL NOT NULL DEFAULT 0,     -- aktuális tényleges készlet (denormalizált)
  lead_time_days      INTEGER NOT NULL DEFAULT 7,
  supplier_id         TEXT,
  notes               TEXT,
  created_at          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  updated_at          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_inventory_items_sku ON inventory_items(sku);
CREATE INDEX IF NOT EXISTS idx_inventory_items_category ON inventory_items(category);

-- ----------------------------------------------------------
-- inventory_batches — FIFO batch-ek (minden bevételezés egy sor)
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS inventory_batches (
  id                TEXT PRIMARY KEY,
  item_id           TEXT NOT NULL REFERENCES inventory_items(id) ON DELETE RESTRICT,
  purchase_date     TEXT NOT NULL,                -- ISO 8601 — ez határozza meg a FIFO sorrendet!
  quantity          REAL NOT NULL,                -- eredeti bevételezett mennyiség
  remaining_qty     REAL NOT NULL,                -- csökken kiadásonként
  unit_price        REAL NOT NULL,                -- nettó egységár ebből a szállítmányból
  supplier_id       TEXT,
  delivery_note_ref TEXT,                         -- szállítólevél száma (audit)
  closed            INTEGER NOT NULL DEFAULT 0,   -- 1 ha remaining_qty = 0
  created_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_batches_item_open ON inventory_batches(item_id, closed, purchase_date);

-- ----------------------------------------------------------
-- inventory_movements — Minden készleteseményt rögzít (teljes audit trail)
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS inventory_movements (
  id              TEXT PRIMARY KEY,
  item_id         TEXT NOT NULL REFERENCES inventory_items(id) ON DELETE RESTRICT,
  movement_type   TEXT NOT NULL CHECK(movement_type IN ('IN','OUT','TRANSFER','SCRAP','ADJUSTMENT')),
  quantity        REAL NOT NULL,
  unit_price      REAL,                            -- FIFO kiadásnál kalkulált súlyozott ár
  total_value     REAL,                            -- quantity * unit_price
  reference       TEXT,                            -- szállítólevél/rendelési szám
  counterparty    TEXT,                            -- partner neve
  location_from   TEXT,
  location_to     TEXT,
  created_by      TEXT DEFAULT 'system',
  notes           TEXT,
  timestamp       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_movements_item ON inventory_movements(item_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_movements_type ON inventory_movements(movement_type, timestamp);

-- ----------------------------------------------------------
-- inventory_stocktakes — Fizikai leltárfelvétel sorok
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS inventory_stocktakes (
  id                TEXT PRIMARY KEY,
  item_id           TEXT NOT NULL REFERENCES inventory_items(id) ON DELETE RESTRICT,
  physical_count    REAL NOT NULL,                -- megszámlált fizikai mennyiség
  system_count      REAL NOT NULL,                -- szoftveres nyilvántartás szerinti érték a mérés pillanatában
  discrepancy       REAL NOT NULL,                -- physical_count - system_count
  discrepancy_value REAL,                         -- discrepancy * aktuális egységár
  status            TEXT NOT NULL DEFAULT 'OPEN' CHECK(status IN ('OPEN','INVESTIGATING','RESOLVED','BOOKED')),
  root_cause        TEXT,                         -- Nyomozó Ágens megállapítása
  resolution_notes  TEXT,
  counted_by        TEXT,
  location          TEXT,
  created_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  resolved_at       TEXT
);

CREATE INDEX IF NOT EXISTS idx_stocktakes_item ON inventory_stocktakes(item_id, status);

-- ----------------------------------------------------------
-- inventory_purchase_orders — Generált rendelések
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS inventory_purchase_orders (
  id                TEXT PRIMARY KEY,
  item_id           TEXT NOT NULL REFERENCES inventory_items(id),
  sku               TEXT NOT NULL,
  order_qty         REAL NOT NULL,
  estimated_unit_price REAL,
  supplier_id       TEXT,
  status            TEXT NOT NULL DEFAULT 'DRAFT' CHECK(status IN ('DRAFT','PENDING_APPROVAL','APPROVED','SENT','RECEIVED','CANCELLED')),
  ai_reasoning      TEXT,                         -- LLM indoklás
  confidence_score  REAL,                         -- 0.0 – 1.0
  email_draft       TEXT,                         -- generált rendelési e-mail szöveg
  approved_by       TEXT,
  created_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  updated_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_po_status ON inventory_purchase_orders(status, created_at);
CREATE INDEX IF NOT EXISTS idx_po_item ON inventory_purchase_orders(item_id);
