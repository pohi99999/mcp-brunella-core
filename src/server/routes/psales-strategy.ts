import { Router } from 'express';
import { StrategyPlannerAgent } from '../../agents/StrategyPlannerAgent.js';
import { ensureError } from '../../utils/ensureError.js';
import { logError, logInfo, logWarn } from '../../utils/logger.js';
import {
  getStrategyPlan,
  pauseStrategyPlan,
  resumeStrategyPlan,
  listPSalesAuditEvents,
  insertPSalesAuditEvent,
  getPSalesStatusSummary,
  updatePlanApprovalState,
} from '../../data/psales_db.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parsePositiveLimit(value: unknown, fallback = 50): number {
  const parsed = typeof value === 'string' ? Number.parseInt(value, 10) : Number(value);
  if (!Number.isFinite(parsed) || Number.isNaN(parsed) || parsed <= 0) return fallback;
  return Math.min(Math.trunc(parsed), 200);
}

function parseOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

// ---------------------------------------------------------------------------
// Route factory
// ---------------------------------------------------------------------------

const agent = new StrategyPlannerAgent();

export function createPSalesStrategyRoutes(): Router {
  const router = Router();

  // --------------------------------------------------------------------------
  // POST /plan — strategy generation (backward-compatible; now persisted)
  // --------------------------------------------------------------------------
  router.post('/plan', async (req, res) => {
    try {
      const body = req.body as Record<string, unknown>;
      const propertyType = parseOptionalString(body.propertyType);
      const location = parseOptionalString(body.location);
      const estimatedValue = typeof body.estimatedValue === 'number' ? body.estimatedValue : Number(body.estimatedValue ?? 0);

      if (!propertyType) {
        return res.status(400).json({ ok: false, error: 'propertyType kötelező' });
      }

      const result = await agent.execute('plan', { propertyType, location, estimatedValue });
      if (result.status === 'error') {
        return res.status(400).json({ ok: false, error: result.error });
      }

      logInfo('PSalesStrategyRoute', `Plan generated: ${(result.data as { planId?: string })?.planId ?? 'unknown'}`);
      return res.status(201).json({ ok: true, plan: result.data });
    } catch (error: unknown) {
      const normalized = ensureError(error);
      logError('PSalesStrategyRoute', `POST /plan failed: ${normalized.message}`);
      return res.status(500).json({ ok: false, error: 'Stratégia generálás sikertelen' });
    }
  });

  // --------------------------------------------------------------------------
  // POST /approve — approve or reject a plan (backward-compatible; now persisted)
  // --------------------------------------------------------------------------
  router.post('/approve', async (req, res) => {
    try {
      const body = req.body as Record<string, unknown>;
      const planId = parseOptionalString(body.planId);
      const decision = parseOptionalString(body.decision);
      const actor = parseOptionalString(body.actor);

      if (!planId || !decision) {
        return res.status(400).json({ ok: false, error: 'planId és decision kötelező' });
      }

      if (decision !== 'approved' && decision !== 'rejected') {
        return res.status(400).json({
          ok: false,
          error: `Érvénytelen döntés: "${decision}". Érvényes: approved, rejected.`,
        });
      }

      const existing = getStrategyPlan(planId);
      if (!existing) {
        return res.status(404).json({ ok: false, error: `Terv nem található: "${planId}"` });
      }

      const updated = updatePlanApprovalState(planId, decision, { actor });
      if (!updated) {
        return res.status(409).json({
          ok: false,
          error: `Terv állapota nem módosítható (jelenlegi: ${existing.approvalState})`,
          currentState: existing.approvalState,
        });
      }

      insertPSalesAuditEvent(planId, decision, {
        actor: actor ?? 'human',
        note: `Döntés: ${decision}`,
      });

      logInfo('PSalesStrategyRoute', `Plan ${decision}: ${planId} by ${actor ?? 'human'}`);
      return res.json({ ok: true, plan: updated });
    } catch (error: unknown) {
      const normalized = ensureError(error);
      logError('PSalesStrategyRoute', `POST /approve failed: ${normalized.message}`);
      return res.status(500).json({ ok: false, error: 'Jóváhagyás feldolgozása sikertelen' });
    }
  });

  // --------------------------------------------------------------------------
  // POST /pause — pause a pending plan (human-in-loop gate)
  // --------------------------------------------------------------------------
  router.post('/pause', async (req, res) => {
    try {
      const body = req.body as Record<string, unknown>;
      const planId = parseOptionalString(body.planId);
      const reason = parseOptionalString(body.reason);
      const actor = parseOptionalString(body.actor);

      if (!planId) {
        return res.status(400).json({ ok: false, error: 'planId kötelező' });
      }

      const existing = getStrategyPlan(planId);
      if (!existing) {
        return res.status(404).json({ ok: false, error: `Terv nem található: "${planId}"` });
      }

      if (existing.approvalState !== 'pending') {
        return res.status(409).json({
          ok: false,
          error: `Csak pending állapotú terv szüneteltethető (jelenlegi: ${existing.approvalState})`,
          currentState: existing.approvalState,
        });
      }

      const updated = pauseStrategyPlan(planId, { reason, actor });
      if (!updated) {
        return res.status(500).json({ ok: false, error: 'Szüneteltetés sikertelen' });
      }

      insertPSalesAuditEvent(planId, 'paused', {
        actor: actor ?? 'system',
        note: reason ?? 'Emberi felülvizsgálat szükséges',
        payload: { resumeToken: updated.resumeToken },
      });

      logInfo('PSalesStrategyRoute', `Plan paused: ${planId}, token: ${updated.resumeToken ?? 'n/a'}`);
      return res.json({ ok: true, plan: updated, resumeToken: updated.resumeToken });
    } catch (error: unknown) {
      const normalized = ensureError(error);
      logError('PSalesStrategyRoute', `POST /pause failed: ${normalized.message}`);
      return res.status(500).json({ ok: false, error: 'Szüneteltetés sikertelen' });
    }
  });

  // --------------------------------------------------------------------------
  // POST /resume — resume a paused plan (accepts planId or resumeToken webhook)
  // --------------------------------------------------------------------------
  router.post('/resume', async (req, res) => {
    try {
      const body = req.body as Record<string, unknown>;
      const planId = parseOptionalString(body.planId);
      const resumeToken = parseOptionalString(body.resumeToken);
      const actor = parseOptionalString(body.actor);
      const note = parseOptionalString(body.note);

      if (!planId && !resumeToken) {
        return res.status(400).json({ ok: false, error: 'planId vagy resumeToken kötelező' });
      }

      const updated = resumeStrategyPlan(
        { planId, resumeToken },
        { actor, note },
      );

      if (!updated) {
        const identifier = planId ?? resumeToken ?? 'n/a';
        logWarn('PSalesStrategyRoute', `Resume failed — not found or not paused: ${identifier}`);
        return res.status(404).json({
          ok: false,
          error: 'Szüneteltetett terv nem található. Ellenőrizd a planId-t vagy resumeToken-t.',
        });
      }

      insertPSalesAuditEvent(updated.planId, 'resumed', {
        actor: actor ?? 'human',
        note: note ?? 'Visszaállítva',
      });

      logInfo('PSalesStrategyRoute', `Plan resumed: ${updated.planId} by ${actor ?? 'human'}`);
      return res.json({ ok: true, plan: updated });
    } catch (error: unknown) {
      const normalized = ensureError(error);
      logError('PSalesStrategyRoute', `POST /resume failed: ${normalized.message}`);
      return res.status(500).json({ ok: false, error: 'Visszaállítás sikertelen' });
    }
  });

  // --------------------------------------------------------------------------
  // GET /audit — list audit events (optionally filter by planId)
  // --------------------------------------------------------------------------
  router.get('/audit', (req, res) => {
    try {
      const planId = parseOptionalString(req.query.planId);
      const limit = parsePositiveLimit(req.query.limit, 50);

      const events = listPSalesAuditEvents(limit, { planId });
      return res.json({ ok: true, events, total: events.length });
    } catch (error: unknown) {
      const normalized = ensureError(error);
      logError('PSalesStrategyRoute', `GET /audit failed: ${normalized.message}`);
      return res.status(500).json({ ok: false, error: 'Audit napló lekérése sikertelen' });
    }
  });

  // --------------------------------------------------------------------------
  // GET /weekly-status — approval state counts + recent audit events
  // --------------------------------------------------------------------------
  router.get('/weekly-status', (req, res) => {
    try {
      const auditLimit = parsePositiveLimit(req.query.auditLimit, 20);
      const summary = getPSalesStatusSummary(auditLimit);
      return res.json({ ok: true, summary });
    } catch (error: unknown) {
      const normalized = ensureError(error);
      logError('PSalesStrategyRoute', `GET /weekly-status failed: ${normalized.message}`);
      return res.status(500).json({ ok: false, error: 'Heti állapot lekérése sikertelen' });
    }
  });

  return router;
}
