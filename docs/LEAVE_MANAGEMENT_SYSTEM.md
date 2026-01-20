# Leave Management System - Implementation Guide

## Overview
A complete leave management system has been added to the staff management module, enabling staff to request leave, view their leave history, and allowing managers/HR to approve or reject leave requests.

## Database Schema

### Tables Created

#### 1. `leave_types` Table
Defines types of leave available in the system with metadata about each type.

```sql
- id (SERIAL PRIMARY KEY)
- name (VARCHAR 50, UNIQUE) - e.g., "Vacation", "Sick Leave", "Unpaid Leave"
- description (TEXT) - Details about the leave type
- days_per_year (INT, DEFAULT 0) - Annual allocation
- requires_approval (BOOLEAN, DEFAULT TRUE) - Whether manager approval is needed
- is_paid (BOOLEAN, DEFAULT TRUE) - Whether it's paid or unpaid
- created_at, updated_at (TIMESTAMPS)
```

**Default Leave Types:**
- Vacation (20 days/year, paid, requires approval)
- Sick Leave (10 days/year, paid, auto-approved)
- Unpaid Leave (requires approval)
- Personal Leave (3 days/year, paid, requires approval)
- Maternity Leave (180 days, paid, requires approval)
- Paternity Leave (10 days, paid, requires approval)
- Bereavement Leave (5 days, paid, requires approval)

#### 2. `leaves` Table
Records individual leave requests from staff.

```sql
- id (SERIAL PRIMARY KEY)
- user_id (INT FK → users.id) - Staff member requesting leave
- leave_type_id (INT FK → leave_types.id) - Type of leave
- start_date (DATE) - First day of leave
- end_date (DATE) - Last day of leave
- reason (TEXT) - Reason for requesting leave
- status (VARCHAR 20) - 'pending', 'approved', 'rejected', 'cancelled'
- approved_by (INT FK → users.id) - Manager/HR who approved/rejected
- approved_at (TIMESTAMP) - When it was processed
- rejection_reason (TEXT) - Reason if rejected
- created_at, updated_at (TIMESTAMPS)
```

**Status Flow:**
- New requests start as `pending`
- Can be moved to `approved` or `rejected` by managers/HR
- Staff can cancel if needed (change to `cancelled`)

#### 3. `leave_balances` Table
Tracks annual leave entitlements and usage per employee per year.

```sql
- id (SERIAL PRIMARY KEY)
- user_id (INT FK → users.id, UNIQUE with leave_type_id & year)
- leave_type_id (INT FK → leave_types.id)
- allocated_days (INT DEFAULT 0) - Days assigned for the year
- used_days (INT DEFAULT 0) - Days already taken
- pending_days (INT DEFAULT 0) - Days with pending approval
- year (INT) - Calendar year (defaults to current year)
- last_updated (TIMESTAMP)
```

### Database Migrations
Three migration files have been created:
1. `20260120_create_leave_types_table.sql` - Leave types setup
2. `20260120_create_leaves_table.sql` - Main leave requests table
3. `20260120_create_leave_balances_table.sql` - Leave balance tracking

**To apply migrations:**
```bash
npm run migrate
# or manually execute the SQL files against your database
```

## API Endpoints

### 1. GET /api/leaves
**Fetch leave requests**

**Query Parameters:**
- `status` (optional) - Filter by status: 'pending', 'approved', 'rejected'
- `leave_type_id` (optional) - Filter by leave type ID
- `viewAll` (optional, admin/manager only) - Set to 'true' to view all employees' leaves

**Response:**
```json
[
  {
    "id": 1,
    "user_id": 5,
    "user_name": "John Doe",
    "user_email": "john@example.com",
    "leave_type_id": 1,
    "leave_type_name": "Vacation",
    "start_date": "2026-02-01",
    "end_date": "2026-02-05",
    "reason": "Annual vacation",
    "status": "pending",
    "approved_by": null,
    "approved_at": null,
    "created_at": "2026-01-20T10:00:00Z"
  }
]
```

**Permissions:**
- Regular staff: Can only see their own leaves
- Manager/HR/Admin: Can see all leaves (with `viewAll=true`)

### 2. POST /api/leaves
**Create new leave request**

**Request Body:**
```json
{
  "leave_type_id": 1,
  "start_date": "2026-02-01",
  "end_date": "2026-02-05",
  "reason": "Annual vacation"
}
```

**Response:**
```json
{
  "message": "Leave request created successfully",
  "leave": {
    "id": 1,
    "user_id": 5,
    "leave_type_id": 1,
    "start_date": "2026-02-01",
    "end_date": "2026-02-05",
    "status": "pending",
    "created_at": "2026-01-20T10:00:00Z"
  }
}
```

### 3. POST /api/leaves/approve
**Approve or reject a leave request (Manager/HR only)**

**Request Body:**
```json
{
  "leave_id": 1,
  "action": "approve"  // or "reject"
  // "rejection_reason" required if action is "reject"
}
```

**Example - Rejection:**
```json
{
  "leave_id": 1,
  "action": "reject",
  "rejection_reason": "Insufficient staffing during this period"
}
```

**Response:**
```json
{
  "message": "Leave request approved successfully",
  "leave": { /* updated leave object */ }
}
```

### 4. GET /api/leave-types
**Fetch all available leave types**

**Response:**
```json
[
  {
    "id": 1,
    "name": "Vacation",
    "description": "Annual vacation leave",
    "days_per_year": 20,
    "requires_approval": true,
    "is_paid": true,
    "created_at": "2026-01-20T10:00:00Z"
  }
]
```

## Frontend Components

### 1. Leave Request Component
**Path:** `app/dashboard/staff-management/leave-request/page.js`

**Features:**
- Select leave type from dropdown
- Choose start and end dates
- Auto-calculates number of days
- Add optional reason
- Shows leave type information and approval requirements
- Form validation

**Accessible by:** All staff members

### 2. Leave History Component
**Path:** `app/dashboard/staff-management/leave-history/page.js`

**Features:**
- View all personal leave requests with status
- Filter by status: All, Pending, Approved, Rejected
- Statistics dashboard showing:
  - Total requests
  - Approved requests
  - Pending requests
  - Rejected requests
  - Total days used (approved)
- View detailed leave information in modal
- Shows approval details and rejection reasons

**Accessible by:** All staff members (view own leaves only)

### 3. Leave Approvals Component
**Path:** `app/dashboard/staff-management/leave-approvals/page.js`

**Features:**
- Dashboard for managers/HR to review pending requests
- Statistics showing total, pending, and processed requests
- Filter requests by status
- Review leave details before approval
- Approve or reject with optional rejection reason
- Shows staff member information

**Accessible by:** Manager, HR, Admin roles only

## Navigation Integration

The leave management features are integrated into the Staff Management menu under the dashboard:

**Menu Structure:**
```
Staff Management
├── Staff List
├── Attendance
├── Payroll
├── Reports
├── Request Leave          (NEW)
├── Leave History          (NEW)
├── Leave Approvals        (NEW - Manager/HR only)
└── Archived Staff
```

**Navigation Items Added:**
- `leave-request` - Request a new leave
- `leave-history` - View leave history and track records
- `leave-approvals` - Manager/HR approval dashboard

## Usage Workflow

### For Staff Members

1. **Request Leave:**
   - Navigate to: Staff Management → Request Leave
   - Select leave type, start date, end date
   - Add reason (optional)
   - Click "Submit Request"
   - Status changes to "Pending"

2. **Track Leave:**
   - Navigate to: Staff Management → Leave History
   - View all requests with status
   - Filter by status to find specific requests
   - Click "View" to see detailed information

### For Managers/HR

1. **Review Requests:**
   - Navigate to: Staff Management → Leave Approvals
   - View pending requests in the dashboard
   - Review staff member, dates, and reason

2. **Approve or Reject:**
   - Click "Review" on a pending request
   - Modal shows full details
   - Click "Approve" to accept
   - Click "Reject" and enter reason to decline
   - Status updates automatically

3. **Track All Leaves:**
   - Use filters to view specific status types
   - Statistics show overview of leave activity

## Features

### Security & Permissions
- Authentication required for all endpoints
- JWT token validation on every request
- Staff can only see their own leaves
- Only Manager/HR/Admin can approve requests
- Audit logging of all actions

### Validation
- End date must be after start date
- Leave type must exist in system
- Required fields validation
- Business logic checks

### Status Tracking
- Real-time status updates
- Automatic timestamps for all actions
- Tracks who approved/rejected and when
- Rejection reasons stored for reference

### User Experience
- Intuitive date pickers
- Auto-calculation of leave days
- Clear status indicators (colors/badges)
- Modal dialogs for detailed views
- Loading states and error handling
- Toast notifications for actions

## Database Maintenance

### Leave Balance Calculation
Leave balances should be recalculated:
1. At the start of each year for annual reset
2. When staff member joins
3. When leave policies change

**Manual calculation query:**
```sql
-- Calculate used days for a user in a leave type for current year
UPDATE leave_balances 
SET used_days = (
  SELECT COUNT(DISTINCT date_trunc('day', generate_series(
    l.start_date, l.end_date, interval '1 day'
  ))) 
  FROM leaves l 
  WHERE l.user_id = leave_balances.user_id 
    AND l.leave_type_id = leave_balances.leave_type_id
    AND l.status = 'approved'
    AND EXTRACT(YEAR FROM l.start_date) = leave_balances.year
)
WHERE EXTRACT(YEAR FROM current_date) = year;
```

## Troubleshooting

### Common Issues

1. **Leave requests not showing:**
   - Verify user has `Authorization` header with valid JWT token
   - Check that user_id exists in database
   - Ensure migrations have been applied

2. **Approval returns 403 (forbidden):**
   - Only Manager, HR, or Admin roles can approve
   - Check user's role in database

3. **Leave balance not tracking:**
   - Ensure `leave_balances` table is populated
   - Run balance calculation query if needed

## Future Enhancements

Possible improvements for future versions:
1. Leave calendar visualization
2. Email notifications for approvals
3. Bulk approval/rejection
4. Leave policies per department/role
5. Carry-over leave rules
6. Leave replacement scheduling
7. Integration with payroll deductions
8. Mobile app support
9. Analytics and reporting dashboard
10. Auto-approval for certain leave types

## Dependencies

**API Level:**
- Express.js / Next.js
- PostgreSQL database
- JWT for authentication
- Audit logger

**Frontend Level:**
- React/Next.js
- Heroicons (icons)
- Toast notifications component
- Custom useAuth hook

## Support

For issues or questions:
1. Check this documentation
2. Review database schema and migrations
3. Check API response codes and error messages
4. Review browser console for client-side errors
5. Check server logs for API errors
