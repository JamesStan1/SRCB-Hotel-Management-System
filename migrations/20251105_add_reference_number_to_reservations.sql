-- Add reference_number column to reservations table
-- This allows storing GCash reference numbers for room reservations

ALTER TABLE reservations
ADD COLUMN IF NOT EXISTS reference_number VARCHAR(255);

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_reservations_reference_number
ON reservations (reference_number);