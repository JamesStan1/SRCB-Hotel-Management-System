-- Create pending_reservations table for reservations awaiting manager/admin approval
-- Reservations submitted from the public homepage will be stored here initially

CREATE TABLE IF NOT EXISTS pending_reservations (
  id SERIAL PRIMARY KEY,
  type VARCHAR(20) NOT NULL CHECK (type IN ('room', 'event')),
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  
  -- Common fields
  customer_name VARCHAR(255) NOT NULL,
  customer_email VARCHAR(255),
  contact_number VARCHAR(50),
  
  -- Room reservation specific fields
  room_id INTEGER REFERENCES rooms(id),
  package_name VARCHAR(255),
  check_in_date DATE,
  check_out_date DATE,
  address TEXT,
  nationality VARCHAR(100),
  additional_guests INTEGER DEFAULT 0,
  additional_requests TEXT,
  
  -- Event reservation specific fields
  event_name VARCHAR(255),
  event_package_name VARCHAR(255),
  event_date DATE,
  event_time TIME,
  attendees INTEGER,
  set_name VARCHAR(50),
  selected_dishes JSONB,
  
  -- Common financial and upload fields
  price NUMERIC(10, 2),
  total NUMERIC(10, 2),
  id_upload TEXT,
  
  -- Approval tracking
  approved_by INTEGER REFERENCES users(id),
  approved_at TIMESTAMP,
  rejection_reason TEXT,
  
  -- Metadata
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_pending_reservations_status ON pending_reservations(status);
CREATE INDEX IF NOT EXISTS idx_pending_reservations_type ON pending_reservations(type);
CREATE INDEX IF NOT EXISTS idx_pending_reservations_created_at ON pending_reservations(created_at DESC);

-- Add comments for documentation
COMMENT ON TABLE pending_reservations IS 'Stores reservations from public homepage awaiting manager/admin approval';
COMMENT ON COLUMN pending_reservations.type IS 'Type of reservation: room or event';
COMMENT ON COLUMN pending_reservations.status IS 'Approval status: pending, approved, or rejected';
