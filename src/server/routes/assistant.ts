import { Router } from 'express';
import { getAssistantBlueprint } from '../../core/assistantBlueprint.js';
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

  return router;
}
