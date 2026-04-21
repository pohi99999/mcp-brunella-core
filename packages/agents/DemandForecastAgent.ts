/**
 * DemandForecastAgent.ts — Értékesítési trend és kereslet-előrejelzés ágens
 * Track: inventory_automation_20260330 — Phase 2.1
 *
 * Felelős:
 *  • Historikus OUT mozgások elemzése (elmúlt 90 nap)
 *  • Szezonalitás és trend azonosítás
 *  • LLM-alapú 30 napos kereslet-előrejelzés (Brunella LLM client)
 *  • SafetyStockAgent-tel együttműködik a ROP frissítéshez
 */

import { IAgent, AgentResponse } from './types.js';
import { logInfo, logError, setAgentStatus } from '@packages/utils/logger.js';
import {
  getItemBySku,
  getAllItems,
  getSalesHistory,
  type DailySalesRow,
  type InventoryItem,
} from '@packages/utils/inventoryDb.js';
import { generateResponse } from '@packages/core-logic/llm_client.js';

// ─── Típusok ─────────────────────────────────────────────────────────────────

export interface ForecastResult {
  sku: string;
  name: string;
  predicted_demand_30d: number;
  recommended_order_qty: number;
  avg_daily_demand: number;
  trend: 'growing' | 'stable' | 'declining' | 'seasonal';
  confidence: number;             // 0.0 – 1.0
  reasoning: string;
}

export interface DemandForecastTask {
  action: 'forecast' | 'forecast-all';
  sku?: string;
  days_history?: number;          // default 90
}

// ─── Agent ───────────────────────────────────────────────────────────────────

export class DemandForecastAgent implements IAgent {
  name = 'DemandForecastAgent';
  role = 'Kereslet-előrejelzési ágens';
  description = 'Historikus értékesítési adatok elemzése és LLM-alapú 30 napos kereslet-előrejelzés. AI-vezérelt szezonalitás és trend detekció KKV-k számára.';
  capabilities = [
    'demand_forecast',
    'sales_velocity',
    'trend_analysis',
    'seasonal_detection',
  ];

  async execute(task: string, context?: unknown): Promise<AgentResponse> {
    setAgentStatus(this.name, 'working', task.slice(0, 60));
    try {
      const parsed = typeof context === 'object' && context !== null
        ? (context as DemandForecastTask)
        : JSON.parse(task) as DemandForecastTask;

      if (parsed.action === 'forecast' && parsed.sku) {
        const item = await getItemBySku(parsed.sku);
        if (!item) return { status: 'error', error: `SKU nem található: ${parsed.sku}` };
        const result = await this.forecastSku(item, parsed.days_history ?? 90);
        return { status: 'success', data: result };
      }

      if (parsed.action === 'forecast-all') {
        return await this.forecastAll(parsed.days_history ?? 90);
      }

      return { status: 'error', error: `Ismeretlen action: ${(parsed as DemandForecastTask).action}` };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      logError(this.name, msg);
      return { status: 'error', error: msg };
    } finally {
      setAgentStatus(this.name, 'idle');
    }
  }

  // ── Egyedi SKU előrejelzés ────────────────────────────────────────────────

  async forecastSku(item: InventoryItem, daysHistory = 90): Promise<ForecastResult> {
    logInfo(this.name, `Előrejelzés indítva: ${item.sku}`);

    const history = await getSalesHistory(item.id, daysHistory);
    const stats = this.computeSalesStats(history, daysHistory);

    // Ha nincs elegendő adat: statikus becslés LLM nélkül
    if (history.length < 7) {
      logInfo(this.name, `${item.sku}: kevés historikus adat (${history.length} nap), statikus becslés`);
      return {
        sku: item.sku,
        name: item.name,
        predicted_demand_30d: stats.avgDaily * 30,
        recommended_order_qty: Math.ceil(stats.avgDaily * (item.lead_time_days + 14)),
        avg_daily_demand: stats.avgDaily,
        trend: 'stable',
        confidence: 0.3,
        reasoning: `Kevés historikus adat (${history.length} aktív értékesítési nap). Statikus átlag alapú becslés.`,
      };
    }

    // LLM-alapú predikció
    const llmResult = await this.callLlmForecast(item, history, stats);
    return llmResult;
  }

  // ── Összes FIFO/WAC item előrejelzése ─────────────────────────────────────

  async forecastAll(daysHistory = 90): Promise<AgentResponse> {
    const items = await getAllItems();
    const results: ForecastResult[] = [];
    const errors: string[] = [];

    for (const item of items) {
      try {
        const result = await this.forecastSku(item, daysHistory);
        results.push(result);
      } catch (e) {
        errors.push(`${item.sku}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    logInfo(this.name, `forecast-all: ${results.length} kész, ${errors.length} hiba`);
    return {
      status: 'success',
      data: {
        forecasts: results,
        errors,
        generated_at: new Date().toISOString(),
      },
    };
  }

  // ── Statisztikai számítások ───────────────────────────────────────────────

  computeSalesStats(history: DailySalesRow[], totalDays: number) {
    const totalSold = history.reduce((s, r) => s + r.qty, 0);
    const activeDays = history.length;
    const avgDaily = totalDays > 0 ? totalSold / totalDays : 0;

    // Heti bontás (szezonalitás)
    const weeklyTotals: number[] = Array(Math.ceil(totalDays / 7)).fill(0);
    history.forEach(r => {
      const dayIdx = Math.max(0, totalDays - 1 - this.daysBetween(r.date, new Date().toISOString().split('T')[0]));
      const weekIdx = Math.floor(dayIdx / 7);
      if (weekIdx < weeklyTotals.length) weeklyTotals[weekIdx] += r.qty;
    });

    // Trend alap-detekció: első és utolsó harmad összehasonlítása
    const third = Math.floor(history.length / 3);
    const firstThird = history.slice(0, third).reduce((s, r) => s + r.qty, 0);
    const lastThird = history.slice(-third).reduce((s, r) => s + r.qty, 0);
    const trendRatio = firstThird > 0 ? lastThird / firstThird : 1;

    let trend: ForecastResult['trend'] = 'stable';
    if (trendRatio > 1.2) trend = 'growing';
    else if (trendRatio < 0.8) trend = 'declining';

    return { totalSold, activeDays, avgDaily, weeklyTotals, trendRatio, trend };
  }

  private daysBetween(dateA: string, dateB: string): number {
    return Math.round(
      (new Date(dateB).getTime() - new Date(dateA).getTime()) / (1000 * 60 * 60 * 24)
    );
  }

  // ── LLM hívás ──────────────────────────────────────────────────────────────

  private async callLlmForecast(
    item: InventoryItem,
    history: DailySalesRow[],
    stats: ReturnType<DemandForecastAgent['computeSalesStats']>
  ): Promise<ForecastResult> {

    const prompt = `Te egy tapasztalt készletkezelési szakértő vagy KKV-k számára.

FELADAT: Elemezd a termék értékesítési adatait, azonosítsd a trendet és készíts előrejelzést.

TERMÉK:
- SKU: ${item.sku}
- Név: ${item.name}
- Mértékegység: ${item.unit}
- Szállítói átfutási idő: ${item.lead_time_days} nap
- Jelenlegi készlet: ${item.current_stock} ${item.unit}

HISTORIKUS ÉRTÉKESÍTÉSI ADATOK (elmúlt 90 nap, napi bontás):
${JSON.stringify(history.slice(-30), null, 2)}

ELŐZETES STATISZTIKA:
- Összesen eladott: ${stats.totalSold} ${item.unit}
- Napi átlag: ${stats.avgDaily.toFixed(2)} ${item.unit}/nap
- Aktív értékesítési napok: ${stats.activeDays}
- Trend arány (utolsó vs első harmad): ${stats.trendRatio.toFixed(2)}

KÉRT VÁLASZ FORMÁTUMA (csak JSON, semmi más):
{
  "predicted_demand_30d": <szám>,
  "recommended_order_qty": <szám>,
  "trend": "growing" | "stable" | "declining" | "seasonal",
  "confidence": <0.0-1.0>,
  "reasoning": "<rövid magyar indoklás max 2 mondatban>"
}`;

    try {
      const raw = await generateResponse(prompt, 'gemini');
      // JSON kinyerés a válaszból
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('LLM nem adott vissza érvényes JSON-t');

      const parsed = JSON.parse(jsonMatch[0]) as {
        predicted_demand_30d: number;
        recommended_order_qty: number;
        trend: ForecastResult['trend'];
        confidence: number;
        reasoning: string;
      };

      return {
        sku: item.sku,
        name: item.name,
        predicted_demand_30d: parsed.predicted_demand_30d,
        recommended_order_qty: Math.ceil(parsed.recommended_order_qty),
        avg_daily_demand: stats.avgDaily,
        trend: parsed.trend,
        confidence: Math.min(1, Math.max(0, parsed.confidence)),
        reasoning: parsed.reasoning,
      };
    } catch (err) {
      logError(this.name, `LLM hívás sikertelen: ${item.sku} — fallback statikus becslés`);
      // Fallback: statikus számítás
      const predicted30d = Math.ceil(stats.avgDaily * 30 * (stats.trendRatio > 1 ? stats.trendRatio : 1));
      return {
        sku: item.sku,
        name: item.name,
        predicted_demand_30d: predicted30d,
        recommended_order_qty: Math.ceil(stats.avgDaily * (item.lead_time_days + 14)),
        avg_daily_demand: stats.avgDaily,
        trend: stats.trend,
        confidence: 0.4,
        reasoning: 'LLM fallback: historikus átlag + trend szorzó alapján.',
      };
    }
  }
}

