import { Router } from 'express';
import { getAssistantBlueprint } from '../../core/assistantBlueprint.js';
import { buildContextFusionCard } from '../../core/contextFusion.js';
import { logError } from '../../utils/logger.js';

export function createAssistantRoutes(): Router {
  const router = Router();

  router.get('/blueprint', async (_req, res) => {
    try {
      const blueprint = await getAssistantBlueprint();
      res.json(blueprint);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      logError('AssistantRoute', `Blueprint generation failed: ${message}`);
      res.status(500).json({
        success: false,
        error: message,
      });
    }
  });

  router.get('/context-fusion', async (_req, res) => {
    try {
      const card = await buildContextFusionCard();
      res.json(card);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      logError('AssistantRoute', `Context fusion generation failed: ${message}`);
      res.status(500).json({
        success: false,
        error: message,
      });
    }
  });

  return router;
}
