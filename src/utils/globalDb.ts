import Database from 'better-sqlite3';
import path from 'path';
import { logInfo, logError } from './logger.js';
import { ensureError } from './ensureError.js';
import { D1Adapter, createD1Adapter } from './d1Adapter.js';

let globalDb: Database.Database | null = null;
let d1Adapter: D1Adapter | null = null;

function reportDbError(operation: string, error: unknown): Error {
  const normalized = ensureError(error);
  logError('GlobalDb', `${operation}: ${normalized.message}`, normalized);
  return normalized;
}

/**
 * Initialize and get the global database instance (Local SQLite)
 */
export function getGlobalDb(): Database.Database {
  if (globalDb) {
    return globalDb;
  }

  try {
    const dbPath = path.join(process.cwd(), 'data', 'brunella.db');
    globalDb = new Database(dbPath);
    
    logInfo('GlobalDb', `Database opened: ${dbPath}`);
    
    // Initialize schema if needed
    initSchema();
    
    return globalDb;
  } catch (error: unknown) {
    throw reportDbError('Failed to open database', error);
  }
}

/**
 * Get D1 Adapter for cloud storage (Phase 1)
 * 
 * Returns null if D1 is not configured (falls back to local SQLite)
 * 
 * Environment variables:
 *   - CLOUDFLARE_WORKER_URL: Worker URL (e.g., https://cean-orchestrator.iam-dd1.workers.dev)
 *   - CEAN_API_KEY: API key for worker authentication
 */
export function getD1Adapter(): D1Adapter | null {
  if (d1Adapter) {
    return d1Adapter;
  }

  d1Adapter = createD1Adapter();

  if (d1Adapter) {
    logInfo('GlobalDb', 'D1 Adapter initialized (cloud mode)');
  } else {
    logInfo('GlobalDb', 'D1 Adapter not available (local mode)');
  }

  return d1Adapter;
}

/**
 * Initialize database schema
 */
function initSchema(): void {
  if (!globalDb) return;

  try {
    // Create tables if they don't exist
    globalDb.exec(`
      CREATE TABLE IF NOT EXISTS suggested_tasks (
        id TEXT PRIMARY KEY,
        file_path TEXT NOT NULL,
        line_number INTEGER NOT NULL,
        todo_text TEXT NOT NULL,
        context TEXT,
        confidence_score REAL DEFAULT 0.5,
        status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'in_progress', 'completed', 'archived')),
        assigned_to TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')),
        UNIQUE(file_path, line_number)
      );

      CREATE TABLE IF NOT EXISTS scheduled_tasks (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        prompt TEXT NOT NULL,
        cron_expression TEXT NOT NULL,
        handler TEXT NOT NULL,
        enabled BOOLEAN DEFAULT 1,
        last_run_at TEXT,
        next_run_at TEXT,
        last_status TEXT DEFAULT 'pending' CHECK(last_status IN ('pending', 'success', 'failed')),
        last_result TEXT,
        metadata TEXT DEFAULT '{}',
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS webhook_events (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        provider TEXT NOT NULL,
        payload TEXT NOT NULL,
        processed BOOLEAN DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS cean_fleets (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        environment TEXT DEFAULT 'production',
        status TEXT DEFAULT 'active' CHECK(status IN ('active', 'paused', 'archived')),
        description TEXT,
        config TEXT DEFAULT '{}',
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS cean_workers (
        id TEXT PRIMARY KEY,
        fleet_id TEXT NOT NULL,
        name TEXT NOT NULL,
        status TEXT DEFAULT 'active' CHECK(status IN ('active', 'paused', 'draining', 'error')),
        url TEXT NOT NULL,
        error_count INTEGER DEFAULT 0,
        requests_total INTEGER DEFAULT 0,
        last_heartbeat TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (fleet_id) REFERENCES cean_fleets(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS cean_metrics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        worker_id TEXT NOT NULL,
        timestamp TEXT DEFAULT (datetime('now')),
        latency_p50 REAL,
        latency_p95 REAL,
        latency_p99 REAL,
        request_count INTEGER DEFAULT 0,
        error_count INTEGER DEFAULT 0,
        error_rate REAL DEFAULT 0,
        memory_usage_mb REAL,
        cloudflare_location TEXT,
        FOREIGN KEY (worker_id) REFERENCES cean_workers(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_suggested_tasks_status ON suggested_tasks(status);
      CREATE INDEX IF NOT EXISTS idx_scheduled_tasks_enabled ON scheduled_tasks(enabled);
      CREATE INDEX IF NOT EXISTS idx_webhook_events_provider ON webhook_events(provider);
      CREATE INDEX IF NOT EXISTS idx_cean_workers_fleet ON cean_workers(fleet_id);
      CREATE INDEX IF NOT EXISTS idx_cean_metrics_worker ON cean_metrics(worker_id);
      CREATE INDEX IF NOT EXISTS idx_cean_metrics_timestamp ON cean_metrics(timestamp);

      CREATE TABLE IF NOT EXISTS edge_tasks (
        task_id TEXT PRIMARY KEY,
        type TEXT,
        status TEXT,
        payload TEXT,
        result TEXT,
        created_at TEXT,
        completed_at TEXT,
        synced_at TEXT DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_edge_tasks_status ON edge_tasks(status);
      CREATE INDEX IF NOT EXISTS idx_edge_tasks_created_at ON edge_tasks(created_at);

      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        type TEXT,
        status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'running', 'completed', 'failed')),
        payload TEXT,
        result TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);

      CREATE TABLE IF NOT EXISTS llm_calls (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp TEXT DEFAULT (datetime('now')),
        provider TEXT NOT NULL,
        model TEXT,
        task_type TEXT,
        prompt_tokens INTEGER DEFAULT 0,
        completion_tokens INTEGER DEFAULT 0,
        total_tokens INTEGER DEFAULT 0,
        duration_ms INTEGER DEFAULT 0,
        success INTEGER DEFAULT 1,
        error TEXT,
        fallback_used INTEGER DEFAULT 0,
        fallback_reason TEXT,
        user_id TEXT,
        cost_usd REAL DEFAULT 0
      );

      CREATE INDEX IF NOT EXISTS idx_llm_calls_timestamp ON llm_calls(timestamp);
      CREATE INDEX IF NOT EXISTS idx_llm_calls_provider ON llm_calls(provider);
      CREATE INDEX IF NOT EXISTS idx_llm_calls_user ON llm_calls(user_id);

      CREATE TABLE IF NOT EXISTS tool_runs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp TEXT DEFAULT (datetime('now')),
        tool_name TEXT NOT NULL,
        input_params TEXT,
        output_data TEXT,
        success INTEGER DEFAULT 1,
        duration_ms INTEGER,
        user_id TEXT,
        quality_score REAL DEFAULT 0.5
      );

      CREATE INDEX IF NOT EXISTS idx_tool_runs_timestamp ON tool_runs(timestamp);
      CREATE INDEX IF NOT EXISTS idx_tool_runs_tool_name ON tool_runs(tool_name);
      CREATE INDEX IF NOT EXISTS idx_tool_runs_success ON tool_runs(success);
    `);

    logInfo('GlobalDb', 'Schema initialized');

    // Backward-compatible migration: ensure scheduled_tasks.metadata exists.
    try {
      const taskColumns = globalDb
        .prepare("PRAGMA table_info(scheduled_tasks)")
        .all() as Array<{ name: string }>;
      const hasMetadata = taskColumns.some((c) => c.name === 'metadata');

      if (!hasMetadata) {
        globalDb.exec("ALTER TABLE scheduled_tasks ADD COLUMN metadata TEXT DEFAULT '{}'");
        logInfo('GlobalDb', 'Migration applied: added scheduled_tasks.metadata column');
      }
    } catch (migrationError: unknown) {
      reportDbError('scheduled_tasks metadata migration failed', migrationError);
    }

    // Create default "Brunella Agents" fleet if it doesn't exist
    const fleetCheck = globalDb.prepare('SELECT COUNT(*) as count FROM cean_fleets WHERE id = ?').get('fleet-brunella-agents') as { count: number };

    if (fleetCheck.count === 0) {
      const now = new Date().toISOString();
      globalDb.prepare(`
        INSERT INTO cean_fleets (id, name, environment, status, description, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        'fleet-brunella-agents',
        'Brunella Agents',
        'local',
        'active',
        'Brunella AI Agent Fleet - All local agents',
        now,
        now
      );
      logInfo('GlobalDb', 'Default Brunella Agents fleet created');
    }
  } catch (error: unknown) {
    reportDbError('Schema initialization failed', error);
  }
}

/**
 * Close the global database connection
 */
export function closeGlobalDb(): void {
  if (globalDb) {
    globalDb.close();
    globalDb = null;
    logInfo('GlobalDb', 'Database closed');
  }
}

export default getGlobalDb;

/* ───── LLM Call Persistence (Observability) ───── */

export interface LlmCallRecord {
  provider: string;
  model?: string;
  taskType?: string;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  durationMs?: number;
  success: boolean;
  error?: string;
  fallbackUsed?: boolean;
  fallbackReason?: string;
  userId?: string;
  costUsd?: number;
}

export interface LlmCallQuery {
  provider?: string;
  since?: string;
  until?: string;
  userId?: string;
  limit?: number;
  offset?: number;
}

export function recordLlmCall(record: LlmCallRecord): void {
  try {
    const db = getGlobalDb();
    db.prepare(`
      INSERT INTO llm_calls (provider, model, task_type, prompt_tokens, completion_tokens, total_tokens,
        duration_ms, success, error, fallback_used, fallback_reason, user_id, cost_usd)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      record.provider,
      record.model ?? null,
      record.taskType ?? null,
      record.promptTokens ?? 0,
      record.completionTokens ?? 0,
      record.totalTokens ?? 0,
      record.durationMs ?? 0,
      record.success ? 1 : 0,
      record.error ?? null,
      record.fallbackUsed ? 1 : 0,
      record.fallbackReason ?? null,
      record.userId ?? null,
      record.costUsd ?? 0,
    );
  } catch (error: unknown) {
    reportDbError('Failed to record LLM call', error);
  }
}

export interface LlmCallRow {
  id: number;
  timestamp: string;
  provider: string;
  model: string | null;
  task_type: string | null;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  duration_ms: number;
  success: number;
  error: string | null;
  fallback_used: number;
  fallback_reason: string | null;
  user_id: string | null;
  cost_usd: number;
}

export function queryLlmCalls(query: LlmCallQuery = {}): LlmCallRow[] {
  try {
    const db = getGlobalDb();
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (query.provider) {
      conditions.push('provider = ?');
      params.push(query.provider);
    }
    if (query.since) {
      conditions.push('timestamp >= ?');
      params.push(query.since);
    }
    if (query.until) {
      conditions.push('timestamp <= ?');
      params.push(query.until);
    }
    if (query.userId) {
      conditions.push('user_id = ?');
      params.push(query.userId);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const limit = query.limit ?? 200;
    const offset = query.offset ?? 0;

    return db.prepare(`SELECT * FROM llm_calls ${where} ORDER BY timestamp DESC LIMIT ? OFFSET ?`)
      .all(...params, limit, offset) as LlmCallRow[];
  } catch (error: unknown) {
    reportDbError('Failed to query LLM calls', error);
    return [];
  }
}

export interface LlmCallStats {
  totalCalls: number;
  successRate: number;
  avgDurationMs: number;
  totalTokens: number;
  totalCostUsd: number;
  byProvider: Array<{ provider: string; count: number; avgDuration: number; tokens: number; cost: number }>;
  byModel: Array<{ model: string; count: number; tokens: number }>;
  recentErrors: Array<{ timestamp: string; provider: string; error: string }>;
}

export function getLlmCallStats(since?: string): LlmCallStats {
  try {
    const db = getGlobalDb();
    const whereClause = since ? 'WHERE timestamp >= ?' : '';
    const params = since ? [since] : [];

    const totals = db.prepare(`
      SELECT COUNT(*) as total, 
             SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as successes,
             AVG(duration_ms) as avg_duration,
             SUM(total_tokens) as total_tokens,
             SUM(cost_usd) as total_cost
      FROM llm_calls ${whereClause}
    `).get(...params) as { total: number; successes: number; avg_duration: number; total_tokens: number; total_cost: number } | undefined;

    const byProvider = db.prepare(`
      SELECT provider, COUNT(*) as count, AVG(duration_ms) as avgDuration, 
             SUM(total_tokens) as tokens, SUM(cost_usd) as cost
      FROM llm_calls ${whereClause}
      GROUP BY provider ORDER BY count DESC
    `).all(...params) as Array<{ provider: string; count: number; avgDuration: number; tokens: number; cost: number }>;

    const byModel = db.prepare(`
      SELECT COALESCE(model, 'unknown') as model, COUNT(*) as count, SUM(total_tokens) as tokens
      FROM llm_calls ${whereClause}
      GROUP BY model ORDER BY count DESC
    `).all(...params) as Array<{ model: string; count: number; tokens: number }>;

    const recentErrors = db.prepare(`
      SELECT timestamp, provider, error FROM llm_calls 
      WHERE success = 0 ${since ? 'AND timestamp >= ?' : ''}
      ORDER BY timestamp DESC LIMIT 10
    `).all(...(since ? [since] : [])) as Array<{ timestamp: string; provider: string; error: string }>;

    return {
      totalCalls: totals?.total ?? 0,
      successRate: totals?.total ? ((totals.successes ?? 0) / totals.total) * 100 : 100,
      avgDurationMs: Math.round(totals?.avg_duration ?? 0),
      totalTokens: totals?.total_tokens ?? 0,
      totalCostUsd: totals?.total_cost ?? 0,
      byProvider,
      byModel,
      recentErrors,
    };
  } catch (error: unknown) {
    reportDbError('Failed to get LLM call stats', error);
    return {
      totalCalls: 0, successRate: 100, avgDurationMs: 0, totalTokens: 0,
      totalCostUsd: 0, byProvider: [], byModel: [], recentErrors: [],
    };
  }
}

/* ───── Tool Run Persistence (Golden Dataset) ───── */

export interface ToolRunRecord {
  tool_name: string;
  input_params?: string;
  output_data?: string;
  success?: number;
  duration_ms?: number;
  user_id?: string;
  quality_score?: number;
}

export interface ToolRunQuery {
  tool_name?: string;
  success?: number;
  since?: string;
  limit?: number;
  offset?: number;
}

export interface ToolRunRow {
  id: number;
  timestamp: string;
  tool_name: string;
  input_params: string | null;
  output_data: string | null;
  success: number;
  duration_ms: number | null;
  user_id: string | null;
  quality_score: number;
}

export interface ToolRunStats {
  totalRuns: number;
  successRate: number;
  avgDurationMs: number;
  byTool: Array<{ tool_name: string; count: number; success_rate: number; avg_duration: number }>;
}

export function recordToolRun(run: ToolRunRecord): void {
  try {
    const db = getGlobalDb();
    db.prepare(`
      INSERT INTO tool_runs (tool_name, input_params, output_data, success, duration_ms, user_id, quality_score)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      run.tool_name,
      run.input_params ?? null,
      run.output_data ?? null,
      run.success ?? 1,
      run.duration_ms ?? null,
      run.user_id ?? null,
      run.quality_score ?? 0.5,
    );
  } catch (error: unknown) {
    reportDbError('Failed to record tool run', error);
  }
}

export function queryToolRuns(query: ToolRunQuery = {}): ToolRunRow[] {
  try {
    const db = getGlobalDb();
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (query.tool_name) {
      conditions.push('tool_name = ?');
      params.push(query.tool_name);
    }
    if (query.success !== undefined) {
      conditions.push('success = ?');
      params.push(query.success);
    }
    if (query.since) {
      conditions.push('timestamp >= ?');
      params.push(query.since);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const limit = query.limit ?? 200;
    const offset = query.offset ?? 0;

    return db.prepare(`SELECT * FROM tool_runs ${where} ORDER BY timestamp DESC LIMIT ? OFFSET ?`)
      .all(...params, limit, offset) as ToolRunRow[];
  } catch (error: unknown) {
    reportDbError('Failed to query tool runs', error);
    return [];
  }
}

export function getToolRunStats(): ToolRunStats {
  try {
    const db = getGlobalDb();

    const totals = db.prepare(`
      SELECT COUNT(*) as total,
             SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as successes,
             AVG(duration_ms) as avg_duration
      FROM tool_runs
    `).get() as { total: number; successes: number; avg_duration: number } | undefined;

    const byTool = db.prepare(`
      SELECT tool_name,
             COUNT(*) as count,
             ROUND(100.0 * SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) / COUNT(*), 1) as success_rate,
             ROUND(AVG(duration_ms)) as avg_duration
      FROM tool_runs
      GROUP BY tool_name ORDER BY count DESC
    `).all() as Array<{ tool_name: string; count: number; success_rate: number; avg_duration: number }>;

    return {
      totalRuns: totals?.total ?? 0,
      successRate: totals?.total ? ((totals.successes ?? 0) / totals.total) * 100 : 100,
      avgDurationMs: Math.round(totals?.avg_duration ?? 0),
      byTool,
    };
  } catch (error: unknown) {
    reportDbError('Failed to get tool run stats', error);
    return { totalRuns: 0, successRate: 100, avgDurationMs: 0, byTool: [] };
  }
}


export interface RuntimeThresholdRolloutJournalSummary {
  id: number;
  recordedAt: string;
  approvedBy: string;
  approvalTicket: string;
  approvedAt: string;
  changeWindow: string;
  notes?: string | null;
  overallAction: string;
  confidence: string;
  overallState: string;
  sampleCount: number;
  lastSampleAt?: string | null;
  canApply: boolean;
  applyReadOnlyReason?: string | null;
  summary?: Record<string, unknown>;
  plan?: Record<string, unknown>;
  renderedPlan?: string | null;
}

export interface RecordRolloutJournalInput {
  approvedBy: string;
  approvalTicket: string;
  approvedAt: string;
  changeWindow: string;
  notes?: string | null;
  summary?: Record<string, unknown>;
  plan?: Record<string, unknown>;
  renderedPlan?: string | null;
}

export function queryRuntimeThresholdRolloutJournalSummaries(opts: {
  approvalTicket?: string;
  limit?: number;
  offset?: number;
}): RuntimeThresholdRolloutJournalSummary[] {
  try {
    const db = getGlobalDb();
    db.prepare(`
      CREATE TABLE IF NOT EXISTS runtime_threshold_rollout_journal (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        recorded_at TEXT NOT NULL,
        approved_by TEXT NOT NULL,
        approval_ticket TEXT NOT NULL,
        approved_at TEXT NOT NULL,
        change_window TEXT NOT NULL,
        notes TEXT,
        overall_action TEXT NOT NULL,
        confidence TEXT NOT NULL,
        overall_state TEXT NOT NULL,
        sample_count INTEGER NOT NULL DEFAULT 0,
        last_sample_at TEXT,
        can_apply INTEGER NOT NULL DEFAULT 1,
        apply_readonly_reason TEXT,
        summary_json TEXT,
        plan_json TEXT,
        rendered_plan TEXT
      )
    `).run();

    const limit = opts.limit ?? 50;
    const offset = opts.offset ?? 0;
    let query = `SELECT * FROM runtime_threshold_rollout_journal`;
    const params: unknown[] = [];

    if (opts.approvalTicket) {
      query += ` WHERE approval_ticket = ?`;
      params.push(opts.approvalTicket);
    }

    query += ` ORDER BY id DESC LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    const rows = db.prepare(query).all(...params) as Array<Record<string, unknown>>;
    return rows.map((r) => ({
      id: r.id as number,
      recordedAt: r.recorded_at as string,
      approvedBy: r.approved_by as string,
      approvalTicket: r.approval_ticket as string,
      approvedAt: r.approved_at as string,
      changeWindow: r.change_window as string,
      notes: r.notes as string | null,
      overallAction: r.overall_action as string,
      confidence: r.confidence as string,
      overallState: r.overall_state as string,
      sampleCount: r.sample_count as number,
      lastSampleAt: r.last_sample_at as string | null,
      canApply: Boolean(r.can_apply),
      applyReadonlyReason: r.apply_readonly_reason as string | null,
    }));
  } catch (error: unknown) {
    reportDbError('Failed to query rollout journal', error);
    return [];
  }
}

export function recordRuntimeThresholdRolloutJournal(
  input: RecordRolloutJournalInput,
  snapshot: { summary?: Record<string, unknown> },
  plan: Record<string, unknown>,
  renderedPlan?: string,
): RuntimeThresholdRolloutJournalSummary {
  const db = getGlobalDb();
  db.prepare(`
    CREATE TABLE IF NOT EXISTS runtime_threshold_rollout_journal (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      recorded_at TEXT NOT NULL,
      approved_by TEXT NOT NULL,
      approval_ticket TEXT NOT NULL,
      approved_at TEXT NOT NULL,
      change_window TEXT NOT NULL,
      notes TEXT,
      overall_action TEXT NOT NULL,
      confidence TEXT NOT NULL,
      overall_state TEXT NOT NULL,
      sample_count INTEGER NOT NULL DEFAULT 0,
      last_sample_at TEXT,
      can_apply INTEGER NOT NULL DEFAULT 1,
      apply_readonly_reason TEXT,
      summary_json TEXT,
      plan_json TEXT,
      rendered_plan TEXT
    )
  `).run();

  const recordedAt = new Date().toISOString();
  const summary = snapshot.summary ?? {};
  const overallAction = (plan['overallAction'] as string) ?? 'observe';
  const confidence = (plan['confidence'] as string) ?? 'low';
  const overallState = (summary['overallState'] as string) ?? 'collecting';
  const sampleCount = (summary['sampleCount'] as number) ?? 0;
  const lastSampleAt = (summary['lastSampleAt'] as string) ?? null;
  const canApply = Boolean(plan['canApply'] ?? true);
  const applyReadonlyReason = (plan['applyReadOnlyReason'] as string) ?? null;

  const result = db.prepare(`
    INSERT INTO runtime_threshold_rollout_journal
      (recorded_at, approved_by, approval_ticket, approved_at, change_window, notes,
       overall_action, confidence, overall_state, sample_count, last_sample_at,
       can_apply, apply_readonly_reason, summary_json, plan_json, rendered_plan)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    recordedAt,
    input.approvedBy,
    input.approvalTicket,
    input.approvedAt,
    input.changeWindow,
    input.notes ?? null,
    overallAction,
    confidence,
    overallState,
    sampleCount,
    lastSampleAt,
    canApply ? 1 : 0,
    applyReadonlyReason,
    JSON.stringify(summary),
    JSON.stringify(plan),
    renderedPlan ?? null,
  );

  return {
    id: result.lastInsertRowid as number,
    recordedAt,
    approvedBy: input.approvedBy,
    approvalTicket: input.approvalTicket,
    approvedAt: input.approvedAt,
    changeWindow: input.changeWindow,
    notes: input.notes ?? null,
    overallAction,
    confidence,
    overallState,
    sampleCount,
    lastSampleAt,
    canApply,
    applyReadOnlyReason: applyReadonlyReason,
    summary,
    plan,
    renderedPlan: renderedPlan ?? null,
  };
}

export function getLatestRuntimeThresholdRolloutJournalSummary(): RuntimeThresholdRolloutJournalSummary | null {
  try {
    const db = getGlobalDb();
    db.prepare(`
      CREATE TABLE IF NOT EXISTS runtime_threshold_rollout_journal (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        recorded_at TEXT NOT NULL,
        approved_by TEXT NOT NULL,
        approval_ticket TEXT NOT NULL,
        approved_at TEXT NOT NULL,
        change_window TEXT NOT NULL,
        notes TEXT,
        overall_action TEXT NOT NULL,
        confidence TEXT NOT NULL,
        overall_state TEXT NOT NULL,
        sample_count INTEGER NOT NULL DEFAULT 0,
        last_sample_at TEXT,
        can_apply INTEGER NOT NULL DEFAULT 1,
        apply_readonly_reason TEXT,
        summary_json TEXT,
        plan_json TEXT,
        rendered_plan TEXT
      )
    `).run();

    const row = db.prepare(
      `SELECT * FROM runtime_threshold_rollout_journal ORDER BY id DESC LIMIT 1`
    ).get() as Record<string, unknown> | undefined;
    if (!row) return null;

    return {
      id: row.id as number,
      recordedAt: row.recorded_at as string,
      approvedBy: row.approved_by as string,
      approvalTicket: row.approval_ticket as string,
      approvedAt: row.approved_at as string,
      changeWindow: row.change_window as string,
      notes: row.notes as string | null,
      overallAction: row.overall_action as string,
      confidence: row.confidence as string,
      overallState: row.overall_state as string,
      sampleCount: row.sample_count as number,
      lastSampleAt: row.last_sample_at as string | null,
      canApply: Boolean(row.can_apply),
      applyReadOnlyReason: row.apply_readonly_reason as string | null,
    };
  } catch (error: unknown) {
    reportDbError('Failed to get latest rollout journal', error);
    return null;
  }
}
