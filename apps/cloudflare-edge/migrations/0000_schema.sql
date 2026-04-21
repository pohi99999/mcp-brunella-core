-- Migration 0000: Initial tasks table
CREATE TABLE tasks (
  id TEXT PRIMARY KEY,           -- UUID or nanoid
  instruction TEXT NOT NULL,      -- Task instruction (user input)
  status TEXT NOT NULL,           -- 'pending' | 'running' | 'success' | 'error'
  result TEXT,                    -- Task result (JSON or plaintext)
  error TEXT,                     -- Error message if failed
  created_at INTEGER NOT NULL,    -- Unix timestamp (ms)
  updated_at INTEGER NOT NULL,    -- Unix timestamp (ms)
  completed_at INTEGER,           -- Completion timestamp
  metadata TEXT                   -- JSON extra metadata (agent, priority, etc.)
);

CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_created_at ON tasks(created_at);
CREATE INDEX idx_tasks_completed_at ON tasks(completed_at);
