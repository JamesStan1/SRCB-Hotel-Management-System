-- Add downpayment_method field to track how downpayment was received (GCash or Cash)

ALTER TABLE pending_reservations 
ADD COLUMN IF NOT EXISTS downpayment_method VARCHAR(20);

-- Add check constraint for valid payment methods
ALTER TABLE pending_reservations 
ADD CONSTRAINT pending_reservations_downpayment_method_check 
CHECK (downpayment_method IS NULL OR downpayment_method IN ('GCash', 'Cash'));

-- Add index for payment method queries
CREATE INDEX IF NOT EXISTS idx_pending_reservations_downpayment_method 
  ON pending_reservations(downpayment_method);

-- Comment for documentation
COMMENT ON COLUMN pending_reservations.downpayment_method IS 'Method used for downpayment: GCash or Cash';
