-- Migration: Add package fields to archived_reservations
-- Purpose: Store package name and event_package_id explicitly for easier querying and UI display

ALTER TABLE IF EXISTS archived_reservations
  ADD COLUMN IF NOT EXISTS package_name TEXT,
  ADD COLUMN IF NOT EXISTS event_package_id INTEGER;

CREATE INDEX IF NOT EXISTS idx_archived_reservations_package_name
  ON archived_reservations (package_name);

-- If you want a foreign key to event_packages, add it manually after verifying referential concerns:
-- ALTER TABLE archived_reservations
--   ADD CONSTRAINT archived_reservations_event_package_id_fkey
--     FOREIGN KEY (event_package_id) REFERENCES event_packages(id) ON DELETE SET NULL;
