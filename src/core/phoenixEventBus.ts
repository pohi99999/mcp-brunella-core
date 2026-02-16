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
import { logInfo, logError } from '../utils/logger.js';

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

export type PhoenixEventMap = {
  'phoenix:agent_failed': PhoenixAgentFailedEvent;
  'phoenix:failover_triggered': PhoenixFailoverTriggeredEvent;
  'phoenix:failover_result': PhoenixFailoverResultEvent;
  'phoenix:edge_health': PhoenixEdgeHealthEvent;
  'phoenix:circuit_breaker': PhoenixCircuitBreakerEvent;
  'phoenix:recovery': PhoenixRecoveryEvent;
  'phoenix:restart': PhoenixRestartEvent;
  'phoenix:state_restored': PhoenixStateRestoredEvent;
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
    // 1. Local EventEmitter subscribers
    this.emit(event, data);

    // 2. Socket.IO broadcast to dashboard
    if (this.socketBroadcaster) {
      this.socketBroadcaster(event, data);
    }

    // 3. Event history ring buffer
    this.eventHistory.push({
      event,
      data,
      timestamp: (data as { timestamp?: string }).timestamp || new Date().toISOString(),
    });
    if (this.eventHistory.length > MAX_EVENT_HISTORY) {
      this.eventHistory.splice(0, this.eventHistory.length - MAX_EVENT_HISTORY);
    }

    logInfo('PhoenixEventBus', `Event: ${event}`);
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
