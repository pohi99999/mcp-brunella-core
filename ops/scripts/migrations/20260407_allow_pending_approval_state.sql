-- Migration: 20260407_allow_pending_approval_state.sql
-- Description: Allow 'pending' approval_state for curated_golden_samples and normalize legacy 'candidate' -> 'pending'
-- Safe, reversible pattern for SQLite / Cloudflare D1 (both SQLite-compatible):
--  1) Create a new table with the desired schema (approval_state allows 'pending' and 'candidate')
--  2) Copy existing data with mapping candidate -> pending
--  3) Drop old table and rename new table
--  4) Recreate indexes
-- IMPORTANT: This SQL is destructive if run blindly on a missing table. Please run the detection steps below first.

-- Detection (run first, manual step):
-- SELECT name, sql FROM sqlite_master WHERE type = 'table' AND name = 'curated_golden_samples';
-- If the returned SQL contains a CHECK(...) for approval_state that DOES NOT include 'pending', then run this migration.

BEGIN TRANSACTION;

-- Create new table with expanded allowed values for approval_state
CREATE TABLE IF NOT EXISTS curated_golden_samples_new (
  id TEXT PRIMARY KEY,
  prompt TEXT NOT NULL,
  completion TEXT NOT NULL,
  source TEXT NOT NULL,
  quality REAL NOT NULL,
  -- Allow both 'pending' (new) and 'candidate' (legacy) plus approved/rejected
  approval_state TEXT NOT NULL DEFAULT 'pending',
  provenance TEXT,
  pii_redacted_count INTEGER DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  approved_at TEXT,
  reviewed_by TEXT,
  review_notes TEXT
);

-- Copy data, mapping legacy 'candidate' -> 'pending' to avoid CHECK failures
INSERT OR REPLACE INTO curated_golden_samples_new (
  id, prompt, completion, source, quality, approval_state, provenance, pii_redacted_count, created_at, approved_at, reviewed_by, review_notes
)
SELECT
  id,
  prompt,
  completion,
  source,
  quality,
  CASE WHEN approval_state = 'candidate' THEN 'pending' ELSE approval_state END as approval_state,
  provenance,
  COALESCE(pii_redacted_count, 0) as pii_redacted_count,
  created_at,
  approved_at,
  reviewed_by,
  review_notes
FROM curated_golden_samples;

-- Replace old table (use DROP + RENAME)
DROP TABLE IF EXISTS curated_golden_samples;
ALTER TABLE curated_golden_samples_new RENAME TO curated_golden_samples;

-- Recreate index for approval_state
CREATE INDEX IF NOT EXISTS idx_curated_approval_state ON curated_golden_samples(approval_state);

COMMIT;

-- Rollback steps (manual):
-- If something goes wrong and you have a DB backup, restore DB from backup.
-- Alternatively, if you ran this in a transaction and it failed, it should have rolled back already.

-- Notes for Cloudflare D1:
-- D1 exposes a SQLite-compatible engine. To apply this migration on D1 you must run the same SQL on the D1 instance (via your worker or D1 console). Because D1 may enforce schema immutability in production, coordinate with ops and run during maintenance window.

-- Example verification queries (run after migration):
-- SELECT COUNT(*) as cnt, approval_state FROM curated_golden_samples GROUP BY approval_state;
-- SELECT sql FROM sqlite_master WHERE type='table' AND name='curated_golden_samples';

-- Additional safety:
-- Take a DB backup: copy the SQLite file or export D1 data before applying.
