/**
 * KKV CRM routes (skeleton)
 *
 * Export a default registration function that the route loader can call with the Express app.
 */

import type { Application, Request, Response } from 'express';
import { kkvCrmService } from '../services/kkvCrmService.js';

export default function registerKkvCrmRoutes(app: Application): void {
  // Create lead endpoint (skeleton)
  app.post('/api/v1/kkv-crm/leads', async (req: Request, res: Response) => {
    try {
      const payload = (req.body as Record<string, unknown>) || {};
      const result = await kkvCrmService.createLead(payload);
      res.status(201).json(result);
    } catch (_err) {
      res.status(500).json({ success: false, error: 'kkv-crm/create-lead-failed' });
    }
  });

  // Lightweight health endpoint for this route set
  app.get('/api/v1/kkv-crm/health', (_req: Request, res: Response) => {
    res.json({ ok: true, service: 'kkv-crm', note: 'skeleton' });
  });
}
