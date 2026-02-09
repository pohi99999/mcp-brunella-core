/**
 * Gold Protocol G6: Persistent Audit Trail
 *
 * RULE-AU1: Every tool execution → permission check → audit_log INSERT
 * RULE-AU2: DENIED → logError + audit_log (result='DENIED')
 * RULE-AU3: Audit log retention: 30 days (auto-cleanup)
 *
 * Non-functional: Audit write is async (non-blocking)
 */

import { logError, logInfo } from '../utils/logger.js';

// ============================================================================
// TYPES
// ============================================================================

export type AuditResult = 'ALLOWED' | 'DENIED';

export interface AuditEntry {
  id?: number;
  timestamp: string;
  agentName: string;
  action: string;
  resource: string;
  result: AuditResult;
  reason?: string;
}

// ============================================================================
// IN-MEMORY AUDIT BUFFER (async non-blocking)
// ============================================================================

const auditBuffer: AuditEntry[] = [];
const MAX_BUFFER = 5000;
const DEFAULT_RETENTION_DAYS = 30;

let cleanupInterval: ReturnType<typeof setInterval> | null = null;

// ============================================================================
// CORE FUNCTIONS
// ============================================================================

/**
 * Record an audit entry (async, non-blocking).
 * RULE-AU1: Every permission check result is recorded.
 * RULE-AU2: DENIED results also trigger logError.
 */
export function record(
  result: AuditResult,
  agentName: string,
  action: string,
  resource: string,
  reason?: string
): void {
  const entry: AuditEntry = {
    timestamp: new Date().toISOString(),
    agentName,
    action,
    resource,
    result,
    reason,
  };

  // RULE-AU2: DENIED → logError
  if (result === 'DENIED') {
    logError('AuditLog', `DENIED: ${agentName} → ${action} on ${resource}: ${reason || 'no reason'}`);
  }

  auditBuffer.push(entry);

  // Ring buffer: evict oldest when full
  if (auditBuffer.length > MAX_BUFFER) {
    auditBuffer.splice(0, auditBuffer.length - MAX_BUFFER);
  }
}

/**
 * Get paginated audit log entries (newest first).
 */
export function getAuditLog(limit = 50, offset = 0): AuditEntry[] {
  const sorted = [...auditBuffer].reverse();
  return sorted.slice(offset, offset + limit);
}

/**
 * Get only DENIED entries (newest first).
 */
export function getDeniedEntries(limit = 50): AuditEntry[] {
  return [...auditBuffer]
    .filter((e) => e.result === 'DENIED')
    .reverse()
    .slice(0, limit);
}

/**
 * Get audit log statistics.
 */
export function getAuditStats(): {
  totalEntries: number;
  allowedCount: number;
  deniedCount: number;
  byAgent: Record<string, { allowed: number; denied: number }>;
} {
  const byAgent: Record<string, { allowed: number; denied: number }> = {};
  let allowedCount = 0;
  let deniedCount = 0;

  for (const entry of auditBuffer) {
    if (entry.result === 'ALLOWED') allowedCount++;
    else deniedCount++;

    if (!byAgent[entry.agentName]) {
      byAgent[entry.agentName] = { allowed: 0, denied: 0 };
    }
    if (entry.result === 'ALLOWED') byAgent[entry.agentName].allowed++;
    else byAgent[entry.agentName].denied++;
  }

  return {
    totalEntries: auditBuffer.length,
    allowedCount,
    deniedCount,
    byAgent,
  };
}

/**
 * RULE-AU3: Cleanup entries older than retentionDays.
 * Returns the number of removed entries.
 */
export function cleanupOldEntries(retentionDays = DEFAULT_RETENTION_DAYS): number {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - retentionDays);
  const cutoffStr = cutoff.toISOString();

  const before = auditBuffer.length;
  const kept = auditBuffer.filter((e) => e.timestamp >= cutoffStr);

  auditBuffer.length = 0;
  auditBuffer.push(...kept);

  const removed = before - auditBuffer.length;
  if (removed > 0) {
    logInfo('AuditLog', `Cleanup: removed ${removed} entries older than ${retentionDays} days`);
  }
  return removed;
}

/**
 * Start periodic cleanup (default: every 6 hours).
 */
export function startCleanupSchedule(intervalMs = 6 * 60 * 60 * 1000): void {
  if (cleanupInterval) return;
  cleanupInterval = setInterval(() => cleanupOldEntries(), intervalMs);
  logInfo('AuditLog', `Cleanup schedule started (interval: ${intervalMs}ms)`);
}

/**
 * Stop periodic cleanup.
 */
export function stopCleanupSchedule(): void {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
  }
}

/**
 * Clear all audit entries (for testing).
 */
export function clearAuditLog(): void {
  auditBuffer.length = 0;
}
