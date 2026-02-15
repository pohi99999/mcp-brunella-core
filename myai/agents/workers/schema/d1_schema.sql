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
  duration_seconds INTEGER,                     -- Execution time
  
  INDEX idx_status (status),
  INDEX idx_agent_type (agent_type),
  INDEX idx_created_at (created_at),
  INDEX idx_priority (priority),
  UNIQUE INDEX idx_request_id (request_id)
);

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
  INDEX idx_task_id (task_id),
  INDEX idx_worker_name (worker_name),
  INDEX idx_status (status),
  FOREIGN KEY (task_id) REFERENCES edge_tasks(id) ON DELETE CASCADE
);

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
  
  INDEX idx_task_id (task_id),
  INDEX idx_result_type (result_type),
  INDEX idx_relevance_score (relevance_score),
  INDEX idx_created_at (created_at),
  FOREIGN KEY (task_id) REFERENCES edge_tasks(id) ON DELETE CASCADE
);

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
  updated_at TEXT NOT NULL,
  
  UNIQUE INDEX idx_bucket (bucket_date, agent_type),
  INDEX idx_agent_type (agent_type)
);

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
  updated_at TEXT NOT NULL,
  
  INDEX idx_status (status)
);

-- ============================================================================
-- 6. EDGE_AUDIT_LOG - Audit trail for compliance
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
  
  created_at TEXT NOT NULL,
  
  INDEX idx_event_type (event_type),
  INDEX idx_entity (entity_type, entity_id),
  INDEX idx_created_at (created_at)
);

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
