/**
 * SafetyStockAgent.ts — Statisztikai biztonsági készlet és újrarendelési pont kalkulátor
 * Track: inventory_automation_20260330 — Phase 2.2
 *
 * Képlet:
 *   σ_demand     = a napi kereslet szórása (elmúlt 90 nap)
 *   Safety Stock = Z × σ_demand × √(lead_time_days)    [Z = 1.65 → 95%-os kiszolgálási szint]
 *   ROP          = (avg_daily_demand × lead_time_days) + safety_stock
 *
 * A kiszámított értékeket visszaírja az inventory_items táblába.
 * DemandForecastAgent előtt is futtatható, de együttesen a legjobb.
 */

import { IAgent, AgentResponse } from './types.js';
import { logInfo, logError, setAgentStatus } from '../utils/logger.js';
import {
  getItemBySku,
  getAllItems,
  getDailyDemandSeries,
  updateSafetyStockAndRop,
  type InventoryItem,
} from '../utils/inventoryDb.js';

// ─── Konstansok ───────────────────────────────────────────────────────────────

/** Z-érték 95%-os szolgáltatási szinthez (normál eloszlás) */
const Z_95 = 1.65;

// ─── Típusok ─────────────────────────────────────────────────────────────────

export interface SafetyStockResult {
  sku: string;
  name: string;
  avg_daily_demand: number;
  sigma_demand: number;
  safety_stock: number;
  reorder_point: number;
  service_level_pct: number;  // 95
  lead_time_days: number;
  updated: boolean;
}

export interface SafetyStockTask {
  action: 'calculate' | 'calculate-all';
  sku?: string;
  days_history?: number;
  z_value?: number;           // override (pl. 2.05 = 98%-os szint)
  dry_run?: boolean;          // ha true, nem ír DB-be
}

// ─── Agent ───────────────────────────────────────────────────────────────────

export class SafetyStockAgent implements IAgent {
  name = 'SafetyStockAgent';
  role = 'Biztonsági készlet kalkulátor';
  description = 'Statisztikai módszerrel kiszámítja a biztonsági készlet szintjét és az újrarendelési pontot minden termékhez. Képlet: Z × σ × √(lead_time). DB-be visszaírja az eredményt.';
  capabilities = [
    'safety_stock_calculation',
    'reorder_point_calculation',
    'demand_variability_analysis',
  ];

  async execute(task: string, context?: unknown): Promise<AgentResponse> {
    setAgentStatus(this.name, 'working', task.slice(0, 60));
    try {
      const parsed = typeof context === 'object' && context !== null
        ? (context as SafetyStockTask)
        : JSON.parse(task) as SafetyStockTask;

      if (parsed.action === 'calculate' && parsed.sku) {
        const item = await getItemBySku(parsed.sku);
        if (!item) return { status: 'error', error: `SKU nem található: ${parsed.sku}` };
        const result = await this.calculateForItem(item, {
          daysHistory: parsed.days_history ?? 90,
          zValue: parsed.z_value ?? Z_95,
          dryRun: parsed.dry_run ?? false,
        });
        return { status: 'success', data: result };
      }

      if (parsed.action === 'calculate-all') {
        return await this.calculateAll({
          daysHistory: parsed.days_history ?? 90,
          zValue: parsed.z_value ?? Z_95,
          dryRun: parsed.dry_run ?? false,
        });
      }

      return { status: 'error', error: `Ismeretlen action: ${(parsed as SafetyStockTask).action}` };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      logError(this.name, msg);
      return { status: 'error', error: msg };
    } finally {
      setAgentStatus(this.name, 'idle');
    }
  }

  // ── Kalkuláció egy termékre ───────────────────────────────────────────────

  async calculateForItem(
    item: InventoryItem,
    opts: { daysHistory: number; zValue: number; dryRun: boolean }
  ): Promise<SafetyStockResult> {

    const series = await getDailyDemandSeries(item.id, opts.daysHistory);

    const avgDailyDemand = this.mean(series);
    const sigmaDemand = this.stdDev(series, avgDailyDemand);

    const safetyStock = Math.ceil(opts.zValue * sigmaDemand * Math.sqrt(item.lead_time_days));
    const reorderPoint = Math.ceil(avgDailyDemand * item.lead_time_days + safetyStock);

    logInfo(
      this.name,
      `${item.sku}: avg=${avgDailyDemand.toFixed(2)}/nap, σ=${sigmaDemand.toFixed(2)}, ` +
      `SS=${safetyStock}, ROP=${reorderPoint}`
    );

    if (!opts.dryRun) {
      await updateSafetyStockAndRop(item.id, safetyStock, reorderPoint);
    }

    return {
      sku: item.sku,
      name: item.name,
      avg_daily_demand: parseFloat(avgDailyDemand.toFixed(4)),
      sigma_demand: parseFloat(sigmaDemand.toFixed(4)),
      safety_stock: safetyStock,
      reorder_point: reorderPoint,
      service_level_pct: Math.round((1 - this.normCdf(-opts.zValue)) * 100),
      lead_time_days: item.lead_time_days,
      updated: !opts.dryRun,
    };
  }

  // ── Összes item kalkuláció ────────────────────────────────────────────────

  async calculateAll(opts: { daysHistory: number; zValue: number; dryRun: boolean }): Promise<AgentResponse> {
    const items = await getAllItems();
    const results: SafetyStockResult[] = [];
    const errors: string[] = [];

    for (const item of items) {
      try {
        const r = await this.calculateForItem(item, opts);
        results.push(r);
      } catch (e) {
        errors.push(`${item.sku}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    logInfo(this.name, `calculate-all: ${results.length} item frissítve, ${errors.length} hiba`);
    return {
      status: 'success',
      data: {
        results,
        errors,
        calculation_params: { z_value: opts.zValue, days_history: opts.daysHistory, dry_run: opts.dryRun },
        generated_at: new Date().toISOString(),
      },
    };
  }

  // ── Matematikai segédfüggvények ───────────────────────────────────────────

  /** Számsorozat aritmetikai átlaga */
  mean(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((s, v) => s + v, 0) / values.length;
  }

  /** Populáció szórása */
  stdDev(values: number[], avg?: number): number {
    if (values.length < 2) return 0;
    const mu = avg ?? this.mean(values);
    const variance = values.reduce((s, v) => s + (v - mu) ** 2, 0) / values.length;
    return Math.sqrt(variance);
  }

  /**
   * Normál eloszlás CDF közelítése (Abramowitz & Stegun, max hiba: 7.5e-8)
   * A szolgáltatási szint % kiszámításához.
   */
  normCdf(z: number): number {
    const t = 1 / (1 + 0.2316419 * Math.abs(z));
    const poly =
      t * (0.319381530 +
        t * (-0.356563782 +
          t * (1.781477937 +
            t * (-1.821255978 +
              t * 1.330274429))));
    const pdf = Math.exp(-0.5 * z * z) / Math.sqrt(2 * Math.PI);
    const cdf = 1 - pdf * poly;
    return z >= 0 ? cdf : 1 - cdf;
  }
}
