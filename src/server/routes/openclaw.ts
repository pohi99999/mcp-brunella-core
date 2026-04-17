import { Router, Request, Response } from 'express';
import { logError, logInfo } from '../../utils/logger.js';
import { createOpenClawRuntime, OpenClawTaskRequestSchema } from '../../integrations/openclaw/index.js';
import { ensureError } from '../../utils/ensureError.js';

export function createOpenClawRoutes(): Router {
  const router = Router();

  router.get('/status', async (_req: Request, res: Response) => {
    try {
      const runtime = createOpenClawRuntime();
      const [health, snapshot] = await Promise.all([
        runtime.gateway.healthCheck(),
        Promise.resolve(runtime.snapshot()),
      ]);

      logInfo('Reported OpenClaw status snapshot', { route: 'OpenClawRoute' });
      res.json({
        success: true,
        data: {
          snapshot,
          health,
        },
      });
    } catch (error: unknown) {
      const normalized = ensureError(error);
      logError('Failed to build OpenClaw status snapshot', { route: 'OpenClawRoute', error: normalized.message });
      res.status(500).json({
        success: false,
        error: normalized.message,
      });
    }
  });

  router.post('/preview', async (req: Request, res: Response) => {
    try {
      const request = OpenClawTaskRequestSchema.parse(req.body as unknown);
      const runtime = createOpenClawRuntime();
      const result = await runtime.dispatcher.preview(request);
      logInfo(`Previewed OpenClaw execution ${request.execution.id}`, { route: 'OpenClawRoute' });
      res.json({
        success: true,
        data: result,
      });
    } catch (error: unknown) {
      const normalized = ensureError(error);
      logError('Failed to preview OpenClaw execution', { route: 'OpenClawRoute', error: normalized.message });
      res.status(400).json({
        success: false,
        error: normalized.message,
      });
    }
  });

  router.post('/dispatch', async (req: Request, res: Response) => {
    try {
      const request = OpenClawTaskRequestSchema.parse(req.body as unknown);
      const runtime = createOpenClawRuntime();
      const result = await runtime.dispatcher.dispatch(request);
      logInfo(`Dispatched OpenClaw execution ${request.execution.id}`, { route: 'OpenClawRoute' });
      res.json({
        success: true,
        data: result,
      });
    } catch (error: unknown) {
      const normalized = ensureError(error);
      logError('Failed to dispatch OpenClaw execution', { route: 'OpenClawRoute', error: normalized.message });
      res.status(400).json({
        success: false,
        error: normalized.message,
      });
    }
  });

  return router;
}
