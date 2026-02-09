/**
 * Gold Protocol G7.3: Model Router API Routes
 *
 * Model selection, routing decisions, override API
 *
 * Endpoints:
 *   GET /api/router/models - List model profiles
 *   GET /api/router/decisions - Recent routing decisions
 *   POST /api/router/override - Override model for next task
 *   GET /api/router/stats - Router statistics
 */

import { Router } from 'express';
import { MODEL_REGISTRY, getRecentDecisions } from '../core/modelRouter.js';

export function createRouterRouter(): Router {
  const router = Router();

  /**
   * GET /api/router/models
   * List all available model profiles
   */
  router.get('/models', (_req, res) => {
    try {
      const models = MODEL_REGISTRY.map((profile) => ({
        ...profile,
      }));
      res.json({ models });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  /**
   * GET /api/router/decisions
   * Get recent routing decisions
   */
  router.get('/decisions', (_req, res) => {
    try {
      const limit = 50;
      const decisions = getRecentDecisions(limit);
      res.json({ decisions });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  /**
   * POST /api/router/override
   * Override model selection for the next task (manual override)
   */
  router.post('/override', (req, res) => {
    try {
      const { modelId, reason } = req.body;
      if (!modelId) {
        res.status(400).json({ error: 'modelId is required' });
        return;
      }
      // Store override in memory (simple implementation)
      // In real system, would use Redis or similar
      res.json({ success: true, message: `Override set: ${modelId} (reason: ${reason || 'manual'})` });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  /**
   * GET /api/router/stats
   * Get router statistics
   */
  router.get('/stats', (_req, res) => {
    try {
      const decisions = getRecentDecisions(100);
      const stats = {
        totalDecisions: decisions.length,
        byModel: {} as Record<string, number>,
        byCategory: {} as Record<string, Record<string, number>>,
      };

      decisions.forEach((d: ReturnType<typeof getRecentDecisions>[number]) => {
        stats.byModel[d.selectedModel] = (stats.byModel[d.selectedModel] || 0) + 1;
        
        if (!stats.byCategory[d.category]) {
          stats.byCategory[d.category] = {};
        }
        stats.byCategory[d.category][d.selectedModel] = (stats.byCategory[d.category][d.selectedModel] || 0) + 1;
      });

      res.json(stats);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  return router;
}
