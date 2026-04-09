// src/server/routes/anythingllmActions.ts
import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { agentManager } from '../../agents/AgentManager.js';
import { logInfo, logError } from '../../utils/logger.js';

export interface ActionAuditRecord {
  id: string;
  timestamp: string;
  action: string;
  agent: string;
  payloadSummary: string;
  resultSummary: string;
  riskLevel: 'normal' | 'high';
  durationMs: number;
  success: boolean;
}

const auditBuffer: ActionAuditRecord[] = [];
const MAX_AUDIT = 50;

const HIGH_RISK_ACTIONS = new Set<string>(['browser_task', 'agent_start']);

export const ACTION_MAP: Record<string, string> = {
  email_triage:     'InvoiceAutomation',
  calendar_check:   'Orchestrator',
  document_summary: 'Researcher',
  browser_task:     'RobotkezV2',
  agent_start:      'Orchestrator',
};

function addAudit(record: ActionAuditRecord): void {
  auditBuffer.push(record);
  if (auditBuffer.length > MAX_AUDIT) auditBuffer.shift();
}

export function getAuditBuffer(): ActionAuditRecord[] {
  return [...auditBuffer];
}

function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const secret = process.env.BRUNELLA_ACTION_SECRET;
  if (!secret) { next(); return; }
  const provided = req.headers['x-brunella-secret'];
  if (provided !== secret) {
    res.status(401).json({
      error: 'Unauthorized',
      hint: 'X-Brunella-Secret header hiányzik vagy érvénytelen',
    });
    return;
  }
  next();
}

export function createAnythingLLMActionRoutes(): Router {
  const router = Router();
  const supported = Object.keys(ACTION_MAP);

  router.use(authMiddleware);

  router.post('/', async (req: Request, res: Response): Promise<void> => {
    const { action, payload } = req.body as {
      action?: string;
      payload?: { task?: string; context?: Record<string, unknown> };
    };

    if (!action || !ACTION_MAP[action]) {
      res.status(400).json({ error: `Unknown action: '${action ?? ''}'`, supported });
      return;
    }

    const agentName = ACTION_MAP[action];
    const task = payload?.task ?? action;
    const context = payload?.context ?? {};
    const riskLevel: 'normal' | 'high' = HIGH_RISK_ACTIONS.has(action) ? 'high' : 'normal';
    const auditId = `act_${Date.now()}_${action}`;
    const start = Date.now();

    try {
      logInfo('AnythingLLMAction', `${action} → ${agentName} | ${task.slice(0, 50)}`);
      const raw = await agentManager.delegate(agentName, task, context);
      const result =
        typeof raw === 'string'
          ? raw
          : ((raw as Record<string, unknown>)?.message as string | undefined) ??
            JSON.stringify(raw);
      const durationMs = Date.now() - start;

      addAudit({
        id: auditId,
        timestamp: new Date().toISOString(),
        action,
        agent: agentName,
        payloadSummary: task.slice(0, 100),
        resultSummary: result.slice(0, 200),
        riskLevel,
        durationMs,
        success: true,
      });

      res.json({ success: true, action, agent: agentName, result, riskLevel, auditId });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      const durationMs = Date.now() - start;

      addAudit({
        id: auditId,
        timestamp: new Date().toISOString(),
        action,
        agent: agentName,
        payloadSummary: task.slice(0, 100),
        resultSummary: `ERROR: ${msg.slice(0, 190)}`,
        riskLevel,
        durationMs,
        success: false,
      });

      logError('AnythingLLMAction', msg);
      res.status(500).json({ success: false, action, error: msg, riskLevel, auditId });
    }
  });

  router.get('/audit', (_req: Request, res: Response): void => {
    res.json({ records: [...auditBuffer].reverse(), total: auditBuffer.length });
  });

  return router;
}
