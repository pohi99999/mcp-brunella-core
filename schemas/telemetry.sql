-- FILE: schemas/telemetry.sql
-- PURPOSE: G5.2 — Token usage & trace persistence (SQLite)

CREATE TABLE IF NOT EXISTS telemetry_spans (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  trace_id    TEXT    NOT NULL,
  span_id     TEXT    NOT NULL UNIQUE,
  parent_span_id TEXT,
  agent_name  TEXT    NOT NULL,
  operation   TEXT    NOT NULL,
  start_time  INTEGER NOT NULL,
  end_time    INTEGER,
  duration_ms INTEGER,
  status      TEXT    NOT NULL DEFAULT 'running',
  input_tokens  INTEGER DEFAULT 0,
  output_tokens INTEGER DEFAULT 0,
  model       TEXT,
  provider    TEXT,
  metadata    TEXT,
  error       TEXT,
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_telemetry_trace_id ON telemetry_spans(trace_id);
CREATE INDEX IF NOT EXISTS idx_telemetry_agent    ON telemetry_spans(agent_name);
CREATE INDEX IF NOT EXISTS idx_telemetry_created  ON telemetry_spans(created_at);
CREATE INDEX IF NOT EXISTS idx_telemetry_status   ON telemetry_spans(status);
