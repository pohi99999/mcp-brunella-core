-- agents_schema.sql

CREATE TABLE IF NOT EXISTS agents (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    status TEXT DEFAULT 'offline', -- offline, active, busy, error
    capabilities TEXT, -- JSON string of capabilities
    last_heartbeat DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    sender_id TEXT NOT NULL,
    target_id TEXT NOT NULL,
    type TEXT NOT NULL, -- handshake, delegate, message, event
    payload TEXT, -- JSON content
    status TEXT DEFAULT 'sent', -- sent, delivered, processed, failed
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(sender_id) REFERENCES agents(id),
    FOREIGN KEY(target_id) REFERENCES agents(id)
);

CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    initiator_id TEXT NOT NULL,
    executor_id TEXT,
    description TEXT,
    status TEXT DEFAULT 'pending', -- pending, in_progress, completed, failed
    result TEXT, -- JSON result
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(initiator_id) REFERENCES agents(id),
    FOREIGN KEY(executor_id) REFERENCES agents(id)
);
