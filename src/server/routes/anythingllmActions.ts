// src/server/routes/anythingllmActions.ts
import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { agentManager } from '../../agents/AgentManager.js';
import { getEnhancedPermissionManager } from '../../core/rbac/agentPermissions.js';
import { approvalManager } from '../../utils/approvalManager.js';
import { logInfo, logError } from '../../utils/logger.js';

type AnythingLLMRole = 'viewer' | 'operator' | 'admin';
type PermissionAction = 'read_file' | 'http' | 'browser' | 'run_command';

interface ActionRequestPayload {
  task?: string;
  context?: Record<string, unknown>;
}

interface ActionRequestBody {
  action?: string;
  approvalId?: string;
  payload?: ActionRequestPayload;
}

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
const ROLE_ORDER: Record<AnythingLLMRole, number> = {
  viewer: 0,
  operator: 1,
  admin: 2,
};

const HIGH_RISK_ACTIONS = new Set<string>(['browser_task', 'agent_start']);
const ACTION_ROLE_REQUIREMENTS: Record<string, AnythingLLMRole> = {
  email_triage: 'operator',
  calendar_check: 'operator',
  document_summary: 'operator',
  browser_task: 'admin',
  agent_start: 'admin',
};
const ACTION_PERMISSION_MAP: Record<string, PermissionAction> = {
  email_triage: 'read_file',
  calendar_check: 'http',
  document_summary: 'read_file',
  browser_task: 'browser',
  agent_start: 'run_command',
};

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

function getRole(req: Request): AnythingLLMRole {
  const role = req.headers['x-brunella-role'];
  if (role === 'admin' || role === 'operator' || role === 'viewer') {
    return role;
  }

  return 'operator';
}

function hasRequiredRole(role: AnythingLLMRole, required: AnythingLLMRole): boolean {
  return ROLE_ORDER[role] >= ROLE_ORDER[required];
}

function toResultMessage(raw: unknown): string {
  return typeof raw === 'string'
    ? raw
    : ((raw as Record<string, unknown>)?.message as string | undefined) ?? JSON.stringify(raw);
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
  const permissionManager = getEnhancedPermissionManager();

  router.use(authMiddleware);

  router.post('/', async (req: Request, res: Response): Promise<void> => {
    const { action, approvalId, payload } = req.body as ActionRequestBody;

    if (!action || !ACTION_MAP[action]) {
      res.status(400).json({ error: `Unknown action: '${action ?? ''}'`, supported });
      return;
    }

    const agentName = ACTION_MAP[action];
    const task = payload?.task ?? action;
    const context = payload?.context ?? {};
    const role = getRole(req);
    const requiredRole = ACTION_ROLE_REQUIREMENTS[action] ?? 'operator';
    const riskLevel: 'normal' | 'high' = HIGH_RISK_ACTIONS.has(action) ? 'high' : 'normal';
    const auditId = `act_${Date.now()}_${action}`;
    const start = Date.now();

    if (!hasRequiredRole(role, requiredRole)) {
      const durationMs = Date.now() - start;
      const resultSummary = `RBAC_DENIED: ${role} < ${requiredRole}`;

      addAudit({
        id: auditId,
        timestamp: new Date().toISOString(),
        action,
        agent: agentName,
        payloadSummary: task.slice(0, 100),
        resultSummary,
        riskLevel,
        durationMs,
        success: false,
      });

      res.status(403).json({
        success: false,
        action,
        agent: agentName,
        error: `Insufficient role: '${role}' cannot execute '${action}'`,
        requiredRole,
        riskLevel,
        auditId,
      });
      return;
    }

    const permissionResult = permissionManager.checkPermission(
      agentName,
      ACTION_PERMISSION_MAP[action] ?? 'read_file',
      `anythingllm:${action}`,
    );
    if (!permissionResult.allowed) {
      const durationMs = Date.now() - start;
      const resultSummary = `RBAC_DENIED: ${permissionResult.reason}`;

      addAudit({
        id: auditId,
        timestamp: new Date().toISOString(),
        action,
        agent: agentName,
        payloadSummary: task.slice(0, 100),
        resultSummary,
        riskLevel,
        durationMs,
        success: false,
      });

      res.status(403).json({
        success: false,
        action,
        agent: agentName,
        error: permissionResult.reason,
        profile: permissionResult.profile,
        riskLevel,
        auditId,
      });
      return;
    }

    if (riskLevel === 'high') {
      const request = approvalId ? approvalManager.getRequest(approvalId) : undefined;
      const approvalMatches =
        request?.status === 'approved'
        && request.metadata
        && typeof request.metadata === 'object'
        && (request.metadata as Record<string, unknown>).action === action
        && (request.metadata as Record<string, unknown>).agent === agentName;

      if (!approvalMatches) {
        if (approvalId && request) {
          const durationMs = Date.now() - start;

          addAudit({
            id: auditId,
            timestamp: new Date().toISOString(),
            action,
            agent: agentName,
            payloadSummary: task.slice(0, 100),
            resultSummary: `APPROVAL_NOT_READY: ${request.status}`,
            riskLevel,
            durationMs,
            success: false,
          });

          res.status(409).json({
            success: false,
            action,
            agent: agentName,
            error: `Approval '${approvalId}' is not approved`,
            approvalRequired: true,
            approvalId,
            approvalStatus: request.status,
            riskLevel,
            auditId,
          });
          return;
        }

        const createdApprovalId = await approvalManager.requestApproval(
          'critical_action',
          `AnythingLLM action approval required: ${action}`,
          { action, agent: agentName, task, riskLevel, role },
        );
        const durationMs = Date.now() - start;

        addAudit({
          id: auditId,
          timestamp: new Date().toISOString(),
          action,
          agent: agentName,
          payloadSummary: task.slice(0, 100),
          resultSummary: `APPROVAL_REQUIRED: ${createdApprovalId}`,
          riskLevel,
          durationMs,
          success: false,
        });

        res.status(202).json({
          success: false,
          action,
          agent: agentName,
          result: 'Approval required before execution',
          approvalRequired: true,
          approvalId: createdApprovalId,
          approvalStatus: 'pending',
          riskLevel,
          auditId,
        });
        return;
      }
    }

    try {
      logInfo('AnythingLLMAction', `${action} → ${agentName} | ${task.slice(0, 50)}`);
      const raw = await agentManager.delegate(agentName, task, context);
      const result = toResultMessage(raw);
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

      res.json({ success: true, action, agent: agentName, result, riskLevel, auditId, role });
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
