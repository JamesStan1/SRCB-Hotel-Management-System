-- Migration: Create archived_reservations table
-- Purpose: Unified reservation history table for archived (paid/checked-out) room and event reservations

CREATE TABLE IF NOT EXISTS archived_reservations (
  id SERIAL PRIMARY KEY,
  reservation_type TEXT NOT NULL, -- 'room' or 'event'
  source_table TEXT NOT NULL,
  source_id INTEGER,
  invoice_id TEXT,
  customer_name TEXT,
  event_name TEXT,
  room_number TEXT,
  check_in_date TIMESTAMP WITH TIME ZONE,
  check_out_date TIMESTAMP WITH TIME ZONE,
  event_date TIMESTAMP WITH TIME ZONE,
  guests INTEGER,
  subtotal NUMERIC DEFAULT 0,
  total NUMERIC DEFAULT 0,
  payment_method TEXT,
  cashier_name TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes to support common queries
CREATE INDEX IF NOT EXISTS idx_archived_reservations_customer_name ON archived_reservations USING BTREE (customer_name);
CREATE INDEX IF NOT EXISTS idx_archived_reservations_dates ON archived_reservations USING BTREE (created_at);
CREATE INDEX IF NOT EXISTS idx_archived_reservations_event_date ON archived_reservations USING BTREE (event_date);
CREATE INDEX IF NOT EXISTS idx_archived_reservations_room_number ON archived_reservations USING BTREE (room_number);
