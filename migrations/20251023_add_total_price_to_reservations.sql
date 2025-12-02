-- Migration: add total_price to reservations
-- Run this migration with the project's migration runner (scripts/run_migrations.js) or apply to DB

ALTER TABLE reservations
  ADD COLUMN IF NOT EXISTS total_price NUMERIC DEFAULT 0;

-- Index for quicker queries by price (optional)
CREATE INDEX IF NOT EXISTS idx_reservations_total_price ON reservations(total_price);
