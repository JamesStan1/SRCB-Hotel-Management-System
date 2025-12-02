-- Migration: Add reference_number to archived_reservations
-- Purpose: Store GCash reference numbers for payments

ALTER TABLE IF EXISTS archived_reservations
  ADD COLUMN IF NOT EXISTS reference_number TEXT;

CREATE INDEX IF NOT EXISTS idx_archived_reservations_reference_number
  ON archived_reservations (reference_number);
