/**
 * Mobile Client Bootstrap — Phase 3
 * Provides session summary, heartbeat, and mobile-specific endpoints
 * for remote sessions initiated from mobile devices.
 */

import { logInfo, logWarn } from '../utils/logger.js';
import { remoteEventBridge } from './remoteEventBridge.js';
import type { MobileSessionSummary, RemoteSession } from './types/remote.js';

// ─── Mobile Session Summary ──────────────────────────────────────────────────

/**
 * Convert a full RemoteSession into a trimmed summary suitable for
 * bandwidth-constrained mobile clients.
 */
export function buildMobileSessionSummary(session: RemoteSession): MobileSessionSummary {
  return {
    sessionId: session.id,
    targetId: session.targetId,
    userId: session.userId,
    active: session.active,
    commandCount: session.commands?.length ?? 0,
    lastActivity: session.createdAt,
    createdAt: session.createdAt,
    expiresAt: session.expiresAt,
  };
}

// ─── Heartbeat ───────────────────────────────────────────────────────────────

/**
 * Process a mobile heartbeat, publishing a bridge event and
 * returning whether the session is still valid.
 */
export function processMobileHeartbeat(
  sessionId: string,
  session: RemoteSession | undefined
): { alive: boolean; ttl?: number } {
  if (!session || !session.active) {
    logWarn('MobileBootstrap', `Heartbeat for dead/missing session: ${sessionId}`);
    return { alive: false };
  }

  const now = Date.now();
  if (now >= session.expiresAt) {
    logWarn('MobileBootstrap', `Session expired: ${sessionId}`);
    return { alive: false };
  }

  const ttl = session.expiresAt - now;

  remoteEventBridge.publish({
    type: 'mobile:heartbeat',
    source: 'MobileBootstrap',
    sessionId,
    payload: { ttl },
  });

  logInfo('MobileBootstrap', `Heartbeat OK sessionId=${sessionId} ttl=${ttl}`);
  return { alive: true, ttl };
}
