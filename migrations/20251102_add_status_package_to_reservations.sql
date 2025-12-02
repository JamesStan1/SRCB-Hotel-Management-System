-- Migration: add status and package_name to reservations table
-- This is needed for approved reservations from pending_reservations workflow

ALTER TABLE reservations
  ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'confirmed',
  ADD COLUMN IF NOT EXISTS package_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- Index for quicker queries by status
CREATE INDEX IF NOT EXISTS idx_reservations_status ON reservations(status);

-- Update existing records to have 'confirmed' status if NULL
UPDATE reservations SET status = 'confirmed' WHERE status IS NULL;
