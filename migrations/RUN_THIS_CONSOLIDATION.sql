-- QUICK MIGRATION SCRIPT
-- Run this directly in your PostgreSQL database
-- Purpose: Consolidate reservations into single table and remove e_signature

-- ============================================================================
-- STEP 1: Add new columns for approval workflow
-- ============================================================================

DO $$
BEGIN
    -- approval_status
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='reservations' AND column_name='approval_status') THEN
        ALTER TABLE reservations ADD COLUMN approval_status VARCHAR(50) DEFAULT 'confirmed';
    END IF;
    
    -- payment_option
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='reservations' AND column_name='payment_option') THEN
        ALTER TABLE reservations ADD COLUMN payment_option VARCHAR(50) DEFAULT 'full_payment';
    END IF;
    
    -- downpayment_amount
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='reservations' AND column_name='downpayment_amount') THEN
        ALTER TABLE reservations ADD COLUMN downpayment_amount NUMERIC(10, 2) DEFAULT 0;
    END IF;
    
    -- downpayment_paid
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='reservations' AND column_name='downpayment_paid') THEN
        ALTER TABLE reservations ADD COLUMN downpayment_paid BOOLEAN DEFAULT FALSE;
    END IF;
    
    -- downpayment_method
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='reservations' AND column_name='downpayment_method') THEN
        ALTER TABLE reservations ADD COLUMN downpayment_method VARCHAR(50);
    END IF;
    
    -- remaining_balance
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='reservations' AND column_name='remaining_balance') THEN
        ALTER TABLE reservations ADD COLUMN remaining_balance NUMERIC(10, 2) DEFAULT 0;
    END IF;
    
    -- approved_by
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='reservations' AND column_name='approved_by') THEN
        ALTER TABLE reservations ADD COLUMN approved_by INTEGER REFERENCES users(id);
    END IF;
    
    -- approved_at
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='reservations' AND column_name='approved_at') THEN
        ALTER TABLE reservations ADD COLUMN approved_at TIMESTAMP;
    END IF;
    
    -- rejection_reason
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='reservations' AND column_name='rejection_reason') THEN
        ALTER TABLE reservations ADD COLUMN rejection_reason TEXT;
    END IF;
    
    -- reservation_source
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='reservations' AND column_name='reservation_source') THEN
        ALTER TABLE reservations ADD COLUMN reservation_source VARCHAR(50) DEFAULT 'dashboard';
    END IF;
    
    RAISE NOTICE 'Columns added successfully';
END $$;

-- ============================================================================
-- STEP 2: Remove e_signature column
-- ============================================================================

ALTER TABLE reservations DROP COLUMN IF EXISTS e_signature;

-- ============================================================================
-- STEP 3: Add constraints
-- ============================================================================

DO $$
BEGIN
    -- approval_status check
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'reservations_approval_status_check') THEN
        ALTER TABLE reservations ADD CONSTRAINT reservations_approval_status_check
        CHECK (approval_status IN ('pending', 'approved', 'rejected', 'confirmed', 'downpayment_pending', 'downpayment_paid'));
    END IF;
    
    -- payment_option check
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'reservations_payment_option_check') THEN
        ALTER TABLE reservations ADD CONSTRAINT reservations_payment_option_check
        CHECK (payment_option IN ('full_payment', 'downpayment', 'checkout'));
    END IF;
    
    -- downpayment_method check
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'reservations_downpayment_method_check') THEN
        ALTER TABLE reservations ADD CONSTRAINT reservations_downpayment_method_check
        CHECK (downpayment_method IN ('GCash', 'Cash', NULL));
    END IF;
    
    -- reservation_source check
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'reservations_source_check') THEN
        ALTER TABLE reservations ADD CONSTRAINT reservations_source_check
        CHECK (reservation_source IN ('dashboard', 'homepage', 'walk-in'));
    END IF;
    
    RAISE NOTICE 'Constraints added successfully';
END $$;

-- ============================================================================
-- STEP 4: Create indexes for performance
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_reservations_approval_status ON reservations(approval_status);
CREATE INDEX IF NOT EXISTS idx_reservations_payment_option ON reservations(payment_option);
CREATE INDEX IF NOT EXISTS idx_reservations_downpayment_paid ON reservations(downpayment_paid);
CREATE INDEX IF NOT EXISTS idx_reservations_source ON reservations(reservation_source);

-- ============================================================================
-- STEP 5: Update existing data
-- ============================================================================

-- Set defaults for existing reservations
UPDATE reservations 
SET 
  approval_status = COALESCE(approval_status, 'confirmed'),
  payment_option = COALESCE(payment_option, 'full_payment'),
  reservation_source = COALESCE(reservation_source, 'dashboard')
WHERE approval_status IS NULL OR payment_option IS NULL OR reservation_source IS NULL;

-- ============================================================================
-- STEP 6: Migrate data from pending_reservations (room type only)
-- ============================================================================

-- Check if pending_reservations table exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'pending_reservations') THEN
        -- Migrate room reservations from pending_reservations to reservations
        INSERT INTO reservations (
          room_id,
          customer_name,
          customer_email,
          contact_number,
          address,
          nationality,
          additional_guests,
          additional_requests,
          remarks,
          check_in_date,
          check_out_date,
          created_at,
          updated_at,
          id_upload,
          total_price,
          status,
          package_name,
          approval_status,
          payment_option,
          downpayment_amount,
          downpayment_paid,
          downpayment_method,
          remaining_balance,
          approved_by,
          approved_at,
          rejection_reason,
          reservation_source
        )
        SELECT 
          pr.room_id,
          pr.customer_name,
          pr.customer_email,
          pr.contact_number,
          pr.address,
          pr.nationality,
          pr.additional_guests,
          pr.additional_requests,
          COALESCE(pr.additional_requests, 'Migrated from pending reservations'),
          pr.check_in_date,
          pr.check_out_date,
          pr.created_at,
          pr.updated_at,
          pr.id_upload,
          COALESCE(pr.total, pr.price, 0),
          CASE 
            WHEN pr.status = 'approved' THEN 'confirmed'
            WHEN pr.status = 'rejected' THEN 'cancelled'
            ELSE 'pending'
          END,
          pr.package_name,
          pr.status,
          COALESCE(pr.payment_option, 'full_payment'),
          COALESCE(pr.downpayment_amount, 0),
          COALESCE(pr.downpayment_paid, FALSE),
          pr.downpayment_method,
          COALESCE(pr.remaining_balance, 0),
          pr.approved_by,
          pr.approved_at,
          pr.rejection_reason,
          'homepage'
        FROM pending_reservations pr
        WHERE pr.type = 'room'
        ON CONFLICT (id) DO NOTHING;
        
        RAISE NOTICE 'Data migrated from pending_reservations';
    ELSE
        RAISE NOTICE 'pending_reservations table does not exist, skipping migration';
    END IF;
END $$;

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Show column changes
SELECT 
    'Verification: New columns exist' as check_name,
    COUNT(*) as column_count
FROM information_schema.columns
WHERE table_name = 'reservations'
  AND column_name IN ('approval_status', 'payment_option', 'reservation_source', 'downpayment_amount');

-- Show e_signature removal
SELECT 
    'Verification: e_signature removed' as check_name,
    COUNT(*) as should_be_zero
FROM information_schema.columns
WHERE table_name = 'reservations'
  AND column_name = 'e_signature';

-- Show reservation counts by source
SELECT 
    'Verification: Reservation counts' as check_name,
    reservation_source,
    approval_status,
    COUNT(*) as count
FROM reservations
GROUP BY reservation_source, approval_status
ORDER BY reservation_source, approval_status;

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '============================================';
    RAISE NOTICE 'MIGRATION COMPLETED SUCCESSFULLY!';
    RAISE NOTICE '============================================';
    RAISE NOTICE 'Changes made:';
    RAISE NOTICE '1. Added approval workflow columns';
    RAISE NOTICE '2. Removed e_signature column';
    RAISE NOTICE '3. Added constraints and indexes';
    RAISE NOTICE '4. Updated existing data';
    RAISE NOTICE '5. Migrated pending_reservations data';
    RAISE NOTICE '============================================';
END $$;
