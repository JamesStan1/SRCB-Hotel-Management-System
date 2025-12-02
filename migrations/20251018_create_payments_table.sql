-- Migration: create payments table
CREATE TABLE IF NOT EXISTS payments (
  id SERIAL PRIMARY KEY,
  reservation_id INTEGER NOT NULL REFERENCES reservations(id) ON DELETE CASCADE,
  amount NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
  method VARCHAR(50) DEFAULT 'cash',
  type VARCHAR(20) DEFAULT 'payment',
  note TEXT,
  created_by INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS payments_reservation_id_idx ON payments(reservation_id);
