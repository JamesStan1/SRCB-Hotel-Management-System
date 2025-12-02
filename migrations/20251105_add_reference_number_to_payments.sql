-- Add reference_number to payments so room (reservation) and event payments can store GCash/reference tokens
-- Created: 2025-11-05

BEGIN;

-- Add the canonical reference_number column if it doesn't already exist
ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS reference_number VARCHAR(255);

-- Index to speed lookups by reference (optional but helpful)
CREATE INDEX IF NOT EXISTS idx_payments_reference_number ON payments (reference_number);

COMMIT;
