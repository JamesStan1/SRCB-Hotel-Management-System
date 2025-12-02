BEGIN;

-- Add amount_given to pos.receipts and receipts if they exist and if the column is missing
ALTER TABLE IF EXISTS pos.receipts ADD COLUMN IF NOT EXISTS amount_given numeric(12,2);
ALTER TABLE IF EXISTS receipts ADD COLUMN IF NOT EXISTS amount_given numeric(12,2);

COMMIT;
