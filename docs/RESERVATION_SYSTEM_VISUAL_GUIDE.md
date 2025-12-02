# Reservation System Architecture - Visual Guide

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    RESERVATION SYSTEM                            │
│                  (Single Table Architecture)                     │
└─────────────────────────────────────────────────────────────────┘

                            ┌──────────────┐
                            │ reservations │
                            │    TABLE     │
                            └──────────────┘
                                   │
        ┌──────────────────────────┼──────────────────────────┐
        │                          │                          │
   [Homepage]                 [Dashboard]                [Walk-in]
  Submissions               Staff Created              Front Desk
        │                          │                          │
        └──────────────────────────┴──────────────────────────┘
                                   │
                     All stored in ONE table with
                     different 'reservation_source'
```

---

## Reservation Flow Diagrams

### 1. Homepage Submission Flow

```
┌──────────────┐
│   CUSTOMER   │
│  (Homepage)  │
└──────┬───────┘
       │
       │ Fills form (no e-signature!)
       │
       ▼
┌─────────────────────────┐
│  POST /api/room         │
│                         │
│  Fields:                │
│  - customer_name        │
│  - check_in_date        │
│  - check_out_date       │
│  - total_price          │
│  - reservation_source:  │
│    'homepage'           │
│  - approval_status:     │
│    'pending'            │
└───────────┬─────────────┘
            │
            │ INSERT
            ▼
    ┌───────────────────┐
    │  reservations     │
    │  ─────────────    │
    │  id: 123          │
    │  source: homepage │
    │  approval: pending│
    │  status: pending  │
    └───────────┬───────┘
                │
                │ Admin views
                ▼
    ┌───────────────────────┐
    │ Pending Reservations  │
    │ Dashboard Page        │
    │                       │
    │ Shows all where:      │
    │ - source = homepage   │
    │ - approval = pending  │
    └───────┬───────────────┘
            │
      ┌─────┴─────┐
      │           │
      ▼           ▼
   APPROVE     REJECT
      │           │
      │           └─► approval_status = 'rejected'
      │               ↓
      │               Notify customer
      │
      └─► approval_status = 'confirmed'
          status = 'confirmed'
          ↓
          Guest can check in
```

### 2. Dashboard Creation Flow

```
┌──────────────┐
│  STAFF USER  │
│  (Dashboard) │
└──────┬───────┘
       │
       │ Creates reservation directly
       │
       ▼
┌─────────────────────────┐
│  POST /api/room         │
│                         │
│  Fields:                │
│  - customer_name        │
│  - room_id              │
│  - check_in_date        │
│  - reservation_source:  │
│    'dashboard'          │
│  - approval_status:     │
│    'confirmed'          │
└───────────┬─────────────┘
            │
            │ INSERT (auto-confirmed)
            ▼
    ┌───────────────────┐
    │  reservations     │
    │  ─────────────    │
    │  id: 124          │
    │  source: dashboard│
    │  approval:        │
    │    confirmed ✓    │
    │  status: confirmed│
    └───────────┬───────┘
                │
                │ Immediately available
                ▼
    ┌───────────────────────┐
    │   Room Management     │
    │   Active Reservations │
    │                       │
    │   Guest can check in  │
    │   right away          │
    └───────────────────────┘
```

### 3. Walk-in Flow

```
┌──────────────┐
│   CUSTOMER   │
│  (Walk-in)   │
└──────┬───────┘
       │
       │ Arrives at front desk
       │
       ▼
┌──────────────┐
│ FRONT DESK   │
│   STAFF      │
└──────┬───────┘
       │
       │ Creates reservation
       │
       ▼
┌─────────────────────────┐
│  POST /api/room         │
│                         │
│  Fields:                │
│  - customer_name        │
│  - room_id              │
│  - check_in_date        │
│  - reservation_source:  │
│    'walk-in'            │
│  - approval_status:     │
│    'confirmed'          │
└───────────┬─────────────┘
            │
            │ INSERT (auto-confirmed)
            ▼
    ┌───────────────────┐
    │  reservations     │
    │  ─────────────    │
    │  id: 125          │
    │  source: walk-in  │
    │  approval:        │
    │    confirmed ✓    │
    │  status: confirmed│
    └───────────┬───────┘
                │
                │ Guest checks in immediately
                ▼
        Check-in Complete
```

---

## Database Table Structure

### reservations Table

```
┌────────────────────────────────────────────────────────────────┐
│                        reservations                            │
├────────────────────────────────────────────────────────────────┤
│ PRIMARY KEY: id                                                │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  CUSTOMER INFORMATION                                          │
│  ├─ customer_name         VARCHAR(100)                         │
│  ├─ customer_email        VARCHAR(100)                         │
│  ├─ contact_number        VARCHAR(20)                          │
│  ├─ address               TEXT                                 │
│  └─ nationality           VARCHAR(50)                          │
│                                                                │
│  RESERVATION DETAILS                                           │
│  ├─ room_id               INTEGER → rooms(id)                  │
│  ├─ package_name          VARCHAR(255)                         │
│  ├─ check_in_date         DATE                                 │
│  ├─ check_out_date        DATE                                 │
│  ├─ additional_guests     INTEGER                              │
│  ├─ additional_requests   TEXT                                 │
│  └─ remarks               TEXT                                 │
│                                                                │
│  STATUS & APPROVAL                                             │
│  ├─ status                VARCHAR(50) - Overall status         │
│  ├─ approval_status       VARCHAR(50) - Approval workflow ✨   │
│  ├─ approved_by           INTEGER → users(id) ✨               │
│  ├─ approved_at           TIMESTAMP ✨                         │
│  ├─ rejection_reason      TEXT ✨                              │
│  └─ reservation_source    VARCHAR(50) ✨                       │
│      (dashboard/homepage/walk-in)                              │
│                                                                │
│  PAYMENT DETAILS                                               │
│  ├─ total_price           NUMERIC                              │
│  ├─ payment_option        VARCHAR(50) ✨                       │
│  │   (full_payment/downpayment/checkout)                       │
│  ├─ downpayment_amount    NUMERIC(10,2) ✨                     │
│  ├─ downpayment_paid      BOOLEAN ✨                           │
│  ├─ downpayment_method    VARCHAR(50) ✨                       │
│  │   (GCash/Cash)                                              │
│  └─ remaining_balance     NUMERIC(10,2) ✨                     │
│                                                                │
│  UPLOADS & METADATA                                            │
│  ├─ id_upload             TEXT                                 │
│  ├─ created_at            TIMESTAMP                            │
│  └─ updated_at            TIMESTAMP                            │
│                                                                │
│  ❌ REMOVED: e_signature   (no longer exists!)                 │
│                                                                │
└────────────────────────────────────────────────────────────────┘

✨ = New columns added in this update
```

---

## Status State Machine

### approval_status States

```
                    ┌─────────────┐
                    │   PENDING   │  ← Homepage submissions start here
                    │             │
                    └──────┬──────┘
                           │
              ┌────────────┴────────────┐
              │                         │
        [APPROVE]                   [REJECT]
              │                         │
              ▼                         ▼
     ┌────────────────┐        ┌──────────────┐
     │   APPROVED     │        │   REJECTED   │
     │                │        │              │
     └────────┬───────┘        └──────────────┘
              │                      │
              │                      └─► End (archived)
              │
     ┌────────┴─────────────┐
     │                      │
     │ Payment Option:      │
     │                      │
     ▼                      ▼
┌─────────────┐    ┌─────────────────────┐
│ FULL        │    │ DOWNPAYMENT         │
│ PAYMENT     │    │                     │
└──────┬──────┘    └──────────┬──────────┘
       │                      │
       │ Pay full amount      │ Pay 50%
       │                      │
       ▼                      ▼
  ┌──────────┐      ┌──────────────────┐
  │CONFIRMED │◄─────│DOWNPAYMENT_PAID  │
  │          │      │                  │
  └──────────┘      └──────────────────┘
       │                      │
       └──────────┬───────────┘
                  │
                  ▼
          ┌───────────────┐
          │   CHECK-IN    │
          │               │
          └───────────────┘
```

### reservation_source Values

```
┌───────────────────────────────────────────────────────────┐
│                                                           │
│  'homepage'   → Customer submitted via website            │
│                 ↓                                         │
│                 Needs approval (pending)                  │
│                                                           │
│  'dashboard'  → Staff created in management system        │
│                 ↓                                         │
│                 Auto-approved (confirmed)                 │
│                                                           │
│  'walk-in'    → Front desk staff for walk-in customer     │
│                 ↓                                         │
│                 Auto-approved (confirmed)                 │
│                                                           │
└───────────────────────────────────────────────────────────┘
```

---

## API Endpoint Architecture

### POST /api/room

```
┌────────────────────────────────────────────────────────┐
│                  POST /api/room                        │
│                                                        │
│  Handles ALL reservation types based on source         │
└───────────────────────┬────────────────────────────────┘
                        │
          ┌─────────────┴─────────────┐
          │                           │
          ▼                           ▼
┌────────────────────┐      ┌────────────────────┐
│ reservation_source │      │ reservation_source │
│ = 'homepage'       │      │ = 'dashboard' or   │
│                    │      │   'walk-in'        │
└─────────┬──────────┘      └─────────┬──────────┘
          │                           │
          │ Set:                      │ Set:
          │ approval_status           │ approval_status
          │   = 'pending'             │   = 'confirmed'
          │ status = 'pending'        │ status = 'confirmed'
          │                           │
          ▼                           ▼
   Needs Admin                 Ready Immediately
   Approval                    
```

### GET /api/pending-reservations

```
┌────────────────────────────────────────────────────────┐
│          GET /api/pending-reservations                 │
│                                                        │
│  Query Parameter: ?type=room or ?type=event            │
└───────────────────────┬────────────────────────────────┘
                        │
          ┌─────────────┴─────────────┐
          │                           │
    type='room'                  type='event'
          │                           │
          ▼                           ▼
┌──────────────────────┐    ┌──────────────────────┐
│ Query:               │    │ Query:               │
│ SELECT * FROM        │    │ SELECT * FROM        │
│ reservations         │    │ pending_reservations │
│ WHERE                │    │ WHERE                │
│ reservation_source   │    │ type = 'event'       │
│   = 'homepage'       │    │                      │
│ AND approval_status  │    │                      │
│   = 'pending'        │    │                      │
└──────────────────────┘    └──────────────────────┘
```

---

## Data Migration Flow

### Before Migration

```
┌──────────────────────┐     ┌──────────────────────┐
│ pending_reservations │     │    reservations      │
│                      │     │                      │
│ Room reservations    │     │ Confirmed            │
│ awaiting approval    │     │ reservations         │
│                      │     │                      │
│ Contains:            │     │ Contains:            │
│ - type: 'room'       │     │ - room_id            │
│ - status: pending    │     │ - customer_name      │
│ - customer_name      │     │ - check_in_date      │
│ - check_in_date      │     │ - e_signature ❌     │
│                      │     │                      │
└──────────────────────┘     └──────────────────────┘
```

### After Migration

```
                 ┌──────────────────────┐
                 │    reservations      │
                 │                      │
                 │ ALL room reservations│
                 │ in ONE table         │
                 │                      │
                 │ Contains:            │
                 │ - room_id            │
                 │ - customer_name      │
                 │ - check_in_date      │
                 │ - approval_status ✨ │
                 │ - reservation_source │
                 │   ✨                 │
                 │ - NO e_signature ✅  │
                 │                      │
                 └──────────────────────┘
                           │
         ┌─────────────────┼─────────────────┐
         │                 │                 │
         ▼                 ▼                 ▼
    [homepage]        [dashboard]       [walk-in]
    pending           confirmed         confirmed
```

---

## Query Examples Visualization

### Get Pending Homepage Reservations

```sql
SELECT * FROM reservations
WHERE reservation_source = 'homepage'
  AND approval_status = 'pending';
```

```
┌──────────────────────────────────────────────────┐
│  Results:                                        │
├──────────────────────────────────────────────────┤
│  id │ name      │ source   │ approval  │ status │
├─────┼───────────┼──────────┼───────────┼────────┤
│ 101 │ John Doe  │ homepage │ pending   │ pending│
│ 102 │ Jane Smith│ homepage │ pending   │ pending│
│ 103 │ Bob Jones │ homepage │ pending   │ pending│
└─────┴───────────┴──────────┴───────────┴────────┘
                    ↑           ↑
              Both filters must match
```

### Get All Confirmed Reservations

```sql
SELECT * FROM reservations
WHERE approval_status = 'confirmed';
```

```
┌──────────────────────────────────────────────────────┐
│  Results: Mix of sources, all confirmed              │
├──────────────────────────────────────────────────────┤
│  id │ name       │ source    │ approval  │ status   │
├─────┼────────────┼───────────┼───────────┼──────────┤
│ 201 │ Alice Lee  │ dashboard │ confirmed │ confirmed│
│ 202 │ Tom Brown  │ walk-in   │ confirmed │ confirmed│
│ 203 │ Sue White  │ homepage  │ confirmed │ confirmed│
└─────┴────────────┴───────────┴───────────┴──────────┘
                                    ↑
                            All confirmed, ready
                            for check-in
```

---

## Benefits Visualization

### Before (Complex)

```
Customer          Admin              System
   │                │                  │
   │ Submit Form    │                  │
   ├───────────────→│                  │
   │                │ INSERT into      │
   │                │ pending_         │
   │                │ reservations     │
   │                ├─────────────────→│
   │                │                  │
   │                │ Review & Approve │
   │                │◄─────────────────│
   │                │                  │
   │                │ DELETE from      │
   │                │ pending_         │
   │                ├─────────────────→│
   │                │                  │
   │                │ INSERT into      │
   │                │ reservations     │
   │                ├─────────────────→│
   │                │                  │
   │ Confirmed      │                  │
   │◄───────────────┴──────────────────│
   
   ❌ Data moves between tables
   ❌ Risk of data loss
   ❌ Complex logic
```

### After (Simple)

```
Customer          Admin              System
   │                │                  │
   │ Submit Form    │                  │
   ├───────────────→│                  │
   │                │ INSERT into      │
   │                │ reservations     │
   │                │ (status=pending) │
   │                ├─────────────────→│
   │                │                  │
   │                │ Review & Approve │
   │                │◄─────────────────│
   │                │                  │
   │                │ UPDATE           │
   │                │ approval_status  │
   │                │ = 'confirmed'    │
   │                ├─────────────────→│
   │                │                  │
   │ Confirmed      │                  │
   │◄───────────────┴──────────────────│
   
   ✅ Single table update
   ✅ No data movement
   ✅ Simple logic
```

---

## Security Model

```
┌─────────────────────────────────────────────────────┐
│              SECURITY & PERMISSIONS                 │
└─────────────────────────────────────────────────────┘

┌──────────────┐
│   PUBLIC     │  → Can submit homepage reservations
│   USERS      │     (No authentication required)
└──────┬───────┘
       │
       ▼
  POST /api/room
  (reservation_source = 'homepage')
       │
       ▼
  Creates with approval_status = 'pending'


┌──────────────┐
│   STAFF      │  → Can create dashboard reservations
│   USERS      │     (Authentication required)
└──────┬───────┘
       │
       ▼
  POST /api/room
  (reservation_source = 'dashboard')
       │
       ▼
  Creates with approval_status = 'confirmed'


┌──────────────┐
│ ADMIN/       │  → Can approve/reject pending reservations
│ MANAGER      │     (Manager role required)
└──────┬───────┘
       │
       ▼
  PUT /api/pending-reservations
       │
       ▼
  Updates approval_status, sets approved_by
```

---

## Monitoring & Reporting

### Dashboard Metrics

```
┌────────────────────────────────────────────┐
│         RESERVATION METRICS                │
├────────────────────────────────────────────┤
│                                            │
│  📊 Total Reservations                     │
│     SELECT COUNT(*) FROM reservations      │
│                                            │
│  🔔 Pending Approvals                      │
│     SELECT COUNT(*) FROM reservations      │
│     WHERE approval_status = 'pending'      │
│                                            │
│  ✅ Confirmed Today                        │
│     SELECT COUNT(*) FROM reservations      │
│     WHERE approval_status = 'confirmed'    │
│     AND created_at::date = CURRENT_DATE    │
│                                            │
│  🌐 Homepage Submissions                   │
│     SELECT COUNT(*) FROM reservations      │
│     WHERE reservation_source = 'homepage'  │
│                                            │
│  💼 Dashboard Created                      │
│     SELECT COUNT(*) FROM reservations      │
│     WHERE reservation_source = 'dashboard' │
│                                            │
└────────────────────────────────────────────┘
```

---

**Visual Guide Version:** 1.0  
**Date:** November 2, 2025  
**Status:** Production Ready ✅
