/**
 * inventoryDb.ts — SQLite adatréteg az Inventory modulhoz
 * Track: inventory_automation_20260330
 *
 * Séma: data/migrations/inventory_001_initial.sql
 * WAL mód, foreign keys ON, singleton kapcsolat.
 */

import Database from 'better-sqlite3';
import { randomUUID } from 'crypto';
import { logInfo, logError } from './logger.js';

// ─── Típusok ────────────────────────────────────────────────────────────────

export interface InventoryItem {
  id: string;
  sku: string;
  name: string;
  unit: string;
  category?: string;
  valuation_method: 'FIFO' | 'WAC';
  min_stock: number;
  reorder_point: number;
  safety_stock: number;
  current_wac_price?: number;
  current_stock: number;
  lead_time_days: number;
  supplier_id?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface InventoryBatch {
  id: string;
  item_id: string;
  purchase_date: string;
  quantity: number;
  remaining_qty: number;
  unit_price: number;
  supplier_id?: string;
  delivery_note_ref?: string;
  closed: number;
  created_at: string;
}

export interface InventoryMovement {
  id: string;
  item_id: string;
  movement_type: 'IN' | 'OUT' | 'TRANSFER' | 'SCRAP' | 'ADJUSTMENT';
  quantity: number;
  unit_price?: number;
  total_value?: number;
  reference?: string;
  counterparty?: string;
  location_from?: string;
  location_to?: string;
  created_by?: string;
  notes?: string;
  timestamp: string;
}

export interface InventoryStocktake {
  id: string;
  item_id: string;
  physical_count: number;
  system_count: number;
  discrepancy: number;
  discrepancy_value?: number;
  status: 'OPEN' | 'INVESTIGATING' | 'RESOLVED' | 'BOOKED';
  root_cause?: string;
  resolution_notes?: string;
  counted_by?: string;
  location?: string;
  created_at: string;
  resolved_at?: string;
}

export interface InventoryPurchaseOrder {
  id: string;
  item_id: string;
  sku: string;
  order_qty: number;
  estimated_unit_price?: number;
  supplier_id?: string;
  status: 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'SENT' | 'RECEIVED' | 'CANCELLED';
  ai_reasoning?: string;
  confidence_score?: number;
  email_draft?: string;
  approved_by?: string;
  created_at: string;
  updated_at: string;
}

export interface FifoIssueResult {
  totalCogs: number;
  batchesConsumed: Array<{ batchId: string; qty: number; unitPrice: number; value: number }>;
  remainingStockValue: number;
}

export interface WacResult {
  sku: string;
  newWacPrice: number;
  totalStock: number;
  totalValue: number;
}

// ─── Singleton DB ────────────────────────────────────────────────────────────

let _db: Database.Database | null = null;

async function getDb() {
  if (_db) return _db;

  const { default: Database } = await import('better-sqlite3');
  const { join } = await import('path');
  const { existsSync, mkdirSync, readFileSync } = await import('fs');

  const dbPath = join(process.cwd(), 'data', 'inventory.db');
  const migrationPath = join(process.cwd(), 'data', 'migrations', 'inventory_001_initial.sql');

  const dataDir = join(process.cwd(), 'data');
  if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true });

  _db = new Database(dbPath);
  _db.pragma('journal_mode = WAL');
  _db.pragma('foreign_keys = ON');

  // Séma migráció
  if (existsSync(migrationPath)) {
    const sql = readFileSync(migrationPath, 'utf8');
    _db.exec(sql);
    logInfo('InventoryDb', 'Séma migráció sikeres: inventory_001_initial.sql');
  } else {
    logError('InventoryDb', `Migráció fájl nem található: ${migrationPath}`);
  }

  return _db;
}

// ─── Items CRUD ──────────────────────────────────────────────────────────────

export async function createItem(data: Omit<InventoryItem, 'id' | 'created_at' | 'updated_at'>): Promise<InventoryItem> {
  const db = await getDb();
  const id = randomUUID();
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO inventory_items
      (id, sku, name, unit, category, valuation_method, min_stock, reorder_point, safety_stock,
       current_wac_price, current_stock, lead_time_days, supplier_id, notes, created_at, updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `).run(
    id, data.sku, data.name, data.unit, data.category ?? null,
    data.valuation_method, data.min_stock, data.reorder_point, data.safety_stock,
    data.current_wac_price ?? null, data.current_stock, data.lead_time_days,
    data.supplier_id ?? null, data.notes ?? null, now, now
  );
  return getItemById(id) as Promise<InventoryItem>;
}

export async function getItemById(id: string): Promise<InventoryItem | null> {
  const db = await getDb();
  return db.prepare('SELECT * FROM inventory_items WHERE id = ?').get(id) as InventoryItem | null;
}

export async function getItemBySku(sku: string): Promise<InventoryItem | null> {
  const db = await getDb();
  return db.prepare('SELECT * FROM inventory_items WHERE sku = ?').get(sku) as InventoryItem | null;
}

export async function getAllItems(): Promise<InventoryItem[]> {
  const db = await getDb();
  return db.prepare('SELECT * FROM inventory_items ORDER BY name ASC').all() as InventoryItem[];
}

export async function updateItemStock(itemId: string, delta: number): Promise<void> {
  const db = await getDb();
  db.prepare(`
    UPDATE inventory_items
    SET current_stock = current_stock + ?,
        updated_at = ?
    WHERE id = ?
  `).run(delta, new Date().toISOString(), itemId);
}

export async function updateWacPrice(itemId: string, newWac: number): Promise<void> {
  const db = await getDb();
  db.prepare(`
    UPDATE inventory_items
    SET current_wac_price = ?, updated_at = ?
    WHERE id = ?
  `).run(newWac, new Date().toISOString(), itemId);
}

// ─── Batch műveletek (FIFO) ──────────────────────────────────────────────────

export async function createBatch(data: Omit<InventoryBatch, 'id' | 'closed' | 'created_at'>): Promise<InventoryBatch> {
  const db = await getDb();
  const id = randomUUID();
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO inventory_batches
      (id, item_id, purchase_date, quantity, remaining_qty, unit_price, supplier_id, delivery_note_ref, closed, created_at)
    VALUES (?,?,?,?,?,?,?,?,0,?)
  `).run(id, data.item_id, data.purchase_date, data.quantity, data.remaining_qty,
         data.unit_price, data.supplier_id ?? null, data.delivery_note_ref ?? null, now);
  return db.prepare('SELECT * FROM inventory_batches WHERE id = ?').get(id) as InventoryBatch;
}

export async function getOpenBatchesByItemId(itemId: string): Promise<InventoryBatch[]> {
  const db = await getDb();
  return db.prepare(`
    SELECT * FROM inventory_batches
    WHERE item_id = ? AND closed = 0
    ORDER BY purchase_date ASC
  `).all(itemId) as InventoryBatch[];
}

export async function updateBatchRemainingQty(batchId: string, newRemaining: number): Promise<void> {
  const db = await getDb();
  db.prepare(`
    UPDATE inventory_batches
    SET remaining_qty = ?, closed = ?
    WHERE id = ?
  `).run(newRemaining, newRemaining <= 0 ? 1 : 0, batchId);
}

// ─── Mozgás logolás ──────────────────────────────────────────────────────────

export async function logMovement(data: Omit<InventoryMovement, 'id' | 'timestamp'>): Promise<void> {
  const db = await getDb();
  const id = randomUUID();
  db.prepare(`
    INSERT INTO inventory_movements
      (id, item_id, movement_type, quantity, unit_price, total_value, reference,
       counterparty, location_from, location_to, created_by, notes, timestamp)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
  `).run(
    id, data.item_id, data.movement_type, data.quantity,
    data.unit_price ?? null, data.total_value ?? null, data.reference ?? null,
    data.counterparty ?? null, data.location_from ?? null, data.location_to ?? null,
    data.created_by ?? 'system', data.notes ?? null,
    new Date().toISOString()
  );
}

export async function getMovementsByItem(itemId: string, limit = 100): Promise<InventoryMovement[]> {
  const db = await getDb();
  return db.prepare(`
    SELECT * FROM inventory_movements
    WHERE item_id = ?
    ORDER BY timestamp DESC
    LIMIT ?
  `).all(itemId, limit) as InventoryMovement[];
}

// ─── Leltár ──────────────────────────────────────────────────────────────────

export async function createStocktake(data: Omit<InventoryStocktake, 'id' | 'status' | 'created_at'>): Promise<InventoryStocktake> {
  const db = await getDb();
  const id = randomUUID();
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO inventory_stocktakes
      (id, item_id, physical_count, system_count, discrepancy, discrepancy_value,
       status, counted_by, location, created_at)
    VALUES (?,?,?,?,?,?,'OPEN',?,?,?)
  `).run(id, data.item_id, data.physical_count, data.system_count,
         data.discrepancy, data.discrepancy_value ?? null,
         data.counted_by ?? null, data.location ?? null, now);
  return db.prepare('SELECT * FROM inventory_stocktakes WHERE id = ?').get(id) as InventoryStocktake;
}

export async function updateStocktakeStatus(
  id: string,
  status: InventoryStocktake['status'],
  rootCause?: string,
  resolutionNotes?: string
): Promise<void> {
  const db = await getDb();
  db.prepare(`
    UPDATE inventory_stocktakes
    SET status = ?, root_cause = ?, resolution_notes = ?,
        resolved_at = CASE WHEN ? IN ('RESOLVED','BOOKED') THEN ? ELSE resolved_at END
    WHERE id = ?
  `).run(status, rootCause ?? null, resolutionNotes ?? null, status, new Date().toISOString(), id);
}

export async function getOpenStocktakes(): Promise<InventoryStocktake[]> {
  const db = await getDb();
  return db.prepare(`
    SELECT s.*, i.sku, i.name
    FROM inventory_stocktakes s
    JOIN inventory_items i ON s.item_id = i.id
    WHERE s.status IN ('OPEN','INVESTIGATING')
    ORDER BY s.created_at DESC
  `).all() as InventoryStocktake[];
}

// ─── Purchase Orders ─────────────────────────────────────────────────────────

export async function createPurchaseOrder(data: Omit<InventoryPurchaseOrder, 'id' | 'status' | 'created_at' | 'updated_at'>): Promise<InventoryPurchaseOrder> {
  const db = await getDb();
  const id = randomUUID();
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO inventory_purchase_orders
      (id, item_id, sku, order_qty, estimated_unit_price, supplier_id,
       status, ai_reasoning, confidence_score, email_draft, created_at, updated_at)
    VALUES (?,?,?,?,?,?,'DRAFT',?,?,?,?,?)
  `).run(
    id, data.item_id, data.sku, data.order_qty,
    data.estimated_unit_price ?? null, data.supplier_id ?? null,
    data.ai_reasoning ?? null, data.confidence_score ?? null, data.email_draft ?? null,
    now, now
  );
  return db.prepare('SELECT * FROM inventory_purchase_orders WHERE id = ?').get(id) as InventoryPurchaseOrder;
}

export async function updatePurchaseOrderStatus(
  id: string,
  status: InventoryPurchaseOrder['status'],
  approvedBy?: string
): Promise<void> {
  const db = await getDb();
  db.prepare(`
    UPDATE inventory_purchase_orders
    SET status = ?, approved_by = ?, updated_at = ?
    WHERE id = ?
  `).run(status, approvedBy ?? null, new Date().toISOString(), id);
}

export async function getPendingPurchaseOrders(): Promise<InventoryPurchaseOrder[]> {
  const db = await getDb();
  return db.prepare(`
    SELECT * FROM inventory_purchase_orders
    WHERE status IN ('DRAFT','PENDING_APPROVAL')
    ORDER BY created_at DESC
  `).all() as InventoryPurchaseOrder[];
}

// ─── Értékelési összesítő ────────────────────────────────────────────────────

export interface ValuationRow {
  sku: string;
  name: string;
  unit: string;
  valuation_method: string;
  current_stock: number;
  fifo_stock_value: number;
  wac_stock_value: number;
}

export async function getValuationSummary(): Promise<ValuationRow[]> {
  const db = await getDb();
  return db.prepare(`
    SELECT
      i.sku,
      i.name,
      i.unit,
      i.valuation_method,
      i.current_stock,
      COALESCE((
        SELECT SUM(b.remaining_qty * b.unit_price)
        FROM inventory_batches b
        WHERE b.item_id = i.id AND b.closed = 0
      ), 0) AS fifo_stock_value,
      COALESCE(i.current_stock * i.current_wac_price, 0) AS wac_stock_value
    FROM inventory_items i
    ORDER BY i.category, i.name
  `).all() as ValuationRow[];
}

// ─── Phase 2: Demand Forecast & Replenishment segédfüggvények ───────────────

export interface DailySalesRow {
  date: string;   // YYYY-MM-DD
  qty: number;
}

/**
 * Visszaadja az elmúlt `daysBack` nap OUT mozgásait napi összesítésben (SKU).
 * DemandForecastAgent és SafetyStockAgent használja.
 */
export async function getSalesHistory(itemId: string, daysBack = 90): Promise<DailySalesRow[]> {
  const db = await getDb();
  const since = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000)
    .toISOString().split('T')[0];

  return db.prepare(`
    SELECT
      date(timestamp) AS date,
      SUM(quantity)   AS qty
    FROM inventory_movements
    WHERE item_id = ?
      AND movement_type = 'OUT'
      AND date(timestamp) >= ?
    GROUP BY date(timestamp)
    ORDER BY date ASC
  `).all(itemId, since) as DailySalesRow[];
}

/**
 * Frissíti az item reorder_point és safety_stock értékét.
 * SafetyStockAgent hívja a kalkuláció után.
 */
export async function updateSafetyStockAndRop(
  itemId: string,
  safetyStock: number,
  reorderPoint: number
): Promise<void> {
  const db = await getDb();
  db.prepare(`
    UPDATE inventory_items
    SET safety_stock = ?, reorder_point = ?, updated_at = ?
    WHERE id = ?
  `).run(safetyStock, reorderPoint, new Date().toISOString(), itemId);
}

/**
 * Visszaadja az összes olyan item-et, amelynek current_stock <= reorder_point.
 * PurchaseOrderAgent ezt hívja a PO-generálási ciklushoz.
 */
export async function getItemsBelowReorderPoint(): Promise<InventoryItem[]> {
  const db = await getDb();
  return db.prepare(`
    SELECT * FROM inventory_items
    WHERE current_stock <= reorder_point
      AND reorder_point > 0
    ORDER BY (reorder_point - current_stock) DESC
  `).all() as InventoryItem[];
}

/**
 * Visszaadja az elmúlt `daysBack` nap tényleges napi kiadási mennyiségeit számként.
 * SafetyStockAgent σ_demand kiszámításához.
 */
export async function getDailyDemandSeries(itemId: string, daysBack = 90): Promise<number[]> {
  const history = await getSalesHistory(itemId, daysBack);
  // Ha egy napra nincs mozgás, azt 0-nak vesszük (kereslet = 0 azon a napon)
  const series: number[] = [];
  for (let i = 0; i < daysBack; i++) {
    const d = new Date(Date.now() - (daysBack - i) * 24 * 60 * 60 * 1000)
      .toISOString().split('T')[0];
    const found = history.find(r => r.date === d);
    series.push(found ? found.qty : 0);
  }
  return series;
}

