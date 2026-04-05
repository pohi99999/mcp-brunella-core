-- Worker task tracking
CREATE TABLE IF NOT EXISTS worker_tasks (
  id TEXT PRIMARY KEY,
  agent_name TEXT NOT NULL,
  worker_url TEXT NOT NULL,
  task TEXT NOT NULL,
  context TEXT,  -- JSON
  status TEXT DEFAULT 'pending',  -- pending|running|completed|failed
  result TEXT,   -- JSON
  error TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  completed_at DATETIME
);

-- Worker routing table
CREATE TABLE IF NOT EXISTS worker_routing (
  agent_name TEXT PRIMARY KEY,
  worker_url TEXT NOT NULL,
  is_healthy INTEGER DEFAULT 1,
  last_health_check DATETIME,
  avg_latency_ms INTEGER
);

-- Seed initial routing data (based on spec)
INSERT OR REPLACE INTO worker_routing (agent_name, worker_url) VALUES 
('LeadMiningAgent', 'https://brunella-lead-agent.workers.dev'),
('SalesHunterAgent', 'https://brunella-lead-agent.workers.dev'),
('MarketIntelAgent', 'https://brunella-intel-agent.workers.dev'),
('TrendAnalystAgent', 'https://brunella-intel-agent.workers.dev'),
('GrantWatcherAgent', 'https://brunella-grant-agent.workers.dev'),
('GrantHunterAgent', 'https://brunella-grant-agent.workers.dev'),
('LawDetectiveAgent', 'https://brunella-law-agent.workers.dev'),
('EmailTriageAgent', 'https://brunella-email-agent.workers.dev'),
('FinanceGuardian', 'https://brunella-finance-agent.workers.dev'),
('FinancialGuardAgent', 'https://brunella-finance-agent.workers.dev'),
('LogisticsDispatcher', 'https://brunella-logistics-agent.workers.dev'),
('SalesAgent', 'https://brunella-sales-agent.workers.dev'),
('NurturerAgent', 'https://brunella-sales-agent.workers.dev'),
('CopywriterAgent', 'https://brunella-sales-agent.workers.dev'),
('DigitalHeadhunterAgent', 'https://brunella-hr-agent.workers.dev'),
('HeadHunterAgent', 'https://brunella-hr-agent.workers.dev'),
('ResearcherAgent', 'https://brunella-research-agent.workers.dev'),
('DataScientistAgent', 'https://brunella-research-agent.workers.dev'),
('DeveloperAgent', 'https://brunella-dev-agent.workers.dev'),
('EvaluatorAgent', 'https://brunella-dev-agent.workers.dev'),
('InnovationBridgeAgent', 'https://brunella-innovation-agent.workers.dev'),
('RobotkezV2Agent', 'https://brunella-browser-agent.workers.dev'),
('CometBrowserAgent', 'https://brunella-browser-agent.workers.dev'),
('LocalCSRAgent', 'https://brunella-csr-agent.workers.dev'),
('KnowledgeBaseBuilderAgent', 'https://brunella-knowledge-agent.workers.dev'),
('ProjectConductorAgent', 'https://brunella-knowledge-agent.workers.dev');
