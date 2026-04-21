-- D1 Database: bas-metadata
-- Migration: 0001_initial_schema
-- Description: Initial schema for BAS hybrid cloud metadata

-- Tracks table: development threads state
CREATE TABLE IF NOT EXISTS tracks (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    status TEXT DEFAULT 'active' CHECK(status IN ('proposed', 'active', 'testing', 'completed', 'paused', 'archived')),
    progress INTEGER DEFAULT 0 CHECK(progress >= 0 AND progress <= 100),
    priority TEXT DEFAULT 'MEDIUM' CHECK(priority IN ('HIGH', 'MEDIUM', 'LOW')),
    owner TEXT,
    description TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

-- System state table: key-value store for system metadata
CREATE TABLE IF NOT EXISTS system_state (
    key TEXT PRIMARY KEY,
    value TEXT,
    type TEXT DEFAULT 'string' CHECK(type IN ('string', 'json', 'number', 'boolean')),
    updated_at TEXT DEFAULT (datetime('now'))
);

-- Sync log table: R2/LanceDB synchronization history
CREATE TABLE IF NOT EXISTS sync_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sync_type TEXT NOT NULL CHECK(sync_type IN ('lancedb_snapshot', 'tracks_sync', 'full_backup', 'restore')),
    status TEXT NOT NULL CHECK(status IN ('started', 'completed', 'failed')),
    source TEXT,
    destination TEXT,
    file_size INTEGER,
    details TEXT,
    error_message TEXT,
    started_at TEXT DEFAULT (datetime('now')),
    completed_at TEXT
);

-- Agents table: registered agents and their status
CREATE TABLE IF NOT EXISTS agents (
    name TEXT PRIMARY KEY,
    status TEXT DEFAULT 'idle' CHECK(status IN ('idle', 'working', 'error', 'offline')),
    last_task TEXT,
    last_activity TEXT DEFAULT (datetime('now')),
    capabilities TEXT, -- JSON array
    config TEXT -- JSON object
);

-- Indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_tracks_status ON tracks(status);
CREATE INDEX IF NOT EXISTS idx_tracks_priority ON tracks(priority);
CREATE INDEX IF NOT EXISTS idx_sync_log_type ON sync_log(sync_type);
CREATE INDEX IF NOT EXISTS idx_sync_log_status ON sync_log(status);
CREATE INDEX IF NOT EXISTS idx_agents_status ON agents(status);

-- Insert initial system state
INSERT OR IGNORE INTO system_state (key, value, type) VALUES
    ('version', '1.0.0', 'string'),
    ('last_full_sync', NULL, 'string'),
    ('local_lancedb_path', 'F:\\mcp-brunella-core\\.lancedb', 'string'),
    ('r2_bucket', 'vodor1', 'string'),
    ('r2_prefix', 'Brunella_core', 'string');
