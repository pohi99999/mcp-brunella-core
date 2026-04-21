import { getGlobalDb } from '@packages/utils/globalDb.js';
import { ensureError } from '@packages/utils/ensureError.js';
import { logError } from '@packages/utils/logger.js';

const DEFAULT_LOOKBACK_DAYS = 7;
const DEFAULT_SUCCESS_THRESHOLD = 0.7;
const DEFAULT_DURATION_THRESHOLD_MS = 30_000;
const DEFAULT_MIN_RUNS = 3;
const DEFAULT_WEAK_LIMIT = 10;

function roundMetric(value: number): number {
  return Number(value.toFixed(3));
}

function normalizeTaskId(taskId: number | string | null | undefined): string | null {
  if (typeof taskId === 'number' && Number.isFinite(taskId)) {
    return String(taskId);
  }

  if (typeof taskId === 'string' && taskId.trim().length > 0) {
    return taskId.trim();
  }

  return null;
}

function serializeMetadata(metadata: Record<string, unknown> | undefined): string {
  return JSON.stringify(metadata ?? {});
}

function parseMetadata(value: string | null | undefined): Record<string, unknown> | undefined {
  if (!value) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(value);
    if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    return undefined;
  }

  return undefined;
}

export interface AgentMetricRecordInput {
  agentName: string;
  taskId?: number | string | null;
  task: string;
  durationMs: number;
  success: boolean;
  errorType?: string;
  source?: string;
  metadata?: Record<string, unknown>;
}

export interface AgentMetricRecord {
  id: number;
  agentName: string;
  taskId: string | null;
  task: string;
  durationMs: number;
  success: boolean;
  errorType?: string | null;
  source: string;
  metadata?: Record<string, unknown>;
  recordedAt: string;
}

export interface AgentPerformanceStats {
  agentName: string;
  totalRuns: number;
  successRate: number;
  avgDurationMs: number;
  minDurationMs: number;
  maxDurationMs: number;
  failureCount: number;
  recentErrorTypes: string[];
  representativeTasks: string[];
  lastRecordedAt?: string | null;
}

export interface WeakAgentCandidate extends AgentPerformanceStats {
  weaknessReasons: string[];
}

export interface WeakAgentOptions {
  days?: number;
  successThreshold?: number;
  durationThresholdMs?: number;
  minRuns?: number;
  limit?: number;
}

export interface AgentPerformanceOverview {
  totalRuns: number;
  agentCount: number;
  overallSuccessRate: number;
  avgDurationMs: number;
  weakAgents: WeakAgentCandidate[];
}

interface AgentMetricRow {
  id: number;
  agentName: string;
  taskId: string | null;
  task: string;
  durationMs: number;
  success: number;
  errorType: string | null;
  source: string;
  metadata: string | null;
  recordedAt: string;
}

interface AgentAggregateRow {
  agentName?: string;
  totalRuns?: number | null;
  successRate?: number | null;
  avgDurationMs?: number | null;
  minDurationMs?: number | null;
  maxDurationMs?: number | null;
  failureCount?: number | null;
  lastRecordedAt?: string | null;
  agentCount?: number | null;
  overallSuccessRate?: number | null;
}

function buildWeaknessReasons(
  stats: AgentPerformanceStats,
  successThreshold: number,
  durationThresholdMs: number,
): string[] {
  const reasons: string[] = [];

  if (stats.successRate < successThreshold) {
    reasons.push(
      `7 napos sikerarány ${(stats.successRate * 100).toFixed(1)}%, ami a ${(successThreshold * 100).toFixed(0)}% küszöb alatt van.`,
    );
  }

  if (stats.avgDurationMs > durationThresholdMs) {
    reasons.push(
      `Átlagos futási idő ${Math.round(stats.avgDurationMs)} ms, ami meghaladja a ${durationThresholdMs} ms küszöböt.`,
    );
  }

  if (reasons.length > 0 && stats.failureCount > 0) {
    reasons.push(`${stats.failureCount} sikertelen futás történt a vizsgált időablakban.`);
  }

  return reasons;
}

class AgentPerformanceTracker {
  private initialized = false;

  private getDb() {
    const db = getGlobalDb();
    if (!this.initialized) {
      this.ensureSchema();
      this.initialized = true;
    }
    return db;
  }

  private ensureSchema(): void {
    const db = getGlobalDb();
    db.exec(`
      CREATE TABLE IF NOT EXISTS agent_metrics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        agent_name TEXT NOT NULL,
        task_id TEXT,
        task TEXT NOT NULL,
        duration_ms INTEGER NOT NULL,
        success INTEGER NOT NULL CHECK(success IN (0, 1)),
        error_type TEXT,
        source TEXT NOT NULL DEFAULT 'base-agent',
        metadata TEXT DEFAULT '{}',
        recorded_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_agent_metrics_agent_time
        ON agent_metrics(agent_name, recorded_at DESC);
      CREATE INDEX IF NOT EXISTS idx_agent_metrics_success
        ON agent_metrics(success, recorded_at DESC);
    `);
  }

  async record(input: AgentMetricRecordInput): Promise<void> {
    try {
      const db = this.getDb();
      db.prepare(`
        INSERT INTO agent_metrics (
          agent_name,
          task_id,
          task,
          duration_ms,
          success,
          error_type,
          source,
          metadata,
          recorded_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      `).run(
        input.agentName,
        normalizeTaskId(input.taskId),
        input.task,
        Math.max(0, Math.round(input.durationMs)),
        input.success ? 1 : 0,
        input.errorType ?? null,
        input.source ?? 'base-agent',
        serializeMetadata(input.metadata),
      );
    } catch (error) {
      const normalized = ensureError(error);
      logError('AgentPerformanceTracker', `record failed: ${normalized.message}`);
    }
  }

  getRecentExecutions(agentName: string, limit = 20): AgentMetricRecord[] {
    const db = this.getDb();
    const safeLimit = Math.max(1, Math.min(limit, 100));
    const rows = db.prepare(`
      SELECT
        id,
        agent_name as agentName,
        task_id as taskId,
        task,
        duration_ms as durationMs,
        success,
        error_type as errorType,
        source,
        metadata,
        recorded_at as recordedAt
      FROM agent_metrics
      WHERE agent_name = ?
      ORDER BY recorded_at DESC, id DESC
      LIMIT ?
    `).all(agentName, safeLimit) as AgentMetricRow[];

    return rows.map((row) => ({
      id: row.id,
      agentName: row.agentName,
      taskId: row.taskId,
      task: row.task,
      durationMs: row.durationMs,
      success: row.success === 1,
      errorType: row.errorType,
      source: row.source,
      metadata: parseMetadata(row.metadata),
      recordedAt: row.recordedAt,
    }));
  }

  getRepresentativeTasks(agentName: string, limit = 5, days = 30): string[] {
    const db = this.getDb();
    const safeLimit = Math.max(1, Math.min(limit, 20));
    const safeDays = Math.max(1, Math.min(days, 365));
    const rows = db.prepare(`
      SELECT task
      FROM agent_metrics
      WHERE agent_name = ?
        AND recorded_at >= datetime('now', ?)
      GROUP BY task
      ORDER BY MAX(recorded_at) DESC, SUM(CASE WHEN success = 0 THEN 1 ELSE 0 END) DESC
      LIMIT ?
    `).all(agentName, `-${safeDays} days`, safeLimit) as Array<{ task: string }>;

    return rows
      .map((row) => row.task.trim())
      .filter((task) => task.length > 0);
  }

  getStats(agentName: string, days = DEFAULT_LOOKBACK_DAYS): AgentPerformanceStats {
    const db = this.getDb();
    const safeDays = Math.max(1, Math.min(days, 365));
    const aggregate = db.prepare(`
      SELECT
        COUNT(*) as totalRuns,
        AVG(CASE WHEN success = 1 THEN 1.0 ELSE 0.0 END) as successRate,
        AVG(duration_ms) as avgDurationMs,
        MIN(duration_ms) as minDurationMs,
        MAX(duration_ms) as maxDurationMs,
        SUM(CASE WHEN success = 0 THEN 1 ELSE 0 END) as failureCount,
        MAX(recorded_at) as lastRecordedAt
      FROM agent_metrics
      WHERE agent_name = ?
        AND recorded_at >= datetime('now', ?)
    `).get(agentName, `-${safeDays} days`) as AgentAggregateRow | undefined;

    const errorRows = db.prepare(`
      SELECT error_type as errorType
      FROM agent_metrics
      WHERE agent_name = ?
        AND success = 0
        AND recorded_at >= datetime('now', ?)
        AND error_type IS NOT NULL
      ORDER BY recorded_at DESC, id DESC
      LIMIT 5
    `).all(agentName, `-${safeDays} days`) as Array<{ errorType: string | null }>;

    const totalRuns = Number(aggregate?.totalRuns ?? 0);
    const successRate = totalRuns > 0 ? roundMetric(Number(aggregate?.successRate ?? 0)) : 0;
    const avgDurationMs = totalRuns > 0 ? roundMetric(Number(aggregate?.avgDurationMs ?? 0)) : 0;
    const minDurationMs = totalRuns > 0 ? Number(aggregate?.minDurationMs ?? 0) : 0;
    const maxDurationMs = totalRuns > 0 ? Number(aggregate?.maxDurationMs ?? 0) : 0;
    const failureCount = Number(aggregate?.failureCount ?? 0);

    return {
      agentName,
      totalRuns,
      successRate,
      avgDurationMs,
      minDurationMs,
      maxDurationMs,
      failureCount,
      recentErrorTypes: errorRows
        .map((row) => row.errorType?.trim())
        .filter((value): value is string => Boolean(value)),
      representativeTasks: this.getRepresentativeTasks(agentName, 5, safeDays),
      lastRecordedAt: aggregate?.lastRecordedAt,
    };
  }

  getWeakAgents(options?: WeakAgentOptions): WeakAgentCandidate[] {
    const db = this.getDb();
    const safeDays = Math.max(1, Math.min(options?.days ?? DEFAULT_LOOKBACK_DAYS, 365));
    const successThreshold = options?.successThreshold ?? DEFAULT_SUCCESS_THRESHOLD;
    const durationThresholdMs = options?.durationThresholdMs ?? DEFAULT_DURATION_THRESHOLD_MS;
    const minRuns = Math.max(1, options?.minRuns ?? DEFAULT_MIN_RUNS);
    const limit = Math.max(1, Math.min(options?.limit ?? DEFAULT_WEAK_LIMIT, 50));
    const rows = db.prepare(`
      SELECT
        agent_name as agentName,
        COUNT(*) as totalRuns,
        AVG(CASE WHEN success = 1 THEN 1.0 ELSE 0.0 END) as successRate,
        AVG(duration_ms) as avgDurationMs,
        MIN(duration_ms) as minDurationMs,
        MAX(duration_ms) as maxDurationMs,
        SUM(CASE WHEN success = 0 THEN 1 ELSE 0 END) as failureCount,
        MAX(recorded_at) as lastRecordedAt
      FROM agent_metrics
      WHERE recorded_at >= datetime('now', ?)
      GROUP BY agent_name
      HAVING COUNT(*) >= ?
      ORDER BY successRate ASC, avgDurationMs DESC, totalRuns DESC
      LIMIT ?
    `).all(`-${safeDays} days`, minRuns, limit) as AgentAggregateRow[];

    return rows
      .map((row) => {
        const stats: AgentPerformanceStats = {
          agentName: row.agentName ?? 'unknown',
          totalRuns: Number(row.totalRuns ?? 0),
          successRate: roundMetric(Number(row.successRate ?? 0)),
          avgDurationMs: roundMetric(Number(row.avgDurationMs ?? 0)),
          minDurationMs: Number(row.minDurationMs ?? 0),
          maxDurationMs: Number(row.maxDurationMs ?? 0),
          failureCount: Number(row.failureCount ?? 0),
          recentErrorTypes: this.getStats(row.agentName ?? 'unknown', safeDays).recentErrorTypes,
          representativeTasks: this.getRepresentativeTasks(row.agentName ?? 'unknown', 5, safeDays),
          lastRecordedAt: row.lastRecordedAt,
        };

        return {
          ...stats,
          weaknessReasons: buildWeaknessReasons(stats, successThreshold, durationThresholdMs),
        };
      })
      .filter((candidate) => candidate.weaknessReasons.length > 0);
  }

  getOverview(days = DEFAULT_LOOKBACK_DAYS): AgentPerformanceOverview {
    const db = this.getDb();
    const safeDays = Math.max(1, Math.min(days, 365));
    const aggregate = db.prepare(`
      SELECT
        COUNT(*) as totalRuns,
        COUNT(DISTINCT agent_name) as agentCount,
        AVG(CASE WHEN success = 1 THEN 1.0 ELSE 0.0 END) as overallSuccessRate,
        AVG(duration_ms) as avgDurationMs
      FROM agent_metrics
      WHERE recorded_at >= datetime('now', ?)
    `).get(`-${safeDays} days`) as AgentAggregateRow | undefined;

    return {
      totalRuns: Number(aggregate?.totalRuns ?? 0),
      agentCount: Number(aggregate?.agentCount ?? 0),
      overallSuccessRate: roundMetric(Number(aggregate?.overallSuccessRate ?? 0)),
      avgDurationMs: roundMetric(Number(aggregate?.avgDurationMs ?? 0)),
      weakAgents: this.getWeakAgents({ days: safeDays }),
    };
  }

  resetForTests(): void {
    const db = this.getDb();
    db.exec('DELETE FROM agent_metrics;');
  }
}

export const agentPerformanceTracker = new AgentPerformanceTracker();

