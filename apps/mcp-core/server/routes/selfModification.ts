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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

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

function parseInteger(value: unknown, fallback: number, min = 1, max = Number.MAX_SAFE_INTEGER): number {
  const numeric = typeof value === 'string' ? Number.parseInt(value, 10) : Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.min(Math.max(Math.trunc(numeric), min), max);
}

function parseOptionalInteger(value: unknown, min = 1, max = Number.MAX_SAFE_INTEGER): number | undefined {
  if (value === undefined || value === null) return undefined;
  const numeric = typeof value === 'string' ? Number.parseInt(value, 10) : Number(value);
  if (!Number.isFinite(numeric)) return undefined;
  return Math.min(Math.max(Math.trunc(numeric), min), max);
}

function parseRatio(value: unknown): number | undefined {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return undefined;
  return Math.min(Math.max(numeric, 0), 1);
}

function parsePositiveNumber(value: unknown): number | undefined {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return undefined;
  return Math.max(numeric, 0);
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
      const days = parseInteger(req.query.days, 7, 1, 365);
      const successThreshold = parseRatio(req.query.successThreshold) ?? 0.7;
      const durationThresholdMs = parseInteger(req.query.durationThresholdMs, 30_000, 1, 86_400_000);
      const minRuns = parseInteger(req.query.minRuns, 3, 1, 100);
      const limit = parseInteger(req.query.limit, 10, 1, 50);
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
      const limit = parseInteger(req.query.limit, 20, 1, 100);
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
      const proposalId = readString(req.params.proposalId);
      if (!proposalId) {
        res.status(400).json({ success: false, error: 'proposalId is required' });
        return;
      }
      const proposal = selfModificationEngine.getProposal(proposalId);
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
      const agentName = readString(req.params.agentName);
      if (!agentName) {
        res.status(400).json({ success: false, error: 'agentName is required' });
        return;
      }
      const body = isRecord(req.body) ? req.body : {};
      const proposal = await selfModificationEngine.improveAgent(agentName, {
        force: parseBoolean(body.force),
        successThreshold: parseRatio(body.successThreshold),
        durationThresholdMs: parsePositiveNumber(body.durationThresholdMs),
        minRuns: parseOptionalInteger(body.minRuns, 1, 100),
        timeoutMs: parsePositiveNumber(body.timeoutMs),
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
      const body = isRecord(req.body) ? req.body : {};
      const result = await selfModificationEngine.runWeeklyCycle({
        successThreshold: parseRatio(body.successThreshold),
        durationThresholdMs: parsePositiveNumber(body.durationThresholdMs),
        minRuns: parseOptionalInteger(body.minRuns, 1, 100),
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
      const proposalId = readString(req.params.proposalId);
      if (!proposalId) {
        res.status(400).json({ success: false, error: 'proposalId is required' });
        return;
      }
      const body = isRecord(req.body) ? req.body : {};
      const proposal = await selfModificationEngine.retestProposal(proposalId, {
        proposedToml: readString(body.proposedToml),
        reviewer: readString(body.reviewer),
        notes: readString(body.notes),
        timeoutMs: parsePositiveNumber(body.timeoutMs),
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
      const proposalId = readString(req.params.proposalId);
      if (!proposalId) {
        res.status(400).json({ success: false, error: 'proposalId is required' });
        return;
      }
      const body = isRecord(req.body) ? req.body : {};
      const proposal = await selfModificationEngine.approveProposal(proposalId, {
        reviewer: readString(body.reviewer),
        notes: readString(body.notes),
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
      const proposalId = readString(req.params.proposalId);
      if (!proposalId) {
        res.status(400).json({ success: false, error: 'proposalId is required' });
        return;
      }
      const body = isRecord(req.body) ? req.body : {};
      const proposal = await selfModificationEngine.rejectProposal(proposalId, {
        reviewer: readString(body.reviewer),
        notes: readString(body.notes),
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
