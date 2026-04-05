import { Router } from 'express';
import { ensureError } from '../../utils/ensureError.js';
import { logError, logInfo, logWarn } from '../../utils/logger.js';
import {
  approveCrmFollowUpPlan,
  cancelCrmFollowUpPlan,
  dispatchCrmFollowUpAction,
  createCrmFollowUpPlan,
  getCrmFollowUpStats,
  getCrmFollowUpSummary,
  listCrmFollowUpActions,
  listCrmFollowUpAuditTrail,
  listCrmFollowUpPlans,
  pauseCrmFollowUpPlan,
  recordCrmLeadResponse,
  recordCrmLeadScore,
  resumeCrmFollowUpPlan,
} from '../../data/crm_db.js';
import { executeDueCrmFollowUpActions } from '../services/crmFollowUpExecutionService.js';
import { normalizeCrmLead, normalizeCrmLeadResponse } from '../../utils/crmLead.js';
import { scoreCrmFollowUpLead } from '../../utils/crmFollowUp.js';

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

function parseOptionalBoolean(value: unknown): boolean | undefined {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'yes', 'approved', 'approve'].includes(normalized)) {
      return true;
    }

    if (['false', '0', 'no', 'rejected', 'reject'].includes(normalized)) {
      return false;
    }
  }

  return undefined;
}

function resolveLeadId(body: unknown, queryLeadId?: string): string | undefined {
  const fromQuery = parseOptionalString(queryLeadId);
  if (fromQuery) return fromQuery;

  if (!isRecord(body)) return undefined;
  return parseOptionalString(body.leadId) ?? parseOptionalString(body.id);
}

function resolveLeadPayload(body: unknown): Record<string, unknown> | null {
  if (!isRecord(body)) return null;
  if (isRecord(body.lead)) return body.lead;
  if (isRecord(body.payload)) return body.payload;
  return body;
}

function resolveManualActor(body: unknown, headerValue?: string): string | undefined {
  const fromHeader = parseOptionalString(headerValue);
  if (fromHeader) {
    return fromHeader;
  }

  if (!isRecord(body)) {
    return undefined;
  }

  return parseOptionalString(body.actor) ?? parseOptionalString(body.user) ?? parseOptionalString(body.reviewer);
}

export function createCrmFollowUpRoutes(): Router {
  const router = Router();

  router.post('/score', async (req, res) => {
    try {
      const leadId = resolveLeadId(req.body, req.query.leadId as string | undefined);
      if (leadId) {
        const result = recordCrmLeadScore(leadId, {
          workflowId: parseOptionalString(isRecord(req.body) ? req.body.workflowId : undefined),
        });
        if (!result) {
          return res.status(404).json({
            ok: false,
            error: 'Lead not found',
          });
        }

        return res.json({
          ok: true,
          decision: result.decision,
          lead: result.lead,
          recorded: true,
        });
      }

      const payload = resolveLeadPayload(req.body);
      const normalized = normalizeCrmLead(payload);
      if (!normalized) {
        return res.status(400).json({
          ok: false,
          error: 'Missing leadId or lead payload',
        });
      }

      const decision = scoreCrmFollowUpLead({
        id: normalized.id,
        source: normalized.source,
        email: normalized.email,
        phone: normalized.phone,
        company: normalized.company,
        status: 'new',
        receivedAt: normalized.receivedAt,
        createdAt: normalized.createdAt,
        payload: normalized.raw,
      });

      return res.json({
        ok: true,
        decision,
        lead: normalized,
      });
    } catch (error: unknown) {
      const normalized = ensureError(error);
      logError('CRMFollowUpRoute', `POST /score failed: ${normalized.message}`);
      return res.status(500).json({
        ok: false,
        error: 'Failed to score CRM lead',
      });
    }
  });

  router.post('/plan', async (req, res) => {
    try {
      const leadId = resolveLeadId(req.body, req.query.leadId as string | undefined);
      if (!leadId) {
        return res.status(400).json({
          ok: false,
          error: 'Missing leadId',
        });
      }

      const result = createCrmFollowUpPlan(leadId);
      if (!result) {
        return res.status(404).json({
          ok: false,
          error: 'Lead not found or follow-up not applicable',
        });
      }

      logInfo('CRMFollowUpRoute', `Created follow-up plan for lead ${leadId}`);
      return res.status(201).json({
        ok: true,
        plan: result.plan,
        lead: result.lead,
        decision: result.decision,
        actions: result.actions,
      });
    } catch (error: unknown) {
      const normalized = ensureError(error);
      logError('CRMFollowUpRoute', `POST /plan failed: ${normalized.message}`);
      return res.status(500).json({
        ok: false,
        error: 'Failed to create follow-up plan',
      });
    }
  });

  router.post('/approval', async (req, res) => {
    try {
      const leadId = resolveLeadId(req.body, req.query.leadId as string | undefined);
      if (!leadId) {
        return res.status(400).json({
          ok: false,
          error: 'Missing leadId',
        });
      }

      const payload = isRecord(req.body) ? req.body : {};
      const approvedValue = parseOptionalBoolean(payload.approved);
      const decisionText = parseOptionalString(payload.decision ?? payload.action);
      const approved =
        approvedValue ??
        (decisionText
          ? ['approve', 'approved', 'accept', 'accepted', 'yes', 'true'].includes(decisionText.toLowerCase())
            ? true
            : ['reject', 'rejected', 'deny', 'denied', 'no', 'false'].includes(decisionText.toLowerCase())
              ? false
              : undefined
          : undefined);

      if (approved === undefined) {
        return res.status(400).json({
          ok: false,
          error: 'Missing approval decision',
        });
      }

      const reason = parseOptionalString(payload.reason) ?? 'approval callback';
      const actor = resolveManualActor(payload, req.header('x-actor') ?? undefined);
      const note = parseOptionalString(payload.note);

      if (!approved) {
        const result = cancelCrmFollowUpPlan(leadId, reason);
        if (!result) {
          return res.status(404).json({
            ok: false,
            error: 'Lead not found',
          });
        }

        logWarn('CRMFollowUpRoute', `Rejected follow-up approval for lead ${leadId}: ${reason}`);
        return res.json({
          ok: true,
          approved: false,
          lead: result.lead,
          plan: result.plan,
          cancelledActions: result.cancelledActions,
        });
      }

      const result = approveCrmFollowUpPlan(leadId, { reason, actor, note });
      if (!result) {
        return res.status(404).json({
          ok: false,
          error: 'Lead not found',
        });
      }

      logInfo('CRMFollowUpRoute', `Approved follow-up plan for lead ${leadId}: ${reason}`);
      return res.json({
        ok: true,
        approved: true,
        lead: result.lead,
        plan: result.plan,
        actions: result.actions,
      });
    } catch (error: unknown) {
      const normalized = ensureError(error);
      logError('CRMFollowUpRoute', `POST /approval failed: ${normalized.message}`);
      return res.status(500).json({
        ok: false,
        error: 'Failed to process CRM approval',
      });
    }
  });

  router.post('/pause', async (req, res) => {
    try {
      const leadId = resolveLeadId(req.body, req.query.leadId as string | undefined);
      if (!leadId) {
        return res.status(400).json({
          ok: false,
          error: 'Missing leadId',
        });
      }

      const payload = isRecord(req.body) ? req.body : {};
      const reason = parseOptionalString(payload.reason) ?? 'paused';
      const actor = resolveManualActor(payload, req.header('x-actor') ?? undefined);
      const note = parseOptionalString(payload.note);
      const result = pauseCrmFollowUpPlan(leadId, { reason, actor, note });

      if (!result) {
        return res.status(404).json({
          ok: false,
          error: 'Lead not found',
        });
      }

      logWarn('CRMFollowUpRoute', `Paused follow-up plan for lead ${leadId}: ${reason}`);
      return res.json({
        ok: true,
        paused: true,
        lead: result.lead,
        plan: result.plan,
        actions: result.actions,
      });
    } catch (error: unknown) {
      const normalized = ensureError(error);
      logError('CRMFollowUpRoute', `POST /pause failed: ${normalized.message}`);
      return res.status(500).json({
        ok: false,
        error: 'Failed to pause CRM follow-up plan',
      });
    }
  });

  router.post('/resume', async (req, res) => {
    try {
      const leadId = resolveLeadId(req.body, req.query.leadId as string | undefined);
      if (!leadId) {
        return res.status(400).json({
          ok: false,
          error: 'Missing leadId',
        });
      }

      const payload = isRecord(req.body) ? req.body : {};
      const reason = parseOptionalString(payload.reason) ?? 'resumed';
      const actor = resolveManualActor(payload, req.header('x-actor') ?? undefined);
      const note = parseOptionalString(payload.note);
      const result = resumeCrmFollowUpPlan(leadId, { reason, actor, note });

      if (!result) {
        return res.status(404).json({
          ok: false,
          error: 'Lead not found',
        });
      }

      logInfo('CRMFollowUpRoute', `Resumed follow-up plan for lead ${leadId}: ${reason}`);
      return res.json({
        ok: true,
        resumed: true,
        lead: result.lead,
        plan: result.plan,
        actions: result.actions,
      });
    } catch (error: unknown) {
      const normalized = ensureError(error);
      logError('CRMFollowUpRoute', `POST /resume failed: ${normalized.message}`);
      return res.status(500).json({
        ok: false,
        error: 'Failed to resume CRM follow-up plan',
      });
    }
  });

  router.post('/response', async (req, res) => {
    try {
      const normalized = normalizeCrmLeadResponse(
        {
          ...(isRecord(req.body) ? req.body : {}),
          leadId: req.query.leadId ?? (isRecord(req.body) ? req.body.leadId : undefined),
        },
      );

      if (!normalized) {
        return res.status(400).json({
          ok: false,
          error: 'Missing leadId',
        });
      }

      const result = recordCrmLeadResponse(normalized.leadId, {
        response: normalized.response,
        reason: normalized.reason,
      });

      if (!result) {
        return res.status(404).json({
          ok: false,
          error: 'Lead not found',
        });
      }

      logWarn('CRMFollowUpRoute', `Cancelled follow-up for lead ${normalized.leadId}: ${normalized.reason}`);
      return res.json({
        ok: true,
        lead: result.lead,
        plan: result.plan,
        cancelledActions: result.cancelledActions,
      });
    } catch (error: unknown) {
      const normalized = ensureError(error);
      logError('CRMFollowUpRoute', `POST /response failed: ${normalized.message}`);
      return res.status(500).json({
        ok: false,
        error: 'Failed to record CRM response',
      });
    }
  });

  router.post('/dispatch', async (req, res) => {
    try {
      const actionId = parseOptionalString(isRecord(req.body) ? req.body.actionId : undefined);
      const leadId = resolveLeadId(req.body, req.query.leadId as string | undefined);
      const result = await dispatchCrmFollowUpAction({
        actionId,
        leadId,
        note: parseOptionalString(isRecord(req.body) ? req.body.note : undefined),
      });

      if (!result) {
        return res.status(404).json({
          ok: false,
          error: 'No dispatchable CRM follow-up action found',
        });
      }

      logInfo('CRMFollowUpRoute', `Dispatched follow-up action ${result.action.id} for lead ${result.lead.id}`);
      return res.json({
        ok: true,
        completed: result.completed,
        plan: result.plan,
        lead: result.lead,
        action: result.action,
        remainingActions: result.remainingActions,
      });
    } catch (error: unknown) {
      const normalized = ensureError(error);
      logError('CRMFollowUpRoute', `POST /dispatch failed: ${normalized.message}`);
      return res.status(500).json({
        ok: false,
        error: 'Failed to dispatch CRM follow-up action',
      });
    }
  });

  router.post('/dispatch-due', async (req, res) => {
    try {
      const result = await executeDueCrmFollowUpActions({
        limit: parsePositiveLimit(isRecord(req.body) ? req.body.limit : req.query.limit, 50),
        note: parseOptionalString(isRecord(req.body) ? req.body.note : undefined),
      });

      return res.json({
        ok: true,
        generatedAt: result.generatedAt,
        scanned: result.scanned,
        dispatched: result.dispatched,
      });
    } catch (error: unknown) {
      const normalized = ensureError(error);
      logError('CRMFollowUpRoute', `POST /dispatch-due failed: ${normalized.message}`);
      return res.status(500).json({
        ok: false,
        error: 'Failed to dispatch due CRM follow-up actions',
      });
    }
  });

  router.post('/cancel', async (req, res) => {
    try {
      const leadId = resolveLeadId(req.body, req.query.leadId as string | undefined);
      if (!leadId) {
        return res.status(400).json({
          ok: false,
          error: 'Missing leadId',
        });
      }

      const reason = parseOptionalString(isRecord(req.body) ? req.body.reason : undefined) ?? 'manual cancel';
      const result = cancelCrmFollowUpPlan(leadId, reason);
      if (!result) {
        return res.status(404).json({
          ok: false,
          error: 'Lead not found',
        });
      }

      return res.json({
        ok: true,
        lead: result.lead,
        plan: result.plan,
        cancelledActions: result.cancelledActions,
      });
    } catch (error: unknown) {
      const normalized = ensureError(error);
      logError('CRMFollowUpRoute', `POST /cancel failed: ${normalized.message}`);
      return res.status(500).json({
        ok: false,
        error: 'Failed to cancel CRM follow-up plan',
      });
    }
  });

  router.get('/plans', async (req, res) => {
    try {
      const limit = parsePositiveLimit(req.query.limit, 25);
      const status = parseOptionalString(req.query.status);
      const plans = listCrmFollowUpPlans(limit, status);

      return res.json({
        ok: true,
        count: plans.length,
        plans,
      });
    } catch (error: unknown) {
      const normalized = ensureError(error);
      logError('CRMFollowUpRoute', `GET /plans failed: ${normalized.message}`);
      return res.status(500).json({
        ok: false,
        error: 'Failed to list CRM follow-up plans',
      });
    }
  });

  router.get('/actions', async (req, res) => {
    try {
      const limit = parsePositiveLimit(req.query.limit, 25);
      const status = parseOptionalString(req.query.status);
      const leadId = parseOptionalString(req.query.leadId);
      const planId = parseOptionalString(req.query.planId);
      const actions = listCrmFollowUpActions(limit, { status, leadId, planId });

      return res.json({
        ok: true,
        count: actions.length,
        actions,
      });
    } catch (error: unknown) {
      const normalized = ensureError(error);
      logError('CRMFollowUpRoute', `GET /actions failed: ${normalized.message}`);
      return res.status(500).json({
        ok: false,
        error: 'Failed to list CRM follow-up actions',
      });
    }
  });

  router.get('/summary', async (_req, res) => {
    try {
      const summary = getCrmFollowUpSummary();

      return res.json({
        ok: true,
        summary,
      });
    } catch (error: unknown) {
      const normalized = ensureError(error);
      logError('CRMFollowUpRoute', `GET /summary failed: ${normalized.message}`);
      return res.status(500).json({
        ok: false,
        error: 'Failed to build CRM follow-up summary',
      });
    }
  });

  router.get('/audit', async (req, res) => {
    try {
      const limit = parsePositiveLimit(req.query.limit, 25);
      const leadId = parseOptionalString(req.query.leadId);
      const events = listCrmFollowUpAuditTrail(limit, { leadId });

      return res.json({
        ok: true,
        count: events.length,
        events,
      });
    } catch (error: unknown) {
      const normalized = ensureError(error);
      logWarn('CRMFollowUpRoute', `GET /audit failed: ${normalized.message}`);
      return res.status(500).json({
        ok: false,
        error: 'Failed to list CRM follow-up audit trail',
      });
    }
  });

  router.get('/health', async (_req, res) => {
    try {
      const stats = getCrmFollowUpStats();
      return res.json({
        ok: true,
        status: 'healthy',
        stats,
      });
    } catch (error: unknown) {
      const normalized = ensureError(error);
      logWarn('CRMFollowUpRoute', `GET /health failed: ${normalized.message}`);
      return res.status(500).json({
        ok: false,
        error: 'CRM follow-up health check failed',
      });
    }
  });

  return router;
}

export default createCrmFollowUpRoutes;
