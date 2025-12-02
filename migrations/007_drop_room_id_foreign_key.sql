-- Drop the foreign key constraint on room_id in pending_reservations
-- This allows us to store package selections that don't correspond to actual room records

ALTER TABLE pending_reservations 
DROP CONSTRAINT IF EXISTS pending_reservations_room_id_fkey;

-- Make room_id nullable and remove the foreign key requirement
-- The package_name field will store the actual room package information
COMMENT ON COLUMN pending_reservations.room_id IS 'Optional room ID reference - may be NULL for package-based reservations';
COMMENT ON COLUMN pending_reservations.package_name IS 'Room package name selected by customer (e.g., Single Room, Family Room)';
