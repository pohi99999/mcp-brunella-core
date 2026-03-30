import { Router } from 'express';
import { PropertyResearchAgent } from '../../agents/PropertyResearchAgent.js';

const agent = new PropertyResearchAgent();

export function createPSalesResearchRoutes(): Router {
  const router = Router();

  // POST /analyze — piacelemzés és értéktartomány
  router.post('/analyze', async (req, res) => {
    const { location, propertyType, areaSqm, askingPrice } = req.body as {
      location?: string;
      propertyType?: string;
      areaSqm?: number;
      askingPrice?: number;
    };

    if (!propertyType) return res.status(400).json({ error: 'propertyType kötelező' });

    const result = await agent.execute('analyze', { location, propertyType, areaSqm, askingPrice });
    if (result.status === 'error') return res.status(400).json(result);
    return res.json(result.data);
  });

  return router;
}
