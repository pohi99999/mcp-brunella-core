// @ts-nocheck
/**
 * KKV CRM routes (skeleton)
 *
 * Export a default registration function that the route loader can call with the Express app.
 */

import { kkvCrmService } from '../services/kkvCrmService.js';

export default function registerKkvCrmRoutes(app) {
  // Create lead endpoint (skeleton)
  app.post('/api/v1/kkv-crm/leads', async (req, res) => {
    try {
      const payload = req.body || {};
      const result = await kkvCrmService.createLead(payload);
      res.status(201).json(result);
    } catch (err) {
      res.status(500).json({ success: false, error: 'kkv-crm/create-lead-failed' });
    }
  });

  // Lightweight health endpoint for this route set
  app.get('/api/v1/kkv-crm/health', (_req, res) => {
    res.json({ ok: true, service: 'kkv-crm', note: 'skeleton' });
  });
}
