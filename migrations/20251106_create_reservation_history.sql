-- Migration: Create reservation_history table
-- Purpose: Store historical reservation data for checked-out rooms

CREATE TABLE IF NOT EXISTS reservation_history (
  id SERIAL PRIMARY KEY,
  room_id INTEGER REFERENCES rooms(id),
  customer_name TEXT,
  customer_email TEXT,
  contact_number TEXT,
  address TEXT,
  nationality TEXT,
  additional_guests INTEGER DEFAULT 0,
  additional_requests TEXT,
  remarks TEXT,
  check_in_date TIMESTAMP WITH TIME ZONE,
  check_out_date TIMESTAMP WITH TIME ZONE,
  checkout_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  id_upload TEXT,
  e_signature TEXT,
  payment_details JSONB DEFAULT '{}'::jsonb,
  room_number TEXT,
  package_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_reservation_history_room_id ON reservation_history(room_id);
CREATE INDEX IF NOT EXISTS idx_reservation_history_checkout_date ON reservation_history(checkout_date);
CREATE INDEX IF NOT EXISTS idx_reservation_history_customer_name ON reservation_history(customer_name);