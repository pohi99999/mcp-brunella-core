-- Chat messages table for cross-device sync
CREATE TABLE IF NOT EXISTS chat_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  role TEXT NOT NULL, -- 'user', 'assistant', 'system'
  content TEXT NOT NULL,
  model TEXT,
  timestamp TEXT DEFAULT (datetime('now')),
  synced INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_chat_timestamp ON chat_messages(timestamp);
