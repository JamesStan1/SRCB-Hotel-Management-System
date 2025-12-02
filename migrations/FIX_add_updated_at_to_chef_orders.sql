-- URGENT FIX: Add updated_at column to chef_orders table
-- Run this immediately to fix the "column updated_at does not exist" error
-- Date: 2025-11-06

-- Add the updated_at column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'chef_orders' 
        AND column_name = 'updated_at'
    ) THEN
        ALTER TABLE chef_orders 
        ADD COLUMN updated_at TIMESTAMP DEFAULT NOW();
        RAISE NOTICE 'Added updated_at column to chef_orders table';
    ELSE
        RAISE NOTICE 'updated_at column already exists in chef_orders table';
    END IF;
END $$;

-- Create or replace the trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS update_chef_orders_updated_at ON chef_orders;

-- Create the trigger
CREATE TRIGGER update_chef_orders_updated_at
    BEFORE UPDATE ON chef_orders
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Update existing rows to have updated_at = created_at if they don't have it
UPDATE chef_orders 
SET updated_at = COALESCE(created_at, NOW())
WHERE updated_at IS NULL;

-- Add comment
COMMENT ON COLUMN chef_orders.updated_at IS 'Timestamp of last update - automatically updated on row changes';

-- Verify the column was added
SELECT 
    column_name, 
    data_type, 
    column_default,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'chef_orders' 
AND column_name = 'updated_at';
