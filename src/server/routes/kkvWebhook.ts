import { Router } from 'express';
import { ensureError } from '../../utils/ensureError.js';
import { logInfo, logError } from '../../utils/logger.js';
import { normalizeCrmLead } from '../../utils/crmLead.js';
import { ingestCrmLead, createCrmFollowUpPlan } from '../../data/crm_db.js';

/**
 * Lightweight webhook receiver for KKV follow-up (used by n8n or other webhooks)
 * Mount point (recommended): /api/v1/webhooks/kkv/kkv-followup
 */
export function createKkvWebhookRoutes() {
  const router = Router();

  router.post('/kkv-followup', async (req, res) => {
    try {
      const payload = req.body ?? {};

      const normalized = normalizeCrmLead(payload);
      if (!normalized) {
        return res.status(400).json({ ok: false, error: 'Invalid lead payload' });
      }

      // Ingest (dedupe or insert)
      const ingested = ingestCrmLead(normalized);

      // Attempt to create a follow-up plan immediately
      const planResult = createCrmFollowUpPlan(ingested.lead.id);
      if (planResult) {
        logInfo('KkvWebhook', `Created follow-up plan for lead ${ingested.lead.id}`);
        return res.status(201).json({ ok: true, created: ingested.inserted, plan: planResult.plan, lead: planResult.lead, actions: planResult.actions });
      }

      logInfo('KkvWebhook', `Lead ingested but no follow-up plan created: ${ingested.lead.id}`);
      return res.status(202).json({ ok: true, created: ingested.inserted, lead: ingested.lead, message: 'Lead ingested; no follow-up plan created' });
    } catch (error: unknown) {
      const e = ensureError(error);
      logError('KkvWebhook', `KKV followup webhook failed: ${e.message}`);
      return res.status(500).json({ ok: false, error: 'Webhook processing failed' });
    }
  });

  return router;
}

export default createKkvWebhookRoutes;
