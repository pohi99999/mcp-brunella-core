-- CEAN D1 schema used by the metrics archive tests
CREATE TABLE IF NOT EXISTS cean_metrics_archive (
  id TEXT PRIMARY KEY,
  timestamp TEXT NOT NULL,
  fleet_id TEXT,
  worker_id TEXT,
  metric_name TEXT NOT NULL,
  metric_value REAL NOT NULL,
  labels TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_cean_metrics_archive_fleet_time
  ON cean_metrics_archive(fleet_id, timestamp);

CREATE INDEX IF NOT EXISTS idx_cean_metrics_archive_worker_time
  ON cean_metrics_archive(worker_id, timestamp);

CREATE INDEX IF NOT EXISTS idx_cean_metrics_archive_metric_time
  ON cean_metrics_archive(metric_name, timestamp);

CREATE TABLE IF NOT EXISTS edge_runtime_mirror (
  key TEXT PRIMARY KEY,
  summary_json TEXT NOT NULL,
  mirrored_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS worker_routing (
  agent_name TEXT,
  worker_url TEXT,
  is_healthy INTEGER
);

CREATE TABLE IF NOT EXISTS worker_tasks (
  id TEXT PRIMARY KEY,
  agent_name TEXT,
  worker_url TEXT,
  task TEXT,
  context TEXT,
  status TEXT,
  result TEXT,
  error TEXT,
  completed_at TEXT
);

CREATE TABLE IF NOT EXISTS dispatch_log (
  id TEXT PRIMARY KEY,
  agent_name TEXT,
  task_type TEXT,
  target TEXT,
  reason TEXT,
  success INTEGER,
  latency_ms INTEGER,
  created_at TEXT NOT NULL
);