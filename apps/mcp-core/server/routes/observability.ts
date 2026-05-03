import { Router } from 'express';
import {
  queryLlmCalls,
  getLlmCallStats,
  queryRuntimeThresholdRolloutJournalSummaries,
  recordRuntimeThresholdRolloutJournal,
  type LlmCallQuery,
} from '@packages/utils/globalDb.js';
import { getRuntimeDriftSnapshot } from '@packages/utils/runtimeDriftMonitor.js';
import {
  buildThresholdRolloutPlan,
  renderThresholdRolloutPlan,
  readRepoRuntimeContract,
} from '@packages/utils/runtimeThresholdRollout.js';
import { logError } from '@packages/utils/logger.js';
import {
  buildPhoenixFlywheelObservabilitySnapshot,
  renderPhoenixFlywheelMarkdown,
} from '@packages/utils/phoenixInsights.js';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function readBoundedInteger(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = Number(value ?? fallback);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(Math.trunc(parsed), min), max);
}

export function createObservabilityRouter(): Router {
  const router = Router();

  /**
   * GET /api/v1/observability/stats
   * LLM call statistics (provider breakdown, latency, tokens, cost)
   */
  router.get('/stats', (_req, res) => {
    try {
      const since = readString(_req.query.since);
      const stats = getLlmCallStats(since);
      res.json({ success: true, stats });
    } catch (e: unknown) {
      const error = e instanceof Error ? e.message : String(e);
      logError('ObservabilityRoute', `GET /stats failed: ${error}`);
      res.status(500).json({ success: false, error });
    }
  });

  /**
   * GET /api/v1/observability/calls
   * List LLM calls with optional filters
   */
  router.get('/calls', (req, res) => {
    try {
      const query: LlmCallQuery = {
        provider: readString(req.query.provider),
        since: readString(req.query.since),
        until: readString(req.query.until),
        userId: readString(req.query.userId),
        limit: readBoundedInteger(req.query.limit, 200, 1, 500),
        offset: readBoundedInteger(req.query.offset, 0, 0, 100_000),
      };
      const calls = queryLlmCalls(query);
      res.json({ success: true, calls, count: calls.length });
    } catch (e: unknown) {
      const error = e instanceof Error ? e.message : String(e);
      logError('ObservabilityRoute', `GET /calls failed: ${error}`);
      res.status(500).json({ success: false, error });
    }
  });

  /**
   * GET /api/v1/observability/timeline
   * Hourly aggregated LLM calls for chart rendering
   */
  router.get('/timeline', (req, res) => {
    try {
      const hours = readBoundedInteger(req.query.hours, 24, 1, 168);
      const since = new Date(Date.now() - hours * 3600 * 1000).toISOString();
      const calls = queryLlmCalls({ since, limit: 5000 });

      // Aggregate by hour
      const buckets = new Map<string, { count: number; tokens: number; errors: number; avgDuration: number; durations: number[] }>();
      for (const call of calls) {
        const hour = call.timestamp.slice(0, 13); // YYYY-MM-DDTHH
        const existing = buckets.get(hour) || { count: 0, tokens: 0, errors: 0, avgDuration: 0, durations: [] };
        existing.count++;
        existing.tokens += call.total_tokens;
        if (!call.success) existing.errors++;
        existing.durations.push(call.duration_ms);
        buckets.set(hour, existing);
      }

      const timeline = Array.from(buckets.entries())
        .map(([hour, data]) => ({
          hour,
          count: data.count,
          tokens: data.tokens,
          errors: data.errors,
          avgDurationMs: Math.round(data.durations.reduce((a, b) => a + b, 0) / data.durations.length),
        }))
        .sort((a, b) => a.hour.localeCompare(b.hour));

      res.json({ success: true, timeline });
    } catch (e: unknown) {
      const error = e instanceof Error ? e.message : String(e);
      logError('ObservabilityRoute', `GET /timeline failed: ${error}`);
      res.status(500).json({ success: false, error });
    }
  });

  /**
   * GET /api/v1/observability/runtime-threshold-rollouts
   * List recorded rollout journal entries.
   */
  router.get('/runtime-threshold-rollouts', (req, res) => {
    try {
      const limit = readBoundedInteger(req.query.limit, 50, 1, 100);
      const offset = readBoundedInteger(req.query.offset, 0, 0, 100_000);
      const approvalTicket = readString(req.query.approvalTicket);
      const entries = queryRuntimeThresholdRolloutJournalSummaries({ approvalTicket, limit, offset });
      res.json({ success: true, entries, count: entries.length });
    } catch (e: unknown) {
      const error = e instanceof Error ? e.message : String(e);
      logError('ObservabilityRoute', `GET /runtime-threshold-rollouts failed: ${error}`);
      res.status(500).json({ success: false, error });
    }
  });

  /**
   * GET /api/v1/observability/phoenix-flywheel
   * Combined Phoenix Protocol + data flywheel observability snapshot.
   */
  router.get('/phoenix-flywheel', async (req, res) => {
    try {
      const rawHours = readBoundedInteger(req.query.hours, 24, 1, 168);

      const snapshot = await buildPhoenixFlywheelObservabilitySnapshot({
        windowHours: rawHours,
      });

      res.json({
        success: true,
        snapshot,
        markdown: renderPhoenixFlywheelMarkdown(snapshot),
      });
    } catch (e: unknown) {
      const error = e instanceof Error ? e.message : String(e);
      logError('ObservabilityRoute', `GET /phoenix-flywheel failed: ${error}`);
      res.status(500).json({ success: false, error });
    }
  });

  /**
   * POST /api/v1/observability/runtime-threshold-rollouts
   * Record an approved rollout journal entry.
   */
  router.post('/runtime-threshold-rollouts', (req, res) => {
    try {
      const body = isRecord(req.body) ? req.body : {};
      const approvedBy = readString(body.approvedBy);
      const approvalTicket = readString(body.approvalTicket);
      const approvedAt = readString(body.approvedAt);
      const changeWindow = readString(body.changeWindow);
      const notes = readString(body.notes);

      if (!approvedBy || !approvalTicket || !approvedAt || !changeWindow) {
        res.status(400).json({
          success: false,
          error: 'approvedBy, approvalTicket, approvedAt, and changeWindow are required',
        });
        return;
      }

      const snapshot = getRuntimeDriftSnapshot();
      const contract = readRepoRuntimeContract(process.cwd());
      const plan = buildThresholdRolloutPlan(snapshot.summary.recommendation, contract);
      const rendered = renderThresholdRolloutPlan(snapshot.summary, {
        approvedBy,
        approvalTicket,
        approvedAt,
        changeWindow,
        notes,
      });

      const entry = recordRuntimeThresholdRolloutJournal(
        { approvedBy, approvalTicket, approvedAt, changeWindow, notes },
        { summary: snapshot.summary as unknown as Record<string, unknown> },
        plan as unknown as Record<string, unknown>,
        rendered.renderedPlan,
      );

      res.status(201).json({ success: true, entry });
    } catch (e: unknown) {
      const error = e instanceof Error ? e.message : String(e);
      logError('ObservabilityRoute', `POST /runtime-threshold-rollouts failed: ${error}`);
      res.status(500).json({ success: false, error });
    }
  });

  return router;
}
