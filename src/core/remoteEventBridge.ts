/**
 * Remote Event Bridge — UnifiedEventBridge
 * Phase 3: Mobile, Voice & Deep PAIOS Integration
 *
 * Collects agent, tool, device and system events and broadcasts them to
 * all subscribed remote sessions via a simple EventEmitter pub/sub model.
 *
 * Usage:
 *   remoteEventBridge.publish({ type: 'agent:status', source: 'MyAgent', payload: {...} })
 *   remoteEventBridge.subscribe(sessionId, handler)
 *   remoteEventBridge.unsubscribe(sessionId, handler)
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { logInfo } from '../utils/logger.js';
import type { RemoteBridgeEvent, RemoteBridgeEventType } from './types/remote.js';

export type BridgeEventHandler = (event: RemoteBridgeEvent) => void;

class RemoteEventBridge extends EventEmitter {
  private static readonly GLOBAL_CHANNEL = '__global__';

  /**
   * Publish an event to all subscribers.
   * If sessionId is provided, the event is also emitted on that session's channel.
   */
  publish(args: {
    type: RemoteBridgeEventType;
    source: string;
    payload: Record<string, unknown>;
    sessionId?: string;
  }): RemoteBridgeEvent {
    const event: RemoteBridgeEvent = {
      id: uuidv4(),
      type: args.type,
      source: args.source,
      sessionId: args.sessionId,
      payload: args.payload,
      timestamp: Date.now(),
    };

    // Broadcast to global listeners
    this.emit(RemoteEventBridge.GLOBAL_CHANNEL, event);

    // Broadcast to session-specific listeners if applicable
    if (args.sessionId) {
      this.emit(args.sessionId, event);
    }

    logInfo('RemoteEventBridge', `Event published type=${event.type} source=${event.source}`);
    return event;
  }

  /** Subscribe to ALL events (all sessions) */
  subscribeGlobal(handler: BridgeEventHandler): void {
    this.on(RemoteEventBridge.GLOBAL_CHANNEL, handler);
  }

  /** Unsubscribe from global channel */
  unsubscribeGlobal(handler: BridgeEventHandler): void {
    this.off(RemoteEventBridge.GLOBAL_CHANNEL, handler);
  }

  /** Subscribe to events for a specific session */
  subscribe(sessionId: string, handler: BridgeEventHandler): void {
    this.on(sessionId, handler);
    logInfo('RemoteEventBridge', `Session subscribed sessionId=${sessionId}`);
  }

  /** Unsubscribe from a specific session */
  unsubscribe(sessionId: string, handler: BridgeEventHandler): void {
    this.off(sessionId, handler);
    logInfo('RemoteEventBridge', `Session unsubscribed sessionId=${sessionId}`);
  }

  /** Returns recent events for a session (for SSE replay) */
  getActiveSubscriberCount(sessionId?: string): number {
    const channel = sessionId ?? RemoteEventBridge.GLOBAL_CHANNEL;
    return this.listenerCount(channel);
  }
}

// Singleton export
export const remoteEventBridge = new RemoteEventBridge();
remoteEventBridge.setMaxListeners(100);
