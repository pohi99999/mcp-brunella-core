-- BAS Adatbázis Szerkezet (Tracks, State, Logs)

DROP TABLE IF EXISTS tracks;
DROP TABLE IF EXISTS system_state;
DROP TABLE IF EXISTS sync_log;

-- 1. Fejlesztési szálak (Tracks)
CREATE TABLE tracks (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    status TEXT DEFAULT 'active',
    progress INTEGER DEFAULT 0,
    priority TEXT DEFAULT 'MEDIUM',
    owner TEXT DEFAULT 'Brunella',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

-- 2. Rendszer Állapot (System State)
CREATE TABLE system_state (
    key TEXT PRIMARY KEY,
    value TEXT,
    updated_at TEXT DEFAULT (datetime('now'))
);

-- 3. Szinkronizációs Napló (Sync Log)
CREATE TABLE sync_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source TEXT NOT NULL,
    action TEXT NOT NULL,
    status TEXT NOT NULL,
    details TEXT,
    timestamp TEXT DEFAULT (datetime('now'))
);

-- 4. Test Futások Rögzítése (Test Runs)
CREATE TABLE testRuns (
    id TEXT PRIMARY KEY,
    scheduledTime TEXT NOT NULL,
    startedAt TEXT NOT NULL,
    endedAt TEXT,
    status TEXT DEFAULT 'running',
    totalTests INTEGER DEFAULT 0,
    passed INTEGER DEFAULT 0,
    failed INTEGER DEFAULT 0,
    skipped INTEGER DEFAULT 0,
    duration INTEGER DEFAULT 0,
    output TEXT,
    errorLog TEXT,
    hostname TEXT DEFAULT 'local',
    triggerType TEXT DEFAULT 'scheduled',
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_testRuns_status ON testRuns(status);
CREATE INDEX idx_testRuns_createdAt ON testRuns(created_at);
CREATE INDEX idx_testRuns_triggerType ON testRuns(triggerType);

-- 5. Javasolt Feladatok (Suggested Tasks) - Jules Continuous AI
CREATE TABLE IF NOT EXISTS suggested_tasks (
    id TEXT PRIMARY KEY,
    file_path TEXT NOT NULL,
    line_number INTEGER NOT NULL,
    todo_text TEXT NOT NULL,
    context TEXT,
    confidence_score REAL DEFAULT 0.5,
    status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'in_progress', 'completed', 'archived')),
    assigned_to TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    UNIQUE(file_path, line_number)
);

CREATE INDEX IF NOT EXISTS idx_suggested_tasks_status ON suggested_tasks(status);
CREATE INDEX IF NOT EXISTS idx_suggested_tasks_confidence ON suggested_tasks(confidence_score DESC);
CREATE INDEX IF NOT EXISTS idx_suggested_tasks_created_at ON suggested_tasks(created_at DESC);

-- 6. Ütemezett Feladatok (Scheduled Tasks) - Jules Continuous AI
CREATE TABLE IF NOT EXISTS scheduled_tasks (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    prompt TEXT NOT NULL,
    cron_expression TEXT NOT NULL,
    handler TEXT NOT NULL,
    enabled BOOLEAN DEFAULT 1,
    last_run_at TEXT,
    next_run_at TEXT,
    last_status TEXT DEFAULT 'pending' CHECK(last_status IN ('pending', 'success', 'failed')),
    last_result TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_scheduled_tasks_enabled ON scheduled_tasks(enabled);
CREATE INDEX IF NOT EXISTS idx_scheduled_tasks_next_run ON scheduled_tasks(next_run_at);

-- Kezdeti teszt adat
INSERT INTO tracks (id, name, status, progress, priority) 
VALUES ('bas-init', 'BAS Cloud Initialization', 'completed', 100, 'HIGH');