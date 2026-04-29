import { Router } from 'express';
import {
  selfModificationEngine,
  type SelfModificationProposalStatus,
} from '@packages/core-logic/selfModificationEngine.js';
import { agentPerformanceTracker } from '@packages/core-logic/agentPerformanceTracker.js';
import { logError } from '@packages/utils/logger.js';

const VALID_STATUSES: SelfModificationProposalStatus[] = [
  'pending_review',
  'approved',
  'rejected',
  'applied',
  'failed',
  'applying',
];

function parseBoolean(value: unknown): boolean | undefined {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true') return true;
    if (normalized === 'false') return false;
  }

  return undefined;
}

function parseInteger(value: unknown, fallback: number): number {
  const numeric = typeof value === 'string' ? Number.parseInt(value, 10) : Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function parseStatus(value: unknown): SelfModificationProposalStatus | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const normalized = value.trim();
  return VALID_STATUSES.includes(normalized as SelfModificationProposalStatus)
    ? normalized as SelfModificationProposalStatus
    : undefined;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function createSelfModificationRouter(): Router {
  const router = Router();

  router.get('/overview', (_req, res) => {
    try {
      res.json({
        success: true,
        data: selfModificationEngine.getOverview(),
      });
    } catch (error) {
      logError('SelfModificationRoute', `GET /overview failed: ${errorMessage(error)}`);
      res.status(500).json({ success: false, error: errorMessage(error) });
    }
  });

  router.get('/weak-agents', (req, res) => {
    try {
      const days = parseInteger(req.query.days, 7);
      const successThreshold = Number(req.query.successThreshold ?? 0.7);
      const durationThresholdMs = parseInteger(req.query.durationThresholdMs, 30_000);
      const minRuns = parseInteger(req.query.minRuns, 3);
      const limit = parseInteger(req.query.limit, 10);
      res.json({
        success: true,
        data: agentPerformanceTracker.getWeakAgents({
          days,
          successThreshold,
          durationThresholdMs,
          minRuns,
          limit,
        }),
      });
    } catch (error) {
      logError('SelfModificationRoute', `GET /weak-agents failed: ${errorMessage(error)}`);
      res.status(500).json({ success: false, error: errorMessage(error) });
    }
  });

  router.get('/proposals', (req, res) => {
    try {
      const status = parseStatus(req.query.status);
      const limit = parseInteger(req.query.limit, 20);
      const proposals = selfModificationEngine.listProposals(status, limit);
      res.json({
        success: true,
        count: proposals.length,
        data: proposals,
      });
    } catch (error) {
      logError('SelfModificationRoute', `GET /proposals failed: ${errorMessage(error)}`);
      res.status(500).json({ success: false, error: errorMessage(error) });
    }
  });

  router.get('/proposals/:proposalId', (req, res) => {
    try {
      const proposal = selfModificationEngine.getProposal(String(req.params.proposalId));
      if (!proposal) {
        res.status(404).json({ success: false, error: 'Proposal not found' });
        return;
      }

      res.json({
        success: true,
        data: proposal,
      });
    } catch (error) {
      logError('SelfModificationRoute', `GET /proposals/:proposalId failed: ${errorMessage(error)}`);
      res.status(500).json({ success: false, error: errorMessage(error) });
    }
  });

  router.post('/improve/:agentName', async (req, res) => {
    try {
      const proposal = await selfModificationEngine.improveAgent(String(req.params.agentName), {
        force: parseBoolean(req.body?.force),
        successThreshold: typeof req.body?.successThreshold === 'number' ? req.body.successThreshold : undefined,
        durationThresholdMs: typeof req.body?.durationThresholdMs === 'number' ? req.body.durationThresholdMs : undefined,
        minRuns: typeof req.body?.minRuns === 'number' ? req.body.minRuns : undefined,
        timeoutMs: typeof req.body?.timeoutMs === 'number' ? req.body.timeoutMs : undefined,
        triggeredBy: 'api',
      });

      res.status(proposal.status === 'failed' ? 202 : 200).json({
        success: true,
        data: proposal,
      });
    } catch (error) {
      const message = errorMessage(error);
      logError('SelfModificationRoute', `POST /improve/:agentName failed: ${message}`);
      res.status(400).json({ success: false, error: message });
    }
  });

  router.post('/cycle', async (req, res) => {
    try {
      const result = await selfModificationEngine.runWeeklyCycle({
        successThreshold: typeof req.body?.successThreshold === 'number' ? req.body.successThreshold : undefined,
        durationThresholdMs: typeof req.body?.durationThresholdMs === 'number' ? req.body.durationThresholdMs : undefined,
        minRuns: typeof req.body?.minRuns === 'number' ? req.body.minRuns : undefined,
      });

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      const message = errorMessage(error);
      logError('SelfModificationRoute', `POST /cycle failed: ${message}`);
      res.status(400).json({ success: false, error: message });
    }
  });

  router.post('/proposals/:proposalId/retest', async (req, res) => {
    try {
      const proposal = await selfModificationEngine.retestProposal(String(req.params.proposalId), {
        proposedToml: typeof req.body?.proposedToml === 'string' ? req.body.proposedToml : undefined,
        reviewer: typeof req.body?.reviewer === 'string' ? req.body.reviewer : undefined,
        notes: typeof req.body?.notes === 'string' ? req.body.notes : undefined,
        timeoutMs: typeof req.body?.timeoutMs === 'number' ? req.body.timeoutMs : undefined,
      });

      res.json({
        success: true,
        data: proposal,
      });
    } catch (error) {
      const message = errorMessage(error);
      logError('SelfModificationRoute', `POST /proposals/:proposalId/retest failed: ${message}`);
      res.status(400).json({ success: false, error: message });
    }
  });

  router.post('/proposals/:proposalId/approve', async (req, res) => {
    try {
      const proposal = await selfModificationEngine.approveProposal(String(req.params.proposalId), {
        reviewer: typeof req.body?.reviewer === 'string' ? req.body.reviewer : undefined,
        notes: typeof req.body?.notes === 'string' ? req.body.notes : undefined,
      });

      res.json({
        success: true,
        data: proposal,
      });
    } catch (error) {
      const message = errorMessage(error);
      logError('SelfModificationRoute', `POST /proposals/:proposalId/approve failed: ${message}`);
      res.status(400).json({ success: false, error: message });
    }
  });

  router.post('/proposals/:proposalId/reject', async (req, res) => {
    try {
      const proposal = await selfModificationEngine.rejectProposal(String(req.params.proposalId), {
        reviewer: typeof req.body?.reviewer === 'string' ? req.body.reviewer : undefined,
        notes: typeof req.body?.notes === 'string' ? req.body.notes : undefined,
      });

      res.json({
        success: true,
        data: proposal,
      });
    } catch (error) {
      const message = errorMessage(error);
      logError('SelfModificationRoute', `POST /proposals/:proposalId/reject failed: ${message}`);
      res.status(400).json({ success: false, error: message });
    }
  });

  return router;
}
