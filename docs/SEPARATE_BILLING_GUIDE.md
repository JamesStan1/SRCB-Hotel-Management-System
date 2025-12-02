# Separate Billing by Category - User Guide

## 📋 Overview
The POS system now supports **separate billing by category**, allowing you to generate individual bills for Restaurant/Cafe, Room Accommodation, and Events & Catering services in a single transaction.

---

## 🎯 Key Features

### Automatic Category Separation
The system automatically categorizes items based on their type:

| Category | Item Types | Color Code |
|----------|-----------|------------|
| **Restaurant / Cafe** | Dishes, Food, Beverages | 🟠 Amber |
| **Room Accommodation** | Room bookings, Packages | 🔵 Blue |
| **Events & Catering** | Event packages, Catering | 🟣 Purple |

### Benefits
✅ **Clear Breakdown** - Customers receive separate, detailed bills for each service type  
✅ **Better Accounting** - Easier to track revenue by department  
✅ **Professional Presentation** - Each bill is clearly labeled with its category  
✅ **Proportional Discounts** - Discounts are applied proportionally across all bills  
✅ **Separate Invoice IDs** - Each bill gets a unique identifier with category suffix

---

## 🚀 How to Use

### Step-by-Step Guide

#### 1. **Add Items to Cart**
- Add items from different categories:
  - Select dishes from the "Dishes" tab
  - Select rooms from the "Rooms" tab
  - Add any combination of items

#### 2. **Enable Separate Billing**
- Scroll to the **"Separate Bills by Category"** toggle
- Click the toggle switch to enable it (turns blue)
- A summary will appear showing how many items are in each category

#### 3. **Review Category Summary**
The summary box shows:
```
Bills to be generated:
🟠 Restaurant: 3 item(s)
🔵 Rooms: 1 item(s)
🟣 Events: 2 item(s)
```

#### 4. **Configure Other Settings**
- Select **Discount Type** (if applicable)
- Choose **Payment Method** (Cash or GCash)
- Billing format is automatically set to itemized bills

#### 5. **Print Separate Bills**
- Click **"Print Separate Bills"** button
- Multiple browser windows will open, one for each category
- Each bill will auto-print in sequence

---

## 📄 Bill Format

### Invoice ID Format
Each bill receives a unique invoice ID with a category suffix:

```
INV-20251101-143022-A8F3-REST  (Restaurant bill)
INV-20251101-143022-A8F3-ROOM  (Room bill)
INV-20251101-143022-A8F3-EVNT  (Events bill)
```

### Bill Structure

Each category bill includes:

**Header Section:**
- Hotel logo and branding
- Category badge (color-coded)
- "ITEMIZED BILL" title

**Bill Information:**
- Invoice Number (with category suffix)
- Date & Time
- Customer Name
- Cashier Name

**Items Table:**
```
#  | Item Description        | Qty | Unit Price | Amount
---|------------------------|-----|------------|--------
1  | Caesar Salad           | 2   | ₱250.00   | ₱500.00
2  | Grilled Chicken        | 1   | ₱450.00   | ₱450.00
```

**Summary:**
- Subtotal (for this category only)
- Discount (proportionally applied)
- Total Amount Due
- Payment Method

**Footer:**
- Thank you message
- Category-specific note
- Contact information

---

## 💰 How Discounts Work

### Proportional Discount Distribution

When you apply a discount with separate billing enabled, the discount is **proportionally distributed** across all categories based on their subtotals.

**Example:**

**Cart Contents:**
- Restaurant items: ₱1,000 (50% of total)
- Room items: ₱800 (40% of total)
- Event items: ₱200 (10% of total)
- **Total: ₱2,000**

**With 20% Senior Citizen Discount (₱400 total discount):**

| Category | Subtotal | Proportional Discount | Final Total |
|----------|----------|----------------------|-------------|
| Restaurant | ₱1,000 | ₱200 (50% of ₱400) | ₱800 |
| Rooms | ₱800 | ₱160 (40% of ₱400) | ₱640 |
| Events | ₱200 | ₱40 (10% of ₱400) | ₱160 |
| **Total** | **₱2,000** | **₱400** | **₱1,600** |

---

## 🎨 Visual Design

### Color-Coded Categories

Each category has a distinct color scheme for easy identification:

#### Restaurant / Cafe (Amber)
- Header: Amber (#f59e0b)
- Badge: Amber background with white text
- Table header: Amber
- Total line: Amber highlight

#### Room Accommodation (Blue)
- Header: Blue (#3b82f6)
- Badge: Blue background with white text
- Table header: Blue
- Total line: Blue highlight

#### Events & Catering (Purple)
- Header: Purple (#8b5cf6)
- Badge: Purple background with white text
- Table header: Purple
- Total line: Purple highlight

---

## 🖨️ Printing Process

### What Happens When You Print

1. **System Groups Items** - Items are automatically sorted by category
2. **Calculations Performed** - Subtotals and discounts calculated for each category
3. **Windows Open** - One browser window per category
4. **Auto-Print Triggered** - Each window prints automatically after a short delay
5. **User Confirms** - User selects printer and confirms each print job

### Print Order
Bills are printed in this sequence:
1. Restaurant / Cafe bill (if items exist)
2. Room Accommodation bill (if items exist)
3. Events & Catering bill (if items exist)

### Tips for Smooth Printing
- ✅ Ensure printer is connected and ready
- ✅ Allow popup windows in your browser
- ✅ Have enough paper in the printer
- ✅ Wait for each print job to complete before closing windows
- ✅ Check print preview if needed

---

## 🔄 Combined vs. Separate Billing

### When to Use Combined Billing (Default)
- Customer prefers one bill
- Simple transactions
- Same department handling all items
- Quick checkout needed

### When to Use Separate Billing
- Customer requests separate bills
- Different departments need separate records
- Accounting requires category breakdown
- Corporate/Business clients
- Events with multiple service types

---

## 💡 Best Practices

### For Cashiers

1. **Ask Customer Preference**
   - "Would you like a single bill or separate bills by service?"
   - Explain the option if they're unsure

2. **Verify Items Before Printing**
   - Review the category summary
   - Ensure all items are in the correct category
   - Confirm customer details

3. **Handle Multiple Windows**
   - Don't close windows immediately
   - Ensure all prints complete successfully
   - Provide bills to customer in organized manner

4. **Discount Application**
   - Apply discount before enabling separate billing
   - Explain how discount is distributed
   - Verify totals match expectations

### For Managers

1. **Train Staff** on the separate billing feature
2. **Monitor Usage** to understand customer preferences
3. **Review Reports** by category for better insights
4. **Gather Feedback** from staff and customers

---

## 🔧 Technical Details

### Item Type Detection

```javascript
Restaurant: item.type !== 'room' && item.type !== 'event'
Rooms: item.type === 'room'
Events: item.type === 'event'
```

### Discount Calculation

```javascript
proportionalDiscount = (categorySubtotal / totalSubtotal) * totalDiscount
```

### Invoice ID Generation

```javascript
baseId = INV-YYYYMMDD-HHMMSS-XXXX
restaurantId = baseId + '-REST'
roomId = baseId + '-ROOM'
eventId = baseId + '-EVNT'
```

---

## ❓ Troubleshooting

### Bills Not Printing

**Issue:** No print dialog appears  
**Solution:** 
- Check if browser is blocking popups
- Allow popups for the POS system
- Verify printer connection

**Issue:** Only some bills print  
**Solution:**
- Ensure items exist in all categories
- Empty categories won't generate bills
- Check browser console for errors

### Wrong Category Assignment

**Issue:** Item in wrong category  
**Solution:**
- Check item type in database
- Verify item was added from correct tab
- Contact administrator if item type is incorrect

### Discount Not Applied Correctly

**Issue:** Discount seems wrong on separate bills  
**Solution:**
- Remember: discount is proportional, not equal
- Larger subtotals get larger discount amounts
- Total discount across all bills equals the full discount
- Use calculator to verify proportions

---

## 📊 Example Scenarios

### Scenario 1: Hotel Guest Checkout

**Customer:** Mr. Smith checking out after 3-night stay

**Items:**
- Room 101 (3 nights): ₱6,000
- Restaurant charges: ₱2,500
- Event hall booking: ₱8,000

**Settings:**
- Separate Billing: ✅ Enabled
- Discount: None
- Payment: Credit Card

**Result:**
- 3 separate bills generated
- Total amount: ₱16,500
- Clear breakdown by service

---

### Scenario 2: Corporate Event

**Customer:** XYZ Corporation - Conference

**Items:**
- Meeting room setup: ₱5,000
- Lunch catering for 50: ₱15,000
- Coffee breaks: ₱3,000

**Settings:**
- Separate Billing: ✅ Enabled
- Discount: 10% Corporate
- Payment: Check

**Result:**
- Restaurant bill: ₱16,200 (₱18,000 - ₱1,800 discount)
- Events bill: ₱4,500 (₱5,000 - ₱500 discount)
- Total: ₱20,700 (₱23,000 - ₱2,300 discount)

---

### Scenario 3: Walk-in Restaurant Customer

**Customer:** Casual diner

**Items:**
- Main course: ₱450
- Dessert: ₱150
- Drinks: ₱120

**Settings:**
- Separate Billing: ❌ Disabled (only restaurant items)
- Discount: Senior (20%)
- Payment: Cash

**Result:**
- Single bill: ₱576 (₱720 - ₱144 discount)
- No need for separate billing (only one category)

---

## 🎓 Training Checklist

For new cashiers, ensure they can:

- [ ] Toggle separate billing on/off
- [ ] Understand the category summary display
- [ ] Explain to customers how separate billing works
- [ ] Handle multiple print windows
- [ ] Verify all bills printed successfully
- [ ] Apply discounts correctly with separate billing
- [ ] Know when to recommend separate vs. combined billing
- [ ] Troubleshoot common printing issues

---

## 📞 Support

For technical issues or questions:

1. **Check this guide** for common solutions
2. **Review the main Bill Printing Guide** (`BILL_PRINTING_GUIDE.md`)
3. **Contact IT Support** for system issues
4. **Report bugs** to the development team

---

## 🔄 Version History

**Version 1.0** (November 1, 2025)
- Initial release of separate billing feature
- Support for 3 categories (Restaurant, Rooms, Events)
- Proportional discount distribution
- Color-coded bill design
- Auto-print functionality

---

**Last Updated:** November 1, 2025  
**Feature Status:** ✅ Active and Production-Ready
