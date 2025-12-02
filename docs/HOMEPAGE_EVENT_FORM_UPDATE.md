# Homepage Event Reservation Form Update

## Date: November 5, 2025

## Summary
Updated the Homepage Event Reservation form to match the Event Management dashboard form structure and added new database columns for supervisor and contact_number.

---

## Changes Made

### 1. **Database Migrations Created**

#### Migration 1: `20251105_add_supervisor_to_events.sql`
- Adds `supervisor` column (VARCHAR 255) to the `events` table
- Adds `contact_number` column (VARCHAR 20) to the `events` table

#### Migration 2: `20251105_add_fields_to_pending_reservations.sql`
- Adds `event_type` column (VARCHAR 100) to the `pending_reservations` table
- Adds `supervisor` column (VARCHAR 255) to the `pending_reservations` table
- Adds `remarks` column (TEXT) to the `pending_reservations` table

**Note:** These migrations need to be executed on the database. Run them manually using your PostgreSQL client or database management tool.

---

### 2. **Updated Homepage Event Form (`app/reservations/event/page.js`)**

#### New Form Fields Added:
1. **Event Type** (Required) - Dropdown with options:
   - Wedding, Birthday, Debut, Anniversary, Reunion
   - Baby Shower, Graduation Party, Christening
   - Engagement Party, Retirement Party
   - Conference, Seminar, Business Meeting
   - Orientation, Academic Conference, Other

2. **Contact Number** (Required) - Text input field

3. **Supervisor** (Required) - Dropdown populated with managers from staff database

4. **Remarks** - Textarea field for additional notes

#### Updated Form Structure:
```
Event Name *
Event Type *
Customer Name *
Customer Email
Contact Number *
Supervisor *
Date *
Time Slot *
Estimated Attendees *
Additional Guests
[Package Selection]
[Set Selection]
[Dish Selection]
Additional Requests
Remarks
Customer ID * (file upload)
Estimated Total
```

#### Features:
- Fetches staff members with "Manager" role for Supervisor dropdown
- Form validation ensures all required fields are filled
- Validates dish selection when a set is chosen
- Auto-calculates total cost based on package and additional guests

---

### 3. **Updated API Endpoints**

#### `app/api/pending-reservations/route.js`

**POST Endpoint Updates:**
- Now accepts `event_type`, `supervisor`, and `remarks` fields
- Updated INSERT query to include these new columns
- Maintains backward compatibility with existing fields

**PUT Endpoint Updates (final_approve action):**
- When approving event reservations, now transfers:
  - `event_type` → `type` column in events table
  - `supervisor` → `supervisor` column in events table
  - `remarks` → `remarks` column in events table
  - `contact_number` → `contact_number` column in events table

**Data Flow:**
```
Homepage Form → pending_reservations table → Approval Process → events table
```

---

## Field Mapping

| Form Field | Pending Reservations Column | Events Table Column |
|------------|---------------------------|---------------------|
| Event Name | event_name | name |
| Event Type | event_type | type |
| Customer Name | customer_name | booked_by |
| Customer Email | customer_email | - |
| Contact Number | contact_number | contact_number |
| Supervisor | supervisor | supervisor |
| Date | event_date | date |
| Time Slot | event_time | allotted_time |
| Attendees | attendees | guests |
| Additional Guests | additional_guests | additional_guests |
| Package | event_package_name | menu |
| Set | set_name | set |
| Dishes | selected_dishes | dishes |
| Additional Requests | additional_requests | additional_requests |
| Remarks | remarks | remarks |
| Customer ID | id_upload | id_upload |
| Total | total | total_cost |

---

## Required Fields

The following fields are now **required** on the Homepage Event Form:
- ✓ Event Name
- ✓ Event Type
- ✓ Customer Name
- ✓ Contact Number
- ✓ Supervisor
- ✓ Date
- ✓ Time Slot
- ✓ Estimated Attendees
- ✓ Customer ID (file upload)

**Note:** Dishes are required only when a Set is selected.

---

## Testing Checklist

- [ ] Run database migrations
- [ ] Test form submission with all required fields
- [ ] Verify supervisor dropdown populates with managers
- [ ] Test event type dropdown selection
- [ ] Verify data saves correctly to pending_reservations table
- [ ] Test approval process transfers all fields to events table
- [ ] Verify Contact Number displays in Event Management
- [ ] Test form validation (missing required fields)
- [ ] Test dish selection validation (when set is selected)
- [ ] Verify form reset functionality works with new fields

---

## Files Modified

1. `app/reservations/event/page.js` - Homepage event reservation form
2. `app/api/pending-reservations/route.js` - Pending reservations API
3. `migrations/20251105_add_supervisor_to_events.sql` - Events table migration
4. `migrations/20251105_add_fields_to_pending_reservations.sql` - Pending reservations migration

---

## Next Steps

1. **Run the Database Migrations:**
   ```sql
   -- Connect to your PostgreSQL database and run:
   \i migrations/20251105_add_supervisor_to_events.sql
   \i migrations/20251105_add_fields_to_pending_reservations.sql
   ```

2. **Test the Form:**
   - Navigate to the homepage event reservation form
   - Fill out all fields including the new ones
   - Submit and verify data is saved correctly

3. **Test the Approval Flow:**
   - Go to Reservation Approval page
   - Approve a pending event reservation
   - Verify all fields transfer to Event Management

4. **Verify in Event Management:**
   - Check that supervisor and contact number display correctly
   - Verify event type shows properly
   - Confirm remarks are saved and visible

---

## Notes

- The form now matches the Event Management dashboard structure
- Supervisor field is required but defaults to "Online Reservation" if not provided during approval
- Contact Number is now captured for better customer communication
- Event Type provides better categorization of events
- Remarks field allows customers to add additional notes separate from Additional Requests
