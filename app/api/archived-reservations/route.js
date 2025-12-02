import { NextResponse } from 'next/server';
import pool from '../../lib/db';

export async function GET(request) {
  try {
    const url = new URL(request.url);
    const startDate = url.searchParams.get('start_date');
    const endDate = url.searchParams.get('end_date');
    const customerName = url.searchParams.get('customer_name');

    const clauses = [];
    const params = [];

    if (startDate) {
      params.push(startDate);
      clauses.push(`created_at >= $${params.length}`);
    }
    if (endDate) {
      params.push(endDate);
      clauses.push(`created_at <= $${params.length}`);
    }
    if (customerName) {
      params.push(`%${customerName}%`);
      clauses.push(`customer_name ILIKE $${params.length}`);
    }

    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';

    const q = `SELECT * FROM archived_reservations ${where} ORDER BY created_at DESC LIMIT 1000`;
    const result = await pool.query(q, params);
    return NextResponse.json(result.rows, { status: 200 });
  } catch (error) {
    console.error('Error fetching archived reservations:', error);
    return NextResponse.json({ error: 'Failed to fetch archived reservations' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const {
      reservation_type,
      source_table,
      source_id,
      invoice_id,
      customer_name,
      event_name,
      room_number,
      check_in_date,
      check_out_date,
      event_date,
      guests,
      subtotal,
      total,
      payment_method,
      cashier_name,
      // New package fields
      package_name,
      event_package_id,
      // GCash reference
      reference_number,
      metadata
    } = body;

    if (!reservation_type || !source_table) {
      return NextResponse.json({ error: 'reservation_type and source_table are required' }, { status: 400 });
    }

    const insertQ = `INSERT INTO archived_reservations (
      reservation_type, source_table, source_id, invoice_id, customer_name, event_name, room_number,
      check_in_date, check_out_date, event_date, guests, subtotal, total, payment_method, cashier_name,
      package_name, event_package_id, reference_number, metadata
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19) RETURNING *`;

    const params = [
      reservation_type,
      source_table,
      source_id || null,
      invoice_id || null,
      customer_name || null,
      event_name || null,
      room_number || null,
      check_in_date || null,
      check_out_date || null,
      event_date || null,
      guests || null,
      subtotal || 0,
      total || 0,
      payment_method || null,
      cashier_name || null,
      package_name || null,
      event_package_id || null,
      reference_number || null,
      metadata ? (typeof metadata === 'string' ? JSON.parse(metadata) : metadata) : {}
    ];

    const res = await pool.query(insertQ, params);
    return NextResponse.json({ success: true, archived: res.rows[0] }, { status: 201 });
  } catch (error) {
    console.error('Error inserting archived reservation:', error);
    return NextResponse.json({ error: 'Failed to archive reservation' }, { status: 500 });
  }
}
