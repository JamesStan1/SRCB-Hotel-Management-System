# Leave Management System - Implementation Checklist

## Database Setup
- [x] Create `leave_types` table with default leave types
- [x] Create `leaves` table with proper relationships and constraints
- [x] Create `leave_balances` table for tracking annual usage
- [x] Create indexes for performance optimization
- [x] Migration files created and ready to run

## API Endpoints
- [x] GET `/api/leaves` - Fetch leave requests with filtering
- [x] POST `/api/leaves` - Create new leave request
- [x] POST `/api/leaves/approve` - Approve/reject requests
- [x] GET `/api/leave-types` - Fetch available leave types
- [x] JWT authentication on all endpoints
- [x] Role-based access control (staff vs manager/HR)
- [x] Audit logging for all actions

## Frontend Components

### Leave Request Component
- [x] Leave type selection dropdown
- [x] Date range picker (start and end dates)
- [x] Auto-calculation of leave days
- [x] Reason text area
- [x] Leave type information display
- [x] Form validation
- [x] Success/error notifications
- [x] Submit button with loading state

### Leave History Component
- [x] Display all personal leave requests
- [x] Status filtering (All, Pending, Approved, Rejected)
- [x] Statistics cards (Total, Approved, Pending, Days Used)
- [x] Responsive table layout
- [x] View details modal
- [x] Status badges with colors
- [x] Date formatting
- [x] Empty state handling

### Leave Approvals Component
- [x] Permission check (Manager/HR/Admin only)
- [x] Display all pending requests
- [x] Statistics dashboard (Total, Pending, Processed)
- [x] Status filtering
- [x] Review modal with full details
- [x] Approve button with success handling
- [x] Reject button with reason input
- [x] Auto-refresh after action
- [x] Access denied message for non-privileged users

## Dashboard Integration
- [x] Import leave components in staff management page
- [x] Add leave pages to conditional rendering
- [x] Update sidebar navigation with leave menu items
- [x] Add leave management to categoryMap
- [x] Update getDropdownItems function
- [x] Add icons for leave menu items (Calendar, DocumentCheck)
- [x] Add menu labels mapping
- [x] Add case statements for page routing
- [x] Update active state detection

## UI/UX Features
- [x] Heroicons integration for consistency
- [x] Toast notifications for user feedback
- [x] Loading spinners during API calls
- [x] Form validation feedback
- [x] Modal dialogs for details
- [x] Status color coding (Green=Approved, Yellow=Pending, Red=Rejected)
- [x] Responsive design (mobile, tablet, desktop)
- [x] Button disabled states during submission
- [x] Clear form buttons to reset inputs
- [x] Empty state messages

## Security
- [x] JWT token validation on all endpoints
- [x] Role-based access control
- [x] Staff can only access own leave data
- [x] Managers/HR restricted endpoints
- [x] Audit logging of all operations
- [x] SQL injection prevention (parameterized queries)
- [x] No sensitive data in responses

## Data Validation
- [x] End date must be after start date
- [x] Leave type must exist
- [x] Required fields validation
- [x] Date format validation
- [x] Rejection reason required when rejecting

## Error Handling
- [x] API error responses with meaningful messages
- [x] Client-side error display via Toast
- [x] Loading states for async operations
- [x] Network error handling
- [x] Fallback UI for failed requests
- [x] Server error status codes (4xx, 5xx)

## Files Created/Modified

### New Files
- `migrations/20260120_create_leave_types_table.sql`
- `migrations/20260120_create_leaves_table.sql`
- `migrations/20260120_create_leave_balances_table.sql`
- `app/api/leaves/route.js`
- `app/api/leaves/approve/route.js`
- `app/api/leave-types/route.js`
- `app/dashboard/staff-management/leave-request/page.js`
- `app/dashboard/staff-management/leave-history/page.js`
- `app/dashboard/staff-management/leave-approvals/page.js`
- `docs/LEAVE_MANAGEMENT_SYSTEM.md`

### Modified Files
- `app/dashboard/staff-management/page.js` - Integrated leave components
- `app/dashboard/page.js` - Added leave navigation and routing

## Testing Checklist

### Staff Member Testing
- [ ] Can request new leave with valid data
- [ ] Cannot submit leave with end date before start date
- [ ] Can view own leave history
- [ ] Can filter leaves by status
- [ ] Can view detailed leave information
- [ ] Receives success notification after request
- [ ] Sees proper error messages for invalid input

### Manager/HR Testing
- [ ] Can access leave approvals page
- [ ] Can view all pending requests
- [ ] Can approve a request
- [ ] Can reject request with reason
- [ ] Can view historical requests
- [ ] Statistics update after approval/rejection
- [ ] Cannot see if not manager/HR role

### Admin Testing
- [ ] Can access all leave management features
- [ ] Can view all employees' leaves with viewAll parameter
- [ ] Can approve/reject any leave request
- [ ] Has audit logs of all actions

### Edge Cases
- [ ] Test with 1-day leave (same start and end date)
- [ ] Test with long leave spans (30+ days)
- [ ] Test with special leave types (unpaid, bereavement)
- [ ] Test rapid approval/rejection
- [ ] Test without network connection
- [ ] Test with expired JWT token
- [ ] Test with invalid leave type ID

## Deployment Steps

1. **Run Database Migrations:**
   ```bash
   psql -U postgres -d hotel_db -f migrations/20260120_create_leave_types_table.sql
   psql -U postgres -d hotel_db -f migrations/20260120_create_leaves_table.sql
   psql -U postgres -d hotel_db -f migrations/20260120_create_leave_balances_table.sql
   ```

2. **Verify Database:**
   - Check that `leave_types` table has 7 default types
   - Verify `leaves` and `leave_balances` tables exist with correct schema
   - Test indexes created successfully

3. **Start Application:**
   ```bash
   npm run dev
   ```

4. **Test Features:**
   - Navigate to Staff Management → Request Leave
   - Request a leave and verify it appears in Leave History
   - If manager, go to Leave Approvals and test approval

5. **Monitor Logs:**
   - Check browser console for any errors
   - Check server logs for API issues
   - Verify audit logs record all actions

## Known Limitations

1. Leave balance calculations are manual (future: auto-sync with payroll)
2. No calendar visualization (future enhancement)
3. No email notifications (future enhancement)
4. No leave policies per department (future enhancement)
5. Weekend handling simplified (counts all days equally)

## Future Enhancements Queue

- [ ] Leave calendar visualization
- [ ] Email notifications system
- [ ] Department-based leave policies
- [ ] Auto-approval rules
- [ ] Carry-over leave calculations
- [ ] Integration with payroll
- [ ] Bulk operations (approve multiple)
- [ ] Analytics dashboard
- [ ] Mobile app support
- [ ] Replacement staff assignment
