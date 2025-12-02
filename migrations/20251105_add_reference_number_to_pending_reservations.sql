-- Add reference_number column to pending_reservations table
-- This allows storing GCash reference numbers during reservation approval

ALTER TABLE pending_reservations
ADD COLUMN IF NOT EXISTS reference_number VARCHAR(255);

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_pending_reservations_reference_number
ON pending_reservations (reference_number);