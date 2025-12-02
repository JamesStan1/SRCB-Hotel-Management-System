-- Migration: Add downpayment_reference to pending_reservations
-- Purpose: Store GCash reference numbers for downpayments made during reservation approval

ALTER TABLE pending_reservations
  ADD COLUMN IF NOT EXISTS downpayment_reference TEXT;

CREATE INDEX IF NOT EXISTS idx_pending_reservations_downpayment_reference
  ON pending_reservations (downpayment_reference);
