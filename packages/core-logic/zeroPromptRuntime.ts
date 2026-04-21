import { approvalRouter } from './approvalRouter.js';
import { ephemeralAgentManager } from './ephemeralAgentManager.js';
import {
  createApprovalResumeEnvelope,
  createHealthStatusEventEnvelope,
  eventFabric,
  type EventEnvelope,
} from './eventFabric.js';
import { evaluateAndLogPolicy, type PolicyDecision } from './policyEngine.js';
import {
  phoenixEventBus,
  type PhoenixApprovalResolvedEvent,
  type PhoenixDegradedEvent,
  type PhoenixEdgeHealthEvent,
  type PhoenixEventFabricSignalEvent,
  type PhoenixRecoveryEvent,
} from './phoenixEventBus.js';
import { logInfo, logWarn } from '@packages/utils/logger.js';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function getResourceFromEnvelope(envelope: EventEnvelope): string | undefined {
  if (typeof envelope.metadata?.resource === 'string') {
    return envelope.metadata.resource;
  }

  if (isRecord(envelope.payload) && typeof envelope.payload.resource === 'string') {
    return envelope.payload.resource;
  }

  if (isRecord(envelope.payload) && typeof envelope.payload.repositoryName === 'string') {
    return envelope.payload.repositoryName;
  }

  return undefined;
}

class ZeroPromptRuntime {
  private started = false;

  private readonly onEventFabricSignal = async (event: PhoenixEventFabricSignalEvent): Promise<void> => {
    const resource = getResourceFromEnvelope(event.envelope);
    const decision = await evaluateAndLogPolicy({
      event: event.envelope,
      agentName: 'ZeroPromptRuntime',
      resource,
    });

    await this.routeDecision(decision, event.envelope, resource);
  };

  /**
   * Three-way policy routing:
   *   1. safe   + requiresApproval=false → auto-spawn ephemeral agent
   *   2. guarded + requiresApproval=true  → create approval workflow
   *   3. dangerous                        → emit escalation event (block spawn)
   *
   * Track: brunella_zero_prompt_ephemeral_bridge_20260402
   */
  private async routeDecision(
    decision: PolicyDecision,
    envelope: EventEnvelope,
    resource: string | undefined,
  ): Promise<void> {
    // Branch 3 — Escalation (dangerous events are blocked, operator notified)
    if (decision.actionClass === 'dangerous') {
      logWarn(
        'ZeroPromptRuntime',
        `[ESCALATION] Dangerous event blocked: type=${envelope.type}, resource=${resource ?? 'n/a'}, reason=${decision.reason}`,
      );
      eventFabric.publish(
        createHealthStatusEventEnvelope({
          kind: 'degraded',
          services: [resource ?? envelope.source ?? 'unknown'],
          level: 'minimal',
          message: `Zero-Prompt escalation: ${decision.reason}`,
          timestamp: new Date().toISOString(),
        }),
      );
      return;
    }

    // Branch 2 — Approval required (guarded events need human review)
    if (decision.requiresApproval) {
      await approvalRouter.createWorkflowFromPolicy(decision, {
        event: envelope,
        agentName: 'ZeroPromptRuntime',
        resource,
      });
      logInfo(
        'ZeroPromptRuntime',
        `[APPROVAL] Workflow created for event type=${envelope.type}, resource=${resource ?? 'n/a'}`,
      );
      return;
    }

    // Branch 1 — Auto-spawn (safe events trigger a scoped ephemeral agent)
    const guardrailTools = this.deriveAllowedTools(decision.guardrails);
    const record = await ephemeralAgentManager.spawn({
      parentAgentName: 'ZeroPromptRuntime',
      purpose: `Auto-spawn for event: ${envelope.type} — ${decision.reason}`,
      allowedTools: guardrailTools,
      ttlMs: 3 * 60 * 1000, // 3 min max
      tokenBudget: 2000,
      costBudgetUsd: 0.05,
      metadata: {
        eventType: envelope.type,
        eventSource: envelope.source,
        resource: resource ?? null,
        riskScore: decision.riskScore,
        autonomyLevel: decision.autonomyLevel,
        spawnedBy: 'ZeroPromptRuntime',
      },
    });
    logInfo(
      'ZeroPromptRuntime',
      `[AUTO-SPAWN] Ephemeral agent ${record.id} spawned for event=${envelope.type}, tools=[${guardrailTools.join(', ')}]`,
    );
  }

  /**
   * Derive the allowed tool set from policy guardrails.
   * Maps guardrail strings to concrete whitelisted tool names.
   */
  private deriveAllowedTools(guardrails: string[]): string[] {
    const toolMap: Record<string, string[]> = {
      spawn_triage_agent: ['agent_delegate', 'log_message'],
      spawn_ephemeral_fixer: ['file_read', 'file_write', 'run_command', 'agent_delegate'],
      allow_code_review: ['file_read', 'log_message'],
      audit_only: ['log_message'],
      observe_only: ['log_message'],
    };
    const tools = new Set<string>();
    for (const g of guardrails) {
      for (const t of toolMap[g] ?? []) tools.add(t);
    }
    // Always emit log_message as a baseline
    tools.add('log_message');
    return [...tools];
  }

  private readonly onDegraded = (event: PhoenixDegradedEvent): void => {
    eventFabric.publish(
      createHealthStatusEventEnvelope({
        kind: 'degraded',
        services: event.services,
        level: event.level,
        message: event.message,
        timestamp: event.timestamp,
      }),
    );
  };

  private readonly onRecovery = (event: PhoenixRecoveryEvent): void => {
    eventFabric.publish(
      createHealthStatusEventEnvelope({
        kind: 'recovery',
        serviceName: event.agent,
        details: event.details,
        timestamp: event.timestamp,
      }),
    );
  };

  private readonly onEdgeHealth = (event: PhoenixEdgeHealthEvent): void => {
    eventFabric.publish(
      createHealthStatusEventEnvelope({
        kind: 'edge_health',
        status: event.status,
        previousStatus: event.previousStatus,
        latencyMs: event.latencyMs,
        timestamp: event.timestamp,
      }),
    );
  };

  private readonly onApprovalResolved = (event: PhoenixApprovalResolvedEvent): void => {
    if (event.status !== 'approved') {
      return;
    }

    const workflow = approvalRouter.getWorkflow(event.workflowId);
    if (!workflow || workflow.status !== 'approved') {
      return;
    }

    eventFabric.publish(createApprovalResumeEnvelope(workflow));
  };

  start(): void {
    if (this.started) {
      return;
    }

    this.started = true;
    phoenixEventBus.subscribe('phoenix:event_fabric_signal', this.onEventFabricSignal);
    phoenixEventBus.subscribe('phoenix:degraded', this.onDegraded);
    phoenixEventBus.subscribe('phoenix:recovery', this.onRecovery);
    phoenixEventBus.subscribe('phoenix:edge_health', this.onEdgeHealth);
    phoenixEventBus.subscribe('phoenix:approval_resolved', this.onApprovalResolved);
    logInfo('ZeroPromptRuntime', 'Zero-Prompt runtime started');
  }

  stop(): void {
    if (!this.started) {
      return;
    }

    phoenixEventBus.unsubscribe('phoenix:event_fabric_signal', this.onEventFabricSignal);
    phoenixEventBus.unsubscribe('phoenix:degraded', this.onDegraded);
    phoenixEventBus.unsubscribe('phoenix:recovery', this.onRecovery);
    phoenixEventBus.unsubscribe('phoenix:edge_health', this.onEdgeHealth);
    phoenixEventBus.unsubscribe('phoenix:approval_resolved', this.onApprovalResolved);
    this.started = false;
  }

  isActive(): boolean {
    return this.started;
  }
}

export const zeroPromptRuntime = new ZeroPromptRuntime();

export default zeroPromptRuntime;
