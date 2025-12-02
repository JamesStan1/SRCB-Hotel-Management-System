-- Add reference_number column to events table
-- This allows storing GCash reference numbers for event reservations

ALTER TABLE events
ADD COLUMN IF NOT EXISTS reference_number VARCHAR(255);

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_events_reference_number
ON events (reference_number);