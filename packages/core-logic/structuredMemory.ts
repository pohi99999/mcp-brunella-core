import { getGlobalDb } from "@packages/utils/globalDb.js";
import { logError, logInfo } from "@packages/utils/logger.js";
import { hashTask } from "./hashUtils.js";

export interface StoredAgentMemory<T = unknown> {
  id: number;
  agentName: string;
  taskHash: string;
  normalizedTask: string;
  rawTask: string;
  result: T;
  confidence: number;
  status: string;
  reuseCount: number;
  ttlDays: number;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
  lastReusedAt: string | null;
}

export interface SaveMemoryParams<T = unknown> {
  agentName: string;
  task: string;
  result: T;
  confidence: number;
  status?: string;
  ttlDays?: number;
}

export interface MemoryQueryParams {
  agentName?: string;
  task?: string;
  limit?: number;
  includeExpired?: boolean;
}

export interface MemoryStatsSummary {
  totalEntries: number;
  avgConfidence: number;
  totalReuses: number;
}

export interface MemoryStatsByAgent extends MemoryStatsSummary {
  agentName: string;
  lastUpdatedAt: string | null;
}

let initialized = false;

function ensureInitialized(): void {
  if (initialized) {
    return;
  }

  const db = getGlobalDb();
  db.pragma("journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS agent_memories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      agent_name TEXT NOT NULL,
      task_hash TEXT NOT NULL,
      normalized_task TEXT NOT NULL,
      raw_task TEXT NOT NULL,
      result_json TEXT NOT NULL,
      confidence REAL NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'success',
      reuse_count INTEGER NOT NULL DEFAULT 0,
      ttl_days INTEGER NOT NULL DEFAULT 30,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      last_reused_at TEXT,
      UNIQUE(agent_name, task_hash)
    );

    CREATE INDEX IF NOT EXISTS idx_agent_memories_agent_name ON agent_memories(agent_name);
    CREATE INDEX IF NOT EXISTS idx_agent_memories_expires_at ON agent_memories(expires_at);
    CREATE INDEX IF NOT EXISTS idx_agent_memories_last_reused_at ON agent_memories(last_reused_at);
  `);

  initialized = true;
}

function mapMemoryRow(row: Record<string, unknown>): StoredAgentMemory {
  return {
    id: Number(row.id),
    agentName: String(row.agent_name),
    taskHash: String(row.task_hash),
    normalizedTask: String(row.normalized_task),
    rawTask: String(row.raw_task),
    result: JSON.parse(String(row.result_json)),
    confidence: Number(row.confidence ?? 0),
    status: String(row.status ?? "success"),
    reuseCount: Number(row.reuse_count ?? 0),
    ttlDays: Number(row.ttl_days ?? 30),
    expiresAt: String(row.expires_at),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    lastReusedAt: row.last_reused_at ? String(row.last_reused_at) : null,
  };
}

function buildExpiryDate(ttlDays: number): string {
  const expires = new Date();
  expires.setUTCDate(expires.getUTCDate() + ttlDays);
  return expires.toISOString();
}

function scoreTokenOverlap(left: string, right: string): number {
  const leftTokens = new Set(left.split(/\s+/).filter(Boolean));
  const rightTokens = new Set(right.split(/\s+/).filter(Boolean));
  if (leftTokens.size === 0 || rightTokens.size === 0) {
    return 0;
  }

  let overlap = 0;
  for (const token of leftTokens) {
    if (rightTokens.has(token)) {
      overlap += 1;
    }
  }

  return overlap / Math.max(leftTokens.size, rightTokens.size);
}

export function initMemoryDb(): void {
  ensureInitialized();
}

export function saveMemory<T = unknown>(params: SaveMemoryParams<T>): StoredAgentMemory<T> {
  ensureInitialized();

  const ttlDays = Math.max(1, Math.trunc(params.ttlDays ?? 30));
  const { normalizedTask, taskHash } = hashTask(params.task);
  const nowIso = new Date().toISOString();
  const expiresAt = buildExpiryDate(ttlDays);
  const db = getGlobalDb();

  db.prepare(`
    INSERT INTO agent_memories (
      agent_name, task_hash, normalized_task, raw_task, result_json,
      confidence, status, ttl_days, expires_at, created_at, updated_at
    ) VALUES (
      @agent_name, @task_hash, @normalized_task, @raw_task, @result_json,
      @confidence, @status, @ttl_days, @expires_at, @created_at, @updated_at
    )
    ON CONFLICT(agent_name, task_hash) DO UPDATE SET
      normalized_task = excluded.normalized_task,
      raw_task = excluded.raw_task,
      result_json = excluded.result_json,
      confidence = excluded.confidence,
      status = excluded.status,
      ttl_days = excluded.ttl_days,
      expires_at = excluded.expires_at,
      updated_at = excluded.updated_at
  `).run({
    agent_name: params.agentName,
    task_hash: taskHash,
    normalized_task: normalizedTask,
    raw_task: params.task,
    result_json: JSON.stringify(params.result),
    confidence: params.confidence,
    status: params.status ?? "success",
    ttl_days: ttlDays,
    expires_at: expiresAt,
    created_at: nowIso,
    updated_at: nowIso,
  });

  const row = db.prepare(`
    SELECT *
    FROM agent_memories
    WHERE agent_name = ? AND task_hash = ?
  `).get(params.agentName, taskHash) as Record<string, unknown> | undefined;

  if (!row) {
    throw new Error(`Nem sikerült visszaolvasni a mentett memóriát: ${params.agentName}/${taskHash}`);
  }

  return mapMemoryRow(row) as StoredAgentMemory<T>;
}

export function queryMemory(params: MemoryQueryParams): StoredAgentMemory[] {
  ensureInitialized();
  const limit = Math.max(1, Math.trunc(params.limit ?? 5));
  const db = getGlobalDb();

  const filters: string[] = [];
  const values: Array<string | number> = [];

  if (!params.includeExpired) {
    filters.push("expires_at > ?");
    values.push(new Date().toISOString());
  }

  if (params.agentName) {
    filters.push("agent_name = ?");
    values.push(params.agentName);
  }

  if (params.task) {
    const { normalizedTask, taskHash } = hashTask(params.task);
    const exactSql = `
      SELECT *
      FROM agent_memories
      WHERE ${[...filters, "task_hash = ?"].join(" AND ")}
      ORDER BY confidence DESC, updated_at DESC
      LIMIT ?
    `;
    const exactRow = db.prepare(exactSql).all(...values, taskHash, limit) as Record<string, unknown>[];
    if (exactRow.length > 0) {
      return exactRow.map(mapMemoryRow);
    }

    const likeSql = `
      SELECT *
      FROM agent_memories
      ${filters.length > 0 ? `WHERE ${filters.join(" AND ")}` : ""}
      ORDER BY confidence DESC, updated_at DESC
      LIMIT ?
    `;
    return (db.prepare(likeSql).all(...values, Math.max(limit * 10, 25)) as Record<string, unknown>[])
      .map(mapMemoryRow)
      .map((memory) => ({
        memory,
        score: scoreTokenOverlap(normalizedTask, memory.normalizedTask),
      }))
      .filter((item) => item.score > 0)
      .sort((a, b) => {
        if (b.score !== a.score) {
          return b.score - a.score;
        }
        if (b.memory.confidence !== a.memory.confidence) {
          return b.memory.confidence - a.memory.confidence;
        }
        return b.memory.updatedAt.localeCompare(a.memory.updatedAt);
      })
      .slice(0, limit)
      .map((item) => item.memory);
  }

  const sql = `
    SELECT *
    FROM agent_memories
    ${filters.length > 0 ? `WHERE ${filters.join(" AND ")}` : ""}
    ORDER BY updated_at DESC
    LIMIT ?
  `;

  return (db.prepare(sql).all(...values, limit) as Record<string, unknown>[]).map(mapMemoryRow);
}

export function incrementReuseCount(agentName: string, taskHash: string): void {
  ensureInitialized();
  const db = getGlobalDb();
  db.prepare(`
    UPDATE agent_memories
    SET reuse_count = reuse_count + 1,
        last_reused_at = @last_reused_at,
        updated_at = @updated_at
    WHERE agent_name = @agent_name AND task_hash = @task_hash
  `).run({
    agent_name: agentName,
    task_hash: taskHash,
    last_reused_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
}

export function purgeExpired(minConfidence?: number): number {
  ensureInitialized();
  const db = getGlobalDb();
  const threshold = typeof minConfidence === "number" ? minConfidence : null;
  const nowIso = new Date().toISOString();

  const result = threshold === null
    ? db.prepare(`DELETE FROM agent_memories WHERE expires_at <= ?`).run(nowIso)
    : db.prepare(`
        DELETE FROM agent_memories
        WHERE expires_at <= ? OR confidence < ?
      `).run(nowIso, threshold);

  return Number(result.changes ?? 0);
}

export function getMemoryStats(): { summary: MemoryStatsSummary; agents: MemoryStatsByAgent[] } {
  ensureInitialized();
  const db = getGlobalDb();
  const summaryRow = db.prepare(`
    SELECT
      COUNT(*) AS total_entries,
      COALESCE(AVG(confidence), 0) AS avg_confidence,
      COALESCE(SUM(reuse_count), 0) AS total_reuses
    FROM agent_memories
    WHERE expires_at > ?
  `).get(new Date().toISOString()) as Record<string, unknown>;

  const rows = db.prepare(`
    SELECT
      agent_name,
      COUNT(*) AS total_entries,
      COALESCE(AVG(confidence), 0) AS avg_confidence,
      COALESCE(SUM(reuse_count), 0) AS total_reuses,
      MAX(updated_at) AS last_updated_at
    FROM agent_memories
    WHERE expires_at > ?
    GROUP BY agent_name
    ORDER BY total_entries DESC, avg_confidence DESC
  `).all(new Date().toISOString()) as Record<string, unknown>[];

  return {
    summary: {
      totalEntries: Number(summaryRow.total_entries ?? 0),
      avgConfidence: Number(summaryRow.avg_confidence ?? 0),
      totalReuses: Number(summaryRow.total_reuses ?? 0),
    },
    agents: rows.map((row) => ({
      agentName: String(row.agent_name),
      totalEntries: Number(row.total_entries ?? 0),
      avgConfidence: Number(row.avg_confidence ?? 0),
      totalReuses: Number(row.total_reuses ?? 0),
      lastUpdatedAt: row.last_updated_at ? String(row.last_updated_at) : null,
    })),
  };
}

export function getRecentPatternReuses(limit = 10): StoredAgentMemory[] {
  ensureInitialized();
  const db = getGlobalDb();
  return (db.prepare(`
    SELECT *
    FROM agent_memories
    WHERE last_reused_at IS NOT NULL
    ORDER BY last_reused_at DESC
    LIMIT ?
  `).all(Math.max(1, Math.trunc(limit))) as Record<string, unknown>[]).map(mapMemoryRow);
}

export function exportStructuredMemories(format: "jsonl" | "json" = "jsonl"): string {
  const rows = queryMemory({ limit: 10000, includeExpired: true });

  if (format === "json") {
    return JSON.stringify(rows, null, 2);
  }

  return rows
    .map((row) => JSON.stringify(row))
    .join("\n");
}

try {
  initMemoryDb();
  logInfo("StructuredMemory", "Structured memory DB initialized");
} catch (error) {
  logError("StructuredMemory", `Init hiba: ${error instanceof Error ? error.message : String(error)}`);
}

