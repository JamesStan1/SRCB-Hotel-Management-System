-- Migration: Create chef_orders table
-- This table stores orders sent to the chef from the POS system

CREATE TABLE IF NOT EXISTS chef_orders (
  id SERIAL PRIMARY KEY,
  invoice_id VARCHAR(50) NOT NULL,
  customer_name VARCHAR(255) DEFAULT 'Guest',
  items JSONB NOT NULL,
  order_time TIMESTAMP DEFAULT NOW(),
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'preparing', 'ready', 'served')),
  completed_time TIMESTAMP,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

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

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_chef_orders_status ON chef_orders(status);
CREATE INDEX IF NOT EXISTS idx_chef_orders_order_time ON chef_orders(order_time DESC);
CREATE INDEX IF NOT EXISTS idx_chef_orders_invoice_id ON chef_orders(invoice_id);

-- Add comment
COMMENT ON TABLE chef_orders IS 'Stores food orders sent to chef from POS system';
COMMENT ON COLUMN chef_orders.updated_at IS 'Timestamp of last update';
