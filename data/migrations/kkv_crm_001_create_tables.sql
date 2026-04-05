-- Migráció: KKV CRM - kezdeti táblasémák
-- Leírás: Létrehozza a `leads`, `followup_jobs` és `audit_log` táblákat
-- Indexek: leads(email), followup_jobs(run_at), audit_log(lead_id, created_at)
-- Rollback: a fájl alján található DROP TABLE / DROP INDEX utasítások
-- Készítette: brunella-orchestrator
-- Dátum: 2026-04-05

PRAGMA foreign_keys = ON;

BEGIN TRANSACTION;

-- CREATE leads tábla
CREATE TABLE IF NOT EXISTS leads (
  id TEXT PRIMARY KEY, -- UUID (tárolva TEXT formátumban)
  external_id TEXT,
  name TEXT,
  email TEXT,
  phone TEXT,
  owner_id TEXT,
  status TEXT,
  created_at DATETIME
);

-- CREATE followup_jobs tábla
CREATE TABLE IF NOT EXISTS followup_jobs (
  id TEXT PRIMARY KEY, -- UUID
  lead_id TEXT NOT NULL,
  campaign TEXT,
  run_at DATETIME,
  status TEXT,
  payload JSON,
  retry_count INTEGER DEFAULT 0,
  created_at DATETIME,
  CONSTRAINT fk_followup_lead FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE ON UPDATE CASCADE
);

-- CREATE audit_log tábla
CREATE TABLE IF NOT EXISTS audit_log (
  event_id TEXT PRIMARY KEY, -- UUID
  lead_id TEXT,
  action TEXT,
  meta JSON,
  created_at DATETIME
);

-- INDEX-ek létrehozása
CREATE INDEX IF NOT EXISTS idx_leads_email ON leads(email);
CREATE INDEX IF NOT EXISTS idx_followup_jobs_run_at ON followup_jobs(run_at);
CREATE INDEX IF NOT EXISTS idx_audit_log_lead_created_at ON audit_log(lead_id, created_at);

COMMIT;

-- ROLLBACK (DOWN) szekció
-- Ha vissza szeretnéd vonni a migrációt, futtasd az alábbiakat (biztonsági mentés ajánlott):
-- BEGIN TRANSACTION;
-- DROP INDEX IF EXISTS idx_audit_log_lead_created_at;
-- DROP INDEX IF EXISTS idx_followup_jobs_run_at;
-- DROP INDEX IF EXISTS idx_leads_email;
-- DROP TABLE IF EXISTS audit_log;
-- DROP TABLE IF EXISTS followup_jobs;
-- DROP TABLE IF EXISTS leads;
-- COMMIT;
-- Migráció: KKV CRM - kezdeti táblasémák
-- Leírás: Létrehozza a `leads`, `followup_jobs` és `audit_log` táblákat
-- Indexek: leads(email), followup_jobs(run_at), audit_log(lead_id, created_at)
-- Rollback: a fájl alján található DROP TABLE / DROP INDEX utasítások
-- Készítette: brunella-orchestrator
-- Dátum: 2026-04-05

PRAGMA foreign_keys = ON;

BEGIN TRANSACTION;

-- CREATE leads tábla
CREATE TABLE IF NOT EXISTS leads (
  id TEXT PRIMARY KEY, -- UUID (tárolva TEXT formátumban)
  external_id TEXT,
  name TEXT,
  email TEXT,
  phone TEXT,
  owner_id TEXT,
  status TEXT,
  created_at DATETIME
);

-- CREATE followup_jobs tábla
CREATE TABLE IF NOT EXISTS followup_jobs (
  id TEXT PRIMARY KEY, -- UUID
  lead_id TEXT NOT NULL,
  campaign TEXT,
  run_at DATETIME,
  status TEXT,
  payload JSON,
  retry_count INTEGER DEFAULT 0,
  created_at DATETIME,
  CONSTRAINT fk_followup_lead FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE ON UPDATE CASCADE
);

-- CREATE audit_log tábla
CREATE TABLE IF NOT EXISTS audit_log (
  event_id TEXT PRIMARY KEY, -- UUID
  lead_id TEXT,
  action TEXT,
  meta JSON,
  created_at DATETIME
);

-- INDEX-ek létrehozása
CREATE INDEX IF NOT EXISTS idx_leads_email ON leads(email);
CREATE INDEX IF NOT EXISTS idx_followup_jobs_run_at ON followup_jobs(run_at);
CREATE INDEX IF NOT EXISTS idx_audit_log_lead_created_at ON audit_log(lead_id, created_at);

COMMIT;

-- ROLLBACK (DOWN) szekció
-- Ha vissza szeretnéd vonni a migrációt, futtasd az alábbiakat (biztonsági mentés ajánlott):
-- BEGIN TRANSACTION;
-- DROP INDEX IF EXISTS idx_audit_log_lead_created_at;
-- DROP INDEX IF EXISTS idx_followup_jobs_run_at;
-- DROP INDEX IF EXISTS idx_leads_email;
-- DROP TABLE IF EXISTS audit_log;
-- DROP TABLE IF EXISTS followup_jobs;
-- DROP TABLE IF EXISTS leads;
-- COMMIT;
