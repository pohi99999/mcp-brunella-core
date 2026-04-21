-- Migration: 0002_allow_pending_approval_state
-- Description: Normalize approval_state and allow 'pending' value in curated_golden_samples
-- Date: 2026-04-07

BEGIN TRANSACTION;

-- Create a new table with the desired schema (approval_state allows 'pending')
CREATE TABLE IF NOT EXISTS curated_golden_samples_new (
  id TEXT PRIMARY KEY,
  prompt TEXT NOT NULL,
  completion TEXT NOT NULL,
  source TEXT NOT NULL,
  quality REAL NOT NULL,
  approval_state TEXT NOT NULL DEFAULT 'pending',
  provenance TEXT,
  pii_redacted_count INTEGER DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  approved_at TEXT,
  reviewed_by TEXT,
  review_notes TEXT
);

-- Copy existing rows, mapping legacy 'candidate' -> 'pending'
INSERT INTO curated_golden_samples_new (
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

-- Replace old table
DROP TABLE IF EXISTS curated_golden_samples;
ALTER TABLE curated_golden_samples_new RENAME TO curated_golden_samples;

-- Recreate index
CREATE INDEX IF NOT EXISTS idx_curated_approval_state ON curated_golden_samples(approval_state);

COMMIT;
