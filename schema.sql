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

-- Kezdeti teszt adat
INSERT INTO tracks (id, name, status, progress, priority) 
VALUES ('bas-init', 'BAS Cloud Initialization', 'completed', 100, 'HIGH');