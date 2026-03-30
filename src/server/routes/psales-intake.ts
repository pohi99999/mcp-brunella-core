import { Router } from 'express';
import { IntakeSurveyAgent } from '../../agents/IntakeSurveyAgent.js';
import { logError } from '../../utils/logger.js';

const agent = new IntakeSurveyAgent();

export function createPSalesIntakeRoutes(): Router {
  const router = Router();

  // GET /checklist/:type — kötelező iratok listája
  router.get('/checklist/:type', async (req, res) => {
    const result = await agent.execute('checklist', { propertyType: req.params['type'] });
    if (result.status === 'error') return res.status(400).json(result);
    return res.json(result.data);
  });

  // POST /survey — felmérés futtatása
  router.post('/survey', async (req, res) => {
    const { propertyType, uploadedDocs } = req.body as { propertyType?: string; uploadedDocs?: string[] };
    if (!propertyType) return res.status(400).json({ error: 'propertyType kötelező' });

    const result = await agent.execute('survey', { propertyType, uploadedDocs: uploadedDocs ?? [] });
    if (result.status === 'error') return res.status(400).json(result);
    return res.json(result.data);
  });

  return router;
}
