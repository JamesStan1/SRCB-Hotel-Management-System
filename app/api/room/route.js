import pool from "../../lib/db";
import { NextResponse } from "next/server";
import { requireRole, Permissions } from "../../lib/rbac";
import { withTrafficHandler } from "../../lib/trafficHandler";

// ✅ SAFER role check wrapper — prevents unexpected crashes
async function safeRequireRole(request, permission, action) {
  try {
    const auth = await requireRole(request, permission, action);
    return auth;
  } catch (err) {
    console.error("RBAC check failed:", err);
    return { allowed: false, message: "Authorization error" };
  }
}

//
// ====================== GET ROOMS ======================
//
async function fetchRoomBillingData(searchParams) {
  const startDate = searchParams.get('start_date');
  const endDate = searchParams.get('end_date');
  const customerName = searchParams.get('customer_name');

  const parseMoney = (value) => {
    if (value === null || value === undefined) return 0;
    if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
    const cleaned = String(value).replace(/[^0-9.-]/g, '');
    if (!cleaned || cleaned === '-' || cleaned === '.' || cleaned === '-.' ) return 0;
    const numeric = Number(cleaned);
    return Number.isFinite(numeric) ? numeric : 0;
  };

  const tblRes = await pool.query(`
    SELECT CASE
      WHEN to_regclass('pos.receipts') IS NOT NULL THEN 'pos.receipts'
      WHEN to_regclass('receipts') IS NOT NULL THEN 'receipts'
      ELSE NULL
    END as tbl
  `);
  const receiptsTable = tblRes.rows[0]?.tbl || null;

  const queryParams = [];
  const filters = ['r.room_id IS NOT NULL'];

  if (startDate) {
    queryParams.push(startDate);
    filters.push(`r.check_in_date >= $${queryParams.length}`);
  }

  if (endDate) {
    queryParams.push(endDate);
    filters.push(`r.check_out_date <= $${queryParams.length}`);
  }

  if (customerName) {
    queryParams.push(`%${customerName}%`);
    filters.push(`r.customer_name ILIKE $${queryParams.length}`);
  }

  const receiptsJoin = receiptsTable
    ? `LEFT JOIN LATERAL (
        SELECT
          rec.id AS receipt_id,
          rec.cashier AS receipt_cashier,
          (rec.total)::numeric AS receipt_total
        FROM ${receiptsTable} rec
        WHERE false
      ) rec_match ON true`
    : '';

  const roomQuery = `
    SELECT
      r.id,
      r.room_id,
      r.check_in_date,
      r.check_out_date,
      COALESCE(rec_match.receipt_total, r.total_price) AS billed_total,
      COALESCE(r.total_price, 0) AS base_total,
      r.customer_name,
      rm.room_number,
      r.package_name,
      COALESCE(r.downpayment_amount, 0) AS downpayment_required,
      CASE WHEN r.downpayment_paid THEN r.downpayment_amount ELSE 0 END AS downpayment_paid_amount,
      COALESCE(payments.total_regular, 0) AS payments_applied,
      COALESCE(payments.cafe_total, 0) AS cafe_payments,
      r.payment_option,
      r.approval_status,
      r.status,
      rec_match.receipt_cashier,
      rec_match.receipt_total
    FROM reservations r
    LEFT JOIN rooms rm ON rm.id = r.room_id
    LEFT JOIN LATERAL (
      SELECT
        COALESCE(SUM(CASE WHEN type = 'payment' THEN amount ELSE 0 END), 0)
        - COALESCE(SUM(CASE WHEN type = 'refund' THEN amount ELSE 0 END), 0) AS total_regular,
        COALESCE(SUM(CASE WHEN type = 'cafe' THEN amount ELSE 0 END), 0) AS cafe_total
      FROM payments
      WHERE reservation_id = r.id
    ) payments ON true
    ${receiptsJoin}
    WHERE ${filters.join(' AND ')}
    ORDER BY r.check_out_date DESC NULLS LAST, r.id DESC
  `;

  const roomResult = await pool.query(roomQuery, queryParams);
  const roomReservations = roomResult.rows.map((row) => {
    const billedTotal = parseMoney(row.billed_total ?? row.total ?? row.total_price ?? row.base_total ?? 0);
    const downpaymentPaid = parseMoney(row.downpayment_paid_amount ?? 0);
    const paymentsApplied = parseMoney(row.payments_applied ?? 0);
    const remaining = Math.max(billedTotal - downpaymentPaid - paymentsApplied, 0);

    return {
      id: row.id,
      room_id: row.room_id,
      check_in_date: row.check_in_date,
      check_out_date: row.check_out_date,
      price: billedTotal,
      total: billedTotal,
      total_price: billedTotal,
      base_total: Number(row.base_total ?? 0),
      customer_name: row.customer_name,
      room_number: row.room_number,
      package_name: row.package_name,
  downpayment_required: parseMoney(row.downpayment_required ?? 0),
  downpayment_amount: parseMoney(row.downpayment_required ?? 0),
  downpayment_paid_amount: downpaymentPaid,
  downpayment: downpaymentPaid,
  payments_applied: paymentsApplied,
  cafe_payments: parseMoney(row.cafe_payments ?? 0),
  total_paid_amount: downpaymentPaid + paymentsApplied,
      remaining_balance: remaining,
      payment_option: row.payment_option,
      approval_status: row.approval_status,
      status: row.status,
      receipt_cashier: row.receipt_cashier,
      receipt_total: row.receipt_total ? Number(row.receipt_total) : null,
      display_name:
        row.receipt_cashier && String(row.receipt_cashier).trim()
          ? row.receipt_cashier
          : row.customer_name,
    };
  });

  return NextResponse.json({ roomReservations }, { status: 200 });
}

export async function GET(request) {
  try {
    const t = await withTrafficHandler(request);
    if (!t.allowed) return NextResponse.json({ error: t.reason || 'Too many requests' }, { status: t.status || 429 });

    const auth = await safeRequireRole(request, Permissions.RoomManagement, "view");
    if (!auth.allowed) {
      return NextResponse.json({ error: auth.message || "Unauthorized" }, { status: 401 });
    }

    const url = new URL(request.url);
    if ((url.searchParams.get('scope') || '').toLowerCase() === 'billing') {
      return await fetchRoomBillingData(url.searchParams);
    }

    const result = await pool.query(`
      SELECT 
        r.*, 
        p.name AS package_name, 
        p.price AS package_price, 
        p.guests AS package_guests, 
        p.image AS package_image,
        p.description AS package_description,
        res.id AS reservation_id,
        res.customer_name,
        res.customer_email,
        res.contact_number,
        res.address,
        res.nationality,
        res.additional_guests,
        res.additional_requests,
        res.remarks,
        res.check_in_date,
        res.check_out_date
      FROM rooms r
      LEFT JOIN packages p ON r.package_id = p.id
      LEFT JOIN reservations res ON res.room_id = r.id
    `);

    const rows = result.rows.map((row) => ({
      id: row.id,
      room_number: row.room_number,
      type: row.type,
      price: row.price,
      status: row.status,
      package_id: row.package_id,
      packageId: row.package_id,
      package: {
        name: row.package_name,
        price: row.package_price,
        guests: row.package_guests,
        image: row.package_image,
        description: row.package_description,
      },
      reservation: row.reservation_id
        ? {
            id: row.reservation_id,
            customerName: row.customer_name,
            customerEmail: row.customer_email,
            contactNumber: row.contact_number,
            address: row.address,
            nationality: row.nationality,
            additionalGuests: row.additional_guests,
            additionalRequests: row.additional_requests,
            remarks: row.remarks,
            checkInDate: row.check_in_date,
            checkOutDate: row.check_out_date,
            totalPrice: row.total_price !== undefined ? Number(row.total_price) : undefined,
          }
        : null,
    }));

    return NextResponse.json(rows, { status: 200 });
  } catch (error) {
    console.error("GET /api/room error:", error);
    return NextResponse.json(
      { error: "Internal Server Error", details: error.message },
      { status: 500 }
    );
  }
}

//
// ====================== CREATE RESERVATION ======================
//
export async function POST(request) {
  let client;
  try {
    const t = await withTrafficHandler(request);
    if (!t.allowed) return NextResponse.json({ error: t.reason || 'Too many requests' }, { status: t.status || 429 });

    const auth = await safeRequireRole(request, Permissions.RoomManagement, "manage");
    if (!auth.allowed) {
      return NextResponse.json({ error: auth.message || "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    console.log("POST /api/room request body:", body);

    if (body.room_number || body.type || body.price || body.status) {
      return NextResponse.json(
        {
          error:
            "Invalid payload: This endpoint is for creating reservations, not rooms. Use POST /api/room/editroom for room creation.",
        },
        { status: 400 }
      );
    }

    const {
      packageId,
      customerName,
      customerEmail,
      contactNumber,
      idUpload,
      eSignature,
      ...otherData
    } = body;

    if (!packageId)
      return NextResponse.json({ error: "Package ID is required" }, { status: 400 });
    if (!customerName || !customerEmail || !contactNumber)
      return NextResponse.json(
        { error: "Customer name, email, and contact number are required" },
        { status: 400 }
      );
    if (!idUpload)
      return NextResponse.json({ error: "ID upload is required" }, { status: 400 });

    client = await pool.connect();
    await client.query("BEGIN");

    // Prevent duplicate reservations
    const existingReservation = await client.query(
      `SELECT id FROM reservations WHERE customer_name=$1 AND customer_email=$2 AND contact_number=$3`,
      [customerName, customerEmail, contactNumber]
    );
    if (existingReservation.rows.length > 0) {
      await client.query("ROLLBACK");
      return NextResponse.json(
        { error: "A reservation already exists for this customer" },
        { status: 400 }
      );
    }

    // Validate package
    const packageCheck = await client.query("SELECT id FROM packages WHERE id = $1", [packageId]);
    if (packageCheck.rows.length === 0) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "Invalid package ID" }, { status: 400 });
    }

    // Find available room
    const roomResult = await client.query(
      `SELECT id FROM rooms WHERE package_id=$1 AND status='Available' ORDER BY id FOR UPDATE SKIP LOCKED LIMIT 1`,
      [packageId]
    );
    if (roomResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return NextResponse.json(
        { error: "No available rooms for this package" },
        { status: 400 }
      );
    }

    const roomId = roomResult.rows[0].id;

    // Update room status
    await client.query(`UPDATE rooms SET status='Occupied' WHERE id=$1`, [roomId]);

    // Create reservation
    // compute nights safely (checkout-exclusive), default to 1
    const computeNights = (startRaw, endRaw) => {
      if (!startRaw || !endRaw) return 1;
      const s = new Date(startRaw);
      const e = new Date(endRaw);
      if (isNaN(s.getTime()) || isNaN(e.getTime())) return 1;
      const toMid = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
      const diff = Math.round((toMid(e) - toMid(s)) / (1000 * 60 * 60 * 24));
      return diff > 0 ? diff : 1;
    };

    const nights = computeNights(otherData.checkInDate, otherData.checkOutDate);
    // the client sends packageId and room price is stored in rooms.price
    // We'll derive the per-night price from the room record (room.price)
    const roomPriceRes = await client.query('SELECT price FROM rooms WHERE id = $1', [roomId]);
    const perNight = roomPriceRes.rows[0] ? Number(roomPriceRes.rows[0].price || 0) : 0;
    const totalPrice = (nights * perNight) - perNight; // (Reserved Days * Price) - Price (for 1 day)

    // Determine status and approval_status based on reservation source
    const reservationSource = otherData.reservation_source || 'dashboard';
    let approval_status = 'confirmed'; // Default for dashboard
    let status = 'confirmed';
    
    if (reservationSource === 'homepage') {
      approval_status = 'pending'; // Homepage reservations need approval
      status = 'pending';
    }

    const reservationResult = await client.query(
      `INSERT INTO reservations (
        room_id, customer_name, customer_email, contact_number,
        address, nationality, additional_guests, additional_requests,
        remarks, check_in_date, check_out_date, id_upload, total_price,
        status, approval_status, payment_option, reservation_source, package_name
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18) RETURNING *`,
      [
        roomId,
        customerName,
        customerEmail,
        contactNumber,
        otherData.address || "",
        otherData.nationality || "",
        otherData.additionalGuests || 0,
        otherData.additionalRequests || "",
        otherData.remarks || "",
        otherData.checkInDate,
        otherData.checkOutDate,
        idUpload,
        totalPrice,
        status,
        approval_status,
        otherData.payment_option || 'full_payment',
        reservationSource,
        otherData.package_name || null
      ]
    );

    await client.query("COMMIT");

    // Message based on source
    let message = 'Reservation created successfully';
    if (reservationSource === 'homepage') {
      message = 'Reservation submitted successfully and is awaiting approval';
    }

    return NextResponse.json(
      {
        success: true,
        message,
        roomId,
        reservation: {
          ...reservationResult.rows[0],
          idUpload: reservationResult.rows[0].id_upload,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    if (client) await client.query("ROLLBACK");
    console.error("POST /api/room error:", error);
    return NextResponse.json(
      { error: "Error creating reservation", details: error.message },
      { status: 500 }
    );
  } finally {
    if (client) client.release();
  }
}

//
// ====================== DELETE ROOM ======================
//
export async function DELETE(request) {
  let client;
  try {
    const t = await withTrafficHandler(request);
    if (!t.allowed) return NextResponse.json({ error: t.reason || 'Too many requests' }, { status: t.status || 429 });

    const auth = await safeRequireRole(request, Permissions.RoomManagement, "manage");
    if (!auth.allowed) {
      return NextResponse.json({ error: auth.message || "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "Room ID is required" }, { status: 400 });
    }

    client = await pool.connect();
    await client.query("BEGIN");

    // Prevent deleting rooms with active reservations
    const resCheck = await client.query(
      "SELECT * FROM reservations WHERE room_id = $1 AND check_out_date IS NULL",
      [id]
    );
    if (resCheck.rows.length > 0) {
      await client.query("ROLLBACK");
      return NextResponse.json(
        { error: "Cannot delete room with active reservations" },
        { status: 400 }
      );
    }

    const roomResult = await client.query("SELECT * FROM rooms WHERE id = $1", [id]);
    if (roomResult.rowCount === 0) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    }

    const room = roomResult.rows[0];

    await client.query(
      `INSERT INTO archive_rooms (original_id, room_number, type, price, status, package_id, archived_at)
       VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)`,
      [
        room.id,
        room.room_number,
        room.type,
        room.price,
        room.status,
        room.package_id,
      ]
    );

    await client.query("DELETE FROM rooms WHERE id = $1", [id]);
    await client.query("COMMIT");

    return NextResponse.json({ message: "Room deleted successfully", roomId: id }, { status: 200 });
  } catch (error) {
    if (client) await client.query("ROLLBACK");
    console.error("Error deleting room:", error);
    return NextResponse.json(
      { error: "Failed to delete room", details: error.message },
      { status: 500 }
    );
  } finally {
    if (client) client.release();
  }
}
