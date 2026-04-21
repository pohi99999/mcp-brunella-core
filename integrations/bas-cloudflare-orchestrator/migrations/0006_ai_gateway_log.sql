-- AI Gateway Logging
-- Migration: 0006_ai_gateway_log
-- Description: Table for tracking LLM usage, prompts, and performance

CREATE TABLE IF NOT EXISTS ai_calls (
    id TEXT PRIMARY KEY,
    model TEXT NOT NULL,
    prompt TEXT,
    response TEXT,
    tokens_in INTEGER,
    tokens_out INTEGER,
    latency_ms INTEGER,
    status TEXT,
    error TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_ai_calls_model ON ai_calls(model);
CREATE INDEX IF NOT EXISTS idx_ai_calls_created_at ON ai_calls(created_at);
