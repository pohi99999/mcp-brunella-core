import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import { approvalManager, type ApprovalAction, type ApprovalRequest } from '../utils/approvalManager.js';
import type { EventEnvelope } from './eventFabric.js';
import type { PolicyDecision } from './policyEngine.js';
import { phoenixEventBus } from './phoenixEventBus.js';
import { notificationChannels } from './notificationChannels.js';
import {
  clearApprovalWorkflows,
  loadApprovalWorkflows,
  saveApprovalWorkflow,
} from './autonomyRuntimeStore.js';

export type ApprovalWorkflowStatus = ApprovalRequest['status'];

export interface ApprovalWorkflow {
  workflowId: string;
  approvalRequestId: string;
  eventId: string;
  status: ApprovalWorkflowStatus;
  createdAt: string;
  updatedAt: string;
  respondedAt?: string;
  timeoutMs: number;
  eventType: string;
  source: string;
  agentName?: string;
  resource?: string;
  decision: PolicyDecision;
  response?: unknown;
  eventPayload: unknown;
  eventMetadata?: Record<string, unknown>;
  callback: {
    token: string;
    approveUrl: string;
    rejectUrl: string;
  };
}

export interface ApprovalWorkflowContext {
  event: EventEnvelope;
  agentName?: string;
  resource?: string;
  timeoutMs?: number;
}

type ResolvedApprovalWorkflow = ApprovalWorkflow & {
  status: Exclude<ApprovalWorkflowStatus, 'pending'>;
};

const DEFAULT_APPROVAL_TIMEOUT_MS = 15 * 60 * 1000;
const DEFAULT_CALLBACK_SECRET = 'brunella-dev-approval-secret';
const DEFAULT_CALLBACK_BASE = 'http://localhost:3000/api/v1/developer';

function getResolutionAction(status: Exclude<ApprovalWorkflowStatus, 'pending'>): 'approve' | 'reject' | 'expire' {
  if (status === 'approved') {
    return 'approve';
  }

  if (status === 'rejected') {
    return 'reject';
  }

  return 'expire';
}

class ApprovalRouter {
  private workflows = new Map<string, ApprovalWorkflow>();
  private approvalRequestToWorkflow = new Map<string, string>();
  private hydrated = false;

  private getCallbackSecret(): string {
    return process.env.APPROVAL_CALLBACK_SECRET || DEFAULT_CALLBACK_SECRET;
  }

  private getCallbackBaseUrl(): string {
    return (process.env.APPROVAL_CALLBACK_BASE_URL || DEFAULT_CALLBACK_BASE).replace(/\/$/, '');
  }

  private generateCallbackToken(approvalRequestId: string): string {
    return crypto
      .createHmac('sha256', this.getCallbackSecret())
      .update(approvalRequestId)
      .digest('hex');
  }

  verifyCallbackToken(approvalRequestId: string, token: string): boolean {
    const expected = this.generateCallbackToken(approvalRequestId);

    try {
      return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(token));
    } catch {
      return false;
    }
  }

  private createCallbackUrls(approvalRequestId: string): ApprovalWorkflow['callback'] {
    const token = this.generateCallbackToken(approvalRequestId);
    const baseUrl = `${this.getCallbackBaseUrl()}/approval/${encodeURIComponent(approvalRequestId)}/callback`;

    return {
      token,
      approveUrl: `${baseUrl}?action=approve&token=${token}`,
      rejectUrl: `${baseUrl}?action=reject&token=${token}`,
    };
  }

  private ensureHydrated(): void {
    if (this.hydrated) {
      return;
    }

    const restored = loadApprovalWorkflows();
    for (const workflow of restored) {
      this.workflows.set(workflow.workflowId, workflow);
      this.approvalRequestToWorkflow.set(workflow.approvalRequestId, workflow.workflowId);
    }
    this.hydrated = true;
  }

  hydrateFromStore(): number {
    this.ensureHydrated();
    this.refreshPendingWorkflows();
    return this.workflows.size;
  }

  private persistWorkflow(workflow: ApprovalWorkflow): void {
    saveApprovalWorkflow(workflow);
  }

  async createWorkflowFromPolicy(
    decision: PolicyDecision,
    context: ApprovalWorkflowContext,
  ): Promise<ApprovalWorkflow | null> {
    this.ensureHydrated();
    if (!decision.requiresApproval) {
      return null;
    }

    const timeoutMs = context.timeoutMs ?? DEFAULT_APPROVAL_TIMEOUT_MS;
    const description = `[${context.event.type}] ${decision.reason}`;
    const approvalRequestId = await approvalManager.requestApproval(
      'critical_action',
      description,
      {
        source: 'zero-prompt',
        eventId: context.event.id,
        eventType: context.event.type,
        sourceName: context.event.source,
        decision,
        agentName: context.agentName,
        resource: context.resource,
      },
      timeoutMs,
    );

    const now = new Date().toISOString();
    const callback = this.createCallbackUrls(approvalRequestId);
    const workflow: ApprovalWorkflow = {
      workflowId: uuidv4(),
      approvalRequestId,
      eventId: context.event.id,
      status: 'pending',
      createdAt: now,
      updatedAt: now,
      timeoutMs,
      eventType: context.event.type,
      source: context.event.source,
      agentName: context.agentName,
      resource: context.resource,
      decision,
      eventPayload: context.event.payload,
      eventMetadata: context.event.metadata,
      callback,
    };

    this.workflows.set(workflow.workflowId, workflow);
    this.approvalRequestToWorkflow.set(approvalRequestId, workflow.workflowId);
    this.persistWorkflow(workflow);

    phoenixEventBus.publish('phoenix:approval_requested', {
      workflowId: workflow.workflowId,
      approvalRequestId,
      eventType: context.event.type,
      source: context.event.source,
      reason: decision.reason,
      timeoutMs,
      timestamp: now,
    });

    await notificationChannels.dispatchApprovalRequested(workflow);

    return workflow;
  }

  registerExternalResponse(
    approvalRequestId: string,
    action: ApprovalAction,
    response?: unknown,
  ): ApprovalWorkflow | null {
    this.ensureHydrated();
    const workflow = this.getWorkflowByApprovalRequestId(approvalRequestId);
    if (!workflow) {
      return null;
    }

    const now = new Date().toISOString();
    workflow.status = action === 'approve' ? 'approved' : 'rejected';
    workflow.updatedAt = now;
    workflow.respondedAt = now;
    workflow.response = response;
    this.persistWorkflow(workflow);

    void this.propagateResolvedWorkflow(workflow as ResolvedApprovalWorkflow, action);

    return workflow;
  }

  syncWithApprovalManager(approvalRequestId: string): ApprovalWorkflow | null {
    this.ensureHydrated();
    const workflow = this.getWorkflowByApprovalRequestId(approvalRequestId);
    if (!workflow) {
      return null;
    }

    const request = approvalManager.getRequest(approvalRequestId);
    if (!request) {
      return workflow;
    }

    const previousStatus = workflow.status;
    const previousRespondedAt = workflow.respondedAt;
    const now = new Date().toISOString();

    // Check expiry based on timeoutMs before trusting the request status
    const elapsedMs = new Date(now).getTime() - new Date(workflow.createdAt).getTime();
    if (request.status === 'pending' && elapsedMs > workflow.timeoutMs) {
      workflow.status = 'expired';
    } else {
      workflow.status = request.status;
    }
    workflow.updatedAt = now;
    if (request.respondedAt) {
      workflow.respondedAt = new Date(request.respondedAt).toISOString();
      workflow.response = request.response;
    } else if (workflow.status === 'expired') {
      workflow.respondedAt = workflow.respondedAt ?? now;
    }

    if (previousStatus !== workflow.status && workflow.status !== 'pending') {
      if (!previousRespondedAt && workflow.status === 'expired') {
        workflow.respondedAt = workflow.respondedAt ?? now;
      }

      const resolvedWorkflow = workflow as ResolvedApprovalWorkflow;
      void this.propagateResolvedWorkflow(resolvedWorkflow, getResolutionAction(resolvedWorkflow.status));
    }

    this.persistWorkflow(workflow);

    return workflow;
  }

  refreshWorkflow(workflowId: string): ApprovalWorkflow | null {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) {
      return null;
    }

    return this.syncWithApprovalManager(workflow.approvalRequestId);
  }

  refreshPendingWorkflows(): void {
    for (const workflow of this.workflows.values()) {
      if (workflow.status === 'pending') {
        this.syncWithApprovalManager(workflow.approvalRequestId);
      }
    }
  }

  listWorkflows(status?: ApprovalWorkflowStatus): ApprovalWorkflow[] {
    this.ensureHydrated();
    this.refreshPendingWorkflows();
    const all = Array.from(this.workflows.values()).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return status ? all.filter((workflow) => workflow.status === status) : all;
  }

  getWorkflow(workflowId: string): ApprovalWorkflow | undefined {
    this.ensureHydrated();
    const workflow = this.workflows.get(workflowId);
    if (workflow?.status === 'pending') {
      this.syncWithApprovalManager(workflow.approvalRequestId);
    }
    return workflow;
  }

  getWorkflowByApprovalRequestId(approvalRequestId: string): ApprovalWorkflow | null {
    this.ensureHydrated();
    const workflowId = this.approvalRequestToWorkflow.get(approvalRequestId);
    if (!workflowId) {
      return null;
    }
    return this.workflows.get(workflowId) ?? null;
  }

  clear(): void {
    this.workflows.clear();
    this.approvalRequestToWorkflow.clear();
    this.hydrated = true;
    clearApprovalWorkflows();
  }

  respondToWorkflowByRequestId(
    approvalRequestId: string,
    action: ApprovalAction,
    response?: unknown,
  ): ApprovalWorkflow | null {
    this.ensureHydrated();
    const success = approvalManager.respond(approvalRequestId, action, response);
    if (!success) {
      return null;
    }

    return this.registerExternalResponse(approvalRequestId, action, response);
  }

  private async propagateResolvedWorkflow(
    workflow: ResolvedApprovalWorkflow,
    action: 'approve' | 'reject' | 'expire',
  ): Promise<void> {
    this.persistWorkflow(workflow);
    phoenixEventBus.publish('phoenix:approval_resolved', {
      workflowId: workflow.workflowId,
      approvalRequestId: workflow.approvalRequestId,
      status: workflow.status,
      action,
      response: workflow.response,
      resumeEventType: workflow.status === 'approved' ? 'approval.workflow.approved' : undefined,
      timestamp: workflow.respondedAt ?? workflow.updatedAt,
    });

    await notificationChannels.dispatchApprovalResolved(workflow);
  }
}

export const approvalRouter = new ApprovalRouter();

export default approvalRouter;
