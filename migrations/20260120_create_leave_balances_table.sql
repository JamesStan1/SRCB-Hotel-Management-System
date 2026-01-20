-- Migration: Create leave balances table (for tracking annual leave balance)
CREATE TABLE IF NOT EXISTS leave_balances (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL UNIQUE,
  leave_type_id INT NOT NULL,
  allocated_days INT DEFAULT 0,
  used_days INT DEFAULT 0,
  pending_days INT DEFAULT 0,
  year INT DEFAULT EXTRACT(YEAR FROM CURRENT_DATE),
  last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (leave_type_id) REFERENCES leave_types(id) ON DELETE CASCADE,
  UNIQUE (user_id, leave_type_id, year)
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_leave_balances_user ON leave_balances(user_id);
CREATE INDEX IF NOT EXISTS idx_leave_balances_year ON leave_balances(year);
CREATE INDEX IF NOT EXISTS idx_leave_balances_type ON leave_balances(leave_type_id);
