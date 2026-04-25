// FILE: src/server/telemetryRoutes.ts
// PURPOSE: G5.2 — Token Cost Dashboard API (RULE-OB1→OB4)
//
// Endpoints:
//   GET /api/telemetry/usage   → { today, week, month, byAgent, byModel }
//   GET /api/telemetry/traces  → recent trace list
//   GET /api/telemetry/traces/:traceId → TraceSpan[]
//   GET /api/telemetry/cost    → { totalCost, breakdown }
//   GET /api/telemetry/stats   → tracer health stats

import { Router } from 'express';
import {
  getTraceSpans,
  getRecentSpans,
  getActiveSpans,
  getTokenUsageSummary,
  getRecentTraceIds,
  getTracerStats,
  type TraceSpan,
} from '../utils/agentTracer.js';
import { ensureError } from '../utils/ensureError.js';

// Cost rates per 1K tokens (USD) — configurable via env
const COST_PER_1K: Record<string, { input: number; output: number }> = {
  'gpt-4o':            { input: 0.005,  output: 0.015 },
  'gemini-2.5-flash':  { input: 0.00015, output: 0.0006 },
  'llama3.1:8b':       { input: 0,      output: 0 },       // Local — free
  'qwen2.5-coder:7b':  { input: 0,      output: 0 },       // Local — free
};

function calculateCost(spans: TraceSpan[]): { totalCost: number; breakdown: Record<string, number> } {
  const breakdown: Record<string, number> = {};
  let totalCost = 0;

  for (const span of spans) {
    if (!span.tokenUsage) continue;
    const model = (span.metadata.model as string) || 'unknown';
    const rates = COST_PER_1K[model] || { input: 0.001, output: 0.003 }; // default fallback

    const cost =
      (span.tokenUsage.input / 1000) * rates.input +
      (span.tokenUsage.output / 1000) * rates.output;

    totalCost += cost;
    breakdown[model] = (breakdown[model] || 0) + cost;
  }

  return { totalCost: Math.round(totalCost * 1_000_000) / 1_000_000, breakdown };
}

function filterByTimeRange(spans: TraceSpan[], sinceMs: number): TraceSpan[] {
  const cutoff = Date.now() - sinceMs;
  return spans.filter(s => s.startTime >= cutoff);
}

export function createTelemetryRouter(): Router {
  const router = Router();

  /**
   * GET /api/telemetry/usage
   * Token usage summary for today / week / month
   */
  router.get('/usage', (_req, res) => {
    try {
      const allSpans = getRecentSpans(2000);

      const todaySpans = filterByTimeRange(allSpans, 24 * 60 * 60 * 1000);
      const weekSpans  = filterByTimeRange(allSpans, 7 * 24 * 60 * 60 * 1000);

      const sumTokens = (spans: TraceSpan[]) => {
        let input = 0, output = 0;
        for (const s of spans) {
          if (s.tokenUsage) {
            input += s.tokenUsage.input;
            output += s.tokenUsage.output;
          }
        }
        return { input, output, total: input + output };
      };

      const summary = getTokenUsageSummary();

      res.json({
        today: sumTokens(todaySpans),
        week: sumTokens(weekSpans),
        month: { input: summary.totalInput, output: summary.totalOutput, total: summary.totalInput + summary.totalOutput },
        byAgent: summary.byAgent,
        byModel: summary.byModel,
      });
    } catch (error: unknown) {
      const err = ensureError(error);
      res.status(500).json({ error: err.message });
    }
  });

  /**
   * GET /api/telemetry/traces
   * List of recent trace IDs with basic info
   */
  router.get('/traces', (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string, 10) || 20;
      const traceIds = getRecentTraceIds(limit);

      const traces = traceIds.map(traceId => {
        const spans = getTraceSpans(traceId);
        const rootSpan = spans[0]; // First span = root
        return {
          traceId,
          rootAgent: rootSpan?.agentName || 'unknown',
          operation: rootSpan?.operation || 'unknown',
          status: rootSpan?.status || 'unknown',
          startTime: rootSpan?.startTime,
          duration: rootSpan?.duration,
          spanCount: spans.length,
        };
      });

      res.json({ traces });
    } catch (error: unknown) {
      const err = ensureError(error);
      res.status(500).json({ error: err.message });
    }
  });

  /**
   * GET /api/telemetry/traces/:traceId
   * Full span hierarchy for a specific trace
   */
  router.get('/traces/:traceId', (req, res) => {
    try {
      const { traceId } = req.params;
      const spans = getTraceSpans(traceId);

      if (spans.length === 0) {
        res.status(404).json({ error: 'Trace not found' });
        return;
      }

      res.json({ traceId, spans });
    } catch (error: unknown) {
      const err = ensureError(error);
      res.status(500).json({ error: err.message });
    }
  });

  /**
   * GET /api/telemetry/cost
   * Estimated cost breakdown by model
   */
  router.get('/cost', (_req, res) => {
    try {
      const allSpans = getRecentSpans(2000);
      const cost = calculateCost(allSpans);
      res.json(cost);
    } catch (error: unknown) {
      const err = ensureError(error);
      res.status(500).json({ error: err.message });
    }
  });

  /**
   * GET /api/telemetry/stats
   * Tracer health / status
   */
  router.get('/stats', (_req, res) => {
    try {
      const stats = getTracerStats();
      const active = getActiveSpans();
      res.json({
        ...stats,
        activeSpanDetails: active.map(s => ({
          spanId: s.spanId,
          agent: s.agentName,
          operation: s.operation,
          runningFor: Date.now() - s.startTime,
        })),
      });
    } catch (error: unknown) {
      const err = ensureError(error);
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}
