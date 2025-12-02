-- migration: create inventory_activity table
-- Run this against your Postgres/Neon database to add inventory activity tracking

CREATE TABLE IF NOT EXISTS inventory_activity (
  id SERIAL PRIMARY KEY,
  item_id INTEGER NOT NULL REFERENCES inventory(id) ON DELETE CASCADE,
  change_amount INTEGER NOT NULL,
  type VARCHAR(32) NOT NULL, -- 'add' | 'withdraw' | other
  note TEXT,
  performed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  occurred_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inventory_activity_item_id ON inventory_activity(item_id);
CREATE INDEX IF NOT EXISTS idx_inventory_activity_occurred_at ON inventory_activity(occurred_at DESC);
