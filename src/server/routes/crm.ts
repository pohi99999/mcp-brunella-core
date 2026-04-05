import { Router } from 'express';
import { ensureError } from '../../utils/ensureError.js';
import { logError, logInfo, logWarn } from '../../utils/logger.js';
import { ingestCrmLead, getCrmLeadStats, getCrmFollowUpStats, listCrmLeads } from '../../data/crm_db.js';
import { normalizeCrmLead } from '../../utils/crmLead.js';
import { createCrmFollowUpRoutes } from './crmFollowUp.js';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parsePositiveLimit(value: unknown, fallback = 25): number {
  const parsed = typeof value === 'string' ? Number.parseInt(value, 10) : Number(value);
  if (!Number.isFinite(parsed) || Number.isNaN(parsed) || parsed <= 0) {
    return fallback;
  }
  return Math.min(Math.trunc(parsed), 200);
}

function parseOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function extractWorkflowId(body: unknown, headerValue: string | undefined): string | undefined {
  const fromHeader = parseOptionalString(headerValue);
  if (fromHeader) return fromHeader;

  if (!isRecord(body)) return undefined;

  const metadata = body.metadata;
  if (!isRecord(metadata)) return undefined;

  return parseOptionalString(metadata.workflowId);
}

export function createCrmRoutes(): Router {
  const router = Router();
  router.use('/follow-up', createCrmFollowUpRoutes());

  router.post('/intake', async (req, res) => {
    try {
      const normalized = normalizeCrmLead(req.body);
      if (!normalized) {
        return res.status(400).json({
          ok: false,
          error: 'Invalid CRM lead payload',
        });
      }

      const workflowId = extractWorkflowId(req.body, req.header('x-workflow-id'));

      const result = ingestCrmLead(normalized, { workflowId });

      logInfo('CRMRoute', `${result.eventType} lead ${normalized.id} from ${normalized.source}`);

      return res.status(result.inserted ? 201 : 200).json({
        ok: true,
        accepted: true,
        inserted: result.inserted,
        eventType: result.eventType,
        lead: result.lead,
      });
    } catch (error: unknown) {
      const normalized = ensureError(error);
      logError('CRMRoute', `POST /intake failed: ${normalized.message}`);
      return res.status(500).json({
        ok: false,
        error: 'CRM intake failed',
      });
    }
  });

  router.get('/leads', async (req, res) => {
    try {
      const limit = parsePositiveLimit(req.query.limit, 25);
      const status = parseOptionalString(req.query.status);
      const leads = listCrmLeads(undefined, limit).filter((lead) => {
        if (!status) return true;
        return lead.status === status;
      });

      return res.json({
        ok: true,
        count: leads.length,
        leads,
      });
    } catch (error: unknown) {
      const normalized = ensureError(error);
      logError('CRMRoute', `GET /leads failed: ${normalized.message}`);
      return res.status(500).json({
        ok: false,
        error: 'Failed to list CRM leads',
      });
    }
  });

  router.get('/health', async (_req, res) => {
    try {
      const stats = getCrmLeadStats();
      return res.json({
        ok: true,
        status: 'healthy',
        stats,
        followUpTrack: 'kkv_crm_followup_approval_reporting_20260405',
      });
    } catch (error: unknown) {
      const normalized = ensureError(error);
      logWarn('CRMRoute', `GET /health failed: ${normalized.message}`);
      return res.status(500).json({
        ok: false,
        error: 'CRM health check failed',
      });
    }
  });

  router.get('/summary', async (_req, res) => {
    try {
      return res.json({
        ok: true,
        status: 'healthy',
        leads: getCrmLeadStats(),
        followUp: getCrmFollowUpStats(),
      });
    } catch (error: unknown) {
      const normalized = ensureError(error);
      logWarn('CRMRoute', `GET /summary failed: ${normalized.message}`);
      return res.status(500).json({
        ok: false,
        error: 'CRM summary failed',
      });
    }
  });

  return router;
}

export default createCrmRoutes;
