-- Migration: Add reference_number to payments
-- Purpose: Store GCash / payment reference numbers for payments

ALTER TABLE IF EXISTS payments
  ADD COLUMN IF NOT EXISTS reference_number TEXT;

CREATE INDEX IF NOT EXISTS idx_payments_reference_number
  ON payments (reference_number);
