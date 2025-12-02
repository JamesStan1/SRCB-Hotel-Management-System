# Separate Billing Feature - Quick Reference

## 🎯 New UI Elements

### 1. Separate Billing Toggle
**Location:** Below "Billing Format" section in POS sidebar

**Visual:**
```
┌────────────────────────────────────────────────────┐
│ [Toggle Switch] Separate Bills by Category        │
│                 Generate separate bills for        │
│                 Restaurant, Rooms & Events         │
└────────────────────────────────────────────────────┘
```

**States:**
- ❌ OFF (gray) - Generate single combined bill
- ✅ ON (blue) - Generate separate bills by category

---

### 2. Category Summary Box
**Location:** Below toggle when enabled and cart has items

**Visual:**
```
┌────────────────────────────────────────┐
│ Bills to be generated:                 │
│                                        │
│ 🟠 Restaurant:  3 item(s)             │
│ 🔵 Rooms:       1 item(s)             │
│ 🟣 Events:      2 item(s)             │
└────────────────────────────────────────┘
```

---

### 3. Updated Print Button
**Location:** Action buttons section

**Text Changes Based on Mode:**
- Regular Mode: "Print Bill" or "Print Receipt"
- **Separate Billing Mode: "Print Separate Bills"**

---

## 📊 Bill Appearance

### Restaurant / Cafe Bill
```
┌─────────────────────────────────────────┐
│         🏨 Joanna's Hotel              │
│    Madroño St., Brgy 4, Balingasag    │
│                                         │
│   ╔═══════════════════════════════╗   │
│   ║  RESTAURANT / CAFE            ║   │ (Amber badge)
│   ╚═══════════════════════════════╝   │
│         ITEMIZED BILL                  │
├─────────────────────────────────────────┤
│ Invoice: INV-20251101-143022-A8F3-REST│
│ Date: November 1, 2025 at 2:30 PM     │
│ Customer: John Doe                     │
│ Cashier: Jane Smith                    │
├─────────────────────────────────────────┤
│ #  Description      Qty  Price  Amount │
├─────────────────────────────────────────┤
│ 1  Caesar Salad     2    ₱250   ₱500  │
│ 2  Grilled Chicken  1    ₱450   ₱450  │
├─────────────────────────────────────────┤
│ Subtotal:                      ₱950.00 │
│ Discount (Senior):            -₱190.00 │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│ TOTAL AMOUNT DUE:              ₱760.00 │
│                                         │
│ Payment Method: Cash                   │
└─────────────────────────────────────────┘
```

### Room Accommodation Bill
```
┌─────────────────────────────────────────┐
│         🏨 Joanna's Hotel              │
│    Madroño St., Brgy 4, Balingasag    │
│                                         │
│   ╔═══════════════════════════════╗   │
│   ║  ROOM ACCOMMODATION           ║   │ (Blue badge)
│   ╚═══════════════════════════════╝   │
│         ITEMIZED BILL                  │
├─────────────────────────────────────────┤
│ Invoice: INV-20251101-143022-A8F3-ROOM│
│ Date: November 1, 2025 at 2:30 PM     │
│ Customer: John Doe                     │
│ Cashier: Jane Smith                    │
├─────────────────────────────────────────┤
│ #  Description          Qty Price  Amt │
├─────────────────────────────────────────┤
│ 1  Room 101 (Deluxe)    1   ₱2000 ₱2000│
├─────────────────────────────────────────┤
│ Subtotal:                    ₱2,000.00 │
│ Discount (Senior):            -₱400.00 │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│ TOTAL AMOUNT DUE:            ₱1,600.00 │
│                                         │
│ Payment Method: Cash                   │
└─────────────────────────────────────────┘
```

### Events & Catering Bill
```
┌─────────────────────────────────────────┐
│         🏨 Joanna's Hotel              │
│    Madroño St., Brgy 4, Balingasag    │
│                                         │
│   ╔═══════════════════════════════╗   │
│   ║  EVENTS & CATERING            ║   │ (Purple badge)
│   ╚═══════════════════════════════╝   │
│         ITEMIZED BILL                  │
├─────────────────────────────────────────┤
│ Invoice: INV-20251101-143022-A8F3-EVNT│
│ Date: November 1, 2025 at 2:30 PM     │
│ Customer: John Doe                     │
│ Cashier: Jane Smith                    │
├─────────────────────────────────────────┤
│ #  Description        Qty  Price Amount│
├─────────────────────────────────────────┤
│ 1  Event: Wedding     1    ₱5000 ₱5000 │
├─────────────────────────────────────────┤
│ Subtotal:                    ₱5,000.00 │
│ Discount (Senior):          -₱1,000.00 │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│ TOTAL AMOUNT DUE:            ₱4,000.00 │
│                                         │
│ Payment Method: Cash                   │
└─────────────────────────────────────────┘
```

---

## 🔢 Workflow Diagram

```
┌─────────────────┐
│  Add Items to   │
│      Cart       │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Enable         │
│  "Separate      │  ◄─── Toggle ON
│  Billing"       │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  View Category  │
│  Summary        │  ◄─── Shows item counts
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Select         │
│  Discount &     │
│  Payment        │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Click "Print   │
│  Separate       │
│  Bills"         │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Multiple       │
│  Windows Open   │  ◄─── One per category
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Bills Print    │
│  Automatically  │
└─────────────────┘
```

---

## 📋 Comparison Table

| Feature | Single Bill | Separate Bills |
|---------|-------------|----------------|
| **Invoice IDs** | 1 ID | 3 IDs (with suffixes) |
| **Print Windows** | 1 window | Up to 3 windows |
| **Discount Application** | Total amount | Proportional |
| **Bill Design** | Green theme | Color-coded by category |
| **Best For** | Simple transactions | Multi-department sales |
| **Processing Time** | Faster | Slightly longer |
| **Paper Used** | 1 sheet | 1-3 sheets |
| **Customer Preference** | Quick checkout | Detailed breakdown |

---

## ⚡ Quick Tips

### For Speed
- ❌ Disable separate billing for single-category transactions
- ✅ Enable only when customer requests or multiple categories exist

### For Accuracy
- Always verify category summary before printing
- Ensure correct items in each category
- Double-check discount calculations

### For Professionalism
- Explain option to customer
- Organize printed bills by category before handing over
- Staple related documents together if needed

---

## 🎨 Color Legend

| Color | Category | Hex Code |
|-------|----------|----------|
| 🟠 Amber | Restaurant / Cafe | #f59e0b |
| 🔵 Blue | Room Accommodation | #3b82f6 |
| 🟣 Purple | Events & Catering | #8b5cf6 |
| 🟢 Green | Combined/Default | #10b981 |

---

## 📱 Mobile Considerations

The separate billing feature works on all screen sizes:

- **Desktop:** Full toggle with description
- **Tablet:** Slightly condensed layout
- **Mobile:** Touch-friendly toggle, stacked summary

---

## ✅ Checklist Before Using

Before enabling separate billing, verify:

- [ ] Cart contains items from multiple categories
- [ ] Customer wants separate bills
- [ ] Printer is ready and has paper
- [ ] Popup blocker is disabled
- [ ] Discount (if any) is selected
- [ ] Payment method is chosen
- [ ] Customer details are entered

---

**Created:** November 1, 2025  
**For:** Joanna's Hotel Management System  
**Version:** 1.0
