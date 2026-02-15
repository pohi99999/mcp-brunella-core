import Database from 'better-sqlite3';
import path from 'path';
import { logInfo, logError } from './logger.js';

let globalDb: Database.Database | null = null;

/**
 * Initialize and get the global database instance
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
  } catch (error) {
    logError('GlobalDb', `Failed to open database: ${error}`);
    throw error;
  }
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

      CREATE INDEX IF NOT EXISTS idx_suggested_tasks_status ON suggested_tasks(status);
      CREATE INDEX IF NOT EXISTS idx_scheduled_tasks_enabled ON scheduled_tasks(enabled);
      CREATE INDEX IF NOT EXISTS idx_webhook_events_provider ON webhook_events(provider);
    `);

    logInfo('GlobalDb', 'Schema initialized');
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
