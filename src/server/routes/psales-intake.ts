import { Router } from 'express';
import { IntakeSurveyAgent } from '../../agents/IntakeSurveyAgent.js';
import { ensureError } from '../../utils/ensureError.js';
import { logError, logInfo } from '../../utils/logger.js';

const agent = new IntakeSurveyAgent();

export function createPSalesIntakeRoutes(): Router {
  const router = Router();

  // GET /checklist/:type — kötelező iratok listája
  router.get('/checklist/:type', async (req, res) => {
    try {
      const result = await agent.execute('checklist', { propertyType: req.params['type'] });
      if (result.status === 'error') return res.status(400).json(result);
      logInfo('PSalesIntakeRoute', `GET /checklist/${req.params['type']} OK`);
      return res.json(result.data);
    } catch (error: unknown) {
      const normalized = ensureError(error);
      logError('PSalesIntakeRoute', `GET /checklist failed: ${normalized.message}`);
      return res.status(500).json({ ok: false, error: 'Checklist lekérés sikertelen' });
    }
  });

  // POST /survey — felmérés futtatása
  router.post('/survey', async (req, res) => {
    try {
      const { propertyType, uploadedDocs } = req.body as {
        propertyType?: string;
        uploadedDocs?: string[];
      };
      if (!propertyType) return res.status(400).json({ error: 'propertyType kötelező' });
      const result = await agent.execute('survey', { propertyType, uploadedDocs: uploadedDocs ?? [] });
      if (result.status === 'error') return res.status(400).json(result);
      logInfo('PSalesIntakeRoute', `POST /survey OK: ${propertyType}`);
      return res.json(result.data);
    } catch (error: unknown) {
      const normalized = ensureError(error);
      logError('PSalesIntakeRoute', `POST /survey failed: ${normalized.message}`);
      return res.status(500).json({ ok: false, error: 'Survey feldolgozás sikertelen' });
    }
  });

  return router;
}
