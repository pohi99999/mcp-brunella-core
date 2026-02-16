-- CEAN D1 Database Schema
-- Purpose: Task queue, execution logs, and results storage for Edge Agents
-- Created: 2026-02-15

-- ============================================================================
-- 1. EDGE_TASKS - Main task queue for agents
-- ============================================================================
CREATE TABLE IF NOT EXISTS edge_tasks (
  id TEXT PRIMARY KEY,                          -- UUID: task-{timestamp}-{random}
  agent_type TEXT NOT NULL,                     -- research|grant|harvest|extract|builder
  status TEXT NOT NULL DEFAULT 'pending',       -- pending|running|completed|failed|cancelled
  priority INTEGER DEFAULT 5,                   -- 1-10 (10 = highest)
  
  -- Task Payload
  payload JSON NOT NULL,                        -- Agent-specific request data
  
  -- Execution Tracking
  assigned_worker_id TEXT,                      -- Worker instance ID
  started_at TEXT,                              -- ISO-8601: when worker started
  completed_at TEXT,                            -- ISO-8601: when worker finished
  
  -- Results
  result_data JSON,                             -- Agent result (JSON)
  error_message TEXT,                           -- Error details if failed
  
  -- Metadata
  created_at TEXT NOT NULL,                     -- ISO-8601: task creation
  updated_at TEXT NOT NULL,                     -- ISO-8601: last update
  retry_count INTEGER DEFAULT 0,                -- Number of retry attempts
  max_retries INTEGER DEFAULT 3,                -- Max retry limit
  
  -- Metadata Tags
  tags TEXT,                                    -- Comma-separated: research,github,urgent
  request_id TEXT,                              -- Tracking: from GitHub/webhook
  
  -- Cost Tracking
  estimated_cost REAL,                          -- Estimated $ for this task
  actual_cost REAL,                             -- Actual $ spent
  duration_seconds INTEGER                      -- Execution time
);

CREATE INDEX IF NOT EXISTS idx_edge_tasks_status ON edge_tasks(status);
CREATE INDEX IF NOT EXISTS idx_edge_tasks_agent_type ON edge_tasks(agent_type);
CREATE INDEX IF NOT EXISTS idx_edge_tasks_created_at ON edge_tasks(created_at);
CREATE INDEX IF NOT EXISTS idx_edge_tasks_priority ON edge_tasks(priority);
CREATE UNIQUE INDEX IF NOT EXISTS idx_edge_tasks_request_id ON edge_tasks(request_id);

-- ============================================================================
-- 2. EDGE_EXECUTIONS - Detailed execution logs
-- ============================================================================
CREATE TABLE IF NOT EXISTS edge_executions (
  id TEXT PRIMARY KEY,                          -- UUID: exec-{timestamp}-{random}
  task_id TEXT NOT NULL,                        -- FK to edge_tasks
  
  -- Execution Details
  worker_name TEXT NOT NULL,                    -- e.g., "research-agent"
  worker_version TEXT,                          -- Deploy version: v1.0.0
  worker_region TEXT,                           -- Edge location
  
  -- Performance
  start_time TEXT NOT NULL,                     -- ISO-8601
  end_time TEXT,                                -- ISO-8601
  duration_ms INTEGER,                          -- Milliseconds
  cpu_ms INTEGER,                               -- CPU time
  wall_clock_ms INTEGER,                        -- Real time
  
  -- Resource Usage
  memory_mb INTEGER,                            -- Memory used
  data_transferred_mb REAL,                     -- Network transfer
  
  -- Status
  status TEXT NOT NULL DEFAULT 'running',       -- running|success|failure|timeout
  exit_code INTEGER,                            -- Process exit code
  signal TEXT,                                  -- Termination signal if any
  
  -- Logs
  stdout_log TEXT,                              -- Standard output (truncated)
  stderr_log TEXT,                              -- Standard error (truncated)
  
  -- Cost
  cost_usd REAL,                                -- Cloudflare cost for this exec

  -- Metadata
  created_at TEXT NOT NULL,
  FOREIGN KEY (task_id) REFERENCES edge_tasks(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_edge_executions_task_id ON edge_executions(task_id);
CREATE INDEX IF NOT EXISTS idx_edge_executions_worker_name ON edge_executions(worker_name);
CREATE INDEX IF NOT EXISTS idx_edge_executions_status ON edge_executions(status);

-- ============================================================================
-- 3. EDGE_RESULTS - Processed results and findings
-- ============================================================================
CREATE TABLE IF NOT EXISTS edge_results (
  id TEXT PRIMARY KEY,                          -- UUID: result-{timestamp}-{random}
  task_id TEXT NOT NULL,                        -- FK to edge_tasks
  
  -- Result Type
  result_type TEXT NOT NULL,                    -- research|grant|harvested|extracted|prediction
  
  -- Content
  title TEXT NOT NULL,                          -- Short result title
  description TEXT,                             -- Full description
  content JSON NOT NULL,                        -- Structured result data
  
  -- Relevance/Quality
  relevance_score REAL,                         -- 0-100: how relevant
  confidence_score REAL,                        -- 0-100: how confident
  
  -- Vector Embedding (for R1 sync)
  embedding_id TEXT,                            -- Reference to R1 vector ID
  embedding_model TEXT,                         -- Which embedding model used
  
  -- Classification
  category TEXT,                                -- Domain category
  tags TEXT,                                    -- Comma-separated tags
  
  -- Source
  source_url TEXT,                              -- Where result came from
  source_name TEXT,                             -- Source identifier
  
  -- Metadata
  created_at TEXT NOT NULL,
  synced_to_r1_at TEXT,                         -- When synced to Vector DB
  expires_at TEXT,                              -- Optional expiration

  FOREIGN KEY (task_id) REFERENCES edge_tasks(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_edge_results_task_id ON edge_results(task_id);
CREATE INDEX IF NOT EXISTS idx_edge_results_result_type ON edge_results(result_type);
CREATE INDEX IF NOT EXISTS idx_edge_results_relevance_score ON edge_results(relevance_score);
CREATE INDEX IF NOT EXISTS idx_edge_results_created_at ON edge_results(created_at);

-- ============================================================================
-- 4. EDGE_METRICS - Aggregate metrics and monitoring
-- ============================================================================
CREATE TABLE IF NOT EXISTS edge_metrics (
  id TEXT PRIMARY KEY,                          -- UUID
  
  -- Time Bucket
  bucket_date TEXT NOT NULL,                    -- Date: YYYY-MM-DD
  bucket_hour TEXT,                             -- Hour: YYYY-MM-DD HH:00
  
  -- Agent Type
  agent_type TEXT NOT NULL,                     -- research|grant|harvest|extract|builder
  
  -- Counts
  tasks_total INTEGER DEFAULT 0,                -- Total tasks
  tasks_completed INTEGER DEFAULT 0,            -- Successful
  tasks_failed INTEGER DEFAULT 0,               -- Failed
  tasks_skipped INTEGER DEFAULT 0,              -- Skipped/cancelled
  
  -- Performance
  avg_duration_ms INTEGER,                      -- Average execution time
  max_duration_ms INTEGER,                      -- Slowest task
  min_duration_ms INTEGER,                      -- Fastest task
  
  -- Results
  results_found INTEGER DEFAULT 0,              -- Results created
  
  -- Cost
  total_cost_usd REAL DEFAULT 0.0,              -- Total $ for period
  avg_cost_per_task REAL,                       -- Avg cost
  
  -- Errors
  error_count INTEGER DEFAULT 0,                -- Total errors
  error_rate REAL,                              -- Error % (0-100)
  
  -- Uptime
  uptime_percent REAL DEFAULT 100,              -- Availability %
  
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_edge_metrics_bucket ON edge_metrics(bucket_date, agent_type);
CREATE INDEX IF NOT EXISTS idx_edge_metrics_agent_type ON edge_metrics(agent_type);

-- ============================================================================
-- 5. EDGE_WORKERS_STATUS - Worker health and status
-- ============================================================================
CREATE TABLE IF NOT EXISTS edge_workers_status (
  id TEXT PRIMARY KEY,                          -- UUID
  
  -- Worker Identity
  worker_name TEXT NOT NULL UNIQUE,             -- research-agent, grant-monitor, etc
  worker_version TEXT,                          -- Current deployed version
  
  -- Status
  status TEXT NOT NULL DEFAULT 'offline',       -- online|offline|degraded|maintenance
  last_heartbeat TEXT,                          -- ISO-8601: last ping
  
  -- Metrics
  uptime_24h REAL DEFAULT 0,                    -- 24-hour uptime %
  uptime_7d REAL DEFAULT 0,                     -- 7-day uptime %
  uptime_30d REAL DEFAULT 0,                    -- 30-day uptime %
  
  -- Performance
  avg_latency_ms REAL DEFAULT 0,                -- Avg response time
  error_rate_24h REAL DEFAULT 0,                -- Error % last 24h
  
  -- Cost
  monthly_cost_usd REAL DEFAULT 0,              -- Running cost this month
  
  -- Configuration
  config JSON,                                  -- Worker config (env, etc)
  
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_edge_workers_status ON edge_workers_status(status);

-- ============================================================================
-- 6. CEAN_CHAT_HISTORY - OrchestratorChat message storage
-- ============================================================================
CREATE TABLE IF NOT EXISTS cean_chat_history (
  id TEXT PRIMARY KEY,                          -- UUID: msg-{timestamp}-{random}
  session_id TEXT NOT NULL,                     -- Chat session ID
  role TEXT NOT NULL,                           -- user|assistant
  content TEXT NOT NULL,                        -- Message text
  task_id TEXT,                                 -- Associated task ID (if any)
  timestamp INTEGER NOT NULL,                   -- Unix epoch timestamp
  created_at TEXT NOT NULL                      -- ISO-8601
);

CREATE INDEX IF NOT EXISTS idx_cean_chat_session_id ON cean_chat_history(session_id);
CREATE INDEX IF NOT EXISTS idx_cean_chat_role ON cean_chat_history(role);
CREATE INDEX IF NOT EXISTS idx_cean_chat_created_at ON cean_chat_history(created_at);

-- ============================================================================
-- 7. EDGE_AUDIT_LOG - Audit trail for compliance
-- ============================================================================
CREATE TABLE IF NOT EXISTS edge_audit_log (
  id TEXT PRIMARY KEY,                          -- UUID
  
  -- Event
  event_type TEXT NOT NULL,                     -- task_created|task_completed|error|config_change
  entity_type TEXT,                             -- edge_task|edge_execution|edge_worker
  entity_id TEXT,                               -- ID of affected entity
  
  -- Details
  actor TEXT,                                   -- Who/what triggered (system|user|webhook)
  action TEXT NOT NULL,                         -- What happened
  details JSON,                                 -- Additional context
  
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_edge_audit_event_type ON edge_audit_log(event_type);
CREATE INDEX IF NOT EXISTS idx_edge_audit_entity ON edge_audit_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_edge_audit_created_at ON edge_audit_log(created_at);

-- ============================================================================
-- 8. CEAN_FLEETS - Worker fleet definitions (Phase 2)
-- ============================================================================
CREATE TABLE IF NOT EXISTS cean_fleets (
  id TEXT PRIMARY KEY,                          -- UUID: fleet-{timestamp}-{random}
  name TEXT NOT NULL,                           -- Fleet name
  environment TEXT NOT NULL DEFAULT 'production',  -- dev|staging|production
  status TEXT NOT NULL DEFAULT 'active',        -- active|paused|draining
  description TEXT,                             -- Optional description
  
  -- Configuration
  config JSON,                                  -- Fleet-specific config
  
  -- Metadata
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_cean_fleets_name ON cean_fleets(name);
CREATE INDEX IF NOT EXISTS idx_cean_fleets_environment ON cean_fleets(environment);
CREATE INDEX IF NOT EXISTS idx_cean_fleets_status ON cean_fleets(status);
CREATE INDEX IF NOT EXISTS idx_cean_fleets_created_at ON cean_fleets(created_at);

-- ============================================================================
-- 9. CEAN_WORKERS - Individual worker instances in fleets (Phase 2)
-- ============================================================================
CREATE TABLE IF NOT EXISTS cean_workers (
  id TEXT PRIMARY KEY,                          -- UUID: worker-{timestamp}-{random}
  fleet_id TEXT NOT NULL,                       -- FK to cean_fleets
  name TEXT NOT NULL,                           -- Worker name
  url TEXT NOT NULL,                            -- Worker URL (Cloudflare endpoint)
  cloudflare_id TEXT,                           -- Cloudflare resource ID
  
  -- Status
  status TEXT NOT NULL DEFAULT 'active',        -- active|paused|draining|removing
  
  -- Metrics
  last_heartbeat TEXT,                          -- ISO-8601: last ping
  error_count INTEGER DEFAULT 0,                -- Accumulated errors
  
  -- Metadata
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  
  FOREIGN KEY (fleet_id) REFERENCES cean_fleets(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_cean_workers_fleet_id ON cean_workers(fleet_id);
CREATE INDEX IF NOT EXISTS idx_cean_workers_status ON cean_workers(status);
CREATE INDEX IF NOT EXISTS idx_cean_workers_created_at ON cean_workers(created_at);

-- ============================================================================
-- 10. CEAN_SCALING_EVENTS - Auto-scaling history (Phase 2)
-- ============================================================================
CREATE TABLE IF NOT EXISTS cean_scaling_events (
  id TEXT PRIMARY KEY,                          -- UUID: scale-{timestamp}-{random}
  fleet_id TEXT NOT NULL,                       -- FK to cean_fleets
  
  -- Event Details
  event_type TEXT NOT NULL,                     -- scale_up|scale_down|failed
  reason TEXT NOT NULL,                         -- Why scaling was triggered
  
  -- Counts
  instance_count_before INTEGER NOT NULL,       -- Worker count before
  instance_count_after INTEGER NOT NULL,        -- Worker count after
  
  -- Outcome
  status TEXT NOT NULL DEFAULT 'completed',     -- completed|failed
  error_message TEXT,                           -- Error details if failed
  
  -- Metadata
  created_at TEXT NOT NULL,
  
  FOREIGN KEY (fleet_id) REFERENCES cean_fleets(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_cean_scaling_fleet_id ON cean_scaling_events(fleet_id);
CREATE INDEX IF NOT EXISTS idx_cean_scaling_event_type ON cean_scaling_events(event_type);
CREATE INDEX IF NOT EXISTS idx_cean_scaling_created_at ON cean_scaling_events(created_at);

-- ============================================================================
-- 11. CEAN_METRICS_CACHE - Prometheus metrics cache (Phase 2)
-- ============================================================================
CREATE TABLE IF NOT EXISTS cean_metrics_cache (
  id TEXT PRIMARY KEY,                          -- UUID
  worker_id TEXT NOT NULL,                      -- FK to cean_workers
  
  -- Timestamp
  timestamp TEXT NOT NULL,                      -- ISO-8601: measurement time
  
  -- Latency Metrics
  latency_p50 REAL,                             -- Milliseconds (50th percentile)
  latency_p95 REAL,                             -- Milliseconds (95th percentile)
  latency_p99 REAL,                             -- Milliseconds (99th percentile)
  
  -- Request Metrics
  request_count INTEGER DEFAULT 0,              -- Total requests in window
  error_count INTEGER DEFAULT 0,                -- Error count
  error_rate REAL,                              -- Error % (0-100)
  
  -- Resource Metrics
  memory_usage_mb REAL,                         -- Memory used
  memory_limit_mb REAL,                         -- Memory limit
  
  -- Geographic
  cloudflare_location TEXT,                     -- Edge location (e.g., 'LAX')
  
  -- Metadata
  created_at TEXT NOT NULL,
  
  FOREIGN KEY (worker_id) REFERENCES cean_workers(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_cean_metrics_worker_id ON cean_metrics_cache(worker_id);
CREATE INDEX IF NOT EXISTS idx_cean_metrics_timestamp ON cean_metrics_cache(timestamp);
CREATE INDEX IF NOT EXISTS idx_cean_metrics_created_at ON cean_metrics_cache(created_at);

-- ============================================================================
-- 12. CEAN_METRICS_ARCHIVE - Long-term metrics storage with retention (Phase 2 C.2)
-- ============================================================================
CREATE TABLE IF NOT EXISTS cean_metrics_archive (
  id TEXT PRIMARY KEY,                          -- UUID
  
  -- Time
  timestamp TEXT NOT NULL,                      -- ISO-8601: measurement time
  
  -- Fleet Information
  fleet_id TEXT,                                -- FK to cean_fleets
  worker_id TEXT,                               -- FK to cean_workers
  
  -- Metric Metadata
  metric_name TEXT NOT NULL,                    -- e.g., fleet_requests_total, worker_latency_ms
  metric_type TEXT,                             -- gauge|counter|histogram
  
  -- Metric Value
  metric_value REAL NOT NULL,                   -- Numeric value
  
  -- Labels (JSON)
  labels TEXT,                                  -- JSON: {worker_id, region, status, ...}
  
  -- Metadata
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_cean_metrics_archive_fleet_time ON cean_metrics_archive(fleet_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_cean_metrics_archive_worker_time ON cean_metrics_archive(worker_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_cean_metrics_archive_metric_name ON cean_metrics_archive(metric_name);
CREATE INDEX IF NOT EXISTS idx_cean_metrics_archive_timestamp ON cean_metrics_archive(timestamp);
CREATE INDEX IF NOT EXISTS idx_cean_metrics_archive_created_at ON cean_metrics_archive(created_at);

-- ============================================================================
-- Trigger: Update edge_tasks.updated_at on modification
-- ============================================================================
-- Note: SQLite doesn't support triggers in D1, so updates must be explicit

-- ============================================================================
-- Initial Data: Insert default worker status rows
-- ============================================================================
INSERT OR IGNORE INTO edge_workers_status (id, worker_name, worker_version, status, created_at, updated_at)
VALUES 
  ('worker-1', 'research-agent', 'v1.0.0', 'offline', datetime('now'), datetime('now')),
  ('worker-2', 'grant-monitor', 'v1.0.0', 'offline', datetime('now'), datetime('now')),
  ('worker-3', 'data-harvester', 'v1.0.0', 'offline', datetime('now'), datetime('now')),
  ('worker-4', 'data-extractor', 'v1.0.0', 'offline', datetime('now'), datetime('now')),
  ('worker-5', 'builder-agent', 'v1.0.0', 'offline', datetime('now'), datetime('now'));

-- ============================================================================
-- Version: 1.0.0
-- Last Updated: 2026-02-15
-- Creator: Brunella CEAN Phase 1A
-- ============================================================================
