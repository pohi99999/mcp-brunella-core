/**
 * Gold Protocol G6: Persistent Audit Trail
 *
 * RULE-AU1: Every tool execution → permission check → audit_log INSERT
 * RULE-AU2: DENIED → logError + audit_log (result='DENIED')
 * RULE-AU3: Audit log retention: 30 days (auto-cleanup)
 *
 * Non-functional: Audit write is async (non-blocking)
 */

import type Database from 'better-sqlite3';
import { logError, logInfo } from '@packages/utils/logger.js';

// ============================================================================
// TYPES
// ============================================================================

export type AuditResult = 'ALLOWED' | 'DENIED';

export interface AuditEntry {
  id?: number;
  timestamp: string;
  tenantId: string;
  agentName: string;
  action: string;
  resource: string;
  result: AuditResult;
  reason?: string;
}

interface AuditLogRow {
  id: number;
  timestamp: string;
  tenant_id: string;
  agent_name: string;
  action: string;
  resource: string;
  result: AuditResult;
  reason: string | null;
}

interface CountRow {
  count: number;
}

interface AgentCountRow {
  agent_name: string;
  result: AuditResult;
  count: number;
}

// ============================================================================
// DATABASE (lazy singleton)
// ============================================================================

export async function getAuditDb(): Promise<Database.Database | null> {
  return await getDb();
}

let db: Database.Database | null = null;
let resolvedDbPath: string | null = null;

function mapAuditRow(row: AuditLogRow): AuditEntry {
  return {
    id: row.id,
    timestamp: row.timestamp,
    tenantId: row.tenant_id,
    agentName: row.agent_name,
    action: row.action,
    resource: row.resource,
    result: row.result,
    reason: row.reason || undefined,
  };
}

async function getDb(): Promise<Database.Database | null> {
  if (db) return db;

  if (typeof process === 'undefined' || !process.versions?.node) {
    return null;
  }

  const path = await import('path');
  const fs = await import('fs');

  if (!resolvedDbPath) {
    const envPath = process.env.AUDIT_LOG_DB?.trim();
    const isTestEnv = Boolean(process.env.VITEST || process.env.NODE_ENV === 'test');

    if (envPath && envPath.length > 0) {
      if (envPath === ':memory:') {
        resolvedDbPath = ':memory:';
      } else if (path.default.isAbsolute(envPath)) {
        resolvedDbPath = envPath;
      } else {
        resolvedDbPath = path.default.join(process.cwd(), envPath);
      }
    } else if (isTestEnv) {
      // Use in-memory database during tests to avoid cross-worker interference
      resolvedDbPath = ':memory:';
    } else {
      const defaultDir = path.default.join(process.cwd(), 'data');
      if (!fs.default.existsSync(defaultDir)) {
        fs.default.mkdirSync(defaultDir, { recursive: true });
      }
      resolvedDbPath = path.default.join(defaultDir, 'audit.db');
    }

    if (resolvedDbPath !== ':memory:') {
      const dir = path.default.dirname(resolvedDbPath);
      if (!fs.default.existsSync(dir)) {
        fs.default.mkdirSync(dir, { recursive: true });
      }
    }
  }

  const DatabaseConstructor = (await import('better-sqlite3')).default;
  const dbPathToUse = resolvedDbPath ?? ':memory:';
  db = new DatabaseConstructor(dbPathToUse);

  // WAL mode for concurrent reads + low-latency writes (skip for in-memory DBs)
  if (dbPathToUse !== ':memory:') {
    db.pragma('journal_mode = WAL');
  }

  // Create table from schemas/audit.sql
  db.exec(`
    CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp TEXT NOT NULL DEFAULT (datetime('now')),
      tenant_id TEXT NOT NULL DEFAULT 'system',
      agent_name TEXT NOT NULL,
      action TEXT NOT NULL,
      resource TEXT,
      result TEXT NOT NULL CHECK (result IN ('ALLOWED', 'DENIED')),
      reason TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_audit_agent ON audit_log(agent_name);
    CREATE INDEX IF NOT EXISTS idx_audit_tenant ON audit_log(tenant_id);
    CREATE INDEX IF NOT EXISTS idx_audit_result ON audit_log(result);
    CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_log(timestamp);
  `);

  const initMode = dbPathToUse === ':memory:' ? 'in-memory test mode' : `WAL mode @ ${dbPathToUse}`;
  logInfo('AuditLog', `Database initialized (${initMode})`);
  return db;
}

// ============================================================================
// IN-MEMORY CACHE (optional fast access)
// ============================================================================

const auditBuffer: AuditEntry[] = [];
const MAX_BUFFER = 1000; // Reduced size (SQLite is source of truth)
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
export async function record(
  result: AuditResult,
  agentName: string,
  action: string,
  resource: string,
  reason?: string,
  tenantId = 'system'
): Promise<void> {
  const entry: AuditEntry = {
    timestamp: new Date().toISOString(),
    tenantId,
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

  // In-memory cache (fast recent access)
  auditBuffer.push(entry);
  if (auditBuffer.length > MAX_BUFFER) {
    auditBuffer.splice(0, auditBuffer.length - MAX_BUFFER);
  }

  // SQLite persistence (async, non-blocking)
  try {
    const database = await getDb();
    if (!database) return;

    const stmt = database.prepare(
      'INSERT INTO audit_log (timestamp, tenant_id, agent_name, action, resource, result, reason) VALUES (?, ?, ?, ?, ?, ?, ?)'
    );
    stmt.run(entry.timestamp, entry.tenantId, entry.agentName, entry.action, entry.resource, entry.result, entry.reason || null);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    logError('AuditLog', `SQLite insert failed: ${msg}`);
  }
}

/**
 * Get paginated audit log entries (newest first).
 * Reads from SQLite (fallback to in-memory buffer if DB unavailable).
 */
export async function getAuditLog(limit = 50, offset = 0, tenantId?: string): Promise<AuditEntry[]> {
  try {
    const database = await getDb();
    if (!database) {
      // Fallback to in-memory buffer
      const sorted = [...auditBuffer]
        .filter((entry) => !tenantId || entry.tenantId === tenantId)
        .reverse();
      return sorted.slice(offset, offset + limit);
    }

    const stmt = tenantId
      ? database.prepare(
          'SELECT id, timestamp, tenant_id, agent_name, action, resource, result, reason FROM audit_log WHERE tenant_id = ? ORDER BY id DESC LIMIT ? OFFSET ?'
        )
      : database.prepare(
          'SELECT id, timestamp, tenant_id, agent_name, action, resource, result, reason FROM audit_log ORDER BY id DESC LIMIT ? OFFSET ?'
        );
    const rows = tenantId ? stmt.all(tenantId, limit, offset) as AuditLogRow[] : stmt.all(limit, offset) as AuditLogRow[];
    return rows.map(mapAuditRow);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    logError('AuditLog', `SQLite select failed: ${msg}`);
    // Fallback to buffer
    const sorted = [...auditBuffer].reverse();
    return sorted.slice(offset, offset + limit);
  }
}

/**
 * Get only DENIED entries (newest first).
 */
export async function getDeniedEntries(limit = 50, tenantId?: string): Promise<AuditEntry[]> {
  try {
    const database = await getDb();
    if (!database) {
      return [...auditBuffer]
        .filter((e) => e.result === 'DENIED' && (!tenantId || e.tenantId === tenantId))
        .reverse()
        .slice(0, limit);
    }

    const stmt = tenantId
      ? database.prepare(
          'SELECT id, timestamp, tenant_id, agent_name, action, resource, result, reason FROM audit_log WHERE result = ? AND tenant_id = ? ORDER BY id DESC LIMIT ?'
        )
      : database.prepare(
          'SELECT id, timestamp, tenant_id, agent_name, action, resource, result, reason FROM audit_log WHERE result = ? ORDER BY id DESC LIMIT ?'
        );
    const rows = tenantId ? stmt.all('DENIED', tenantId, limit) as AuditLogRow[] : stmt.all('DENIED', limit) as AuditLogRow[];
    return rows.map(mapAuditRow);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    logError('AuditLog', `SQLite denied query failed: ${msg}`);
    return [...auditBuffer]
      .filter((e) => e.result === 'DENIED' && (!tenantId || e.tenantId === tenantId))
      .reverse()
      .slice(0, limit);
  }
}

/**
 * Get audit log statistics.
 */
export async function getAuditStats(tenantId?: string): Promise<{
  totalEntries: number;
  allowedCount: number;
  deniedCount: number;
  byAgent: Record<string, { allowed: number; denied: number }>;
}> {
  try {
    const database = await getDb();
    if (!database) {
      // Fallback to in-memory buffer
      const byAgent: Record<string, { allowed: number; denied: number }> = {};
      let allowedCount = 0;
      let deniedCount = 0;
      const filtered = auditBuffer.filter((entry) => !tenantId || entry.tenantId === tenantId);

      for (const entry of filtered) {
        if (entry.result === 'ALLOWED') allowedCount++;
        else deniedCount++;

        if (!byAgent[entry.agentName]) {
          byAgent[entry.agentName] = { allowed: 0, denied: 0 };
        }
        if (entry.result === 'ALLOWED') byAgent[entry.agentName].allowed++;
        else byAgent[entry.agentName].denied++;
      }

      return {
        totalEntries: filtered.length,
        allowedCount,
        deniedCount,
        byAgent,
      };
    }

    // SQLite aggregation
    const totalRow = tenantId
      ? database.prepare('SELECT COUNT(*) as count FROM audit_log WHERE tenant_id = ?').get(tenantId) as CountRow | undefined
      : database.prepare('SELECT COUNT(*) as count FROM audit_log').get() as CountRow | undefined;
    const allowedRow = tenantId
      ? database.prepare('SELECT COUNT(*) as count FROM audit_log WHERE result = ? AND tenant_id = ?').get('ALLOWED', tenantId) as CountRow | undefined
      : database.prepare('SELECT COUNT(*) as count FROM audit_log WHERE result = ?').get('ALLOWED') as CountRow | undefined;
    const deniedRow = tenantId
      ? database.prepare('SELECT COUNT(*) as count FROM audit_log WHERE result = ? AND tenant_id = ?').get('DENIED', tenantId) as CountRow | undefined
      : database.prepare('SELECT COUNT(*) as count FROM audit_log WHERE result = ?').get('DENIED') as CountRow | undefined;

    const agentRows = tenantId
      ? database.prepare(`
      SELECT tenant_id, agent_name, result, COUNT(*) as count
      FROM audit_log
      WHERE tenant_id = ?
      GROUP BY tenant_id, agent_name, result
    `).all(tenantId) as Array<AgentCountRow & { tenant_id: string }>
      : database.prepare(`
      SELECT tenant_id, agent_name, result, COUNT(*) as count
      FROM audit_log
      GROUP BY tenant_id, agent_name, result
    `).all() as Array<AgentCountRow & { tenant_id: string }>;

    const byAgent: Record<string, { allowed: number; denied: number }> = {};
    for (const row of agentRows) {
      if (!byAgent[row.agent_name]) {
        byAgent[row.agent_name] = { allowed: 0, denied: 0 };
      }
      if (row.result === 'ALLOWED') byAgent[row.agent_name].allowed = row.count;
      else byAgent[row.agent_name].denied = row.count;
    }

    return {
      totalEntries: totalRow?.count || 0,
      allowedCount: allowedRow?.count || 0,
      deniedCount: deniedRow?.count || 0,
      byAgent,
    };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    logError('AuditLog', `SQLite stats failed: ${msg}`);

    // Fallback to buffer
    const byAgent: Record<string, { allowed: number; denied: number }> = {};
    let allowedCount = 0;
    let deniedCount = 0;
    const filtered = auditBuffer.filter((entry) => !tenantId || entry.tenantId === tenantId);

    for (const entry of filtered) {
      if (entry.result === 'ALLOWED') allowedCount++;
      else deniedCount++;

      if (!byAgent[entry.agentName]) {
        byAgent[entry.agentName] = { allowed: 0, denied: 0 };
      }
      if (entry.result === 'ALLOWED') byAgent[entry.agentName].allowed++;
      else byAgent[entry.agentName].denied++;
    }

    return {
      totalEntries: filtered.length,
      allowedCount,
      deniedCount,
      byAgent,
    };
  }
}

/**
 * RULE-AU3: Cleanup entries older than retentionDays.
 * Returns the number of removed entries.
 */
export async function cleanupOldEntries(retentionDays = DEFAULT_RETENTION_DAYS): Promise<number> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - retentionDays);
  const cutoffStr = cutoff.toISOString();

  try {
    const database = await getDb();
    if (!database) {
      // Fallback to in-memory buffer
      const before = auditBuffer.length;
      const kept = auditBuffer.filter((e) => e.timestamp >= cutoffStr);

      auditBuffer.length = 0;
      auditBuffer.push(...kept);

      const removed = before - auditBuffer.length;
      if (removed > 0) {
        logInfo('AuditLog', `Cleanup (buffer): removed ${removed} entries older than ${retentionDays} days`);
      }
      return removed;
    }

    const stmt = database.prepare('DELETE FROM audit_log WHERE timestamp < ?');
    const result = stmt.run(cutoffStr);

    const removed = result.changes;
    if (removed > 0) {
      logInfo('AuditLog', `Cleanup (SQLite): removed ${removed} entries older than ${retentionDays} days`);
    }
    return removed;
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    logError('AuditLog', `SQLite cleanup failed: ${msg}`);
    return 0;
  }
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
 * Also clears SQLite database.
 */
export async function clearAuditLog(tenantId?: string): Promise<void> {
  if (tenantId) {
    for (let index = auditBuffer.length - 1; index >= 0; index--) {
      if (auditBuffer[index]?.tenantId === tenantId) {
        auditBuffer.splice(index, 1);
      }
    }
  } else {
    auditBuffer.length = 0;
  }

  try {
    const database = await getDb();
    if (database) {
      if (tenantId) {
        database.prepare('DELETE FROM audit_log WHERE tenant_id = ?').run(tenantId);
      } else {
        database.prepare('DELETE FROM audit_log').run();
      }
    }
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    logError('AuditLog', `Clear SQLite failed: ${msg}`);
  }
}

/**
 * Close audit database (for tests / graceful shutdown).
 */
export async function closeAuditDb(): Promise<void> {
  if (db) {
    db.close();
    db = null;
    resolvedDbPath = null;
    logInfo('AuditLog', 'Database closed');
  }
}

