/**
 * InventoryWacAgent.ts — Súlyozott Átlagár (WAC) értékelő ágens
 * Track: inventory_automation_20260330 — Phase 1.4
 *
 * WAC képlet (Számviteli Törvény 2000. évi C. tv. 47. §):
 *   WAC = (nyitókészlet_érték + időszaki_bevételek_értéke)
 *         / (nyitókészlet_menny + időszaki_bevételek_menny)
 *
 * Futtatás: n8n WF-INV-2 → napi éjfél cron → /api/v1/inventory/wac-refresh
 */

import { IAgent, AgentResponse } from './types.js';
import { logInfo, logError, setAgentStatus } from '../utils/logger.js';
import {
  getAllItems,
  getItemById,
  getItemBySku,
  updateWacPrice,
  updateItemStock,
  logMovement,
  type WacResult,
} from '../utils/inventoryDb.js';

// ─── Bemenet típusok ─────────────────────────────────────────────────────────

export interface WacIssueInput {
  sku: string;
  quantity: number;
  reference?: string;
  counterparty?: string;
}

export interface WacAgentTask {
  action: 'refresh' | 'issue' | 'recalc';
  data?: WacIssueInput | { sku?: string };
}

// ─── Agent ───────────────────────────────────────────────────────────────────

export class InventoryWacAgent implements IAgent {
  name = 'InventoryWacAgent';
  role = 'Készletkezelő — WAC (Súlyozott Átlagár) értékelés';
  description = 'Napi WAC ár frissítés és WAC alapú készletkiadás KKV-k számára. Számvitelileg helyes, minden bevételezés után azaynnali WAC újraszámítás.';
  capabilities = [
    'wac_refresh',
    'wac_issue',
    'wac_recalculate',
  ];

  async execute(task: string, context?: unknown): Promise<AgentResponse> {
    setAgentStatus(this.name, 'working', task.slice(0, 60));
    try {
      const parsed = typeof context === 'object' && context !== null
        ? (context as WacAgentTask)
        : JSON.parse(task) as WacAgentTask;

      switch (parsed.action) {
        case 'refresh':
          return await this.refreshAllWac();
        case 'issue':
          return await this.issueWac(parsed.data as WacIssueInput);
        case 'recalc': {
          const d = parsed.data as { sku?: string };
          if (!d?.sku) return { status: 'error', error: 'SKU megadása kötelező recalc-hoz' };
          return await this.recalcSingleWac(d.sku);
        }
        default:
          return { status: 'error', error: `Ismeretlen action: ${(parsed as WacAgentTask).action}` };
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      logError(this.name, msg);
      return { status: 'error', error: msg };
    } finally {
      setAgentStatus(this.name, 'idle');
    }
  }

  // ── WAC Frissítés (napi batch, n8n WF-INV-2 hívja) ──────────────────────────

  async refreshAllWac(): Promise<AgentResponse> {
    logInfo(this.name, 'WAC frissítés indítása — összes WAC-módszerű termék');

    const items = await getAllItems();
    const wacItems = items.filter(i => i.valuation_method === 'WAC');

    const results: WacResult[] = [];
    let updatedCount = 0;
    let skippedCount = 0;

    for (const item of wacItems) {
      try {
        const result = await this.computeWac(item.id);
        if (result !== null) {
          await updateWacPrice(item.id, result.newWacPrice);
          results.push(result);
          updatedCount++;
        } else {
          skippedCount++;
        }
      } catch (err) {
        logError(this.name, `WAC hiba: ${item.sku} — ${err instanceof Error ? err.message : String(err)}`);
        skippedCount++;
      }
    }

    logInfo(this.name, `WAC frissítés kész: ${updatedCount} frissítve, ${skippedCount} kihagyva`);

    return {
      status: 'success',
      data: {
        updated: updatedCount,
        skipped: skippedCount,
        results,
        refreshed_at: new Date().toISOString(),
      },
    };
  }

  // ── WAC kiadás ────────────────────────────────────────────────────────────────

  async issueWac(input: WacIssueInput): Promise<AgentResponse> {
    logInfo(this.name, `WAC kiadás: ${input.sku} — ${input.quantity} db`);

    const item = await getItemBySku(input.sku);
    if (!item) {
      return { status: 'error', error: `SKU nem található: ${input.sku}` };
    }
    if (item.valuation_method !== 'WAC') {
      return { status: 'error', error: `${input.sku} értékelési módja: ${item.valuation_method} — nem WAC` };
    }
    if (item.current_stock < input.quantity) {
      return {
        status: 'error',
        error: `Elégtelen készlet: ${input.sku} — kért: ${input.quantity}, elérhető: ${item.current_stock}`,
      };
    }

    const wacPrice = item.current_wac_price ?? 0;
    const totalValue = input.quantity * wacPrice;

    // Készlet csökkentése
    await updateItemStock(item.id, -input.quantity);

    // Mozgás naplózás
    await logMovement({
      item_id: item.id,
      movement_type: 'OUT',
      status: 'COMPLETED',
      quantity: input.quantity,
      unit_price: wacPrice,
      total_value: totalValue,
      reference: input.reference,
      counterparty: input.counterparty,
    });


    logInfo(this.name, `WAC kiadás kész: ${input.quantity} db @ ${wacPrice} Ft/db = ${totalValue.toLocaleString('hu-HU')} Ft`);

    return {
      status: 'success',
      data: {
        sku: input.sku,
        quantity_issued: input.quantity,
        wac_price: wacPrice,
        total_value: totalValue,
        remaining_stock: item.current_stock - input.quantity,
        reference: input.reference,
      },
    };
  }

  // ── Egyedi SKU WAC újraszámítás ───────────────────────────────────────────────

  async recalcSingleWac(sku: string): Promise<AgentResponse> {
    const item = await getItemBySku(sku);
    if (!item) return { status: 'error', error: `SKU nem található: ${sku}` };

    const result = await this.computeWac(item.id);
    if (!result) {
      return { status: 'success', data: { sku, message: 'Nincs bevételezési adat, WAC nem frissíthető' } };
    }

    await updateWacPrice(item.id, result.newWacPrice);

    return {
      status: 'success',
      data: {
        sku,
        new_wac_price: result.newWacPrice,
        total_stock: result.totalStock,
        total_value: result.totalValue,
        recalculated_at: new Date().toISOString(),
      },
    };
  }

  // ── WAC Számítás (belső) ─────────────────────────────────────────────────────

  /**
   * WAC = SUM(remaining_qty * unit_price) / SUM(remaining_qty)
   * Az összes nyitott batch alapján számítva (FIFO batch-eket is felhasználja WAC-hoz)
   */
  private async computeWac(itemId: string): Promise<WacResult | null> {
    const { getOpenBatchesByItemId } = await import('../utils/inventoryDb.js');
    const batches = await getOpenBatchesByItemId(itemId);

    const item = await getItemById(itemId);
    if (!item) return null;

    if (batches.length === 0) {
      // Ha nincs nyitott batch de van készlet (legacy adat), tartjuk az utolsó WAC-ot
      return null;
    }

    const totalStock = batches.reduce((sum, b) => sum + b.remaining_qty, 0);
    const totalValue = batches.reduce((sum, b) => sum + b.remaining_qty * b.unit_price, 0);

    if (totalStock <= 0) return null;

    const newWacPrice = totalValue / totalStock;

    return {
      sku: item.sku,
      newWacPrice,
      totalStock,
      totalValue,
    };
  }
}
