/**
 * inventoryPhase2.test.ts — Phase 2 (AI utánpótlás) egységtesztek
 * Track: inventory_automation_20260330
 *
 * Teszti hatókör:
 *  - SafetyStockAgent matematikai kalkuláció (determinisztikus)
 *  - DemandForecastAgent statisztikai jellemzők (statikus, LLM nélkül)
 *  - PurchaseOrderAgent rendelési mennyiség számítás
 *
 * Megjegyzés: LLM-t igénylő hívások vi.mock-kal vannak kicserélve.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SafetyStockAgent } from '../src/agents/SafetyStockAgent.js';
import { DemandForecastAgent } from '../src/agents/DemandForecastAgent.js';
import { PurchaseOrderAgent } from '../src/agents/PurchaseOrderAgent.js';
import type { InventoryItem } from '../src/utils/inventoryDb.js';

// ─── Mock-ok ─────────────────────────────────────────────────────────────────

vi.mock('../src/utils/inventoryDb.js', () => ({
  getItemBySku: vi.fn(),
  getAllItems: vi.fn(),
  getSalesHistory: vi.fn(),
  getDailyDemandSeries: vi.fn(),
  updateSafetyStockAndRop: vi.fn(),
  getItemsBelowReorderPoint: vi.fn(),
  createPurchaseOrder: vi.fn(),
}));

vi.mock('../src/core/llm_client.js', () => ({
  generateResponse: vi.fn(),
}));

vi.mock('../src/utils/logger.js', () => ({
  logInfo: vi.fn(),
  logError: vi.fn(),
  setAgentStatus: vi.fn(),
}));

import {
  getItemBySku,
  getAllItems,
  getDailyDemandSeries,
  updateSafetyStockAndRop,
  getItemsBelowReorderPoint,
  createPurchaseOrder,
} from '../src/utils/inventoryDb.js';
import { generateResponse } from '../src/core/llm_client.js';

// ─── Test Fixtures ─────────────────────────────────────────────────────────

const mockItem: InventoryItem = {
  id: 'item-001',
  sku: 'TEST-001',
  name: 'Teszt Termék',
  unit: 'db',
  category: 'Alkatrész',
  valuation_method: 'FIFO',
  min_stock: 10,
  reorder_point: 50,
  safety_stock: 20,
  current_stock: 35,
  lead_time_days: 7,
  supplier_id: 'SUPPLIER-X',
  current_wac_price: 1000,
  created_at: '2024-01-01T00:00:00.000Z',
  updated_at: '2024-01-01T00:00:00.000Z',
};

// ─── SafetyStockAgent tesztek ────────────────────────────────────────────────

describe('SafetyStockAgent — matematikai kalkuláció', () => {
  const agent = new SafetyStockAgent();

  it('[SS-1] Konstans kereslet esetén σ = 0, SS = 0', async () => {
    // 90 nap, minden nap 10 db → szórás = 0
    const series = Array(90).fill(10);
    vi.mocked(getDailyDemandSeries).mockResolvedValue(series);
    vi.mocked(updateSafetyStockAndRop).mockResolvedValue(undefined);

    const result = await agent.calculateForItem(mockItem, {
      daysHistory: 90,
      zValue: 1.65,
      dryRun: true,
    });

    expect(result.sigma_demand).toBe(0);
    expect(result.safety_stock).toBe(0);
    expect(result.avg_daily_demand).toBeCloseTo(10, 2);
  });

  it('[SS-2] Ismert szórással helyes Safety Stock képlet', async () => {
    // σ = 5, lead_time = 7, Z = 1.65
    // SS = ceil(1.65 * 5 * sqrt(7)) = ceil(1.65 * 5 * 2.6458) = ceil(21.83) = 22
    const agent = new SafetyStockAgent();
    expect(agent.stdDev([0, 10, 0, 10, 0, 10], 5)).toBeCloseTo(5, 1);
    const safetyStock = Math.ceil(1.65 * 5 * Math.sqrt(7));
    expect(safetyStock).toBe(22);
  });

  it('[SS-3] ROP = avg_daily * lead_time + safety_stock', async () => {
    // avg=10, lead=7, SS=22 → ROP=ceil(10*7+22)=92
    const mockItem7 = { ...mockItem, lead_time_days: 7 };
    const series = Array(90).fill(0).map((_, i) => i % 2 === 0 ? 0 : 10);
    vi.mocked(getDailyDemandSeries).mockResolvedValue(series);
    vi.mocked(updateSafetyStockAndRop).mockResolvedValue(undefined);

    const result = await agent.calculateForItem(mockItem7, {
      daysHistory: 90,
      zValue: 1.65,
      dryRun: true,
    });

    expect(result.reorder_point).toBe(
      Math.ceil(result.avg_daily_demand * mockItem7.lead_time_days + result.safety_stock)
    );
  });

  it('[SS-4] dry_run esetén updateSafetyStockAndRop NEM hívódik', async () => {
    const series = Array(90).fill(5);
    vi.mocked(getDailyDemandSeries).mockResolvedValue(series);
    vi.mocked(updateSafetyStockAndRop).mockResolvedValue(undefined);

    await agent.calculateForItem(mockItem, { daysHistory: 90, zValue: 1.65, dryRun: true });
    expect(updateSafetyStockAndRop).not.toHaveBeenCalled();
  });

  it('[SS-5] dry_run=false esetén updateSafetyStockAndRop hívódik', async () => {
    const series = Array(90).fill(5);
    vi.mocked(getDailyDemandSeries).mockResolvedValue(series);
    vi.mocked(updateSafetyStockAndRop).mockResolvedValue(undefined);

    await agent.calculateForItem(mockItem, { daysHistory: 90, zValue: 1.65, dryRun: false });
    expect(updateSafetyStockAndRop).toHaveBeenCalledWith(
      mockItem.id,
      expect.any(Number),
      expect.any(Number)
    );
  });

  it('[SS-6] mean() és stdDev() helyes értékek', () => {
    const values = [2, 4, 4, 4, 5, 5, 7, 9]; // klasszikus példa
    const mu = agent.mean(values); // = 5
    const sigma = agent.stdDev(values, mu); // = 2
    expect(mu).toBeCloseTo(5, 5);
    expect(sigma).toBeCloseTo(2, 5);
  });
});

// ─── DemandForecastAgent tesztek ─────────────────────────────────────────────

describe('DemandForecastAgent — statisztika és fallback', () => {
  const agent = new DemandForecastAgent();

  it('[DF-1] Kevés adat esetén statikus fallback, confidence < 0.5', async () => {
    vi.mocked(getItemBySku).mockResolvedValue(mockItem);
    // Csak 3 nap historikus adat → statikus becslés
    const { getSalesHistory: mockSH } = vi.mocked(await import('../src/utils/inventoryDb.js'));
    mockSH.mockResolvedValue([
      { date: '2024-01-01', qty: 10 },
      { date: '2024-01-02', qty: 8 },
      { date: '2024-01-03', qty: 12 },
    ]);

    const result = await agent.forecastSku(mockItem, 90);
    expect(result.confidence).toBeLessThan(0.5);
    expect(result.sku).toBe('TEST-001');
  });

  it('[DF-2] computeSalesStats helyes átlagot számít', () => {
    const history = [
      { date: '2024-01-01', qty: 10 },
      { date: '2024-01-02', qty: 20 },
    ];
    const stats = agent.computeSalesStats(history, 90);
    // totalSold = 30, totalDays = 90 → avg = 30/90 ≈ 0.333
    expect(stats.totalSold).toBe(30);
    expect(stats.avgDaily).toBeCloseTo(30 / 90, 5);
  });

  it('[DF-3] trend detekció: domináns növekedés esetén "growing"', () => {
    // Első harmad: alacsony, utolsó harmad: magas → growing
    const history = [
      { date: '2024-01-01', qty: 2 },
      { date: '2024-01-02', qty: 2 },
      { date: '2024-01-03', qty: 2 },
      { date: '2024-01-04', qty: 10 },
      { date: '2024-01-05', qty: 10 },
      { date: '2024-01-06', qty: 10 },
      { date: '2024-01-07', qty: 10 },
      { date: '2024-01-08', qty: 10 },
      { date: '2024-01-09', qty: 10 },
    ];
    const stats = agent.computeSalesStats(history, 90);
    expect(stats.trend).toBe('growing');
  });

  it('[DF-4] LLM hiba esetén fallback result visszajön (confidence >= 0.3)', async () => {
    // LLM dob egy hibát
    vi.mocked(generateResponse).mockRejectedValue(new Error('LLM hiba'));
    const { getSalesHistory: mockSH } = vi.mocked(await import('../src/utils/inventoryDb.js'));
    // 30 napos adat → LLM-et hív, de fallback-ra esik
    const dates = Array.from({ length: 30 }, (_, i) => ({
      date: `2024-02-${String(i + 1).padStart(2, '0')}`,
      qty: 10,
    }));
    mockSH.mockResolvedValue(dates);

    const result = await agent.forecastSku(mockItem, 90);
    expect(result).toHaveProperty('sku', 'TEST-001');
    expect(result.confidence).toBeGreaterThanOrEqual(0.3);
  });
});

// ─── PurchaseOrderAgent tesztek ──────────────────────────────────────────────

describe('PurchaseOrderAgent — rendelési logika', () => {
  const agent = new PurchaseOrderAgent();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('[PO-1] calculateOrderQty: max(ROP*2, SS*3, 1)', () => {
    const item = { ...mockItem, reorder_point: 50, safety_stock: 20 };
    const qty = agent.calculateOrderQty(item);
    // max(100, 60, 1) = 100
    expect(qty).toBe(100);
  });

  it('[PO-2] calculateOrderQty: safety_stock*3 dominál', () => {
    const item = { ...mockItem, reorder_point: 10, safety_stock: 40 };
    const qty = agent.calculateOrderQty(item);
    // max(20, 120, 1) = 120
    expect(qty).toBe(120);
  });

  it('[PO-3] Nincs ROP alatti termék → üres orders tömb', async () => {
    vi.mocked(getItemsBelowReorderPoint).mockResolvedValue([]);
    const response = await agent.generateForAllBelowRop();
    expect(response.status).toBe('success');
    expect((response.data as { orders: unknown[] }).orders).toHaveLength(0);
  });

  it('[PO-4] ROP alatti terméknél PO létrejön (createPurchaseOrder hívódik)', async () => {
    vi.mocked(getItemsBelowReorderPoint).mockResolvedValue([mockItem]);
    vi.mocked(createPurchaseOrder).mockResolvedValue({
      ...mockItem,
      id: 'po-001', order_qty: 100, status: 'DRAFT',
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    } as unknown as Awaited<ReturnType<typeof createPurchaseOrder>>);
    vi.mocked(generateResponse).mockResolvedValue(
      'Tárgy: Megrendelés – TEST-001 [TERVEZET]\n\nTisztelt Szállítónk!\n\nRendelünk 100 db TEST-001 terméket.'
    );

    const response = await agent.generateForAllBelowRop();
    expect(response.status).toBe('success');
    expect(createPurchaseOrder).toHaveBeenCalledTimes(1);
    const callArg = vi.mocked(createPurchaseOrder).mock.calls[0][0];
    expect(callArg.item_id).toBe('item-001');
    expect(callArg.order_qty).toBe(100);
  });

  it('[PO-5] execute(): single SKU generate action létrehoz egy PO draftot', async () => {
    vi.mocked(getItemBySku).mockResolvedValue(mockItem);
    vi.mocked(createPurchaseOrder).mockResolvedValue({
      ...mockItem,
      id: 'po-002', order_qty: 120, status: 'DRAFT',
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    } as unknown as Awaited<ReturnType<typeof createPurchaseOrder>>);
    vi.mocked(generateResponse).mockResolvedValue(
      'Tárgy: Megrendelés – TEST-001 [TERVEZET]\n\nTisztelt Szállítónk!\n\nRendelünk 120 db TEST-001 terméket.'
    );

    const response = await agent.execute(JSON.stringify({
      action: 'generate',
      sku: 'TEST-001',
      override_qty: 120,
    }));

    expect(response.status).toBe('success');
    expect(getItemBySku).toHaveBeenCalledWith('TEST-001');
    expect(createPurchaseOrder).toHaveBeenCalledTimes(1);
    const callArg = vi.mocked(createPurchaseOrder).mock.calls[0][0];
    expect(callArg.item_id).toBe('item-001');
    expect(callArg.order_qty).toBe(120);
  });
});
