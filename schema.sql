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

-- Kezdeti teszt adat
INSERT INTO tracks (id, name, status, progress, priority) 
VALUES ('bas-init', 'BAS Cloud Initialization', 'completed', 100, 'HIGH');