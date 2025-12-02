import { NextResponse } from 'next/server';
import pool from '../../../lib/db';

export async function GET(request) {
  const url = new URL(request.url);
  const status = url.searchParams.get('status');

  if (!status) {
    return NextResponse.json({ error: 'Status parameter is required' }, { status: 400 });
  }

  let client;
  try {
    client = await pool.connect();
  } catch (connErr) {
    console.error('Database connection failed for housekeeping/by-status:', connErr);
    return NextResponse.json({ error: 'Database connection error' }, { status: 503 });
  }

  try {
    const result = await client.query(
      `SELECT h.room_id, h.status, h.notes, r.room_number 
       FROM public.housekeeping h 
       JOIN public.rooms r ON h.room_id = r.id 
       WHERE h.status = $1`,
      [status]
    );

    const housekeepings = result.rows.map((h) => ({
      room_id: h.room_id,
      room_number: h.room_number,
      status: h.status,
      notes: h.notes,
    }));

    return NextResponse.json(housekeepings);
  } catch (error) {
    console.error('Error fetching housekeeping by status:', error);
    return NextResponse.json({ error: 'Failed to fetch housekeeping data' }, { status: 500 });
  } finally {
    try { if (client) client.release(); } catch (e) { /* ignore */ }
  }
}
