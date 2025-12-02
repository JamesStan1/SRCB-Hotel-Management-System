-- Migration: Consolidate all reservations into single table
-- Date: November 2, 2025
-- Purpose: Merge pending_reservations and reservations tables, remove e_signature

BEGIN;

-- Step 1: Add new columns to reservations table to support pending reservations workflow
ALTER TABLE reservations
  ADD COLUMN IF NOT EXISTS approval_status VARCHAR(50) DEFAULT 'confirmed' 
    CHECK (approval_status IN ('pending', 'approved', 'rejected', 'confirmed', 'downpayment_pending', 'downpayment_paid')),
  ADD COLUMN IF NOT EXISTS payment_option VARCHAR(50) DEFAULT 'full_payment'
    CHECK (payment_option IN ('full_payment', 'downpayment', 'checkout')),
  ADD COLUMN IF NOT EXISTS downpayment_amount NUMERIC(10, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS downpayment_paid BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS downpayment_method VARCHAR(50)
    CHECK (downpayment_method IN ('GCash', 'Cash', NULL)),
  ADD COLUMN IF NOT EXISTS remaining_balance NUMERIC(10, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS approved_by INTEGER REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
  ADD COLUMN IF NOT EXISTS reservation_source VARCHAR(50) DEFAULT 'dashboard'
    CHECK (reservation_source IN ('dashboard', 'homepage', 'walk-in'));

-- Step 2: Drop e_signature column (no longer needed)
ALTER TABLE reservations DROP COLUMN IF EXISTS e_signature;

-- Step 3: Create indexes for new columns
CREATE INDEX IF NOT EXISTS idx_reservations_approval_status 
  ON reservations(approval_status);
CREATE INDEX IF NOT EXISTS idx_reservations_payment_option 
  ON reservations(payment_option);
CREATE INDEX IF NOT EXISTS idx_reservations_downpayment_paid 
  ON reservations(downpayment_paid);
CREATE INDEX IF NOT EXISTS idx_reservations_source 
  ON reservations(reservation_source);

-- Step 4: Migrate data from pending_reservations to reservations (room reservations only)
INSERT INTO reservations (
  room_id,
  customer_name,
  customer_email,
  contact_number,
  address,
  nationality,
  additional_guests,
  additional_requests,
  remarks,
  check_in_date,
  check_out_date,
  created_at,
  updated_at,
  id_upload,
  total_price,
  status,
  package_name,
  approval_status,
  payment_option,
  downpayment_amount,
  downpayment_paid,
  downpayment_method,
  remaining_balance,
  approved_by,
  approved_at,
  rejection_reason,
  reservation_source
)
SELECT 
  pr.room_id,
  pr.customer_name,
  pr.customer_email,
  pr.contact_number,
  pr.address,
  pr.nationality,
  pr.additional_guests,
  pr.additional_requests,
  COALESCE(pr.additional_requests, 'Migrated from pending reservations'),
  pr.check_in_date,
  pr.check_out_date,
  pr.created_at,
  pr.updated_at,
  pr.id_upload,
  COALESCE(pr.total, pr.price, 0),
  CASE 
    WHEN pr.status = 'approved' THEN 'confirmed'
    WHEN pr.status = 'rejected' THEN 'cancelled'
    ELSE 'pending'
  END,
  pr.package_name,
  pr.status,
  COALESCE(pr.payment_option, 'full_payment'),
  COALESCE(pr.downpayment_amount, 0),
  COALESCE(pr.downpayment_paid, FALSE),
  pr.downpayment_method,
  COALESCE(pr.remaining_balance, 0),
  pr.approved_by,
  pr.approved_at,
  pr.rejection_reason,
  'homepage'
FROM pending_reservations pr
WHERE pr.type = 'room'
ON CONFLICT (id) DO NOTHING;

-- Step 5: Add comments for documentation
COMMENT ON COLUMN reservations.approval_status IS 
  'Approval workflow status: pending (awaiting approval), approved (approved but not paid), confirmed (paid and confirmed), downpayment_pending (waiting for downpayment), downpayment_paid (downpayment received), rejected (rejected by admin)';

COMMENT ON COLUMN reservations.payment_option IS 
  'Payment method selected: full_payment (pay full amount), downpayment (pay partial then rest on checkout), checkout (pay on arrival)';

COMMENT ON COLUMN reservations.downpayment_amount IS 
  'Amount paid as downpayment (typically 50% of total)';

COMMENT ON COLUMN reservations.downpayment_paid IS 
  'Whether downpayment has been received and verified';

COMMENT ON COLUMN reservations.downpayment_method IS 
  'Method used for downpayment: GCash or Cash';

COMMENT ON COLUMN reservations.remaining_balance IS 
  'Balance remaining after downpayment';

COMMENT ON COLUMN reservations.approved_by IS 
  'User ID of admin/manager who approved/rejected the reservation';

COMMENT ON COLUMN reservations.approved_at IS 
  'Timestamp when reservation was approved/rejected';

COMMENT ON COLUMN reservations.rejection_reason IS 
  'Reason provided if reservation was rejected';

COMMENT ON COLUMN reservations.reservation_source IS 
  'Where the reservation came from: dashboard (staff created), homepage (customer submitted online), walk-in (customer at front desk)';

-- Step 6: Update existing reservations to set proper defaults
UPDATE reservations 
SET 
  approval_status = 'confirmed',
  payment_option = 'full_payment',
  reservation_source = 'dashboard'
WHERE approval_status IS NULL OR reservation_source IS NULL;

COMMIT;

-- Note: pending_reservations table is kept for event reservations
-- It will continue to be used for event reservation approval workflow
-- Only room reservations are consolidated into the main reservations table
