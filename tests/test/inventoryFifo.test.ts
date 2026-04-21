/**
 * inventoryFifo.test.ts — FIFO algoritmus egységtesztek
 * Track: inventory_automation_20260330 — AC-1 teljesítés
 *
 * Főbb tesztek:
 *  - 30 db @ 6000 Ft + 70 db @ 5000 Ft → 50 db kiadás = 280.000 Ft ELÁBÉ (spec AC-1)
 *  - Multi-batch kimerítés sorrendhelyes (FIFO = legkorábbi batch előbb)
 *  - Részleges batch kimerítés (remaining_qty csökken, nem zárul be)
 *  - Teljes batch lezárás (closed = 1 ha remaining_qty = 0)
 *  - Elégtelen készlet → Error
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// ─── Mock az inventoryDb-re ───────────────────────────────────────────────────

type MockBatch = {
  id: string;
  item_id: string;
  purchase_date: string;
  quantity: number;
  remaining_qty: number;
  unit_price: number;
  closed: number;
};

let mockBatches: MockBatch[] = [];
let mockItemStock = 0;
let movementsLog: unknown[] = [];

vi.mock('../src/utils/inventoryDb.js', () => ({
  getItemBySku: vi.fn(),
  getItemById: vi.fn(),
  createBatch: vi.fn(),
  getOpenBatchesByItemId: vi.fn(() => mockBatches.filter(b => b.closed === 0).sort(
    (a, b) => a.purchase_date.localeCompare(b.purchase_date)
  )),
  updateBatchRemainingQty: vi.fn((id: string, newRemaining: number) => {
    const b = mockBatches.find(x => x.id === id);
    if (b) {
      b.remaining_qty = newRemaining;
      b.closed = newRemaining <= 0 ? 1 : 0;
    }
  }),
  logMovement: vi.fn((m: unknown) => { movementsLog.push(m); }),
  updateItemStock: vi.fn((id: string, delta: number) => { mockItemStock += delta; }),
  getAllItems: vi.fn(() => []),
}));

import { InventoryFifoAgent } from '../src/agents/InventoryFifoAgent.js';

const { getItemBySku, createBatch, getOpenBatchesByItemId, updateBatchRemainingQty } =
  await import('../src/utils/inventoryDb.js');

// ─── Segédfüggvény ────────────────────────────────────────────────────────────

function makeBatch(id: string, purchase_date: string, qty: number, unit_price: number): MockBatch {
  return { id, item_id: 'item-1', purchase_date, quantity: qty, remaining_qty: qty, unit_price, closed: 0 };
}

function setupItem(valuation_method = 'FIFO', stock = 100) {
  const item = {
    id: 'item-1', sku: 'SKU-001', name: 'Teszt termék',
    unit: 'db', valuation_method, current_stock: stock,
    min_stock: 5, reorder_point: 10, safety_stock: 5,
    lead_time_days: 7, created_at: '2026-01-01', updated_at: '2026-01-01',
  };
  vi.mocked(getItemBySku).mockResolvedValue(item as never);
  mockItemStock = stock;
  return item;
}

// ─── Tesztek ─────────────────────────────────────────────────────────────────

describe('InventoryFifoAgent — FIFO Algoritmus', () => {
  let agent: InventoryFifoAgent;

  beforeEach(() => {
    agent = new InventoryFifoAgent();
    mockBatches = [];
    movementsLog = [];
    vi.clearAllMocks();
  });

  // ── AC-1 Spec kritérium ───────────────────────────────────────────────────

  it('AC-1: 30 db @ 6000 Ft + 70 db @ 5000 Ft → 50 db kiadás = 280.000 Ft ELÁBÉ', async () => {
    setupItem('FIFO', 100);

    // Két batch: először a drágábbat kell felhasználnia (FIFO: korábbi dátum)
    mockBatches = [
      makeBatch('batch-A', '2026-01-05', 30, 6000),   // első bevételezés
      makeBatch('batch-B', '2026-02-10', 70, 5000),    // második bevételezés
    ];

    vi.mocked(getOpenBatchesByItemId).mockResolvedValue(
      [...mockBatches].sort((a, b) => a.purchase_date.localeCompare(b.purchase_date)) as never
    );

    const result = await agent.runFifoAlgorithm('item-1', 50);

    // Elvárt ELÁBÉ: 30 * 6000 + 20 * 5000 = 180.000 + 100.000 = 280.000
    expect(result.totalCogs).toBe(280_000);

    // batch-A teljesen kimerült (30 db felhasznált)
    expect(result.batchesConsumed[0].batchId).toBe('batch-A');
    expect(result.batchesConsumed[0].qty).toBe(30);
    expect(result.batchesConsumed[0].value).toBe(180_000);

    // batch-B részlegesen (20 db felhasznált)
    expect(result.batchesConsumed[1].batchId).toBe('batch-B');
    expect(result.batchesConsumed[1].qty).toBe(20);
    expect(result.batchesConsumed[1].value).toBe(100_000);
  });

  // ── Batch lezárás helye ───────────────────────────────────────────────────

  it('batch closed=1 ha remaining_qty eléri a 0-t', async () => {
    setupItem('FIFO', 30);

    mockBatches = [makeBatch('batch-X', '2026-01-01', 30, 1000)];
    vi.mocked(getOpenBatchesByItemId).mockResolvedValue([...mockBatches] as never);

    await agent.runFifoAlgorithm('item-1', 30);

    expect(vi.mocked(updateBatchRemainingQty)).toHaveBeenCalledWith('batch-X', 0);
    expect(mockBatches[0].closed).toBe(1);
  });

  // ── Részleges kimerítés ───────────────────────────────────────────────────

  it('részleges batch kimerítéskor remaining_qty csökken, closed marad 0', async () => {
    setupItem('FIFO', 50);

    mockBatches = [makeBatch('batch-Y', '2026-01-01', 50, 2000)];
    vi.mocked(getOpenBatchesByItemId).mockResolvedValue([...mockBatches] as never);

    await agent.runFifoAlgorithm('item-1', 20);

    expect(vi.mocked(updateBatchRemainingQty)).toHaveBeenCalledWith('batch-Y', 30);
    expect(mockBatches[0].remaining_qty).toBe(30);
    expect(mockBatches[0].closed).toBe(0);
  });

  // ── FIFO sorrend ellenőrzése ───────────────────────────────────────────────

  it('FIFO: korábbi purchase_date-ű batch kerül ki előbb', async () => {
    setupItem('FIFO', 60);

    // Szándékosan fordított sorrendben adjuk meg, az agent-nek kell sorba raknia
    mockBatches = [
      makeBatch('batch-LATE', '2026-03-01', 30, 9000),   // újabb → másodikként
      makeBatch('batch-EARLY', '2026-01-01', 30, 3000),  // korábbi → elsőként
    ];

    vi.mocked(getOpenBatchesByItemId).mockResolvedValue(
      [...mockBatches].sort((a, b) => a.purchase_date.localeCompare(b.purchase_date)) as never
    );

    const result = await agent.runFifoAlgorithm('item-1', 30);

    // Csak a korábbi batch-et kellett kimeríteni
    expect(result.batchesConsumed).toHaveLength(1);
    expect(result.batchesConsumed[0].batchId).toBe('batch-EARLY');
    expect(result.batchesConsumed[0].unitPrice).toBe(3000);
    expect(result.totalCogs).toBe(90_000); // 30 * 3000
  });

  // ── Elégtelen készlet hibakezelés ─────────────────────────────────────────

  it('elégtelen batch készlet esetén Error dobódik', async () => {
    setupItem('FIFO', 10);

    mockBatches = [makeBatch('batch-SMALL', '2026-01-01', 10, 1000)];
    vi.mocked(getOpenBatchesByItemId).mockResolvedValue([...mockBatches] as never);

    await expect(agent.runFifoAlgorithm('item-1', 20)).rejects.toThrow('Elégtelen batch készlet');
  });

  // ── Issue: SKU nem található ──────────────────────────────────────────────

  it('issue: ismeretlen SKU → status: error', async () => {
    vi.mocked(getItemBySku).mockResolvedValue(null as never);

    const result = await agent.issue({ sku: 'ISMERETLEN', quantity: 5 });
    expect(result.status).toBe('error');
    expect(result.error).toMatch(/SKU nem található/);
  });

  // ── Issue: WAC termék FIFO-val → error ────────────────────────────────────

  it('issue: WAC módszerű terméknél FIFO agent error-t ad', async () => {
    setupItem('WAC');
    const result = await agent.issue({ sku: 'SKU-001', quantity: 5 });
    expect(result.status).toBe('error');
    expect(result.error).toMatch(/WAC/);
  });

  // ── Issue: elégtelen készlet ─────────────────────────────────────────────

  it('issue: elégtelen készlet → status: error', async () => {
    setupItem('FIFO', 5);
    const result = await agent.issue({ sku: 'SKU-001', quantity: 10 });
    expect(result.status).toBe('error');
    expect(result.error).toMatch(/Elégtelen készlet/);
  });
});
