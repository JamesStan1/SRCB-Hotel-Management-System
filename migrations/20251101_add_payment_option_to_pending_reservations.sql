-- Add payment_option column and update status constraint for pending_reservations
-- Supports manager approval workflow with payment choices

-- First, drop the existing status constraint
ALTER TABLE pending_reservations 
  DROP CONSTRAINT IF EXISTS pending_reservations_status_check;

-- Add payment_option column
ALTER TABLE pending_reservations 
  ADD COLUMN IF NOT EXISTS payment_option VARCHAR(20) CHECK (payment_option IN ('downpayment', 'checkout'));

-- Recreate status constraint with new values
ALTER TABLE pending_reservations 
  ADD CONSTRAINT pending_reservations_status_check 
  CHECK (status IN ('pending', 'approved', 'rejected', 'awaiting_downpayment'));

-- Add index for payment_option
CREATE INDEX IF NOT EXISTS idx_pending_reservations_payment_option 
  ON pending_reservations(payment_option);

-- Add comments
COMMENT ON COLUMN pending_reservations.payment_option IS 'Payment method chosen during approval: downpayment or checkout';
COMMENT ON COLUMN pending_reservations.status IS 'Status: pending (awaiting approval), approved (completed), rejected (denied), awaiting_downpayment (approved but needs payment)';
