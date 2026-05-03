import { Router, type Request, type Response } from 'express';
import { zeroPromptRuntime } from '@packages/core-logic/zeroPromptRuntime.js';
import { eventFabric } from '@packages/core-logic/eventFabric.js';
import { approvalRouter } from '@packages/core-logic/approvalRouter.js';
import { githubRemediationRuntime } from '@packages/core-logic/githubRemediationRuntime.js';
import { notificationChannels } from '@packages/core-logic/notificationChannels.js';
import { evaluateAndLogPolicy } from '@packages/core-logic/policyEngine.js';
import { logError } from '@packages/utils/logger.js';
import { v4 as uuidv4 } from 'uuid';
import type { EventEnvelope, EventFabricPriority, EventFabricRiskHint } from '@packages/core-logic/eventFabric.js';

const PRIORITIES = new Set<EventFabricPriority>(['critical', 'high', 'medium', 'low']);
const RISK_HINTS = new Set<EventFabricRiskHint>(['safe', 'guarded', 'dangerous']);

function isString(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0;
}

function readString(v: unknown): string | null {
  return isString(v) ? v.trim() : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readPriority(value: unknown): EventFabricPriority {
  return typeof value === 'string' && PRIORITIES.has(value as EventFabricPriority)
    ? (value as EventFabricPriority)
    : 'medium';
}

function readRiskHint(value: unknown): EventFabricRiskHint {
  return typeof value === 'string' && RISK_HINTS.has(value as EventFabricRiskHint)
    ? (value as EventFabricRiskHint)
    : 'safe';
}

function readLimit(value: unknown, fallback: number): number {
  const parsed = typeof value === 'number' ? value : Number.parseInt(String(value ?? fallback), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(Math.trunc(parsed), 1), 200);
}

export function createZeroPromptRouter(): Router {
  const router = Router();

  /**
   * GET /status
   * Zero-Prompt runtime állapota és esemény statisztikák.
   */
  router.get('/status', (_req: Request, res: Response) => {
    try {
      const stats = eventFabric.getStats();
      const pending = approvalRouter.listWorkflows('pending');
      res.json({
        active: zeroPromptRuntime.isActive(),
        remediationActive: githubRemediationRuntime.isActive(),
        eventFabric: stats,
        pendingApprovals: pending.length,
        remediation: githubRemediationRuntime.getSummary(),
        timestamp: new Date().toISOString(),
      });
    } catch (e: unknown) {
      logError('ZeroPromptRoute', `status error: ${e instanceof Error ? e.message : String(e)}`);
      res.status(500).json({ error: 'Failed to get zero-prompt status' });
    }
  });

  /**
   * GET /events
   * Esemény előzmények (szűrhető source, type, limit query paraméterekkel).
   */
  router.get('/events', (req: Request, res: Response) => {
    try {
      const source = readString(req.query.source) ?? undefined;
      const type = readString(req.query.type) ?? undefined;
      const events = eventFabric.getHistory({ source, type, limit: readLimit(req.query.limit, 50) });
      res.json({ count: events.length, events });
    } catch (e: unknown) {
      logError('ZeroPromptRoute', `events error: ${e instanceof Error ? e.message : String(e)}`);
      res.status(500).json({ error: 'Failed to get event history' });
    }
  });

  /**
   * POST /events
   * Manuálisan publikál egy eseményt az EventFabricba (orchestrátor által vezérelhető).
   * Body: { source, type, priority?, riskHint?, payload, metadata? }
   */
  router.post('/events', (req: Request, res: Response) => {
    try {
      const body = isRecord(req.body) ? req.body : {};
      const source = readString(body.source);
      const type = readString(body.type);
      if (!source || !type) {
        res.status(400).json({ error: 'source and type are required strings' });
        return;
      }

      const envelope: EventEnvelope = {
        id: uuidv4(),
        source,
        type,
        priority: readPriority(body.priority),
        riskHint: readRiskHint(body.riskHint),
        dedupKey: `manual:${source}:${type}:${Date.now()}`,
        payload: body.payload ?? {},
        timestamp: new Date().toISOString(),
        metadata: isRecord(body.metadata)
          ? body.metadata
          : { source: 'manual_api' },
      };

      const result = eventFabric.publish(envelope);
      res.status(result.accepted ? 201 : 200).json({
        accepted: result.accepted,
        reason: result.reason,
        eventId: envelope.id,
      });
    } catch (e: unknown) {
      logError('ZeroPromptRoute', `publish error: ${e instanceof Error ? e.message : String(e)}`);
      res.status(500).json({ error: 'Failed to publish event' });
    }
  });

  /**
   * POST /start
   * Zero-Prompt runtime indítása (ha le lett állítva).
   */
  router.post('/start', (_req: Request, res: Response) => {
    try {
      if (zeroPromptRuntime.isActive()) {
        if (!githubRemediationRuntime.isActive()) {
          githubRemediationRuntime.start();
        }
        res.json({ started: false, message: 'Zero-Prompt runtime already active' });
        return;
      }
      zeroPromptRuntime.start();
      githubRemediationRuntime.start();
      res.json({ started: true, message: 'Zero-Prompt runtime started' });
    } catch (e: unknown) {
      logError('ZeroPromptRoute', `start error: ${e instanceof Error ? e.message : String(e)}`);
      res.status(500).json({ error: 'Failed to start zero-prompt runtime' });
    }
  });

  /**
   * POST /stop
   * Zero-Prompt runtime leállítása.
   */
  router.post('/stop', (_req: Request, res: Response) => {
    try {
      if (!zeroPromptRuntime.isActive()) {
        if (githubRemediationRuntime.isActive()) {
          githubRemediationRuntime.stop();
        }
        res.json({ stopped: false, message: 'Zero-Prompt runtime was not active' });
        return;
      }
      zeroPromptRuntime.stop();
      githubRemediationRuntime.stop();
      res.json({ stopped: true, message: 'Zero-Prompt runtime stopped' });
    } catch (e: unknown) {
      logError('ZeroPromptRoute', `stop error: ${e instanceof Error ? e.message : String(e)}`);
      res.status(500).json({ error: 'Failed to stop zero-prompt runtime' });
    }
  });

  /**
   * GET /approvals
   * Jóváhagyásra váró workflow-ok listája (status query: pending|approved|rejected|expired).
   */
  router.get('/approvals', (req: Request, res: Response) => {
    try {
      const status = isString(req.query.status) ? req.query.status : undefined;
      const validStatuses = ['pending', 'approved', 'rejected', 'expired'];
      const safeStatus = status && validStatuses.includes(status)
        ? (status as 'pending' | 'approved' | 'rejected' | 'expired')
        : undefined;
      const workflows = approvalRouter.listWorkflows(safeStatus);
      res.json({ count: workflows.length, workflows });
    } catch (e: unknown) {
      logError('ZeroPromptRoute', `approvals list error: ${e instanceof Error ? e.message : String(e)}`);
      res.status(500).json({ error: 'Failed to list approval workflows' });
    }
  });

  /**
   * GET /approvals/:workflowId
   * Egy workflow részletei.
   */
  router.get('/approvals/:workflowId', (req: Request, res: Response) => {
    try {
      const workflow = approvalRouter.getWorkflow(String(req.params.workflowId));
      if (!workflow) {
        res.status(404).json({ error: 'Workflow not found' });
        return;
      }
      res.json(workflow);
    } catch (e: unknown) {
      logError('ZeroPromptRoute', `approval get error: ${e instanceof Error ? e.message : String(e)}`);
      res.status(500).json({ error: 'Failed to get workflow' });
    }
  });

  /**
   * GET /notifications
   * Approval notification delivery history.
   */
  router.get('/notifications', (req: Request, res: Response) => {
    try {
      const limit = readLimit(req.query.limit, 20);
      const channel = readString(req.query.channel) ?? undefined;
      const status = readString(req.query.status) ?? undefined;

      const deliveries = notificationChannels.listDeliveries({
        limit: isNaN(limit) ? 20 : limit,
        channel: channel as 'email' | 'slack' | 'discord' | 'system' | undefined,
        status: status as 'sent' | 'failed' | 'skipped' | undefined,
      });

      res.json({
        deliveries,
        count: deliveries.length,
      });
    } catch (e: unknown) {
      logError('ZeroPromptRoute', `notifications list error: ${e instanceof Error ? e.message : String(e)}`);
      res.status(500).json({ error: 'Failed to list approval notification deliveries' });
    }
  });

  /**
   * GET /notifications/summary
   * Approval notification summary + workflow counters.
   */
  router.get('/notifications/summary', (_req: Request, res: Response) => {
    try {
      const summary = notificationChannels.getSummary();
      const workflows = approvalRouter.listWorkflows();

      res.json({
        summary: {
          ...summary,
          channelPolicies: notificationChannels.getPolicies(),
          workflowCounts: {
            pending: workflows.filter((workflow) => workflow.status === 'pending').length,
            approved: workflows.filter((workflow) => workflow.status === 'approved').length,
            rejected: workflows.filter((workflow) => workflow.status === 'rejected').length,
            expired: workflows.filter((workflow) => workflow.status === 'expired').length,
          },
        },
      });
    } catch (e: unknown) {
      logError('ZeroPromptRoute', `notifications summary error: ${e instanceof Error ? e.message : String(e)}`);
      res.status(500).json({ error: 'Failed to summarize approval notifications' });
    }
  });

  /**
   * GET /remediation-runs
   * GitHub workflow failure remediation futások listája.
   */
  router.get('/remediation-runs', (req: Request, res: Response) => {
    try {
      const status = readString(req.query.status) ?? undefined;
      const limit = readLimit(req.query.limit, 20);
      const validStatuses = [
        'queued',
        'analyzing',
        'running_fixer',
        'verifying',
        'awaiting_final_approval',
        'approved',
        'rejected',
        'failed',
      ];
      const safeStatus = status && validStatuses.includes(status) ? status : undefined;
      const runs = githubRemediationRuntime.listRuns(
        safeStatus as
          | 'queued'
          | 'analyzing'
          | 'running_fixer'
          | 'verifying'
          | 'awaiting_final_approval'
          | 'approved'
          | 'rejected'
          | 'failed'
          | undefined,
        limit,
      );

      res.json({
        count: runs.length,
        runs,
      });
    } catch (e: unknown) {
      logError('ZeroPromptRoute', `remediation runs error: ${e instanceof Error ? e.message : String(e)}`);
      res.status(500).json({ error: 'Failed to list remediation runs' });
    }
  });

  /**
   * GET /remediation-runs/summary
   * Remediation futások aggregált állapota.
   */
  router.get('/remediation-runs/summary', (_req: Request, res: Response) => {
    try {
      res.json({
        summary: githubRemediationRuntime.getSummary(),
      });
    } catch (e: unknown) {
      logError('ZeroPromptRoute', `remediation summary error: ${e instanceof Error ? e.message : String(e)}`);
      res.status(500).json({ error: 'Failed to summarize remediation runs' });
    }
  });

  /**
   * POST /workflows/:workflowId/notify
   * Re-dispatch notification delivery for an approval workflow.
   */
  router.post('/workflows/:workflowId/notify', async (req: Request, res: Response) => {
    try {
      const workflow = approvalRouter.getWorkflow(String(req.params.workflowId));
      if (!workflow) {
        res.status(404).json({ error: 'Workflow not found' });
        return;
      }

      const deliveries = await notificationChannels.dispatchWorkflowState(workflow);
      res.json({ success: true, deliveries });
    } catch (e: unknown) {
      logError('ZeroPromptRoute', `workflow notify error: ${e instanceof Error ? e.message : String(e)}`);
      res.status(500).json({ error: 'Failed to dispatch approval workflow notification' });
    }
  });

  /**
   * POST /approvals/:workflowId/approve
   * Workflow jóváhagyása — orchestrátor általi döntés.
   */
  router.post('/approvals/:workflowId/approve', (req: Request, res: Response) => {
    try {
      const workflow = approvalRouter.getWorkflow(String(req.params.workflowId));
      if (!workflow) {
        res.status(404).json({ error: 'Workflow not found' });
        return;
      }
      const updated = approvalRouter.respondToWorkflowByRequestId(
        workflow.approvalRequestId,
        'approve',
        req.body,
      );
      res.json({ success: true, workflow: updated });
    } catch (e: unknown) {
      logError('ZeroPromptRoute', `approve error: ${e instanceof Error ? e.message : String(e)}`);
      res.status(500).json({ error: 'Failed to approve workflow' });
    }
  });

  /**
   * POST /approvals/:workflowId/reject
   * Workflow elutasítása.
   */
  router.post('/approvals/:workflowId/reject', (req: Request, res: Response) => {
    try {
      const workflow = approvalRouter.getWorkflow(String(req.params.workflowId));
      if (!workflow) {
        res.status(404).json({ error: 'Workflow not found' });
        return;
      }
      const updated = approvalRouter.respondToWorkflowByRequestId(
        workflow.approvalRequestId,
        'reject',
        req.body,
      );
      res.json({ success: true, workflow: updated });
    } catch (e: unknown) {
      logError('ZeroPromptRoute', `reject error: ${e instanceof Error ? e.message : String(e)}`);
      res.status(500).json({ error: 'Failed to reject workflow' });
    }
  });

  /**
   * POST /evaluate
   * Esemény kockázatértékelése a PolicyEngine-nel, jóváhagyás létrehozása nélkül.
   * Body: { source, type, priority?, riskHint?, payload }
   */
  router.post('/evaluate', async (req: Request, res: Response) => {
    try {
      const body = isRecord(req.body) ? req.body : {};
      const source = readString(body.source);
      const type = readString(body.type);
      if (!source || !type) {
        res.status(400).json({ error: 'source and type are required' });
        return;
      }

      const envelope: EventEnvelope = {
        id: uuidv4(),
        source,
        type,
        priority: readPriority(body.priority),
        riskHint: readRiskHint(body.riskHint),
        dedupKey: `eval:${source}:${type}:${Date.now()}`,
        payload: body.payload ?? {},
        timestamp: new Date().toISOString(),
      };

      const decision = await evaluateAndLogPolicy({
        event: envelope,
        agentName: readString(body.agentName) ?? 'ManualEvaluate',
        resource: readString(body.resource) ?? undefined,
      });

      res.json({ decision });
    } catch (e: unknown) {
      logError('ZeroPromptRoute', `evaluate error: ${e instanceof Error ? e.message : String(e)}`);
      res.status(500).json({ error: 'Failed to evaluate event policy' });
    }
  });

  /**
   * POST /replay
   * Korábbi események újrajátszása (pl. rendszer-visszaállítás után).
   * Body: { source?, type?, limit? }
   */
  router.post('/replay', (req: Request, res: Response) => {
    try {
      const body = isRecord(req.body) ? req.body : {};
      const result = eventFabric.replay({
        source: readString(body.source) ?? undefined,
        type: readString(body.type) ?? undefined,
        limit: readLimit(body.limit, 10),
      });
      res.json({ replayed: result.replayed, events: result.events });
    } catch (e: unknown) {
      logError('ZeroPromptRoute', `replay error: ${e instanceof Error ? e.message : String(e)}`);
      res.status(500).json({ error: 'Failed to replay events' });
    }
  });

  return router;
}
