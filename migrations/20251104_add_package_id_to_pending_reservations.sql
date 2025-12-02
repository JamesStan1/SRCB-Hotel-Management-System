-- Add package_id column to pending_reservations so we can persist and use package IDs
-- This migration is additive and non-breaking: package_id is nullable and indexed for queries.

ALTER TABLE pending_reservations
  ADD COLUMN IF NOT EXISTS package_id INTEGER;

-- Optional index for faster lookups
CREATE INDEX IF NOT EXISTS idx_pending_reservations_package_id ON pending_reservations(package_id);

COMMENT ON COLUMN pending_reservations.package_id IS 'Optional package id (packages.id) selected by customer on public homepage';
