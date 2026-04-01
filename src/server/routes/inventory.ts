/**
 * inventory.ts — REST API végpontok az Inventory modulhoz
 * Track: inventory_automation_20260330
 *
 * Mountolás: /api/v1/inventory  (src/server/routes/index.ts)
 *
 * Végpontok:
 *  POST /receive             — bevételezés (FIFO batch)
 *  POST /issue               — kiadás (FIFO vagy WAC)
 *  POST /transfer            — raktárközi mozgás
 *  POST /scrap               — selejtezés
 *  POST /stocktake           — fizikai leltárfelvétel
 *  GET  /status              — aktuális készlet (összes vagy ?sku=X)
 *  GET  /valuation           — FIFO / WAC értékelés összesítő
 *  GET  /movements           — mozgási napló (?sku=X &limit=N)
 *  GET  /pending-orders      — jóváhagyásra váró rendelések
 *  GET  /open-stocktakes     — nyitott leltáreltérések
 *  POST /wac-refresh         — WAC napi frissítés (n8n WF-INV-2 hívja)
 *  POST /items               — új termék létrehozás
 */

import { Router, type Request, type Response } from 'express';
import { logInfo, logError } from '../../utils/logger.js';
import {
  createItem,
  getAllItems,
  getItemBySku,
  logMovement,
  updateItemStock,
  createStocktake,
  getPendingPurchaseOrders,
  getOpenStocktakes,
  getValuationSummary,
  getMovementsByItem,
} from '../../utils/inventoryDb.js';
import { InventoryFifoAgent } from '../../agents/InventoryFifoAgent.js';
import { InventoryWacAgent } from '../../agents/InventoryWacAgent.js';
import { DemandForecastAgent, type DemandForecastTask } from '../../agents/DemandForecastAgent.js';
import { SafetyStockAgent, type SafetyStockTask } from '../../agents/SafetyStockAgent.js';
import { PurchaseOrderAgent, type PurchaseOrderTask } from '../../agents/PurchaseOrderAgent.js';

// Singleton agent példányok
const fifoAgent = new InventoryFifoAgent();
const wacAgent = new InventoryWacAgent();
const forecastAgent = new DemandForecastAgent();
const safetyStockAgent = new SafetyStockAgent();
const poAgent = new PurchaseOrderAgent();

function normalizeRouteParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) {
    return String(value[0] ?? '').trim();
  }

  return String(value ?? '').trim();
}

export function createInventoryRoutes(): Router {
  const router = Router();

  // ── POST /items — Új termék felvétele ──────────────────────────────────────
  router.post('/items', async (req: Request, res: Response) => {
    try {
      const { sku, name, unit, category, valuation_method, min_stock,
              reorder_point, safety_stock, lead_time_days, supplier_id, notes } = req.body as {
        sku: string; name: string; unit: string; category?: string;
        valuation_method?: 'FIFO' | 'WAC'; min_stock?: number;
        reorder_point?: number; safety_stock?: number; lead_time_days?: number;
        supplier_id?: string; notes?: string;
      };

      if (!sku || !name || !unit) {
        return res.status(400).json({ error: 'sku, name, unit kötelező mezők' });
      }

      const item = await createItem({
        sku, name, unit,
        category,
        valuation_method: valuation_method ?? 'FIFO',
        min_stock: min_stock ?? 0,
        reorder_point: reorder_point ?? 0,
        safety_stock: safety_stock ?? 0,
        current_stock: 0,
        lead_time_days: lead_time_days ?? 7,
        supplier_id,
        notes,
      });

      logInfo('InventoryRoute', `Termék létrehozva: ${sku}`);
      res.status(201).json({ success: true, item });
    } catch (e) {
      logError('InventoryRoute', `POST /items hiba: ${e instanceof Error ? e.message : String(e)}`);
      res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
    }
  });

  // ── POST /receive — Bevételezés ────────────────────────────────────────────
  router.post('/receive', async (req: Request, res: Response) => {
    try {
      const { sku, quantity, unit_price, purchase_date, supplier_id, delivery_note_ref } = req.body as {
        sku: string; quantity: number; unit_price: number;
        purchase_date?: string; supplier_id?: string; delivery_note_ref?: string;
      };

      if (!sku || !quantity || !unit_price) {
        return res.status(400).json({ error: 'sku, quantity, unit_price kötelező' });
      }

      const item = await getItemBySku(sku);
      if (!item) return res.status(404).json({ error: `SKU nem található: ${sku}` });

      // Delegálás a megfelelő ágensnek a valuation_method alapján
      // (WAC és FIFO bevételezés logikája megegyezik, csak WAC igényel azonnali recalc-ot)
      const result = await fifoAgent.receive({ sku, quantity, unit_price, purchase_date, supplier_id, delivery_note_ref });

      // WAC esetén azonnal újraszámítjuk az átlagárat
      if (item.valuation_method === 'WAC') {
        await wacAgent.execute('recalc WAC', { action: 'recalc', data: { sku } });
      }

      res.json(result);
    } catch (e) {
      logError('InventoryRoute', `POST /receive hiba: ${e instanceof Error ? e.message : String(e)}`);
      res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
    }
  });

  // ── POST /issue — Kiadás ──────────────────────────────────────────────────
  router.post('/issue', async (req: Request, res: Response) => {
    try {
      const { sku, quantity, reference, counterparty } = req.body as {
        sku: string; quantity: number; reference?: string; counterparty?: string;
      };

      if (!sku || !quantity) {
        return res.status(400).json({ error: 'sku, quantity kötelező' });
      }

      const item = await getItemBySku(sku);
      if (!item) return res.status(404).json({ error: `SKU nem található: ${sku}` });

      let result;
      if (item.valuation_method === 'WAC') {
        result = await wacAgent.issueWac({ sku, quantity, reference, counterparty });
      } else {
        result = await fifoAgent.issue({ sku, quantity, reference, counterparty });
      }

      res.json(result);
    } catch (e) {
      logError('InventoryRoute', `POST /issue hiba: ${e instanceof Error ? e.message : String(e)}`);
      res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
    }
  });

  // ── POST /transfer — Raktárközi mozgás ────────────────────────────────────
  router.post('/transfer', async (req: Request, res: Response) => {
    try {
      const { sku, quantity, location_from, location_to, reference } = req.body as {
        sku: string; quantity: number; location_from: string;
        location_to: string; reference?: string;
      };

      if (!sku || !quantity || !location_from || !location_to) {
        return res.status(400).json({ error: 'sku, quantity, location_from, location_to kötelező' });
      }

      const item = await getItemBySku(sku);
      if (!item) return res.status(404).json({ error: `SKU nem található: ${sku}` });

      await logMovement({
        item_id: item.id,
        movement_type: 'TRANSFER',
        quantity,
        reference,
        location_from,
        location_to,
      });

      logInfo('InventoryRoute', `Transfer rögzítve: ${sku} ${location_from} → ${location_to}`);
      res.json({ success: true, sku, quantity, location_from, location_to });
    } catch (e) {
      logError('InventoryRoute', `POST /transfer hiba: ${e instanceof Error ? e.message : String(e)}`);
      res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
    }
  });

  // ── POST /scrap — Selejtezés ───────────────────────────────────────────────
  router.post('/scrap', async (req: Request, res: Response) => {
    try {
      const { sku, quantity, reference, notes } = req.body as {
        sku: string; quantity: number; reference?: string; notes?: string;
      };

      if (!sku || !quantity) {
        return res.status(400).json({ error: 'sku, quantity kötelező' });
      }

      const item = await getItemBySku(sku);
      if (!item) return res.status(404).json({ error: `SKU nem található: ${sku}` });

      if (item.current_stock < quantity) {
        return res.status(400).json({ error: `Elégtelen készlet: ${item.current_stock} < ${quantity}` });
      }

      await updateItemStock(item.id, -quantity);
      await logMovement({
        item_id: item.id,
        movement_type: 'SCRAP',
        quantity,
        reference,
        notes,
      });

      logInfo('InventoryRoute', `Selejtezés rögzítve: ${sku} — ${quantity} db`);
      res.json({ success: true, sku, quantity_scrapped: quantity, remaining_stock: item.current_stock - quantity });
    } catch (e) {
      logError('InventoryRoute', `POST /scrap hiba: ${e instanceof Error ? e.message : String(e)}`);
      res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
    }
  });

  // ── POST /stocktake — Fizikai leltárfelvétel ───────────────────────────────
  router.post('/stocktake', async (req: Request, res: Response) => {
    try {
      const { sku, physical_count, counted_by, location } = req.body as {
        sku: string; physical_count: number; counted_by?: string; location?: string;
      };

      if (!sku || physical_count === undefined) {
        return res.status(400).json({ error: 'sku, physical_count kötelező' });
      }

      const item = await getItemBySku(sku);
      if (!item) return res.status(404).json({ error: `SKU nem található: ${sku}` });

      const discrepancy = physical_count - item.current_stock;
      const unitPrice = item.current_wac_price ?? 0;

      const stocktake = await createStocktake({
        item_id: item.id,
        physical_count,
        system_count: item.current_stock,
        discrepancy,
        discrepancy_value: Math.abs(discrepancy) * unitPrice,
        counted_by,
        location,
      });

      const needsInvestigation = discrepancy !== 0;
      logInfo('InventoryRoute', `Leltárfelvétel: ${sku} — eltérés: ${discrepancy >= 0 ? '+' : ''}${discrepancy}`);

      res.json({
        success: true,
        stocktake_id: stocktake.id,
        sku,
        physical_count,
        system_count: item.current_stock,
        discrepancy,
        needs_investigation: needsInvestigation,
        status: stocktake.status,
      });
    } catch (e) {
      logError('InventoryRoute', `POST /stocktake hiba: ${e instanceof Error ? e.message : String(e)}`);
      res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
    }
  });

  // ── GET /status — Aktuális készlet ────────────────────────────────────────
  router.get('/status', async (req: Request, res: Response) => {
    try {
      const sku = req.query['sku'] as string | undefined;
      const result = await fifoAgent.status(sku);
      res.json(result);
    } catch (e) {
      logError('InventoryRoute', `GET /status hiba: ${e instanceof Error ? e.message : String(e)}`);
      res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
    }
  });

  // ── GET /valuation — Értékelési összesítő ────────────────────────────────
  router.get('/valuation', async (_req: Request, res: Response) => {
    try {
      const rows = await getValuationSummary();
      const totalFifo = rows.reduce((s, r) => s + r.fifo_stock_value, 0);
      const totalWac = rows.reduce((s, r) => s + r.wac_stock_value, 0);

      res.json({
        success: true,
        summary: {
          total_items: rows.length,
          total_fifo_value: totalFifo,
          total_wac_value: totalWac,
        },
        items: rows,
        generated_at: new Date().toISOString(),
      });
    } catch (e) {
      logError('InventoryRoute', `GET /valuation hiba: ${e instanceof Error ? e.message : String(e)}`);
      res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
    }
  });

  // ── GET /movements — Mozgási napló ────────────────────────────────────────
  router.get('/movements', async (req: Request, res: Response) => {
    try {
      const sku = req.query['sku'] as string | undefined;
      const limit = parseInt(req.query['limit'] as string ?? '100', 10);

      if (!sku) {
        return res.status(400).json({ error: 'sku query param kötelező' });
      }

      const item = await getItemBySku(sku);
      if (!item) return res.status(404).json({ error: `SKU nem található: ${sku}` });

      const movements = await getMovementsByItem(item.id, limit);
      res.json({ success: true, sku, movements });
    } catch (e) {
      logError('InventoryRoute', `GET /movements hiba: ${e instanceof Error ? e.message : String(e)}`);
      res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
    }
  });

  // ── GET /pending-orders — Jóváhagyásra váró PO-k ─────────────────────────
  router.get('/pending-orders', async (_req: Request, res: Response) => {
    try {
      const orders = await getPendingPurchaseOrders();
      res.json({ success: true, count: orders.length, orders });
    } catch (e) {
      logError('InventoryRoute', `GET /pending-orders hiba: ${e instanceof Error ? e.message : String(e)}`);
      res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
    }
  });

  // ── GET /open-stocktakes — Nyitott leltáreltérések ────────────────────────
  router.get('/open-stocktakes', async (_req: Request, res: Response) => {
    try {
      const stocktakes = await getOpenStocktakes();
      res.json({ success: true, count: stocktakes.length, stocktakes });
    } catch (e) {
      logError('InventoryRoute', `GET /open-stocktakes hiba: ${e instanceof Error ? e.message : String(e)}`);
      res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
    }
  });

  // ── POST /wac-refresh — WAC napi batch frissítés (n8n WF-INV-2) ──────────
  router.post('/wac-refresh', async (_req: Request, res: Response) => {
    try {
      logInfo('InventoryRoute', 'WAC batch frissítés indítva (WF-INV-2)');
      const result = await wacAgent.refreshAllWac();
      res.json(result);
    } catch (e) {
      logError('InventoryRoute', `POST /wac-refresh hiba: ${e instanceof Error ? e.message : String(e)}`);
      res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
    }
  });

  // ── GET /forecast/:sku — Demand Forecast ─────────────────────────────────────
  router.get('/forecast/:sku', async (req: Request, res: Response) => {
    try {
      const sku = normalizeRouteParam(req.params.sku);
      if (!sku) {
        res.status(400).json({ error: 'SKU paraméter kötelező' });
        return;
      }
      
      const payload: DemandForecastTask = { sku, action: 'forecast' };
      const result = await forecastAgent.execute(JSON.stringify(payload));
      res.json(result);
    } catch (e) {
      logError('InventoryRoute', `GET /forecast/:sku hiba: ${e instanceof Error ? e.message : String(e)}`);
      res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
    }
  });

  // ── POST /safety-stock/:sku — Biztonsági Készlet Kalkuláció ──────────────
  router.post('/safety-stock/:sku', async (req: Request, res: Response) => {
    try {
      const sku = normalizeRouteParam(req.params.sku);
      if (!sku) {
        res.status(400).json({ error: 'SKU paraméter kötelező' });
        return;
      }
      
      const payload: SafetyStockTask = { sku, action: 'calculate' };
      const result = await safetyStockAgent.execute(JSON.stringify(payload));
      res.json(result);
    } catch (e) {
      logError('InventoryRoute', `POST /safety-stock/:sku hiba: ${e instanceof Error ? e.message : String(e)}`);
      res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
    }
  });

  // ── POST /generate-po/:sku — PO (Purchase Order) Generátor ──────────────────
  router.post('/generate-po/:sku', async (req: Request, res: Response) => {
    try {
      const sku = normalizeRouteParam(req.params.sku);
      if (!sku) {
        res.status(400).json({ error: 'SKU paraméter kötelező' });
        return;
      }
      
      const payload: PurchaseOrderTask = { sku, action: 'generate' };
      const result = await poAgent.execute(JSON.stringify(payload));
      res.json(result);
    } catch (e) {
      logError('InventoryRoute', `POST /generate-po/:sku hiba: ${e instanceof Error ? e.message : String(e)}`);
      res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
    }
  });

  return router;
}
