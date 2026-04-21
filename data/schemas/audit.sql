-- Gold Protocol G6: Audit Log Schema
-- RULE-AU1: Every tool execution → permission check → audit_log INSERT
-- RULE-AU2: DENIED → logError + audit_log (result='DENIED')
-- RULE-AU3: 30-day retention (auto-cleanup)

CREATE TABLE IF NOT EXISTS audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TEXT NOT NULL DEFAULT (datetime('now')),
    agent_name TEXT NOT NULL,
    action TEXT NOT NULL,
    resource TEXT,
    result TEXT NOT NULL CHECK (result IN ('ALLOWED', 'DENIED')),
    reason TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_audit_agent ON audit_log(agent_name);
CREATE INDEX IF NOT EXISTS idx_audit_result ON audit_log(result);
CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_log(timestamp);
