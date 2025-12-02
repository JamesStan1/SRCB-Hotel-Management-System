-- Migration: add event_id to payments for explicit event association
ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS event_id INTEGER NULL REFERENCES events(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS payments_event_id_idx ON payments(event_id);

-- Backfill: attempt to parse notes with 'event:<id>' and set event_id where possible
DO $$
BEGIN
  UPDATE payments p
  SET event_id = (regexp_replace(p.note, '^.*event:([0-9]+).*$','\1'))::int
  WHERE p.event_id IS NULL AND p.note ~ 'event:[0-9]+';
EXCEPTION WHEN others THEN
  RAISE NOTICE 'Backfill for payments.event_id failed: %', SQLERRM;
END$$;
