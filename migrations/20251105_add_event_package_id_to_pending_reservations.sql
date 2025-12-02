-- Add event_package_id to pending_reservations so homepage event submissions can persist package FK
ALTER TABLE pending_reservations
  ADD COLUMN IF NOT EXISTS event_package_id INTEGER;

-- Optional: create an index to speed lookups by package
CREATE INDEX IF NOT EXISTS idx_pending_reservations_event_package_id
  ON pending_reservations(event_package_id);

-- Optional: add foreign key (set to NULL on delete of package)
ALTER TABLE pending_reservations
  ADD CONSTRAINT IF NOT EXISTS pending_reservations_event_package_id_fkey
  FOREIGN KEY (event_package_id)
  REFERENCES public.event_packages(id)
  ON DELETE SET NULL;
