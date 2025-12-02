-- Migration: Add event_type, supervisor, and remarks columns to pending_reservations table
-- Date: 2025-11-05

-- Add event_type column to pending_reservations table if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'pending_reservations' 
        AND column_name = 'event_type'
    ) THEN
        ALTER TABLE pending_reservations ADD COLUMN event_type VARCHAR(100);
        RAISE NOTICE 'Added event_type column to pending_reservations table';
    ELSE
        RAISE NOTICE 'event_type column already exists in pending_reservations table';
    END IF;
END $$;

-- Add supervisor column to pending_reservations table if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'pending_reservations' 
        AND column_name = 'supervisor'
    ) THEN
        ALTER TABLE pending_reservations ADD COLUMN supervisor VARCHAR(255);
        RAISE NOTICE 'Added supervisor column to pending_reservations table';
    ELSE
        RAISE NOTICE 'supervisor column already exists in pending_reservations table';
    END IF;
END $$;

-- Add remarks column to pending_reservations table if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'pending_reservations' 
        AND column_name = 'remarks'
    ) THEN
        ALTER TABLE pending_reservations ADD COLUMN remarks TEXT;
        RAISE NOTICE 'Added remarks column to pending_reservations table';
    ELSE
        RAISE NOTICE 'remarks column already exists in pending_reservations table';
    END IF;
END $$;
