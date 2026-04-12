/**
 * Reflection Routes — /api/v1/reflection
 *
 * Exposes the ReflectionEngine for dashboard/CLI insight surfaces,
 * pain point detection, and manual nightly cycle trigger.
 *
 * Track: brunella_reflection_continual_learning_20260402
 */

import { Router, type Request, type Response } from 'express';
import { ReflectionEngine, type TaskOutcome } from '../../core/reflectionEngine.js';
import { logInfo } from '../../utils/logger.js';

const MODULE = 'reflectionRoutes';

function createReflectionRouter(): Router {
  const router = Router();
  const engine = ReflectionEngine.getInstance();

  // GET /api/v1/reflection/stats
  // Returns aggregate reflection statistics and SelfModel health.
  router.get('/stats', (_req: any, res: any) => {
    const stats = engine.getStats();
    const selfModel = engine.getSelfModelState();
    res.json({ ok: true, stats, selfModel });
  });

  // GET /api/v1/reflection/pain-points
  // Returns recurring failure patterns sorted by severity.
  router.get('/pain-points', (_req: any, res: any) => {
    const painPoints = engine.detectPainPoints();
    res.json({ ok: true, count: painPoints.length, painPoints });
  });

  // GET /api/v1/reflection/context
  // Returns the reflection context string used in orchestrator system prompts.
  router.get('/context', (_req: any, res: any) => {
    const context = engine.getReflectionContext();
    res.json({ ok: true, context });
  });

  // GET /api/v1/reflection/insights
  // Returns MetaReasoner insights, optionally filtered by category.
  router.get('/insights', (req: any, res: any) => {
    const category = req.query['category'] as 'pattern' | 'anomaly' | 'recommendation' | 'warning' | undefined;
    const insights = engine.getMetaInsights(category);
    res.json({ ok: true, count: insights.length, insights });
  });

  // POST /api/v1/reflection/reflect
  // Manually submit a task outcome for reflection.
  router.post('/reflect', async (req: any, res: any) => {
    const outcome = req.body as TaskOutcome;
    if (!outcome?.agent || !outcome?.task || !outcome?.result) {
      res.status(400).json({ ok: false, error: 'Missing required fields: agent, task, result' });
      return;
    }
    const result = await engine.reflect(outcome);
    logInfo(MODULE, `Manual reflect: agent=${outcome.agent}, quality=${(result.qualityScore * 100).toFixed(0)}%`);
    res.json({ ok: true, result });
  });

  // POST /api/v1/reflection/nightly-cycle
  // Manually triggers the nightly learning cycle (also runs automatically via ScheduledTasksRunner).
  router.post('/nightly-cycle', async (_req: any, res: any) => {
    logInfo(MODULE, 'Manual nightly cycle triggered via API');
    const result = await engine.runNightlyCycle();
    res.json({ ok: true, result });
  });

  return router;
}

export { createReflectionRouter };
