import { Router } from 'express';
import { z } from 'zod';

import type { MonteCarloConfig } from '@packages/core-logic/decisionTypes.js';
import { predictiveDecisionEngine } from '@packages/core-logic/predictiveDecisionEngine.js';

const triggerSchema = z.object({
  triggeredBy: z.string().trim().min(1).optional(),
  config: z.object({
    scenarioCount: z.number().int().min(6).max(120).optional(),
    riskWeight: z.number().min(0).max(1).optional(),
    impactWeight: z.number().min(0).max(1).optional(),
    alignmentWeight: z.number().min(0).max(1).optional(),
    selectionThreshold: z.number().min(0).max(1).optional(),
    seed: z.number().int().optional(),
  }).optional(),
});

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function createPredictiveDecisionRouter(): Router {
  const router = Router();

  router.get('/history', async (req, res) => {
    try {
      const limit = req.query.limit ? Number(req.query.limit) : 25;
      const history = predictiveDecisionEngine.getDecisionHistory(limit);
      res.json({ success: true, data: history, count: history.length });
    } catch (error) {
      res.status(500).json({ success: false, error: getErrorMessage(error) });
    }
  });

  router.get('/stats', async (req, res) => {
    try {
      const daysBack = req.query.daysBack ? Number(req.query.daysBack) : 30;
      const stats = predictiveDecisionEngine.getDecisionStats(daysBack);
      res.json({ success: true, data: stats });
    } catch (error) {
      res.status(500).json({ success: false, error: getErrorMessage(error) });
    }
  });

  router.post('/trigger', async (req, res) => {
    try {
      const payload = triggerSchema.parse(req.body);
      const result = await predictiveDecisionEngine.analyzeDecisionPoint(
        payload.triggeredBy ?? 'manual_api',
        (payload.config ?? {}) satisfies Partial<MonteCarloConfig>,
      );
      res.json({ success: true, data: result });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ success: false, error: error.issues.map((issue) => issue.message).join('; ') });
        return;
      }
      res.status(500).json({ success: false, error: getErrorMessage(error) });
    }
  });

  router.get('/:decisionId', async (req, res) => {
    try {
      const result = predictiveDecisionEngine.getDecisionResult(req.params.decisionId);
      res.json({ success: true, data: result });
    } catch (error) {
      const message = getErrorMessage(error);
      res.status(message.includes('not found') ? 404 : 500).json({ success: false, error: message });
    }
  });

  router.post('/:decisionId/rollback', async (req, res) => {
    try {
      const result = await predictiveDecisionEngine.rollbackDecision(req.params.decisionId);
      res.json({ success: true, data: result });
    } catch (error) {
      const message = getErrorMessage(error);
      const status = message.includes('not found')
        ? 404
        : message.includes('cannot be rolled back') || message.includes('already rolled back')
          ? 400
          : 500;
      res.status(status).json({ success: false, error: message });
    }
  });

  return router;
}

export const router = createPredictiveDecisionRouter();
