-- Migration: Add supervisor column to events table
-- Date: 2025-11-05

-- Add supervisor column to events table if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'events' 
        AND column_name = 'supervisor'
    ) THEN
        ALTER TABLE events ADD COLUMN supervisor VARCHAR(255);
        RAISE NOTICE 'Added supervisor column to events table';
    ELSE
        RAISE NOTICE 'supervisor column already exists in events table';
    END IF;
END $$;

-- Add contact_number column to events table if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'events' 
        AND column_name = 'contact_number'
    ) THEN
        ALTER TABLE events ADD COLUMN contact_number VARCHAR(20);
        RAISE NOTICE 'Added contact_number column to events table';
    ELSE
        RAISE NOTICE 'contact_number column already exists in events table';
    END IF;
END $$;
