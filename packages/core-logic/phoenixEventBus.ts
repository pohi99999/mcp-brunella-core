/**
 * PhoenixEventBus - Unified Pub/Sub Event System
 *
 * Connects isolated event systems (logger EventEmitter, Socket.IO, agent events)
 * into a single, typed event bus for Phoenix Protocol Szint 4-5.
 *
 * Events:
 *   phoenix:agent_failed      - Agent failed after all retries exhausted
 *   phoenix:failover_triggered - Cross-agent failover initiated
 *   phoenix:failover_result   - Failover completed (success or final failure)
 *   phoenix:edge_health       - Edge health status changed
 *   phoenix:circuit_breaker   - Circuit breaker state change
 *   phoenix:recovery          - Recovery event (crash, restart, git_checkpoint)
 *
 * @version 1.0.0
 */

import { EventEmitter } from 'events';
import type { RemediationRunStatus } from './remediationRuntime.types.js';
import { logInfo, logError } from '@packages/utils/logger.js';

// ============================================================================
// EVENT TYPES
// ============================================================================

export interface PhoenixAgentFailedEvent {
  agentName: string;
  taskInstruction: string;
  taskContext?: Record<string, unknown>;
  error: string;
  retriesExhausted: number;
  timestamp: string;
}

export interface PhoenixFailoverTriggeredEvent {
  originalAgent: string;
  fallbackAgent: string;
  taskInstruction: string;
  attempt: number;
  timestamp: string;
}

export interface PhoenixFailoverResultEvent {
  originalAgent: string;
  fallbackAgent: string;
  taskInstruction: string;
  success: boolean;
  error?: string;
  executionTimeMs: number;
  timestamp: string;
}

export interface PhoenixEdgeHealthEvent {
  status: 'healthy' | 'degraded' | 'offline';
  previousStatus: 'healthy' | 'degraded' | 'offline';
  latencyMs: number;
  timestamp: string;
}

export interface PhoenixCircuitBreakerEvent {
  agentName: string;
  state: 'open' | 'closed' | 'half-open';
  previousState: 'open' | 'closed' | 'half-open';
  failures: number;
  timestamp: string;
}

export interface PhoenixRecoveryEvent {
  type: 'crash' | 'restart' | 'git_checkpoint' | 'failover';
  agent: string;
  details: string;
  timestamp: string;
}

export interface PhoenixRestartEvent {
  serviceName: string;
  success: boolean;
  error?: string;
  timestamp: string;
}

export interface PhoenixStateRestoredEvent {
  agentName: string;
  taskId: string;
  stepIndex: number;
  stepName: string;
  timestamp: string;
}

export interface PhoenixDegradedEvent {
  level: 'full' | 'partial' | 'minimal' | 'offline';
  services: string[];
  message: string;
  timestamp: string;
}

export interface PhoenixEventFabricSignalEvent {
  envelope: {
    id: string;
    source: string;
    type: string;
    priority: 'critical' | 'high' | 'medium' | 'low';
    riskHint?: 'safe' | 'guarded' | 'dangerous';
    dedupKey: string;
    payload: unknown;
    metadata?: Record<string, unknown>;
    timestamp: string;
  };
  source: string;
  eventType: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  riskHint: 'safe' | 'guarded' | 'dangerous';
  timestamp: string;
}

export interface PhoenixPolicyDecisionEvent {
  source: string;
  eventType: string;
  actionClass: 'safe' | 'guarded' | 'dangerous';
  riskScore: number;
  autonomyLevel: 'low' | 'medium' | 'high';
  requiresApproval: boolean;
  guardrails: string[];
  reason: string;
  riskHint: 'safe' | 'guarded' | 'dangerous';
  timestamp: string;
}

export interface PhoenixApprovalRequestedEvent {
  workflowId: string;
  approvalRequestId: string;
  eventType: string;
  source: string;
  reason: string;
  timeoutMs: number;
  timestamp: string;
}

export interface PhoenixApprovalResolvedEvent {
  workflowId: string;
  approvalRequestId: string;
  status: 'approved' | 'rejected' | 'expired';
  action: 'approve' | 'reject' | 'expire';
  response?: unknown;
  resumeEventType?: string;
  timestamp: string;
}

export interface PhoenixRemediationRunUpdatedEvent {
  runId: string;
  status: RemediationRunStatus;
  repositoryName: string;
  workflowRunId?: string;
  failureReason?: string;
  updatedAt: string;
  timestamp: string;
}

export interface PhoenixEphemeralSpawnedEvent {
  agentId: string;
  parentAgentName: string;
  purpose: string;
  allowedTools: string[];
  deniedTools?: string[];
  allowedPaths?: string[];
  allowedHosts?: string[];
  ttlMs: number;
  state: string;
  timestamp: string;
}

export interface PhoenixEphemeralTerminatedEvent {
  agentId: string;
  parentAgentName: string;
  reason: string;
  state: string;
  tokenUsed: number;
  costUsed: number;
  stepsUsed: number;
  timestamp: string;
}

export interface PhoenixEphemeralBudgetExceededEvent {
  agentId: string;
  budgetType: 'token' | 'cost' | 'step';
  used: number;
  limit: number;
  action?: 'terminated' | 'approval_requested' | 'renewed';
  workflowId?: string;
  approvalRequestId?: string;
  state?: string;
  timestamp: string;
}

export interface PhoenixEphemeralToolViolationEvent {
  agentId: string;
  parentAgentName: string;
  toolName: string;
  allowedTools: string[];
  violationType?: 'tool' | 'file' | 'network' | 'composition';
  target?: string;
  reason?: string;
  chainId?: string;
  timestamp: string;
}

export interface PhoenixFederationPeerRegisteredEvent {
  peerId: string;
  displayName: string;
  endpoint: string;
  trustState: string;
  timestamp: string;
}

export interface PhoenixFederationPeerRevokedEvent {
  peerId: string;
  displayName: string;
  reason: string;
  timestamp: string;
}

export interface PhoenixFederationManifestIssuedEvent {
  manifestId: string;
  peerId: string;
  capabilityCount: number;
  expiresAt: string;
  timestamp: string;
}

export interface PhoenixFederationRouteRequestedEvent {
  requestId: string;
  capabilityName: string;
  preferredPeerId: string | null;
  timestamp: string;
}

export interface PhoenixFederationRouteResolvedEvent {
  requestId: string;
  capabilityName: string;
  selectedPeer: string | null;
  candidateCount: number;
  fallbackUsed: boolean;
  timestamp: string;
}

export interface PhoenixFederationNegotiationStartedEvent {
  sessionId: string;
  fromPeerId: string;
  toPeerId: string;
  capabilityCount: number;
  requiresApproval: boolean;
  timestamp: string;
}

export interface PhoenixFederationNegotiationCompletedEvent {
  sessionId: string;
  outcome: 'accepted' | 'rejected';
  agreedCapabilities: string[];
  timestamp: string;
}

export interface PhoenixFederationRuntimeKeyStagedEvent {
  peerId: string;
  keyId: string;
  previousCurrentKeyId: string | null;
  timestamp: string;
}

export interface PhoenixFederationRuntimeKeyPromotedEvent {
  peerId: string;
  keyId: string;
  previousCurrentKeyId: string | null;
  reason: string | null;
  timestamp: string;
}

export interface PhoenixTaskCompletedEvent {
  taskId: string;
  agentName: string;
  result?: unknown;
  timestamp: string;
}

export interface PhoenixTaskFailedEvent {
  taskId: string;
  agentName: string;
  error?: string;
  timestamp: string;
}

export interface PhoenixTaskTimeoutEvent {
  taskId: string;
  agentName: string;
  timestamp: string;
}

export type PhoenixEventMap = {
  'phoenix:agent_failed': PhoenixAgentFailedEvent;
  'phoenix:failover_triggered': PhoenixFailoverTriggeredEvent;
  'phoenix:failover_result': PhoenixFailoverResultEvent;
  'phoenix:edge_health': PhoenixEdgeHealthEvent;
  'phoenix:circuit_breaker': PhoenixCircuitBreakerEvent;
  'phoenix:recovery': PhoenixRecoveryEvent;
  'phoenix:restart': PhoenixRestartEvent;
  'phoenix:state_restored': PhoenixStateRestoredEvent;
  'phoenix:degraded': PhoenixDegradedEvent;
  'phoenix:event_fabric_signal': PhoenixEventFabricSignalEvent;
  'phoenix:policy_decision': PhoenixPolicyDecisionEvent;
  'phoenix:approval_requested': PhoenixApprovalRequestedEvent;
  'phoenix:approval_resolved': PhoenixApprovalResolvedEvent;
  'phoenix:remediation_run_updated': PhoenixRemediationRunUpdatedEvent;
  'phoenix:ephemeral_spawned': PhoenixEphemeralSpawnedEvent;
  'phoenix:ephemeral_terminated': PhoenixEphemeralTerminatedEvent;
  'phoenix:ephemeral_budget_exceeded': PhoenixEphemeralBudgetExceededEvent;
  'phoenix:ephemeral_tool_violation': PhoenixEphemeralToolViolationEvent;
  'phoenix:federation_peer_registered': PhoenixFederationPeerRegisteredEvent;
  'phoenix:federation_peer_revoked': PhoenixFederationPeerRevokedEvent;
  'phoenix:federation_manifest_issued': PhoenixFederationManifestIssuedEvent;
  'phoenix:federation_route_requested': PhoenixFederationRouteRequestedEvent;
  'phoenix:federation_route_resolved': PhoenixFederationRouteResolvedEvent;
  'phoenix:federation_negotiation_started': PhoenixFederationNegotiationStartedEvent;
  'phoenix:federation_negotiation_completed': PhoenixFederationNegotiationCompletedEvent;
  'phoenix:federation_runtime_key_staged': PhoenixFederationRuntimeKeyStagedEvent;
  'phoenix:federation_runtime_key_promoted': PhoenixFederationRuntimeKeyPromotedEvent;
  'task:completed': PhoenixTaskCompletedEvent;
  'task:failed': PhoenixTaskFailedEvent;
  'task:timeout': PhoenixTaskTimeoutEvent;
};

export type PhoenixEventName = keyof PhoenixEventMap;

// ============================================================================
// EVENT BUS
// ============================================================================

/** Maximum events to keep in history ring buffer */
const MAX_EVENT_HISTORY = 200;

class PhoenixEventBusClass extends EventEmitter {
  private eventHistory: Array<{ event: string; data: unknown; timestamp: string }> = [];
  private socketBroadcaster: ((event: string, data: unknown) => void) | null = null;

  constructor() {
    super();
    this.setMaxListeners(50);
  }

  /**
   * Connect Socket.IO broadcaster so all phoenix events are also sent to the dashboard.
   */
  connectSocketBroadcaster(broadcaster: (event: string, data: unknown) => void): void {
    this.socketBroadcaster = broadcaster;
    logInfo('PhoenixEventBus', 'Socket.IO broadcaster connected');
  }

  /**
   * Publish a typed event to all subscribers + Socket.IO + history.
   */
  publish<K extends PhoenixEventName>(event: K, data: PhoenixEventMap[K]): void {
    // 1. Local EventEmitter subscribers (synchronous — handlers are called immediately)
    try {
      this.emit(event, data);
    } catch (err) {
      logError('PhoenixEventBus', `Error in event handler for ${event}: ${err instanceof Error ? err.message : String(err)}`);
    }

    // 2. Socket.IO broadcast to dashboard
    if (this.socketBroadcaster) {
      try {
        this.socketBroadcaster(event, data);
      } catch (err) {
        logError('PhoenixEventBus', `Error in socket broadcaster for ${event}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    // 3. Event history ring buffer (synchronous - fast operation)
    this.eventHistory.push({
      event,
      data,
      timestamp: (data as { timestamp?: string }).timestamp || new Date().toISOString(),
    });
    if (this.eventHistory.length > MAX_EVENT_HISTORY) {
      this.eventHistory.splice(0, this.eventHistory.length - MAX_EVENT_HISTORY);
    }

    logInfo('PhoenixEventBus', `Event queued: ${event}`);
  }

  /**
   * Subscribe to a typed event.
   */
  subscribe<K extends PhoenixEventName>(
    event: K,
    handler: (data: PhoenixEventMap[K]) => void,
  ): void {
    this.on(event, handler);
  }

  /**
   * Unsubscribe from a typed event.
   */
  unsubscribe<K extends PhoenixEventName>(
    event: K,
    handler: (data: PhoenixEventMap[K]) => void,
  ): void {
    this.off(event, handler);
  }

  /**
   * Get recent event history, optionally filtered by event type.
   */
  getHistory(eventFilter?: string, limit = 50): Array<{ event: string; data: unknown; timestamp: string }> {
    const filtered = eventFilter
      ? this.eventHistory.filter((e) => e.event === eventFilter)
      : this.eventHistory;
    return filtered.slice(-limit);
  }

  /**
   * Get summary statistics of events.
   */
  getStats(): Record<string, number> {
    const stats: Record<string, number> = {};
    for (const entry of this.eventHistory) {
      stats[entry.event] = (stats[entry.event] || 0) + 1;
    }
    return stats;
  }

  /**
   * Clear event history.
   */
  clearHistory(): void {
    this.eventHistory = [];
  }
}

export const phoenixEventBus = new PhoenixEventBusClass();
export default phoenixEventBus;

