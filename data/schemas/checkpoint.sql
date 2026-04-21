-- Gold Protocol - Checkpoint Schema
-- Used by: src/core/checkpoint.ts
-- Purpose: Partial task state persistence for Phoenix Protocol (RULE-PH1, RULE-PH5)

CREATE TABLE IF NOT EXISTS checkpoints (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id TEXT NOT NULL,
    step_index INTEGER NOT NULL,
    step_name TEXT NOT NULL,
    state_json TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_checkpoints_task_id ON checkpoints(task_id);
CREATE INDEX IF NOT EXISTS idx_checkpoints_task_step ON checkpoints(task_id, step_index);
