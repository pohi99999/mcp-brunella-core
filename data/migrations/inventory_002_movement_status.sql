-- Migration: Add status to inventory_movements and update movement_type
-- Track: kkv_business_automation_20260408

-- SQLite does not support easy ALTER TABLE for constraints, so we recreate if needed or just add column.
-- For BAS, we usually add columns.

ALTER TABLE inventory_movements ADD COLUMN status TEXT NOT NULL DEFAULT 'COMPLETED';

-- Create an index for status
CREATE INDEX IF NOT EXISTS idx_movements_status ON inventory_movements(status);
