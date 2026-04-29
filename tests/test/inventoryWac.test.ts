/**
 * inventoryWac.test.ts — WAC (Súlyozott Átlagár) algoritmus egységtesztek
 * Track: inventory_automation_20260330
 *
 * Főbb tesztek:
 *  - WAC frissítés korrekt számítás (SUM(qty*price) / SUM(qty))
 *  - Bevételezés után azonnali WAC változás
 *  - Kiadásnál mindig az aktuális WAC ár kerül felhasználásra
 *  - Nulla készlet esetén WAC nem frissítendő
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
let mockWacPrice: number | null = null;
let mockStock = 0;
let movementsLog: unknown[] = [];

vi.mock('@packages/utils/inventoryDb.js', () => ({
  getItemBySku: vi.fn(),
  getItemById: vi.fn(),
  getAllItems: vi.fn(() => []),
  getOpenBatchesByItemId: vi.fn(() =>
    mockBatches.filter(b => b.closed === 0)
  ),
  updateWacPrice: vi.fn((_id: string, price: number) => { mockWacPrice = price; }),
  updateItemStock: vi.fn((_id: string, delta: number) => { mockStock += delta; }),
  logMovement: vi.fn((m: unknown) => { movementsLog.push(m); }),
}));

import { InventoryWacAgent } from '@packages/agents/InventoryWacAgent.js';

const { getItemBySku, getItemById, getAllItems, getOpenBatchesByItemId, updateWacPrice } =
  await import('@packages/utils/inventoryDb.js');

// ─── Segédfüggvény ────────────────────────────────────────────────────────────

function makeBatch(id: string, qty: number, unit_price: number): MockBatch {
  return {
    id, item_id: 'item-2', purchase_date: '2026-01-01',
    quantity: qty, remaining_qty: qty, unit_price, closed: 0,
  };
}

function setupWacItem(currentWac: number | null = null, stock = 100) {
  const item = {
    id: 'item-2', sku: 'WAC-001', name: 'WAC termék',
    unit: 'kg', valuation_method: 'WAC', current_stock: stock,
    current_wac_price: currentWac, min_stock: 2, reorder_point: 5,
    safety_stock: 2, lead_time_days: 5, created_at: '2026-01-01', updated_at: '2026-01-01',
  };
  vi.mocked(getItemBySku).mockResolvedValue(item as never);
  vi.mocked(getItemById).mockResolvedValue(item as never);
  mockWacPrice = currentWac;
  mockStock = stock;
  return item;
}

// ─── Tesztek ─────────────────────────────────────────────────────────────────

describe('InventoryWacAgent — WAC Algoritmus', () => {
  let agent: InventoryWacAgent;

  beforeEach(() => {
    agent = new InventoryWacAgent();
    mockBatches = [];
    movementsLog = [];
    vi.clearAllMocks();
  });

  // ── WAC számítás helyessége ───────────────────────────────────────────────

  it('WAC helyes: 100 db @ 1000 Ft + 200 db @ 700 Ft → WAC = 800 Ft', async () => {
    setupWacItem(1000, 300);

    mockBatches = [
      makeBatch('b1', 100, 1000),   // hozzájárulás: 100.000 Ft
      makeBatch('b2', 200, 700),    // hozzájárulás: 140.000 Ft
    ];

    vi.mocked(getOpenBatchesByItemId).mockResolvedValue([...mockBatches] as never);

    const result = await agent.recalcSingleWac('WAC-001');

    expect(result.status).toBe('success');
    // WAC = (100*1000 + 200*700) / (100+200) = 240.000 / 300 = 800
    expect(vi.mocked(updateWacPrice)).toHaveBeenCalledWith('item-2', 800);
  });

  // ── Egyenlő mennyiségű tételek ────────────────────────────────────────────

  it('WAC helyes: 50 db @ 2000 Ft + 50 db @ 1000 Ft → WAC = 1500 Ft', async () => {
    setupWacItem(null, 100);

    mockBatches = [
      makeBatch('b3', 50, 2000),
      makeBatch('b4', 50, 1000),
    ];

    vi.mocked(getOpenBatchesByItemId).mockResolvedValue([...mockBatches] as never);

    await agent.recalcSingleWac('WAC-001');

    expect(vi.mocked(updateWacPrice)).toHaveBeenCalledWith('item-2', 1500);
  });

  // ── Egy batch esetén WAC = batch egységár ─────────────────────────────────

  it('WAC egyetlen batch esetén = batch unit_price', async () => {
    setupWacItem(null, 80);

    mockBatches = [makeBatch('b5', 80, 3500)];
    vi.mocked(getOpenBatchesByItemId).mockResolvedValue([...mockBatches] as never);

    await agent.recalcSingleWac('WAC-001');

    expect(vi.mocked(updateWacPrice)).toHaveBeenCalledWith('item-2', 3500);
  });

  // ── Nulla batch esetén nincs frissítés ────────────────────────────────────

  it('ha nincs nyitott batch, WAC nem frissítendő', async () => {
    setupWacItem(2000, 0);
    mockBatches = [];
    vi.mocked(getOpenBatchesByItemId).mockResolvedValue([] as never);

    const result = await agent.recalcSingleWac('WAC-001');

    expect(result.status).toBe('success');
    expect(vi.mocked(updateWacPrice)).not.toHaveBeenCalled();
  });

  // ── WAC kiadás ────────────────────────────────────────────────────────────

  it('issueWac: helyes WAC ár és értékszámítás', async () => {
    setupWacItem(1200, 50);

    const result = await agent.issueWac({ sku: 'WAC-001', quantity: 10, reference: 'VSZ-001' });

    expect(result.status).toBe('success');
    expect((result.data as { total_value: number }).total_value).toBe(12_000);
    expect((result.data as { wac_price: number }).wac_price).toBe(1200);
  });

  // ── WAC kiadás: elégtelen készlet ─────────────────────────────────────────

  it('issueWac: elégtelen készlet → error', async () => {
    setupWacItem(1000, 5);

    const result = await agent.issueWac({ sku: 'WAC-001', quantity: 20 });
    expect(result.status).toBe('error');
    expect(result.error).toMatch(/Elégtelen készlet/);
  });

  // ── WAC kiadás: FIFO termékre → error ─────────────────────────────────────

  it('issueWac: FIFO módszerű terméknél error', async () => {
    const item = { ...setupWacItem(), valuation_method: 'FIFO' };
    vi.mocked(getItemBySku).mockResolvedValue(item as never);

    const result = await agent.issueWac({ sku: 'WAC-001', quantity: 5 });
    expect(result.status).toBe('error');
    expect(result.error).toMatch(/FIFO/);
  });

  // ── Batch refresh eredmény ────────────────────────────────────────────────

  it('refreshAllWac: WAC módszerű tételek frissítve, FIFO figyelmen kívül', async () => {
    const wacItem = setupWacItem(1000, 100);
    const fifoItem = { ...wacItem, id: 'item-3', sku: 'FIFO-001', valuation_method: 'FIFO' };

    vi.mocked(getAllItems).mockResolvedValue([wacItem, fifoItem] as never);
    vi.mocked(getItemById).mockResolvedValue(wacItem as never);

    mockBatches = [makeBatch('b6', 100, 1500)];
    vi.mocked(getOpenBatchesByItemId).mockResolvedValue([...mockBatches] as never);

    const result = await agent.refreshAllWac();

    expect(result.status).toBe('success');
    // Csak a WAC tételt frissítette
    expect(vi.mocked(updateWacPrice)).toHaveBeenCalledTimes(1);
    expect((result.data as { updated: number }).updated).toBe(1);
  });
});
