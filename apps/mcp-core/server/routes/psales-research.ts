import { Router } from 'express';
import { PropertyResearchAgent } from '@packages/agents/PropertyResearchAgent.js';
import { ensureError } from '@packages/utils/ensureError.js';
import { logError, logInfo } from '@packages/utils/logger.js';

const agent = new PropertyResearchAgent();

export function createPSalesResearchRoutes(): Router {
  const router = Router();

  // POST /analyze — piacelemzés és értéktartomány
  router.post('/analyze', async (req, res) => {
    try {
      const { location, propertyType, areaSqm, askingPrice } = req.body as {
        location?: string;
        propertyType?: string;
        areaSqm?: number;
        askingPrice?: number;
      };
      if (!propertyType) return res.status(400).json({ error: 'propertyType kötelező' });
      const result = await agent.execute('analyze', { location, propertyType, areaSqm, askingPrice });
      if (result.status === 'error') return res.status(400).json(result);
      logInfo('PSalesResearchRoute', `POST /analyze OK: ${propertyType} @ ${location ?? 'n/a'}`);
      return res.json(result.data);
    } catch (error: unknown) {
      const normalized = ensureError(error);
      logError('PSalesResearchRoute', `POST /analyze failed: ${normalized.message}`);
      return res.status(500).json({ ok: false, error: 'Piacelemzés sikertelen' });
    }
  });

  return router;
}
