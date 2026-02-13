-- D1 Database: bas-metadata
-- Migration: 0002_task_analytics
-- Description: Task history, agent metrics, and routing decision tracking

-- Task history: every processed task with timing and result
CREATE TABLE IF NOT EXISTS task_history (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL CHECK(type IN ('browser', 'research', 'code', 'orchestrate')),
    agent_name TEXT,
    instruction TEXT NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('pending', 'dispatched', 'running', 'completed', 'failed')),
    routing_method TEXT CHECK(routing_method IN ('keyword', 'llm', 'explicit', 'fallback')),
    result_summary TEXT,
    duration_ms INTEGER,
    created_at TEXT DEFAULT (datetime('now')),
    completed_at TEXT,
    context TEXT -- JSON
);

-- Agent metrics: rolling performance stats per agent
CREATE TABLE IF NOT EXISTS agent_metrics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    agent_name TEXT NOT NULL,
    period TEXT NOT NULL, -- 'hourly', 'daily'
    period_start TEXT NOT NULL,
    tasks_total INTEGER DEFAULT 0,
    tasks_success INTEGER DEFAULT 0,
    tasks_failed INTEGER DEFAULT 0,
    avg_duration_ms REAL DEFAULT 0,
    p95_duration_ms REAL DEFAULT 0,
    UNIQUE(agent_name, period, period_start)
);

-- Routing decisions: audit trail for task classification
CREATE TABLE IF NOT EXISTS routing_decisions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id TEXT NOT NULL,
    method TEXT NOT NULL CHECK(method IN ('keyword', 'llm', 'explicit', 'trigger', 'fallback')),
    matched_agent TEXT NOT NULL,
    confidence REAL,
    keyword_hits INTEGER,
    llm_model TEXT,
    llm_latency_ms INTEGER,
    decided_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (task_id) REFERENCES task_history(id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_task_history_status ON task_history(status);
CREATE INDEX IF NOT EXISTS idx_task_history_agent ON task_history(agent_name);
CREATE INDEX IF NOT EXISTS idx_task_history_created ON task_history(created_at);
CREATE INDEX IF NOT EXISTS idx_agent_metrics_agent ON agent_metrics(agent_name, period);
CREATE INDEX IF NOT EXISTS idx_routing_decisions_task ON routing_decisions(task_id);
CREATE INDEX IF NOT EXISTS idx_routing_decisions_method ON routing_decisions(method);
