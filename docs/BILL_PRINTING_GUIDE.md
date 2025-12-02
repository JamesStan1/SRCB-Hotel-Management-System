# Bill Printing Functionality Guide

## Overview
Your hotel management system now has comprehensive bill printing functionality across multiple modules.

---

## 🎯 Features Implemented

### 1. **Point of Sale (POS) Bill Printing**
Location: `app/dashboard/pos/page.js`

#### Two Billing Options:
1. **Simple Receipt** - Plain text format for quick printing
2. **Itemized Bill** - Professional table format with detailed layout

#### Features:
- ✅ Automatic invoice ID generation (format: `INV-YYYYMMDD-HHMMSS-XXXX`)
- ✅ Customer name and cashier information
- ✅ Detailed item listing with quantities and prices
- ✅ Subtotal, discount, and total calculations
- ✅ Payment method tracking
- ✅ Bill preview before printing
- ✅ Auto-print functionality

#### How to Use in POS:
1. Add items to cart
2. Select payment method
3. Choose billing format:
   - Click "📄 Simple Receipt" for plain format
   - Click "📋 Itemized Bill" for professional format
4. Click "View Bill" to preview (itemized only)
5. Click "Print Receipt" or "Print Bill" to print

---

### 2. **Bills & Invoices History Page** 
Location: `app/dashboard/pos/bills-history/page.js`

#### Features:
- ✅ Complete history of all bills and invoices
- ✅ Search by Invoice ID, Customer, Cashier, or Payment Method
- ✅ Statistics dashboard (Total Bills, Total Revenue, Search Results)
- ✅ Table view with sortable columns
- ✅ Preview bills before printing
- ✅ Reprint any historical bill
- ✅ Pagination support

#### Access:
- From POS page, click the "Bills & Invoices" button in the header
- Or navigate to: `/dashboard/pos/bills-history`

#### Table Columns:
- Invoice ID
- Date & Time
- Customer Name
- Cashier Name
- Number of Items
- Total Amount
- Payment Method
- Actions (Preview & Print)

---

### 3. **Order History with Receipts**
Location: `app/dashboard/pos/order-history/page.js`

#### Features:
- ✅ View all past orders
- ✅ Table format with order details
- ✅ Search functionality
- ✅ View order details modal
- ✅ Print receipts for individual orders

---

## 📄 Bill Format Details

### Simple Receipt Format
```
Joanna's Nook
Madroño St., Brgy 4, Balingasag, Mis. Or.
Invoice ID: INV-20251101-143022-A8F3
Date: November 1, 2025
Time: 2:30:22 PM
Cashier: John Doe
Customer: Jane Smith

--------------------------------
Items Purchased:
--------------------------------
Dish Name
2 x ₱150.00 = ₱300.00

Room 101 (Standard Package)
1 x ₱2000.00 = ₱2000.00
--------------------------------
Subtotal: ₱2300.00
Discount (Senior Citizen): ₱230.00
Total: ₱2070.00
Payment Method: Cash
```

### Itemized Bill Format
Professional HTML table format with:
- Hotel logo and header
- Bill information grid (Invoice #, Date/Time, Customer, Cashier)
- Detailed items table with columns:
  - # (Item number)
  - Item Description
  - Quantity
  - Unit Price
  - Amount
- Summary section with subtotal, discount, and total
- Payment method information
- Footer with thank you message

---

## 🖨️ Printing Process

### Automatic Print Flow:
1. User completes transaction or views bill
2. System generates invoice ID
3. Bill data is formatted with HTML/CSS
4. New browser window opens with print-ready document
5. Browser print dialog appears automatically
6. User selects printer and prints

### Manual Print Flow:
1. Navigate to Bills History page
2. Search for specific bill (optional)
3. Click "Preview" icon (👁️) to view bill
4. Click "Print" icon (🖨️) to print directly
5. Or click "Print Bill" button in preview modal

---

## 💾 Data Persistence

### Bills are saved to database with:
- Invoice ID (unique identifier)
- Receipt ID (internal tracking)
- Customer name
- Cashier name
- Items array (JSON format)
- Subtotal, discount, total amounts
- Payment method
- Discount type
- Timestamp

### API Endpoint:
- **GET** `/api/receipts` - Fetch all bills
- **POST** `/api/receipts` - Save new bill

---

## 🎨 Styling & Design

### Color Scheme:
- Primary: Emerald Green (#10b981)
- Secondary: Gray tones
- Accent: Blue for preview, Green for print

### Print Optimizations:
- Clean, professional layout
- Print-specific CSS media queries
- Removes unnecessary buttons when printing
- Optimized margins and spacing
- High-contrast for readability

---

## 🔒 Security & Permissions

### Authentication Required:
- User must be logged in to access POS
- Token-based authentication for API calls
- Only authorized users can print bills

### Data Validation:
- All amounts validated before saving
- Invoice ID uniqueness ensured
- Error handling for failed operations

---

## 📊 Statistics & Reporting

### Bills History Dashboard shows:
1. **Total Bills** - Count of all bills in system
2. **Total Revenue** - Sum of all bill totals
3. **Search Results** - Filtered count

### Future Enhancements Possible:
- Date range filtering
- Revenue by payment method
- Daily/weekly/monthly reports
- Export to PDF/Excel
- Email bills to customers

---

## 🚀 Quick Access Guide

### For Cashiers:
1. Go to **Dashboard → POS**
2. Add items to cart
3. Select billing format
4. Print bill/receipt
5. Access history via "Bills & Invoices" button

### For Managers:
1. Go to **Dashboard → POS → Bills History**
2. View all transactions
3. Search specific bills
4. Reprint as needed
5. Review revenue statistics

---

## 🐛 Troubleshooting

### Bill won't print:
- Check if popup blockers are enabled
- Ensure printer is connected
- Verify browser print permissions

### Preview not showing:
- Check if items array is properly formatted
- Verify bill data is complete
- Check console for errors

### Search not working:
- Ensure search term is entered correctly
- Check if bills exist in database
- Verify API connection

---

## 📝 Technical Details

### Technologies Used:
- **React** - Component framework
- **Next.js** - App router and pages
- **Tailwind CSS** - Styling
- **Heroicons** - Icons
- **SweetAlert2** - Notifications
- **PostgreSQL** - Database

### Print Implementation:
- `window.open()` - Opens new window
- `document.write()` - Writes HTML content
- `window.print()` - Triggers print dialog
- CSS `@media print` - Print-specific styles

---

## 📞 Support

For issues or questions:
1. Check error messages in browser console
2. Verify database connection
3. Ensure all API endpoints are working
4. Check authentication token validity

---

**Last Updated:** November 1, 2025
**Version:** 1.0.0
