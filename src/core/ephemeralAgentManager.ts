import { v4 as uuidv4 } from 'uuid';
import { approvalRouter, type ApprovalWorkflow } from './approvalRouter.js';
import { generatePostmortem } from './ephemeralAudit.js';
import {
  canRequestBudgetApproval,
  createInitialLeaseState,
  markBudgetExceeded,
  renewLease,
  resolveBudgetExceededAction,
  shouldResetBudgetsOnRenew,
  type EphemeralBudgetType,
  type EphemeralLeasePolicy,
  type EphemeralLeaseState,
} from './ephemeralLeaseManager.js';
import { evaluateAndLogPolicy, type PolicyDecision } from './policyEngine.js';
import { createScopedToolRegistryView, type EphemeralScopedToolRegistry } from './ephemeralScopedToolRegistry.js';
import { phoenixEventBus } from './phoenixEventBus.js';
import { logInfo, logWarn } from '../utils/logger.js';

export type EphemeralAgentState = 'pending' | 'running' | 'terminated' | 'expired' | 'failed';

export interface EphemeralAgentSpec {
  parentAgentName: string;
  purpose: string;
  allowedTools: string[];
  deniedTools?: string[];
  allowedPaths?: string[];
  allowedHosts?: string[];
  ttlMs?: number;
  tokenBudget?: number;
  costBudgetUsd?: number;
  stepBudget?: number;
  leasePolicy?: EphemeralLeasePolicy;
  metadata?: Record<string, unknown>;
}

export interface EphemeralApprovalState {
  kind: 'spawn' | 'budget';
  workflowId: string;
  approvalRequestId: string;
  requestedAt: string;
  reason: string;
  budgetType?: EphemeralBudgetType;
  used?: number;
  limit?: number;
}

export interface EphemeralAuditEntry {
  timestamp: string;
  event: string;
  detail?: string;
}

export interface EphemeralAgentRecord {
  id: string;
  spec: EphemeralAgentSpec;
  state: EphemeralAgentState;
  spawnedAt: string;
  terminatedAt?: string;
  terminationReason?: string;
  tokenUsed: number;
  costUsed: number;
  stepsUsed: number;
  lease: EphemeralLeaseState;
  approval?: EphemeralApprovalState;
  auditTrail: EphemeralAuditEntry[];
}

export interface EphemeralUsageResult {
  killed: boolean;
  reason?: string;
  approval?: EphemeralApprovalState;
}

const DEFAULT_TTL_MS = 5 * 60 * 1000;
const DEFAULT_APPROVAL_TIMEOUT_MS = 10 * 60 * 1000;

class EphemeralAgentManager {
  private readonly agents = new Map<string, EphemeralAgentRecord>();
  private readonly timers = new Map<string, ReturnType<typeof setTimeout>>();
  private readonly postmortemRecorded = new Set<string>();

  async spawn(spec: EphemeralAgentSpec): Promise<EphemeralAgentRecord> {
    const now = new Date().toISOString();
    const id = uuidv4();
    const ttlMs = spec.ttlMs ?? DEFAULT_TTL_MS;

    const decision = await evaluateAndLogPolicy({
      event: {
        id: uuidv4(),
        source: 'ephemeral_manager',
        type: 'ephemeral.agent.spawn',
        priority: 'medium',
        dedupKey: `ephemeral:spawn:${spec.parentAgentName}:${id}`,
        payload: { purpose: spec.purpose, parentAgentName: spec.parentAgentName },
        timestamp: now,
      },
      agentName: spec.parentAgentName,
    });

    const record: EphemeralAgentRecord = {
      id,
      spec,
      state: decision.requiresApproval ? 'pending' : 'running',
      spawnedAt: now,
      tokenUsed: 0,
      costUsed: 0,
      stepsUsed: 0,
      lease: createInitialLeaseState(spec, now, DEFAULT_TTL_MS),
      auditTrail: [{ timestamp: now, event: 'spawned', detail: spec.purpose }],
    };

    if (decision.requiresApproval) {
      const workflow = await this.createApprovalWorkflow(record, decision, 'spawn');
      if (workflow) {
        record.approval = this.toApprovalState(workflow, 'spawn', decision.reason);
      }
      record.auditTrail.push({ timestamp: now, event: 'pending_approval', detail: decision.reason });
    }

    this.agents.set(id, record);
    this.armTimer(id, ttlMs);

    phoenixEventBus.publish('phoenix:ephemeral_spawned', {
      agentId: id,
      parentAgentName: spec.parentAgentName,
      purpose: spec.purpose,
      allowedTools: spec.allowedTools,
      deniedTools: spec.deniedTools,
      allowedPaths: spec.allowedPaths,
      allowedHosts: spec.allowedHosts,
      ttlMs,
      state: record.state,
      timestamp: now,
    });

    logInfo('EphemeralAgentManager', `Spawned ${id} (parent: ${spec.parentAgentName}, state: ${record.state})`);
    return record;
  }

  terminate(id: string, reason = 'manual'): EphemeralAgentRecord | null {
    const record = this.agents.get(id);
    if (!record) return null;

    this.syncApprovalStateForRecord(record);
    if (record.state === 'terminated' || record.state === 'expired') {
      return record;
    }

    const now = new Date().toISOString();
    this.finalizeRecord(record, 'terminated', reason, now, 'terminated');
    logInfo('EphemeralAgentManager', `Terminated ${id}: ${reason}`);
    return record;
  }

  async recordUsage(
    id: string,
    tokens: number,
    costUsd: number,
    steps = 1,
  ): Promise<EphemeralUsageResult> {
    const record = this.agents.get(id);
    if (!record) {
      return { killed: false };
    }

    this.syncApprovalStateForRecord(record);
    if (record.state !== 'running') {
      return { killed: false };
    }

    record.tokenUsed += tokens;
    record.costUsed += costUsd;
    record.stepsUsed += steps;

    const { spec } = record;
    if (spec.tokenBudget !== undefined && record.tokenUsed > spec.tokenBudget) {
      return this.handleBudgetExceeded(record, 'token', record.tokenUsed, spec.tokenBudget);
    }
    if (spec.costBudgetUsd !== undefined && record.costUsed > spec.costBudgetUsd) {
      return this.handleBudgetExceeded(record, 'cost', record.costUsed, spec.costBudgetUsd);
    }
    if (spec.stepBudget !== undefined && record.stepsUsed > spec.stepBudget) {
      return this.handleBudgetExceeded(record, 'step', record.stepsUsed, spec.stepBudget);
    }

    return { killed: false };
  }

  getAgent(id: string): EphemeralAgentRecord | undefined {
    const record = this.agents.get(id);
    if (!record) {
      return undefined;
    }

    this.syncApprovalStateForRecord(record);
    return record;
  }

  listAgents(state?: EphemeralAgentState): EphemeralAgentRecord[] {
    const all = Array.from(this.agents.values());
    all.forEach((record) => this.syncApprovalStateForRecord(record));
    return state ? all.filter((agent) => agent.state === state) : all;
  }

  getScopedRegistry(id: string): EphemeralScopedToolRegistry | null {
    const record = this.getAgent(id);
    if (!record) {
      return null;
    }

    return createScopedToolRegistryView(record);
  }

  clear(): void {
    for (const id of this.agents.keys()) {
      this.clearTimer(id);
    }
    this.agents.clear();
    this.timers.clear();
    this.postmortemRecorded.clear();
  }

  private armTimer(id: string, ttlMs: number): void {
    this.clearTimer(id);
    const timer = setTimeout(() => {
      void this.expire(id);
    }, ttlMs);
    this.timers.set(id, timer);
  }

  private async expire(id: string): Promise<void> {
    const record = this.agents.get(id);
    if (!record || record.state === 'terminated' || record.state === 'expired') {
      return;
    }

    const now = new Date().toISOString();
    this.finalizeRecord(record, 'expired', 'ttl_expired', now, 'expired');
    logWarn('EphemeralAgentManager', `Agent ${id} TTL expired`);
  }

  private finalizeRecord(
    record: EphemeralAgentRecord,
    state: Extract<EphemeralAgentState, 'terminated' | 'expired'>,
    reason: string,
    now: string,
    auditEvent: 'terminated' | 'expired',
  ): void {
    record.state = state;
    record.terminatedAt = now;
    record.terminationReason = reason;
    record.approval = undefined;
    record.auditTrail.push({ timestamp: now, event: auditEvent, detail: reason });

    this.clearTimer(record.id);
    this.publishTerminated(record, reason);
    this.recordPostmortem(record);
  }

  private recordPostmortem(record: EphemeralAgentRecord): void {
    if (this.postmortemRecorded.has(record.id)) {
      return;
    }

    generatePostmortem(record);
    this.postmortemRecorded.add(record.id);
  }

  private async handleBudgetExceeded(
    record: EphemeralAgentRecord,
    budgetType: EphemeralBudgetType,
    used: number,
    limit: number,
  ): Promise<EphemeralUsageResult> {
    const now = new Date().toISOString();
    record.lease = markBudgetExceeded(record.lease, budgetType, now, 'exceeded');
    record.auditTrail.push({
      timestamp: now,
      event: 'budget_exceeded',
      detail: `${budgetType}: ${used} > ${limit}`,
    });

    const action = resolveBudgetExceededAction(record.spec);
    if (action === 'require_approval' && canRequestBudgetApproval(record.lease)) {
      const workflow = await this.createBudgetApprovalWorkflow(record, budgetType, used, limit);
      if (workflow) {
        record.state = 'pending';
        record.lease = markBudgetExceeded(record.lease, budgetType, now, 'awaiting_approval');
        record.approval = this.toApprovalState(
          workflow,
          'budget',
          `Budget exceeded: ${budgetType} ${used} > ${limit}`,
          budgetType,
          used,
          limit,
        );
        record.auditTrail.push({ timestamp: now, event: 'budget_approval_requested', detail: workflow.workflowId });

        phoenixEventBus.publish('phoenix:ephemeral_budget_exceeded', {
          agentId: record.id,
          budgetType,
          used,
          limit,
          action: 'approval_requested',
          workflowId: workflow.workflowId,
          approvalRequestId: workflow.approvalRequestId,
          state: record.state,
          timestamp: now,
        });

        return { killed: false, reason: 'budget_approval_requested', approval: record.approval };
      }
    }

    phoenixEventBus.publish('phoenix:ephemeral_budget_exceeded', {
      agentId: record.id,
      budgetType,
      used,
      limit,
      action: 'terminated',
      state: 'terminated',
      timestamp: now,
    });
    this.finalizeRecord(record, 'terminated', `${budgetType}_budget_exceeded`, now, 'terminated');
    return { killed: true, reason: `${budgetType}_budget_exceeded` };
  }

  private async createBudgetApprovalWorkflow(
    record: EphemeralAgentRecord,
    budgetType: EphemeralBudgetType,
    used: number,
    limit: number,
  ): Promise<ApprovalWorkflow | null> {
    const now = new Date().toISOString();
    const decision: PolicyDecision = {
      actionClass: 'guarded',
      riskScore: 78,
      autonomyLevel: 'low',
      requiresApproval: true,
      reason: `Ephemeral agent budget exceeded: ${budgetType} ${used} > ${limit}`,
      guardrails: ['require_approval', 'ephemeral_lease_renewal'],
      auditResult: 'ALLOWED',
    };

    return approvalRouter.createWorkflowFromPolicy(decision, {
      event: {
        id: uuidv4(),
        source: 'ephemeral_manager',
        type: 'ephemeral.agent.budget_exceeded',
        priority: 'critical',
        riskHint: 'guarded',
        dedupKey: `ephemeral:budget:${record.id}:${budgetType}:${record.lease.renewalsUsed}`,
        payload: {
          agentId: record.id,
          purpose: record.spec.purpose,
          parentAgentName: record.spec.parentAgentName,
          budgetType,
          used,
          limit,
        },
        timestamp: now,
        metadata: { approvalKind: 'budget', ephemeralAgentId: record.id },
      },
      agentName: record.spec.parentAgentName,
      resource: `ephemeral:${record.id}:budget:${budgetType}`,
      timeoutMs: record.spec.leasePolicy?.approvalExtensionMs ?? DEFAULT_APPROVAL_TIMEOUT_MS,
    });
  }

  private async createApprovalWorkflow(
    record: EphemeralAgentRecord,
    decision: PolicyDecision,
    kind: EphemeralApprovalState['kind'],
  ): Promise<ApprovalWorkflow | null> {
    const now = new Date().toISOString();

    return approvalRouter.createWorkflowFromPolicy(decision, {
      event: {
        id: uuidv4(),
        source: 'ephemeral_manager',
        type: kind === 'spawn' ? 'ephemeral.agent.spawn_approval' : 'ephemeral.agent.budget_approval',
        priority: kind === 'spawn' ? 'medium' : 'critical',
        riskHint: 'guarded',
        dedupKey: `ephemeral:${kind}:${record.id}`,
        payload: {
          agentId: record.id,
          purpose: record.spec.purpose,
          parentAgentName: record.spec.parentAgentName,
        },
        timestamp: now,
        metadata: { approvalKind: kind, ephemeralAgentId: record.id },
      },
      agentName: record.spec.parentAgentName,
      resource: `ephemeral:${record.id}:${kind}`,
      timeoutMs: DEFAULT_APPROVAL_TIMEOUT_MS,
    });
  }

  private toApprovalState(
    workflow: ApprovalWorkflow,
    kind: EphemeralApprovalState['kind'],
    reason: string,
    budgetType?: EphemeralBudgetType,
    used?: number,
    limit?: number,
  ): EphemeralApprovalState {
    return {
      kind,
      workflowId: workflow.workflowId,
      approvalRequestId: workflow.approvalRequestId,
      requestedAt: workflow.createdAt,
      reason,
      budgetType,
      used,
      limit,
    };
  }

  private syncApprovalStateForRecord(record: EphemeralAgentRecord): void {
    if (!record.approval) {
      return;
    }

    const workflow = approvalRouter.getWorkflow(record.approval.workflowId);
    if (!workflow || workflow.status === 'pending') {
      return;
    }

    const now = new Date().toISOString();
    const approval = record.approval;

    if (workflow.status === 'approved') {
      if (approval.kind === 'spawn') {
        record.state = 'running';
        record.lease = {
          ...record.lease,
          expiresAt: new Date(Date.parse(now) + record.lease.ttlMs).toISOString(),
          budgetStatus: 'healthy',
        };
        this.armTimer(record.id, record.lease.ttlMs);
        record.auditTrail.push({ timestamp: now, event: 'spawn_approval_granted', detail: workflow.workflowId });
      } else {
        record.state = 'running';
        record.lease = renewLease(record.lease, record.spec, now);
        if (shouldResetBudgetsOnRenew(record.spec)) {
          record.tokenUsed = 0;
          record.costUsed = 0;
          record.stepsUsed = 0;
        }
        this.armTimer(record.id, record.lease.ttlMs);
        record.auditTrail.push({ timestamp: now, event: 'budget_approval_granted', detail: workflow.workflowId });
      }

      record.approval = undefined;
      return;
    }

    const denialReason = approval.kind === 'spawn'
      ? `spawn_approval_${workflow.status}`
      : `budget_approval_${workflow.status}`;

    this.finalizeRecord(record, 'terminated', denialReason, now, 'terminated');
  }

  private publishTerminated(record: EphemeralAgentRecord, reason: string): void {
    const timestamp = record.terminatedAt ?? new Date().toISOString();
    phoenixEventBus.publish('phoenix:ephemeral_terminated', {
      agentId: record.id,
      parentAgentName: record.spec.parentAgentName,
      reason,
      state: record.state,
      tokenUsed: record.tokenUsed,
      costUsed: record.costUsed,
      stepsUsed: record.stepsUsed,
      timestamp,
    });
  }

  private clearTimer(id: string): void {
    const timer = this.timers.get(id);
    if (timer !== undefined) {
      clearTimeout(timer);
      this.timers.delete(id);
    }
  }
}

export const ephemeralAgentManager = new EphemeralAgentManager();
export default ephemeralAgentManager;
