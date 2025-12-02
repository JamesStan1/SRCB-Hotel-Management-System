# Room Management Reservation Flow

## Overview
This document describes the enhanced reservation flow for Room Management that includes payment options and contract printing.

## New Reservation Flow

### Step 1: Initiate Reservation
Users can create reservations in two ways:

1. **Walk-in Reservation**
   - Click "Walk-in Reservation" button
   - Check-in date is automatically set to today
   - Remarks field pre-filled with walk-in timestamp

2. **Add Reservation** 
   - Click "Add Reservation" button
   - Standard reservation form

### Step 2: Fill Customer Information
- Customer Name (required)
- Email (required, validated)
- Contact Number (required, validated)
- Address (optional)
- Nationality (optional, dropdown selection)
- Check-in Date (required, must be future date)
- Check-out Date (required, must be after check-in)
- Additional Guests (optional)
- Additional Requests (optional)
- Remarks (optional)
- ID Upload (required, file upload or camera capture)

### Step 3: Select Package
- Choose from available room packages
- Package details displayed (price, guests, description)
- Real-time payment summary updates based on:
  - Selected package price per night
  - Number of nights (calculated from check-in/check-out dates)
  - Total amount calculation: (nights × price) - price

### Step 4: Choose Payment Option

#### Option A: Full Payment at Checkout
- No payment required at reservation time
- Total amount due at checkout
- Contract shows "Payment Due at Checkout" status
- Balance displayed in red

#### Option B: Downpayment Now
- Enter downpayment amount
- Validation: Amount must be > 0 and ≤ total price
- Recommended: 50% of total amount
- Downpayment recorded in payments table
- Remaining balance shown
- Contract shows partial payment status with:
  - Downpayment amount (green)
  - Remaining balance (red)

### Step 5: Payment Summary
Real-time display showing:
- Package name and price per night
- Number of nights
- Total amount
- If downpayment selected:
  - Downpayment amount
  - Balance due at checkout

### Step 6: Create Reservation
1. System validates all required fields
2. Creates reservation in database
3. If downpayment selected:
   - Records payment in payments table
   - Type: 'downpayment'
   - Method: 'cash' (default)
4. Assigns available room automatically
5. Updates room status to 'Occupied'

### Step 7: Print Contract and Bill
After successful reservation, system prompts:
- "Would you like to print the contract and bill?"
- Contract includes:
  - Hotel branding and header
  - Confirmation number
  - Guest information
  - Reservation details
  - Room number assigned
  - Package information
  - Number of nights
  - Total amount
  - Payment status (Full or Partial)
  - Payment details (downpayment/balance if applicable)
  - Terms and conditions
  - Signature sections for guest and hotel representative

## Technical Implementation

### Database Schema
```sql
-- Reservations table includes all customer and booking info
-- Payments table records:
CREATE TABLE payments (
  id SERIAL PRIMARY KEY,
  reservation_id INTEGER REFERENCES reservations(id),
  amount DECIMAL(10, 2) NOT NULL,
  method VARCHAR(50) DEFAULT 'cash',
  type VARCHAR(50) DEFAULT 'payment', -- 'payment', 'downpayment', 'refund'
  note TEXT,
  created_by INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### API Endpoints Used

#### POST /api/room
Creates reservation
- Validates customer info and dates
- Finds available room for selected package
- Creates reservation record
- Updates room status
- Returns reservation ID and room number

#### POST /api/payments
Records payment (if downpayment selected)
- Links to reservation_id
- Records amount, method, type
- Calculates payment totals
- Notifies housekeeping when fully paid

### Frontend Components

#### Payment Options UI
- Visual selection between two options
- Color-coded (Blue for Full Payment, Green for Downpayment)
- Conditional downpayment input field
- Real-time payment summary calculator

#### Contract Printing
- Opens in new window
- Professional styling with hotel branding
- Responsive layout for printing
- Auto-prints on load
- Includes payment-specific terms based on option selected

## User Roles and Permissions
- **Front Desk**: Can create reservations, process payments, print contracts
- **Manager**: Full access to all reservation functions
- **Security**: View-only (cannot create/edit)
- **Housekeeping**: View reservations, cannot create

## Validation Rules

### Customer Information
- Email: Must match valid email format
- Phone: 7-15 digits, optional '+' prefix
- ID Upload: Required, PNG or JPEG only

### Dates
- Check-in: Must be today or future date
- Check-out: Must be after check-in date
- Calculates nights excluding checkout day

### Payment
- Downpayment: Must be > 0 and ≤ total price
- Recommended amount: 50% of total

## Benefits

1. **Clear Payment Terms**: Customers know payment expectations upfront
2. **Flexible Options**: Accommodates different customer preferences
3. **Professional Documentation**: Printed contract serves as legal agreement
4. **Financial Tracking**: All payments recorded for audit trail
5. **Automated Calculations**: Reduces manual errors
6. **Better Customer Experience**: Walk-in flow optimized for speed

## Future Enhancements
- Multiple payment methods (card, online, etc.)
- Email contract to customer
- Digital signature capture
- Payment receipt printing
- Installment payment options
- Integration with accounting system
