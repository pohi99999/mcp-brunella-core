-- Migration: 0001_phase1_tables
-- Description: Create Phase 1 tables for enterprise events, agent tasks, and golden samples
-- Date: 2026-02-21

-- enterprise_events: All enterprise-level events (API calls, agent actions, system events)
CREATE TABLE IF NOT EXISTS enterprise_events (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  payload TEXT NOT NULL,
  source_module TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'MEDIUM',
  status TEXT NOT NULL DEFAULT 'PENDING',
  created_at INTEGER NOT NULL,
  processed_at INTEGER
);

CREATE INDEX idx_enterprise_events_status ON enterprise_events(status);
CREATE INDEX idx_enterprise_events_created_at ON enterprise_events(created_at);
CREATE INDEX idx_enterprise_events_type ON enterprise_events(type);

-- agent_tasks: All agent task executions with results
CREATE TABLE IF NOT EXISTS agent_tasks (
  id TEXT PRIMARY KEY,
  agent_name TEXT NOT NULL,
  task TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  result TEXT,
  created_at INTEGER NOT NULL,
  completed_at INTEGER
);

CREATE INDEX idx_agent_tasks_status ON agent_tasks(status);
CREATE INDEX idx_agent_tasks_agent_name ON agent_tasks(agent_name);
CREATE INDEX idx_agent_tasks_created_at ON agent_tasks(created_at);

-- golden_samples: Golden dataset samples for training/evaluation
CREATE TABLE IF NOT EXISTS golden_samples (
  id TEXT PRIMARY KEY,
  instruction TEXT NOT NULL,
  output TEXT NOT NULL,
  source TEXT,
  agent_name TEXT,
  created_at INTEGER NOT NULL
);

CREATE INDEX idx_golden_samples_agent_name ON golden_samples(agent_name);
CREATE INDEX idx_golden_samples_source ON golden_samples(source);
CREATE INDEX idx_golden_samples_created_at ON golden_samples(created_at);
