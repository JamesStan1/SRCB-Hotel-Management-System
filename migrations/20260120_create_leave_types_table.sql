-- Migration: Create leave types table
CREATE TABLE IF NOT EXISTS leave_types (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) NOT NULL UNIQUE,
  description TEXT,
  days_per_year INT DEFAULT 0,
  requires_approval BOOLEAN DEFAULT TRUE,
  is_paid BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default leave types
INSERT INTO leave_types (name, description, days_per_year, requires_approval, is_paid) VALUES
  ('Vacation', 'Annual vacation leave', 20, true, true),
  ('Sick Leave', 'Paid sick leave', 10, false, true),
  ('Unpaid Leave', 'Unpaid leave', 0, true, false),
  ('Personal Leave', 'Personal leave for urgent matters', 3, true, true),
  ('Maternity Leave', 'Maternity leave', 180, true, true),
  ('Paternity Leave', 'Paternity leave', 10, true, true),
  ('Bereavement Leave', 'Leave for family bereavement', 5, true, true)
ON CONFLICT (name) DO NOTHING;
