import { approvalRouter } from './approvalRouter.js';
import {
  createApprovalResumeEnvelope,
  createHealthStatusEventEnvelope,
  eventFabric,
  type EventEnvelope,
} from './eventFabric.js';
import { evaluateAndLogPolicy } from './policyEngine.js';
import {
  phoenixEventBus,
  type PhoenixApprovalResolvedEvent,
  type PhoenixDegradedEvent,
  type PhoenixEdgeHealthEvent,
  type PhoenixEventFabricSignalEvent,
  type PhoenixRecoveryEvent,
} from './phoenixEventBus.js';
import { logInfo } from '../utils/logger.js';

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
    const decision = await evaluateAndLogPolicy({
      event: event.envelope,
      agentName: 'ZeroPromptRuntime',
      resource: getResourceFromEnvelope(event.envelope),
    });

    if (decision.requiresApproval) {
      await approvalRouter.createWorkflowFromPolicy(decision, {
        event: event.envelope,
        agentName: 'ZeroPromptRuntime',
        resource: getResourceFromEnvelope(event.envelope),
      });
    }
  };

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