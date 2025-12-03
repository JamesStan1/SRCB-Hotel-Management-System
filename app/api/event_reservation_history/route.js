import { NextResponse } from 'next/server';
import pool from '../../lib/db';

// Safe JSON functions
function safeJsonParse(str, fallback = null) {
  try {
    return str ? JSON.parse(str) : fallback;
  } catch {
    return fallback;
  }
}

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);

    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');
    const customerName = searchParams.get('customer_name');

    // Determine receipts table (pos.receipts preferred)
    const tblRes = await pool.query("SELECT CASE WHEN to_regclass('pos.receipts') IS NOT NULL THEN 'pos.receipts' WHEN to_regclass('receipts') IS NOT NULL THEN 'receipts' ELSE NULL END as tbl");
    const receiptsTable = tblRes.rows[0] && tblRes.rows[0].tbl;
    const receiptsJoin = receiptsTable ? `LEFT JOIN ${receiptsTable} r ON (erh.invoice_id::text = r.id::text)` : '';

    // Left join receipts by invoice_id when present so we can prefer the POS receipt's cashier and total
    let query = `
      SELECT 
        erh.id, erh.event_id, erh.event_package_id, erh.invoice_id, erh.customer_name, erh.event_name,
        erh.event_date, erh.guests, erh.total_cost, erh.payment_method,
        erh.discount_type, erh.discount_amount, erh.subtotal, erh.total, erh.cashier_name, erh.created_at,
        r.cashier as receipt_cashier,
        (r.total)::numeric as receipt_total
      FROM event_reservation_history erh
      ${receiptsJoin}
      WHERE 1=1
    `;
    const params = [];

    if (startDate) {
      params.push(startDate);
      query += ` AND event_date >= $${params.length}`;
    }
    if (endDate) {
      params.push(endDate);
      query += ` AND event_date <= $${params.length}`;
    }
    if (customerName) {
      params.push(`%${customerName}%`);
      query += ` AND customer_name ILIKE $${params.length}`;
    }

    query += ` ORDER BY event_date DESC`;

    const result = await pool.query(query, params);

    const reservations = result.rows.map(row => ({
      ...row,
      total_cost: row.total_cost ? Number(row.total_cost) : 0,
      subtotal: row.subtotal ? Number(row.subtotal) : 0,
      total: row.total ? Number(row.total) : 0,
      discount_amount: row.discount_amount ? Number(row.discount_amount) : 0,
      // Normalize joined receipt values if available
      receipt_cashier: row.receipt_cashier || null,
      receipt_total: row.receipt_total !== null && row.receipt_total !== undefined ? Number(row.receipt_total) : null,
    }));

    return NextResponse.json(reservations, { status: 200 });
  } catch (error) {
    console.error('Error fetching event reservations:', error);
    return NextResponse.json(
      { error: 'Failed to fetch event reservations', details: error.message },
      { status: 500 }
    );
  }
}

export async function POST(req) {
  try {
    const body = await req.json();
    
    // Validate required fields
    const requiredFields = [
      'event_id', 'invoice_id', 'customer_name', 'event_name', 'event_date',
      'total_cost', 'guests', 'payment_method', 'discount_type', 'discount_amount',
      'subtotal', 'total', 'cashier_name'
    ];
    
    for (const field of requiredFields) {
      if (body[field] === undefined || body[field] === null) {
        return NextResponse.json(
          { error: `Missing required field: ${field}` },
          { status: 400 }
        );
      }
    }

    // Validate numeric fields
    if (typeof body.total_cost !== 'number' || body.total_cost < 0) {
      return NextResponse.json(
        { error: 'Invalid total_cost: must be a non-negative number' },
        { status: 400 }
      );
    }
    if (typeof body.guests !== 'number' || body.guests < 0 || !Number.isInteger(body.guests)) {
      return NextResponse.json(
        { error: 'Invalid guests: must be a non-negative integer' },
        { status: 400 }
      );
    }
    if (typeof body.discount_amount !== 'number' || body.discount_amount < 0) {
      return NextResponse.json(
        { error: 'Invalid discount_amount: must be a non-negative number' },
        { status: 400 }
      );
    }
    if (typeof body.subtotal !== 'number' || body.subtotal < 0) {
      return NextResponse.json(
        { error: 'Invalid subtotal: must be a non-negative number' },
        { status: 400 }
      );
    }
    if (typeof body.total !== 'number' || body.total < 0) {
      return NextResponse.json(
        { error: 'Invalid total: must be a non-negative number' },
        { status: 400 }
      );
    }

    // Validate event_date format
    const eventDate = new Date(body.event_date);
    if (isNaN(eventDate.getTime())) {
      return NextResponse.json(
        { error: 'Invalid event_date: must be a valid ISO date string' },
        { status: 400 }
      );
    }

    const query = `
      INSERT INTO event_reservation_history (
        event_id, event_package_id, invoice_id, customer_name, event_name,
        event_date, total_cost, guests, payment_method, discount_type,
        discount_amount, subtotal, total, cashier_name
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING *
    `;
    
    const values = [
      body.event_id,
      body.event_package_id,
      body.invoice_id,
      body.customer_name,
      body.event_name,
      body.event_date,
      body.total_cost,
      body.guests,
      body.payment_method,
      body.discount_type,
      body.discount_amount,
      body.subtotal,
      body.total,
      body.cashier_name
    ];

    const result = await pool.query(query, values);

    return NextResponse.json(result.rows[0], { status: 201 });
  } catch (error) {
    console.error('Error saving event reservation history:', error);
    return NextResponse.json(
      { error: 'Failed to save event reservation history', details: error.message },
      { status: 500 }
    );
  }
}
