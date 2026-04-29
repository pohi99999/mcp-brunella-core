import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StocktakeReconciliationAgent } from '@packages/agents/StocktakeReconciliationAgent.js';
import { StocktakeReportAgent } from '@packages/agents/StocktakeReportAgent.js';
import { InventoryAdjustmentAgent } from '@packages/agents/InventoryAdjustmentAgent.js';
import * as db from '@packages/utils/inventoryDb.js';
import * as llm from '@packages/core-logic/llm_client.js';

describe('Inventory Phase 3 - Stocktake Agents', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('StocktakeReconciliationAgent', () => {
    it('should detect recent receive and give high confidence', async () => {
      vi.spyOn(db, 'getItemBySku').mockResolvedValue({
        id: 'ITEM-1', sku: 'TEST-SKU-1', name: 'Test', unit: 'db', current_stock: 10,
        category: '', valuation_method: 'FIFO', min_stock: 0, reorder_point: 5,
        safety_stock: 0, lead_time_days: 1, current_wac_price: 1000
      } as any);

      vi.spyOn(db, 'getMovementsByItem').mockResolvedValue([
        { id: '1', item_id: 'ITEM-1', movement_type: 'IN', quantity: 10, timestamp: new Date().toISOString() }
      ] as any);

      const agent = new StocktakeReconciliationAgent();
      const res = await agent.execute(JSON.stringify({
        sku: 'TEST-SKU-1', discrepancy_qty: -10, discrepancy_value: -10000
      }));

      expect(res.status).toBe('success');
      expect((res.data as any).probable_cause).toContain('Késleltetett vagy duplikált bevételezés');
      expect((res.data as any).confidence).toBe(0.75);
    });

    it('should fallback to LLM if no matching recent movement', async () => {
      vi.spyOn(db, 'getItemBySku').mockResolvedValue({
        id: 'ITEM-2', sku: 'TEST-SKU-2', name: 'Test', unit: 'db', current_stock: 10,
        category: '', valuation_method: 'FIFO', min_stock: 0, reorder_point: 5,
        safety_stock: 0, lead_time_days: 1, current_wac_price: 1000
      } as any);

      vi.spyOn(db, 'getMovementsByItem').mockResolvedValue([]);
      vi.spyOn(llm, 'generateResponse').mockResolvedValue('AI reason explanation');

      const agent = new StocktakeReconciliationAgent();
      const res = await agent.execute(JSON.stringify({
        sku: 'TEST-SKU-2', discrepancy_qty: -5, discrepancy_value: -5000
      }));

      expect(res.status).toBe('success');
      expect((res.data as any).probable_cause).toContain('AI reason explanation');
      expect((res.data as any).confidence).toBe(0.5);
    });
  });

  describe('StocktakeReportAgent', () => {
    it('should generate markdown report for discrepancies', async () => {
      vi.spyOn(llm, 'generateResponse').mockResolvedValue('Mocked markdown report');
      const agent = new StocktakeReportAgent();
      const res = await agent.execute(JSON.stringify({
        date: '2026-04-02',
        total_inventory_value: 100000,
        discrepancies: [
          { sku: 'TEST-1', system_qty: 10, counted_qty: 5, discrepancy_value: -5000, investigation_cause: 'hiány', confidence: 0.8 }
        ]
      }));

      expect(res.status).toBe('success');
      expect((res.data as any).markdown).toBe('Mocked markdown report');
    });
  });

  describe('InventoryAdjustmentAgent', () => {
    it('should generate draft document for discrepancy (loss)', async () => {
      const agent = new InventoryAdjustmentAgent();
      const res = await agent.execute(JSON.stringify({
        sku: 'TEST-SKU-3', discrepancy_qty: -10, discrepancy_value: -15000, date: '2026-04-02', reason: 'Teszt'
      }));

      expect(res.status).toBe('success');
      expect((res.data as any).account_debit).toBe('8693');
      expect((res.data as any).account_credit).toBe('261');
      expect((res.data as any).amount).toBe(15000);
      expect((res.data as any).status).toBe('DRAFT_FOR_APPROVAL');
    });

    it('should generate draft document for discrepancy (surplus)', async () => {
      const agent = new InventoryAdjustmentAgent();
      const res = await agent.execute(JSON.stringify({
        sku: 'TEST-SKU-4', discrepancy_qty: 5, discrepancy_value: 20000, date: '2026-04-02', reason: 'Fellelt készlet'
      }));

      expect(res.status).toBe('success');
      expect((res.data as any).account_debit).toBe('261');
      expect((res.data as any).account_credit).toBe('9693');
      expect((res.data as any).amount).toBe(20000);
      expect((res.data as any).status).toBe('DRAFT_FOR_APPROVAL');
    });
  });
});
