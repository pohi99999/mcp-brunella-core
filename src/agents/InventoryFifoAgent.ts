/**
 * InventoryFifoAgent.ts — FIFO készletértékelő ágens
 * Track: inventory_automation_20260330 — Phase 1.3
 *
 * Felelős:
 *  • Bevételezés: új FIFO batch létrehozása
 *  • Kiadás: FIFO algoritmus (legkorábbi batch-ek kimerítése)
 *  • ELÁBÉ kalkuláció (Cost of Goods Sold)
 */

import { IAgent, AgentResponse } from './types.js';
import { logInfo, logError, setAgentStatus } from '../utils/logger.js';
import {
  getItemBySku,
  getItemById,
  createBatch,
  getOpenBatchesByItemId,
  updateBatchRemainingQty,
  logMovement,
  updateItemStock,
  type FifoIssueResult,
} from '../utils/inventoryDb.js';

// ─── Bemenet típusok ─────────────────────────────────────────────────────────

export interface ReceiveInput {
  sku: string;
  quantity: number;
  unit_price: number;
  purchase_date?: string;           // ISO 8601, default: ma
  supplier_id?: string;
  delivery_note_ref?: string;
}

export interface IssueInput {
  sku: string;
  quantity: number;
  reference?: string;               // vevői rendelés szám / bizonylat szám
  counterparty?: string;
}

export interface FifoAgentTask {
  action: 'receive' | 'issue' | 'status';
  data: ReceiveInput | IssueInput | { sku?: string };
}

// ─── Agent ───────────────────────────────────────────────────────────────────

export class InventoryFifoAgent implements IAgent {
  name = 'InventoryFifoAgent';
  role = 'Készletkezelő — FIFO értékelés';
  description = 'FIFO alapú készletbevételezés, kiadás és ELÁBÉ kalkuláció KKV-k számára.';
  capabilities = [
    'fifo_receive',
    'fifo_issue',
    'cogs_calculation',
    'inventory_status',
  ];

  async execute(task: string, context?: unknown): Promise<AgentResponse> {
    setAgentStatus(this.name, 'working', task.slice(0, 60));
    try {
      const parsed = typeof context === 'object' && context !== null
        ? (context as FifoAgentTask)
        : JSON.parse(task) as FifoAgentTask;

      switch (parsed.action) {
        case 'receive':
          return await this.receive(parsed.data as ReceiveInput);
        case 'issue':
          return await this.issue(parsed.data as IssueInput);
        case 'status': {
          const d = parsed.data as { sku?: string };
          return await this.status(d.sku);
        }
        default:
          return { status: 'error', error: `Ismeretlen action: ${(parsed as FifoAgentTask).action}` };
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      logError(this.name, msg);
      return { status: 'error', error: msg };
    } finally {
      setAgentStatus(this.name, 'idle');
    }
  }

  // ── Bevételezés ─────────────────────────────────────────────────────────────

  async receive(input: ReceiveInput): Promise<AgentResponse> {
    logInfo(this.name, `Bevételezés: ${input.sku} — ${input.quantity} db @ ${input.unit_price} Ft`);

    const item = await getItemBySku(input.sku);
    if (!item) {
      return { status: 'error', error: `SKU nem található: ${input.sku}` };
    }
    if (item.valuation_method !== 'FIFO') {
      return { status: 'error', error: `${input.sku} értékelési módja: ${item.valuation_method} — nem FIFO` };
    }

    const purchaseDate = input.purchase_date ?? new Date().toISOString().split('T')[0];

    const batch = await createBatch({
      item_id: item.id,
      purchase_date: purchaseDate,
      quantity: input.quantity,
      remaining_qty: input.quantity,
      unit_price: input.unit_price,
      supplier_id: input.supplier_id,
      delivery_note_ref: input.delivery_note_ref,
    });

    // Készlet növelése
    await updateItemStock(item.id, input.quantity);

    // Mozgás naplózás
    await logMovement({
      item_id: item.id,
      movement_type: 'IN',
      status: 'COMPLETED',
      quantity: input.quantity,
      unit_price: input.unit_price,
      total_value: input.quantity * input.unit_price,
      reference: input.delivery_note_ref,
      counterparty: input.supplier_id,
    });

    logInfo(this.name, `Batch létrehozva: ${batch.id}, Készlet +${input.quantity}`);

    return {
      status: 'success',
      data: {
        batch_id: batch.id,
        sku: input.sku,
        quantity_received: input.quantity,
        unit_price: input.unit_price,
        purchase_date: purchaseDate,
        total_value: input.quantity * input.unit_price,
      },
    };
  }

  // ── Kiadás (FIFO algoritmus) ─────────────────────────────────────────────────

  async issue(input: IssueInput): Promise<AgentResponse> {
    logInfo(this.name, `Kiadás: ${input.sku} — ${input.quantity} db`);

    const item = await getItemBySku(input.sku);
    if (!item) {
      return { status: 'error', error: `SKU nem található: ${input.sku}` };
    }
    if (item.valuation_method !== 'FIFO') {
      return { status: 'error', error: `${input.sku} értékelési módja: ${item.valuation_method} — nem FIFO` };
    }
    if (item.current_stock < input.quantity) {
      return {
        status: 'error',
        error: `Elégtelen készlet: ${input.sku} — kért: ${input.quantity}, elérhető: ${item.current_stock}`,
      };
    }

    const result = await this.runFifoAlgorithm(item.id, input.quantity);

    // Készlet csökkentése
    await updateItemStock(item.id, -input.quantity);

    // Mozgás naplózás
    await logMovement({
      item_id: item.id,
      movement_type: 'OUT',
      status: 'COMPLETED',
      quantity: input.quantity,
      unit_price: result.totalCogs / input.quantity,
      total_value: result.totalCogs,
      reference: input.reference,
      counterparty: input.counterparty,
    });

    logInfo(this.name, `FIFO kiadás kész: ELÁBÉ = ${result.totalCogs.toLocaleString('hu-HU')} Ft`);

    return {
      status: 'success',
      data: {
        sku: input.sku,
        quantity_issued: input.quantity,
        total_cogs: result.totalCogs,
        average_cost_per_unit: result.totalCogs / input.quantity,
        batches_consumed: result.batchesConsumed,
        remaining_stock_value: result.remainingStockValue,
        reference: input.reference,
      },
    };
  }

  /**
   * FIFO Algoritmus — belső logika
   * Spec: legkorábbi batch-ek kimerítése purchase_date ASC sorrendben
   */
  async runFifoAlgorithm(itemId: string, qty: number): Promise<FifoIssueResult> {
    const batches = await getOpenBatchesByItemId(itemId);

    let remaining = qty;
    let totalCogs = 0;
    const batchesConsumed: FifoIssueResult['batchesConsumed'] = [];

    for (const batch of batches) {
      if (remaining <= 0) break;

      const consume = Math.min(remaining, batch.remaining_qty);
      const value = consume * batch.unit_price;

      totalCogs += value;
      remaining -= consume;

      const newRemaining = batch.remaining_qty - consume;
      await updateBatchRemainingQty(batch.id, newRemaining);

      batchesConsumed.push({
        batchId: batch.id,
        qty: consume,
        unitPrice: batch.unit_price,
        value,
      });
    }

    if (remaining > 0) {
      throw new Error(`Elégtelen batch készlet! Még hiányzik: ${remaining} db`);
    }

    // Maradék készletérték kalkuláció
    const updatedBatches = await getOpenBatchesByItemId(itemId);
    const remainingStockValue = updatedBatches.reduce(
      (sum, b) => sum + b.remaining_qty * b.unit_price,
      0
    );

    return { totalCogs, batchesConsumed, remainingStockValue };
  }

  // ── Státusz lekérdezés ───────────────────────────────────────────────────────

  async status(sku?: string): Promise<AgentResponse> {
    if (sku) {
      const item = await getItemBySku(sku);
      if (!item) return { status: 'error', error: `SKU nem található: ${sku}` };

      const batches = await getOpenBatchesByItemId(item.id);
      const fifoValue = batches.reduce((sum, b) => sum + b.remaining_qty * b.unit_price, 0);

      return {
        status: 'success',
        data: {
          sku: item.sku,
          name: item.name,
          current_stock: item.current_stock,
          unit: item.unit,
          valuation_method: item.valuation_method,
          fifo_stock_value: fifoValue,
          open_batches: batches.length,
          reorder_point: item.reorder_point,
          needs_reorder: item.current_stock <= item.reorder_point,
        },
      };
    }

    // Összes tétel
    const { getAllItems } = await import('../utils/inventoryDb.js');
    const items = await getAllItems();
    return {
      status: 'success',
      data: {
        total_items: items.length,
        items_needing_reorder: items.filter(i => i.current_stock <= i.reorder_point).length,
        items,
      },
    };
  }
}
