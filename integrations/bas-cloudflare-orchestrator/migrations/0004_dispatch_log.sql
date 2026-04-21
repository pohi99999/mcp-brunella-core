-- D1 Database: bas-metadata
-- Migration: 0004_dispatch_log
-- Description: Dispatch decision audit trail for smart Cloudflare routing

CREATE TABLE IF NOT EXISTS dispatch_log (
    id TEXT PRIMARY KEY,
    agent_name TEXT,
    task_type TEXT,
    target TEXT,
    reason TEXT,
    success INTEGER,
    latency_ms INTEGER,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_dispatch_log_agent ON dispatch_log(agent_name);
CREATE INDEX IF NOT EXISTS idx_dispatch_log_target ON dispatch_log(target);
CREATE INDEX IF NOT EXISTS idx_dispatch_log_created_at ON dispatch_log(created_at);
