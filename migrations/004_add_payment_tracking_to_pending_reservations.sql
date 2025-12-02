-- Add payment tracking fields to pending_reservations table

-- Add payment_option field if it doesn't exist
ALTER TABLE pending_reservations 
ADD COLUMN IF NOT EXISTS payment_option VARCHAR(50);

-- Add downpayment_amount field
ALTER TABLE pending_reservations 
ADD COLUMN IF NOT EXISTS downpayment_amount NUMERIC(10, 2) DEFAULT 0;

-- Add downpayment_paid field to track if downpayment has been received
ALTER TABLE pending_reservations 
ADD COLUMN IF NOT EXISTS downpayment_paid BOOLEAN DEFAULT false;

-- Add downpayment_date to track when downpayment was received
ALTER TABLE pending_reservations 
ADD COLUMN IF NOT EXISTS downpayment_date TIMESTAMP;

-- Add remaining_balance field (calculated field, but useful to cache)
ALTER TABLE pending_reservations 
ADD COLUMN IF NOT EXISTS remaining_balance NUMERIC(10, 2) DEFAULT 0;

-- Update status check constraint to include new statuses
ALTER TABLE pending_reservations 
DROP CONSTRAINT IF EXISTS pending_reservations_status_check;

ALTER TABLE pending_reservations 
ADD CONSTRAINT pending_reservations_status_check 
CHECK (status IN ('pending', 'awaiting_downpayment', 'downpayment_paid', 'approved', 'rejected', 'completed'));

-- Add index for payment tracking queries
CREATE INDEX IF NOT EXISTS idx_pending_reservations_payment_option ON pending_reservations(payment_option);
CREATE INDEX IF NOT EXISTS idx_pending_reservations_downpayment_paid ON pending_reservations(downpayment_paid);

-- Comments for documentation
COMMENT ON COLUMN pending_reservations.payment_option IS 'Payment method: checkout, downpayment, or full_payment';
COMMENT ON COLUMN pending_reservations.downpayment_amount IS 'Amount of downpayment required/received';
COMMENT ON COLUMN pending_reservations.downpayment_paid IS 'Whether downpayment has been received';
COMMENT ON COLUMN pending_reservations.remaining_balance IS 'Remaining balance after downpayment';
