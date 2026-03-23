/**
 * PAIOS Remote Integration — Phase 3
 * Bridges PAIOS sessions, streams, and actions into the Remote Event Bridge.
 *
 * In PAIOS, "actions" are high-level goals dispatched to AI workers.
 * This module translates them into remote commands that the session manager
 * can track and execute, and publishes lifecycle events via the bridge.
 */

import { logInfo } from '../utils/logger.js';
import { remoteEventBridge } from './remoteEventBridge.js';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface PaiosAction {
  actionId: string;
  type: string;
  description: string;
  payload: Record<string, unknown>;
  priority?: number;
}

export interface PaiosActionResult {
  actionId: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
  result?: unknown;
  error?: string;
}

// ─── Action Queue ────────────────────────────────────────────────────────────

const queue: PaiosAction[] = [];

/**
 * Enqueue a PAIOS action for execution.
 * Publishes a bridge event so all subscribers are notified.
 */
export function enqueuePaiosAction(sessionId: string, action: PaiosAction): PaiosActionResult {
  queue.push(action);

  logInfo('PaiosIntegration', `Enqueued actionId=${action.actionId} type=${action.type}`);

  remoteEventBridge.publish({
    type: 'paios:action:queued',
    source: 'PaiosIntegration',
    sessionId,
    payload: { actionId: action.actionId, type: action.type },
  });

  return { actionId: action.actionId, status: 'queued' };
}

/**
 * Simulate processing the next action in the queue.
 * In production this would call out to whatever PAIOS worker is relevant.
 */
export function processNextPaiosAction(sessionId: string): PaiosActionResult | null {
  const action = queue.shift();
  if (!action) {
    return null;
  }

  logInfo('PaiosIntegration', `Processing actionId=${action.actionId} type=${action.type}`);

  remoteEventBridge.publish({
    type: 'paios:action:running',
    source: 'PaiosIntegration',
    sessionId,
    payload: { actionId: action.actionId },
  });

  // Mark as completed (in reality, this would be async work)
  const result: PaiosActionResult = {
    actionId: action.actionId,
    status: 'completed',
    result: { processed: true, type: action.type },
  };

  remoteEventBridge.publish({
    type: 'paios:action:completed',
    source: 'PaiosIntegration',
    sessionId,
    payload: { actionId: result.actionId, status: result.status, result: result.result, error: result.error },
  });

  return result;
}

/**
 * Return the current queue length and action IDs for status inspection.
 */
export function getPaiosQueueStatus(): { length: number; actionIds: string[] } {
  return { length: queue.length, actionIds: queue.map(a => a.actionId) };
}
