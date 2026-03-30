import { Router } from 'express';
import { StrategyPlannerAgent } from '../../agents/StrategyPlannerAgent.js';

const agent = new StrategyPlannerAgent();

export function createPSalesStrategyRoutes(): Router {
  const router = Router();

  // POST /plan — stratégia generálás
  router.post('/plan', async (req, res) => {
    const { propertyType, location, estimatedValue } = req.body as {
      propertyType?: string;
      location?: string;
      estimatedValue?: number;
    };
    if (!propertyType) return res.status(400).json({ error: 'propertyType kötelező' });

    const result = await agent.execute('plan', { propertyType, location, estimatedValue });
    if (result.status === 'error') return res.status(400).json(result);
    return res.json(result.data);
  });

  // POST /approve — jóváhagyás / elutasítás
  router.post('/approve', async (req, res) => {
    const { planId, decision } = req.body as { planId?: string; decision?: string };
    if (!planId || !decision) return res.status(400).json({ error: 'planId és decision kötelező' });

    const result = await agent.execute('approve', { planId, decision });
    if (result.status === 'error') return res.status(400).json(result);
    return res.json(result.data);
  });

  return router;
}
