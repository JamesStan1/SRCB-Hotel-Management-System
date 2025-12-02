# Reservation Consolidation - Deployment Checklist

## Pre-Deployment

- [ ] Review documentation
  - [ ] Read `RESERVATION_CONSOLIDATION_SUMMARY.md`
  - [ ] Review `RESERVATION_SYSTEM_VISUAL_GUIDE.md`
  - [ ] Check `RESERVATION_CONSOLIDATION_GUIDE.md` for details

- [ ] Backup current database
  ```bash
  pg_dump -U your_username -d your_database > backup_$(date +%Y%m%d).sql
  ```

- [ ] Check current reservation counts
  ```sql
  -- Count in old system
  SELECT 'pending_reservations' as table, type, COUNT(*) 
  FROM pending_reservations 
  GROUP BY type;
  
  SELECT 'reservations' as table, COUNT(*) 
  FROM reservations;
  ```

---

## Deployment Steps

### Step 1: Run Database Migration

- [ ] Connect to database
  ```bash
  psql -U your_username -d your_database
  ```

- [ ] Run migration script
  ```sql
  \i c:/Users/Admin/hotelmanagement/migrations/RUN_THIS_CONSOLIDATION.sql
  ```

- [ ] Check for errors
  - [ ] Look for "MIGRATION COMPLETED SUCCESSFULLY!" message
  - [ ] Review any warnings or errors

### Step 2: Verify Migration

- [ ] Check new columns exist
  ```sql
  SELECT column_name FROM information_schema.columns 
  WHERE table_name = 'reservations' 
    AND column_name IN ('approval_status', 'reservation_source', 'payment_option');
  ```
  **Expected:** 3 rows returned

- [ ] Verify e_signature is removed
  ```sql
  SELECT column_name FROM information_schema.columns 
  WHERE table_name = 'reservations' AND column_name = 'e_signature';
  ```
  **Expected:** 0 rows returned

- [ ] Check data migration
  ```sql
  SELECT reservation_source, approval_status, COUNT(*) 
  FROM reservations 
  GROUP BY reservation_source, approval_status;
  ```
  **Expected:** See data with different sources

### Step 3: Restart Application

- [ ] Stop development server if running
  ```bash
  # Press Ctrl+C in terminal where npm run dev is running
  ```

- [ ] Start development server
  ```bash
  cd c:\Users\Admin\hotelmanagement
  npm run dev
  ```

- [ ] Check for startup errors
  - [ ] No database connection errors
  - [ ] No column not found errors

---

## Testing

### Test 1: Homepage Submission (No E-signature!)

- [ ] Open browser: `http://localhost:3000`
- [ ] Click "Book a Room" or navigate to reservations
- [ ] Fill out form:
  - [ ] Customer name: "Test User"
  - [ ] Email: "test@example.com"
  - [ ] Phone: "09123456789"
  - [ ] Check-in date: Tomorrow
  - [ ] Check-out date: 2 days from now
  - [ ] Select a room package
  - [ ] Upload ID (optional)
- [ ] Submit form
- [ ] **Verify:** Success message "Reservation submitted successfully and is awaiting approval"
- [ ] **Verify:** NO e-signature field required! ✅

**Check Database:**
```sql
SELECT id, customer_name, reservation_source, approval_status 
FROM reservations 
WHERE customer_email = 'test@example.com';
```

**Expected Results:**
- [ ] `reservation_source = 'homepage'`
- [ ] `approval_status = 'pending'`
- [ ] `status = 'pending'`

### Test 2: Dashboard Creation

- [ ] Log in as staff user
- [ ] Navigate to "Room Management"
- [ ] Click "Add Reservation" or create new reservation
- [ ] Fill out form:
  - [ ] Customer name: "Staff Created Test"
  - [ ] Email: "staff.test@example.com"
  - [ ] Select room
  - [ ] Set dates
- [ ] Save reservation
- [ ] **Verify:** Immediate confirmation (no approval needed)

**Check Database:**
```sql
SELECT id, customer_name, reservation_source, approval_status 
FROM reservations 
WHERE customer_email = 'staff.test@example.com';
```

**Expected Results:**
- [ ] `reservation_source = 'dashboard'` or `'walk-in'`
- [ ] `approval_status = 'confirmed'`
- [ ] `status = 'confirmed'`

### Test 3: Pending Reservations Page

- [ ] Log in as admin or manager
- [ ] Navigate to "Pending Reservations"
- [ ] **Verify:** See the test homepage submission from Test 1
- [ ] Click "Approve" on test reservation
- [ ] **Verify:** Success message
- [ ] **Verify:** Reservation disappears from pending list (or status updates)

**Check Database:**
```sql
SELECT id, customer_name, approval_status, approved_by, approved_at 
FROM reservations 
WHERE customer_email = 'test@example.com';
```

**Expected Results:**
- [ ] `approval_status = 'confirmed'` or `'approved'`
- [ ] `approved_by` has user ID
- [ ] `approved_at` has timestamp

### Test 4: No E-signature Errors

- [ ] Create multiple reservations (both homepage and dashboard)
- [ ] **Verify:** No errors mentioning "e_signature"
- [ ] **Verify:** All reservations save successfully
- [ ] Check browser console for errors
- [ ] Check server logs for errors

---

## Post-Deployment Verification

### Data Integrity

- [ ] Compare before/after counts
  ```sql
  -- After migration, all room reservations should be in reservations table
  SELECT COUNT(*) as total_reservations FROM reservations;
  
  -- Events should still be in pending_reservations
  SELECT COUNT(*) as event_reservations 
  FROM pending_reservations 
  WHERE type = 'event';
  ```

- [ ] Check for orphaned data
  ```sql
  -- Should return 0 (no rooms in pending_reservations)
  SELECT COUNT(*) 
  FROM pending_reservations 
  WHERE type = 'room';
  ```

### Application Health

- [ ] Homepage loads without errors
- [ ] Dashboard loads without errors
- [ ] Room Management page works
- [ ] Pending Reservations page works
- [ ] No console errors
- [ ] No server errors in logs

---

## Rollback (If Needed)

**⚠️ Only if critical issues occur!**

### Quick Rollback

- [ ] Restore from backup
  ```bash
  psql -U your_username -d your_database < backup_YYYYMMDD.sql
  ```

- [ ] Restart application
  ```bash
  cd c:\Users\Admin\hotelmanagement
  npm run dev
  ```

### Partial Rollback (Keep data, revert schema)

- [ ] Re-add e_signature column (if needed)
  ```sql
  ALTER TABLE reservations ADD COLUMN e_signature TEXT;
  ```

- [ ] Remove new columns (if absolutely necessary)
  ```sql
  ALTER TABLE reservations 
  DROP COLUMN IF EXISTS approval_status,
  DROP COLUMN IF EXISTS reservation_source,
  DROP COLUMN IF EXISTS payment_option,
  DROP COLUMN IF EXISTS downpayment_amount,
  DROP COLUMN IF EXISTS downpayment_paid,
  DROP COLUMN IF EXISTS downpayment_method,
  DROP COLUMN IF EXISTS remaining_balance,
  DROP COLUMN IF EXISTS approved_by,
  DROP COLUMN IF EXISTS approved_at,
  DROP COLUMN IF EXISTS rejection_reason;
  ```

---

## Success Criteria

**All of these should be TRUE:**

- [x] Migration completed without errors
- [x] E-signature column removed
- [x] New columns added successfully
- [x] Homepage submissions work (no e-signature required)
- [x] Dashboard reservations work
- [x] Pending reservations page displays correctly
- [x] Approval workflow functions
- [x] No database errors
- [x] No application errors
- [x] All existing reservations preserved
- [x] Data migrated correctly

---

## Monitoring (First 24 Hours)

### Watch for:

- [ ] Any errors mentioning "e_signature"
- [ ] Reservations not saving
- [ ] Approval workflow failures
- [ ] Database connection issues
- [ ] Performance degradation

### Check Regularly:

```sql
-- New reservations coming in
SELECT COUNT(*), reservation_source, approval_status
FROM reservations
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY reservation_source, approval_status;

-- Any stuck in pending
SELECT COUNT(*)
FROM reservations
WHERE approval_status = 'pending'
  AND created_at < NOW() - INTERVAL '24 hours';
```

---

## Support Contacts

**If issues occur:**

1. Check documentation in `/docs/`
2. Review migration file: `/migrations/RUN_THIS_CONSOLIDATION.sql`
3. Check server logs
4. Query database directly
5. Contact development team

---

## Completion

**Once all checkboxes are checked:**

- [ ] All tests passed ✅
- [ ] No errors found ✅
- [ ] Data verified ✅
- [ ] System stable ✅

**Deployment Status:** COMPLETE ✅

**Deployed By:** _________________

**Date:** _________________

**Notes:**
_______________________________________________________________
_______________________________________________________________
_______________________________________________________________

---

**Checklist Version:** 1.0  
**Date:** November 2, 2025
