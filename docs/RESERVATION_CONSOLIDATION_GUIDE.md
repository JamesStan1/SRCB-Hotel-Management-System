# Reservation Table Consolidation Guide

## Overview
This document explains the consolidation of room reservations into a single `reservations` table, removing the dual-table system (`pending_reservations` + `reservations`) and eliminating the `e_signature` column.

**Date:** November 2, 2025  
**Status:** Ready to Deploy  
**Migration File:** `migrations/20251102_consolidate_reservations.sql`

---

## What Changed

### Before (Old System)
- **Two Tables:**
  - `pending_reservations` - For homepage submissions awaiting approval
  - `reservations` - For confirmed/dashboard-created reservations
- **E-signature Required:** Had `e_signature` column (now removed)
- **Complex Workflow:** Data moved between tables after approval

### After (New System)
- **One Table:** All room reservations in `reservations` table
- **No E-signature:** Column removed, no longer required
- **Status-Based Workflow:** Use `approval_status` column to track workflow
- **Source Tracking:** `reservation_source` column identifies origin

---

## Database Schema Changes

### New Columns Added to `reservations`

```sql
-- Approval workflow
approval_status VARCHAR(50) DEFAULT 'confirmed'
  CHECK (approval_status IN ('pending', 'approved', 'rejected', 'confirmed', 'downpayment_pending', 'downpayment_paid'))

-- Payment workflow
payment_option VARCHAR(50) DEFAULT 'full_payment'
  CHECK (payment_option IN ('full_payment', 'downpayment', 'checkout'))
downpayment_amount NUMERIC(10, 2) DEFAULT 0
downpayment_paid BOOLEAN DEFAULT FALSE
downpayment_method VARCHAR(50)
  CHECK (downpayment_method IN ('GCash', 'Cash', NULL))
remaining_balance NUMERIC(10, 2) DEFAULT 0

-- Approval tracking
approved_by INTEGER REFERENCES users(id)
approved_at TIMESTAMP
rejection_reason TEXT

-- Source tracking
reservation_source VARCHAR(50) DEFAULT 'dashboard'
  CHECK (reservation_source IN ('dashboard', 'homepage', 'walk-in'))
```

### Column Removed

```sql
e_signature TEXT -- NO LONGER EXISTS
```

---

## Approval Status Flow

### Status Definitions

| Status | Meaning | Next Actions |
|--------|---------|--------------|
| `pending` | Homepage submission awaiting admin review | Approve or Reject |
| `approved` | Admin approved, awaiting payment | Record payment |
| `downpayment_pending` | Approved with downpayment option, awaiting payment | Confirm payment |
| `downpayment_paid` | Downpayment received | Final checkout |
| `confirmed` | Fully approved and paid (or dashboard-created) | Check-in |
| `rejected` | Rejected by admin | No further action |

### Workflow Diagrams

#### Homepage Submission Flow
```
1. Customer submits → approval_status: 'pending'
2. Admin approves → approval_status: 'approved' OR 'downpayment_pending'
3. Payment received → approval_status: 'confirmed' OR 'downpayment_paid'
4. Guest arrives → status: 'confirmed'
```

#### Dashboard/Walk-in Flow
```
1. Staff creates reservation → approval_status: 'confirmed', status: 'confirmed'
2. Guest arrives → Check-in
```

---

## Reservation Source Types

### `dashboard`
- **Created by:** Hotel staff in dashboard
- **Approval:** Auto-approved (`approval_status = 'confirmed'`)
- **Use Case:** Walk-in customers, phone bookings, staff-created

### `homepage`
- **Created by:** Customers via website
- **Approval:** Requires admin approval (`approval_status = 'pending'`)
- **Use Case:** Online reservations

### `walk-in`
- **Created by:** Front desk staff
- **Approval:** Auto-approved (`approval_status = 'confirmed'`)
- **Use Case:** Customers booking at front desk

---

## API Endpoint Changes

### `/api/room` (POST)

**Old Behavior:**
```javascript
// Required e_signature
// Only handled dashboard reservations
```

**New Behavior:**
```javascript
// No longer requires e_signature
// Handles dashboard, homepage, and walk-in
// Sets approval_status based on reservation_source

// Example payload:
{
  customer_name: "John Doe",
  customer_email: "john@email.com",
  contact_number: "09123456789",
  check_in_date: "2025-11-10",
  check_out_date: "2025-11-12",
  total_price: 3000,
  reservation_source: "homepage", // or "dashboard" or "walk-in"
  approval_status: "pending", // for homepage
  payment_option: "checkout",
  package_name: "Standard Room"
}
```

### `/api/pending-reservations` (GET)

**Old Behavior:**
```javascript
// Queried pending_reservations table only
// Mixed room and event reservations
```

**New Behavior:**
```javascript
// For rooms: Queries reservations table WHERE reservation_source = 'homepage'
// For events: Still uses pending_reservations table
// Filters by approval_status instead of status

// Query parameters:
// ?status=pending     → approval_status = 'pending'
// ?type=room          → room reservations only
// ?type=event         → event reservations only
```

### `/app/reservations/room/page.js` (Homepage Form)

**Old:**
```javascript
fetch('/api/pending-reservations', { type: 'room', ... })
```

**New:**
```javascript
fetch('/api/room', { 
  reservation_source: 'homepage',
  approval_status: 'pending',
  ...
})
```

---

## Migration Steps

### 1. Run the Migration

```bash
# Connect to your database and run:
psql -U your_username -d your_database -f migrations/20251102_consolidate_reservations.sql
```

**The migration will:**
1. ✅ Add new columns to `reservations` table
2. ✅ Drop `e_signature` column
3. ✅ Create indexes for performance
4. ✅ Migrate existing `pending_reservations` (room type) to `reservations`
5. ✅ Set proper defaults for existing records
6. ✅ Add documentation comments

### 2. Verify Migration

```sql
-- Check new columns exist
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'reservations'
  AND column_name IN ('approval_status', 'reservation_source', 'payment_option');

-- Verify e_signature is gone
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'reservations'
  AND column_name = 'e_signature';
-- Should return 0 rows

-- Check migrated data
SELECT COUNT(*), approval_status, reservation_source
FROM reservations
GROUP BY approval_status, reservation_source;
```

### 3. Update Application Code (Already Done)

- ✅ `/app/api/room/route.js` - Updated to handle new fields
- ✅ `/app/api/pending-reservations/route.js` - Updated GET to query reservations table
- ✅ `/app/reservations/room/page.js` - Updated to use /api/room endpoint

---

## Testing Checklist

### Test Homepage Submissions

- [ ] Navigate to homepage `http://localhost:3000`
- [ ] Fill out room reservation form
- [ ] Submit reservation
- [ ] Verify success message: "Reservation submitted successfully and is awaiting approval"
- [ ] Check database:
  ```sql
  SELECT * FROM reservations 
  WHERE reservation_source = 'homepage' 
  ORDER BY created_at DESC LIMIT 1;
  ```
- [ ] Verify fields:
  - `approval_status = 'pending'`
  - `reservation_source = 'homepage'`
  - `e_signature` column does not exist

### Test Dashboard Creation

- [ ] Log in as staff
- [ ] Navigate to Room Management
- [ ] Create new reservation
- [ ] Verify immediate confirmation (no approval needed)
- [ ] Check database:
  ```sql
  SELECT * FROM reservations 
  WHERE reservation_source = 'dashboard' 
  ORDER BY created_at DESC LIMIT 1;
  ```
- [ ] Verify fields:
  - `approval_status = 'confirmed'`
  - `reservation_source = 'dashboard'`
  - `status = 'confirmed'`

### Test Pending Reservations Page

- [ ] Log in as admin/manager
- [ ] Navigate to Pending Reservations
- [ ] Verify homepage submissions appear
- [ ] Test approval workflow
- [ ] Verify status updates correctly
- [ ] Check database after approval:
  ```sql
  SELECT id, approval_status, approved_by, approved_at 
  FROM reservations 
  WHERE id = [reservation_id];
  ```

### Test E-signature Removal

- [ ] Create reservation without e-signature
- [ ] Verify no errors
- [ ] Verify reservation saves successfully
- [ ] Confirm e-signature field doesn't appear in forms

---

## Backward Compatibility

### Data Preservation

**Existing reservations:**
- ✅ All data preserved
- ✅ Auto-assigned `approval_status = 'confirmed'`
- ✅ Auto-assigned `reservation_source = 'dashboard'`

**Migrated pending_reservations:**
- ✅ Room reservations moved to `reservations` table
- ✅ Approval status preserved
- ✅ Payment info preserved
- ✅ Source marked as 'homepage'

### Event Reservations

**Important:** Event reservations still use `pending_reservations` table.

```sql
-- Event reservations remain in pending_reservations
SELECT * FROM pending_reservations WHERE type = 'event';
```

This ensures event approval workflow continues unchanged.

---

## Rollback Plan

If issues occur, rollback with:

```sql
BEGIN;

-- Re-add e_signature column (if absolutely needed)
ALTER TABLE reservations ADD COLUMN e_signature TEXT;

-- Remove new columns (if needed)
ALTER TABLE reservations 
  DROP COLUMN IF EXISTS approval_status,
  DROP COLUMN IF EXISTS payment_option,
  DROP COLUMN IF EXISTS downpayment_amount,
  DROP COLUMN IF EXISTS downpayment_paid,
  DROP COLUMN IF EXISTS downpayment_method,
  DROP COLUMN IF EXISTS remaining_balance,
  DROP COLUMN IF EXISTS approved_by,
  DROP COLUMN IF EXISTS approved_at,
  DROP COLUMN IF EXISTS rejection_reason,
  DROP COLUMN IF EXISTS reservation_source;

COMMIT;
```

**Note:** This will lose data in the new columns. Only use if absolutely necessary.

---

## Benefits of New System

### For Customers
- ✅ No e-signature required (faster booking)
- ✅ Streamlined submission process
- ✅ Clear approval status tracking

### For Staff
- ✅ Single table to manage (simpler)
- ✅ No data moving between tables
- ✅ Clear source tracking (homepage vs dashboard)
- ✅ Unified approval workflow

### For Developers
- ✅ Simpler codebase (one table, not two)
- ✅ Reduced complexity
- ✅ Better data integrity
- ✅ Easier to query and report

### Performance
- ✅ Fewer JOINs needed
- ✅ Better indexes
- ✅ Faster queries
- ✅ Simplified database operations

---

## Database Queries Reference

### Get All Pending Homepage Reservations
```sql
SELECT * FROM reservations
WHERE reservation_source = 'homepage'
  AND approval_status = 'pending'
ORDER BY created_at DESC;
```

### Get All Dashboard-Created Reservations
```sql
SELECT * FROM reservations
WHERE reservation_source = 'dashboard'
ORDER BY created_at DESC;
```

### Get Reservations Awaiting Payment
```sql
SELECT * FROM reservations
WHERE approval_status IN ('approved', 'downpayment_pending')
ORDER BY created_at DESC;
```

### Get All Confirmed Reservations
```sql
SELECT * FROM reservations
WHERE approval_status = 'confirmed'
  AND status = 'confirmed'
ORDER BY check_in_date;
```

### Get Rejected Reservations
```sql
SELECT * FROM reservations
WHERE approval_status = 'rejected'
ORDER BY created_at DESC;
```

---

## Troubleshooting

### Issue: Migration Fails

**Error:** `column "e_signature" does not exist`

**Solution:** Already removed, safe to ignore. Run:
```sql
ALTER TABLE reservations DROP COLUMN IF EXISTS e_signature;
```

### Issue: Old Code Still Uses pending_reservations

**Check:** Search codebase for `pending_reservations` references
```bash
cd c:\Users\Admin\hotelmanagement
grep -r "pending_reservations" app/
```

**Fix:** Update to use `reservations` table with filters:
```javascript
// OLD
fetch('/api/pending-reservations?status=pending')

// NEW (for rooms)
fetch('/api/pending-reservations?type=room&status=pending')
// This will query reservations table automatically
```

### Issue: Homepage Reservations Not Appearing

**Check:**
1. Verify `reservation_source = 'homepage'` is set
2. Check `approval_status = 'pending'`
3. Query directly:
   ```sql
   SELECT * FROM reservations 
   WHERE reservation_source = 'homepage';
   ```

**Fix:** Ensure `/app/reservations/room/page.js` sends correct fields:
```javascript
reservation_source: 'homepage',
approval_status: 'pending'
```

### Issue: Dashboard Reservations Need Approval

**Check:** `reservation_source` value

**Fix:** Dashboard reservations should have:
```javascript
reservation_source: 'dashboard',
approval_status: 'confirmed'
```

---

## Security Considerations

### Input Validation

All endpoints validate:
- ✅ Required fields present
- ✅ Data types correct
- ✅ Enum values valid
- ✅ SQL injection prevented (parameterized queries)

### Authorization

- ✅ Homepage submissions: No auth required (public)
- ✅ Dashboard creation: Requires staff login
- ✅ Approval actions: Requires manager/admin role
- ✅ View reservations: Requires staff login

---

## Future Enhancements

### Potential Improvements

1. **Email Notifications**
   - Send confirmation to customer after homepage submission
   - Notify customer when approved/rejected
   - Reminder emails before check-in

2. **SMS Notifications**
   - Text message on approval
   - Check-in reminder

3. **Payment Integration**
   - Online payment for downpayment
   - GCash API integration
   - Payment receipts

4. **Advanced Filtering**
   - Filter by date range
   - Filter by payment status
   - Search by customer name/email

---

## Support

### Questions or Issues?

1. Check this documentation first
2. Review migration file: `migrations/20251102_consolidate_reservations.sql`
3. Check API endpoints: `/api/room`, `/api/pending-reservations`
4. Contact development team

---

**Document Version:** 1.0  
**Last Updated:** November 2, 2025  
**Maintained By:** Development Team
