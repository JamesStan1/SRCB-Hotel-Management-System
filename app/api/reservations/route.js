import { NextResponse } from 'next/server';
import pool from '../../lib/db';

// GET handler for fetching room and event reservations
export async function GET(request) {
  try {
    // Quick DB connection check to provide clearer 503 when DB is unreachable
    try {
      await pool.query('SELECT 1');
    } catch (dbErr) {
      console.error('Database connectivity check failed for /api/reservations:', dbErr);
      return NextResponse.json({ error: 'Database connection error' }, { status: 503 });
    }
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');
    const customerName = searchParams.get('customer_name');

    // Determine receipts table (pos.receipts preferred)
    const tblRes = await pool.query("SELECT CASE WHEN to_regclass('pos.receipts') IS NOT NULL THEN 'pos.receipts' WHEN to_regclass('receipts') IS NOT NULL THEN 'receipts' ELSE NULL END as tbl");
    const receiptsTable = tblRes.rows[0] && tblRes.rows[0].tbl;

    // Build lateral join for receipts matching (optional)
    const lateralJoin = receiptsTable ? `LEFT JOIN LATERAL (
      SELECT rec.id as receipt_id, rec.cashier as receipt_cashier, (rec.total)::numeric as receipt_total,
        -- indicate if this receipt explicitly references the reservation id inside items
        (
          CASE WHEN EXISTS (
            SELECT 1 FROM jsonb_array_elements(rec.items) elem WHERE (elem->>'reservation_id') = rh.id::text
          ) THEN true ELSE false END
        ) as explicit_reservation_match
      FROM ${receiptsTable} rec
      WHERE (
        -- 1) exact reservation id stored inside items JSON
        EXISTS (SELECT 1 FROM jsonb_array_elements(rec.items) elem WHERE (elem->>'reservation_id') = rh.id::text)
        -- 2) fallback: reservation id appears somewhere in the items JSON text (less strict)
        OR rec.items::text ILIKE ('%' || rh.id::text || '%')
        -- 3) fallback: matching customer name
        OR (rec.customer ILIKE rh.customer_name)
        -- 4) fallback: exact total match
        OR (
          (rh.payment_details->>'total') IS NOT NULL
          AND (rec.total)::numeric = ((rh.payment_details->>'total')::numeric)
        )
      )
      ORDER BY 
        -- prefer explicit reservation id matches first, then by time proximity
        (CASE WHEN EXISTS (SELECT 1 FROM jsonb_array_elements(rec.items) elem WHERE (elem->>'reservation_id') = rh.id::text) THEN 0 ELSE 1 END),
        ABS(EXTRACT(EPOCH FROM (rec.created_at - COALESCE(rh.check_out_date, rh.created_at)))) ASC
      LIMIT 1
    ) rec_match ON true` : '';

    // Select event reservation fields and join to receipts to include receipt cashier/total when linked by invoice_id
    const receiptsJoin = receiptsTable ? `LEFT JOIN ${receiptsTable} r ON (erh.invoice_id::text = r.id::text)` : '';

    let eventQuery = `SELECT erh.*, r.cashier as receipt_cashier, (r.total)::numeric as receipt_total
      FROM event_reservation_history erh
      ${receiptsJoin}
      WHERE 1=1`;
    const queryParams = [];

    // Build WHERE conditions as strings
    let rhConditions = '';
    let rConditions = '';

    if (startDate) {
      rhConditions += ' AND rh.check_in_date >= $' + (queryParams.length + 1);
      rConditions += ' AND r.check_in_date >= $' + (queryParams.length + 1);
      eventQuery += ' AND erh.event_date >= $' + (queryParams.length + 1);
      queryParams.push(startDate);
    }

    if (endDate) {
      rhConditions += ' AND rh.check_out_date <= $' + (queryParams.length + 1);
      rConditions += ' AND r.check_out_date <= $' + (queryParams.length + 1);
      eventQuery += ' AND erh.event_date <= $' + (queryParams.length + 1);
      queryParams.push(endDate);
    }

    if (customerName) {
      rhConditions += ' AND rh.customer_name ILIKE $' + (queryParams.length + 1);
      rConditions += ' AND r.customer_name ILIKE $' + (queryParams.length + 1);
      eventQuery += ' AND erh.customer_name ILIKE $' + (queryParams.length + 1);
      queryParams.push(`%${customerName}%`);
    }

    // Build room query with UNION to include both reservation_history and reservations table
    let roomQuery = `
      SELECT 
        rh.id,
        rh.room_id,
        rh.check_in_date,
        rh.check_out_date,
        (rh.payment_details->>'total')::NUMERIC AS price,
        (COALESCE((rh.payment_details->>'total')::NUMERIC, NULL)) AS total_price,
        rh.customer_name,
        rooms.room_number,
        rh.package_name,
        NULL::NUMERIC as downpayment,
        rec_match.receipt_cashier,
        rec_match.receipt_total
      FROM reservation_history rh
      LEFT JOIN rooms ON rh.room_id = rooms.id
      ${lateralJoin}
      WHERE 1=1 ${rhConditions}
      
      UNION ALL
      
      SELECT 
        r.id,
        r.room_id,
        r.check_in_date,
        r.check_out_date,
        r.total_price AS price,
        r.total_price,
        r.customer_name,
        rooms.room_number,
        r.package_name,
        COALESCE(r.downpayment_amount, 0) AS downpayment,
        NULL as receipt_cashier,
        NULL as receipt_total
      FROM reservations r
      LEFT JOIN rooms ON r.room_id = rooms.id
      WHERE r.room_id IS NOT NULL ${rConditions}
    `;

    // Execute queries
    const roomResult = await pool.query(roomQuery, queryParams);
    const eventResult = await pool.query(eventQuery, queryParams);

    // Normalize room rows: add a display_name that prefers receipt_cashier when available
    const roomReservations = roomResult.rows.map((r) => ({
      ...r,
      display_name: (r.receipt_cashier && String(r.receipt_cashier).trim()) ? r.receipt_cashier : r.customer_name,
    }));

    return NextResponse.json({
      roomReservations,
      eventReservations: eventResult.rows,
    }, { status: 200 });

  } catch (error) {
    console.error('API Error:', error);
    // If the error looks like a DB connectivity issue, return 503 to help debugging
    const msg = (error && error.message) ? String(error.message) : '';
    if (/connect|ECONN|timeout|ENOTFOUND|Database connection/i.test(msg)) {
      return NextResponse.json({ error: 'Database connection error' }, { status: 503 });
    }
    return NextResponse.json({ error: 'Failed to fetch reservations' }, { status: 500 });
  }
}

// POST handler for creating new room reservations
export async function POST(request) {
  try {
    const body = await request.json();
    const {
      type, // 'room' or 'event' to determine reservation type
      room_id, // Changed from room_number to match schema
      package_name,
      customer_name,
      check_in_date,
      check_out_date,
      price,
      event_name,
      event_package_name,
      event_date,
      guests,
      total
    } = body;

    if (type === 'room') {
      // Validate room reservation fields
      if (!room_id || !customer_name || !check_in_date || !check_out_date || !price) {
        return NextResponse.json(
          { error: 'Missing required fields for room reservation' },
          { status: 400 }
        );
      }

      const query = `
        INSERT INTO reservation_history (
          room_id, customer_name, check_in_date, check_out_date, payment_details, room_number, package_name
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
      `;

      const values = [
        room_id,
        customer_name,
        check_in_date,
        check_out_date,
        { price: price }, // Store price in payment_details JSONB
        body.room_number || null,
        package_name || null
      ];

      const result = await pool.query(query, values);

      return NextResponse.json(result.rows[0], { status: 201 });

    } else if (type === 'event') {
      // Validate event reservation fields
      if (!event_name || !customer_name || !event_date || !guests || !total) {
        return NextResponse.json(
          { error: 'Missing required fields for event reservation' },
          { status: 400 }
        );
      }

      const query = `
        INSERT INTO event_reservation_history (
          event_name, event_package_name, customer_name,
          event_date, guests, total
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      `;

      const values = [
        event_name,
        event_package_name || null,
        customer_name,
        event_date,
        guests,
        total
      ];

      const result = await pool.query(query, values);

      return NextResponse.json(result.rows[0], { status: 201 });

    } else {
      return NextResponse.json(
        { error: 'Invalid reservation type' },
        { status: 400 }
      );
    }

  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      { error: 'Failed to create reservation' },
      { status: 500 }
    );
  }
}