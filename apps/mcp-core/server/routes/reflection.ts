/**
 * Reflection Routes — /api/v1/reflection
 *
 * Exposes the ReflectionEngine for dashboard/CLI insight surfaces,
 * pain point detection, and manual nightly cycle trigger.
 *
 * Track: brunella_reflection_continual_learning_20260402
 */

import { Router, type Request, type Response } from 'express';
import { ReflectionEngine, type TaskOutcome } from '@packages/core-logic/reflectionEngine.js';
import type { ReflectionOverview } from '@packages/core-logic/reflectionOverview.js';
import { logInfo } from '@packages/utils/logger.js';

const MODULE = 'reflectionRoutes';
const OUTCOMES = new Set<TaskOutcome['result']>(['success', 'failure', 'partial']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function readTaskId(value: unknown): string | number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  return readString(value);
}

function readDuration(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.round(value) : 0;
}

function buildMemoryScopes(): ReflectionOverview['selfModel']['memoryScopes'] {
  return {
    global: {
      purpose: 'Hosszú távú tanulságok, stratégiai minták és kereszt-projekt összefüggések.',
      sources: ['GraphRagEngine', 'ReflectionEngine', 'MetaReasoner'],
    },
    local: {
      purpose: 'Aktív munkamenet, structured memory és task-szintű újrahasznosítás.',
      sources: ['StructuredMemory', 'PatternReuse', 'BaseAgent'],
    },
  };
}

function createReflectionRouter(): Router {
  const router = Router();
  const engine = ReflectionEngine.getInstance();

  // GET /api/v1/reflection/overview
  // Returns a dashboard/CLI friendly summary of the reflective subsystem.
  router.get('/overview', (_req: Request, res: Response) => {
    const stats = engine.getStats();
    const selfModel = engine.getSelfModelState();
    const overview: ReflectionOverview = {
      stats,
      selfModel: {
        ...selfModel,
        memoryScopes: buildMemoryScopes(),
      },
      painPoints: engine.detectPainPoints(),
      insights: engine.getMetaInsights(),
      context: engine.getReflectionContext(),
    };

    res.json({ ok: true, overview });
  });

  // GET /api/v1/reflection/stats
  // Returns aggregate reflection statistics and SelfModel health.
  router.get('/stats', (_req: Request, res: Response) => {
    const stats = engine.getStats();
    const selfModel = engine.getSelfModelState();
    res.json({ ok: true, stats, selfModel });
  });

  // GET /api/v1/reflection/pain-points
  // Returns recurring failure patterns sorted by severity.
  router.get('/pain-points', (_req: Request, res: Response) => {
    const painPoints = engine.detectPainPoints();
    res.json({ ok: true, count: painPoints.length, painPoints });
  });

  // GET /api/v1/reflection/context
  // Returns the reflection context string used in orchestrator system prompts.
  router.get('/context', (_req: Request, res: Response) => {
    const context = engine.getReflectionContext();
    res.json({ ok: true, context });
  });

  // GET /api/v1/reflection/insights
  // Returns MetaReasoner insights, optionally filtered by category.
  router.get('/insights', (req: Request, res: Response) => {
    const category = req.query['category'] as 'pattern' | 'anomaly' | 'recommendation' | 'warning' | undefined;
    const insights = engine.getMetaInsights(category);
    res.json({ ok: true, count: insights.length, insights });
  });

  // POST /api/v1/reflection/reflect
  // Manually submit a task outcome for reflection.
  router.post('/reflect', async (req: Request, res: Response) => {
    const body = isRecord(req.body) ? req.body : {};
    const taskId = readTaskId(body.taskId) ?? `manual-${Date.now()}`;
    const agent = readString(body.agent);
    const task = readString(body.task);
    const resultText = readString(body.result);
    const output = readString(body.output) ?? '';

    if (!agent || !task || !resultText || !OUTCOMES.has(resultText as TaskOutcome['result'])) {
      res.status(400).json({ ok: false, error: 'Missing required fields: agent, task, result' });
      return;
    }

    const outcome: TaskOutcome = {
      taskId,
      agent,
      task,
      result: resultText as TaskOutcome['result'],
      output,
      durationMs: readDuration(body.durationMs),
      errorMessage: readString(body.errorMessage) ?? undefined,
      metadata: isRecord(body.metadata) ? body.metadata : undefined,
    };

    const result = await engine.reflect(outcome);
    logInfo(MODULE, `Manual reflect: agent=${outcome.agent}, quality=${(result.qualityScore * 100).toFixed(0)}%`);
    res.json({ ok: true, result });
  });

  // POST /api/v1/reflection/nightly-cycle
  // Manually triggers the nightly learning cycle (also runs automatically via ScheduledTasksRunner).
  router.post('/nightly-cycle', async (_req: Request, res: Response) => {
    logInfo(MODULE, 'Manual nightly cycle triggered via API');
    const result = await engine.runNightlyCycle();
    res.json({ ok: true, result });
  });

  return router;
}

export { createReflectionRouter };
