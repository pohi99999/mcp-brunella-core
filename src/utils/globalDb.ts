import type { Database as DatabaseType } from 'better-sqlite3';
import { logInfo, logError } from './logger.js';

let globalDb: DatabaseType | null = null;

/**
 * Initialize and get the global database instance
 */
export async function getGlobalDb(): Promise<DatabaseType> {
  if (globalDb) {
    return globalDb;
  }

  try {
    const { default: Database } = await import('better-sqlite3');
    const path = await import('path');

    const dbPath = path.join(process.cwd(), 'data', 'brunella.db');
    globalDb = new Database(dbPath);
    
    logInfo('GlobalDb', `Database opened: ${dbPath}`);
    
    // Initialize schema if needed
    initSchema(globalDb);
    
    return globalDb;
  } catch (error) {
    logError('GlobalDb', `Failed to open database: ${error}`);
    throw error;
  }
}

/**
 * Initialize database schema
 */
function initSchema(db: DatabaseType): void {
  try {
    // Create tables if they don't exist
    db.exec(`
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
    `);

    logInfo('GlobalDb', 'Schema initialized');

    // Create default "Brunella Agents" fleet if it doesn't exist
    const fleetCheck = db.prepare('SELECT COUNT(*) as count FROM cean_fleets WHERE id = ?').get('fleet-brunella-agents') as { count: number };

    if (fleetCheck.count === 0) {
      const now = new Date().toISOString();
      db.prepare(`
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
  } catch (error) {
    logError('GlobalDb', `Schema initialization failed: ${error}`);
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
