-- Migration to allow payments that are not tied to a reservation
-- This makes reservation_id nullable so POS can accept payments for carts without a reservation

ALTER TABLE payments ALTER COLUMN reservation_id DROP NOT NULL;

-- Note: existing foreign key constraint remains; NULL values are allowed and will not reference reservations.

