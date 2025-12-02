-- Add updated_at column to chef_orders table if it doesn't exist

ALTER TABLE chef_orders 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();

-- Create or replace a function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Drop trigger if exists and create it
DROP TRIGGER IF EXISTS update_chef_orders_updated_at ON chef_orders;

CREATE TRIGGER update_chef_orders_updated_at
    BEFORE UPDATE ON chef_orders
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

COMMENT ON COLUMN chef_orders.updated_at IS 'Timestamp of last update';
