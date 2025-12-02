import { NextResponse } from 'next/server';
import pool from '../../lib/db'; // Adjust the import path as necessary

export async function GET() {
  let client;
  try {
    client = await pool.connect();
    const result = await client.query(`
      SELECT 
        a.id, a.user_id, a.date, a.clock_in, a.clock_out, a.hours_worked, a.status,
        u.name AS user_name, u.role AS user_role, u.email
      FROM attendance a
      JOIN users u ON a.user_id = u.id
      ORDER BY a.date DESC, u.name ASC
    `);
    return NextResponse.json(result.rows, { status: 200 });
  } catch (error) {
    console.error('Error fetching attendance:', error.message, error.code, error.stack);
    return NextResponse.json({ error: 'Failed to fetch attendance', details: error.message }, { status: 500 });
  } finally {
    if (client) client.release();
  }
}

export async function POST(request) {
  let client;
  try {
    const { userId, action, date } = await request.json();
    if (!userId || !action || !date) {
      return NextResponse.json({ error: 'User ID, action, and date are required' }, { status: 400 });
    }
    if (!['clock_in', 'clock_out'].includes(action)) {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    client = await pool.connect();

    // Check user status
    const userRes = await client.query(`
      SELECT status FROM users WHERE id = $1
    `, [userId]);
    if (userRes.rows.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    if (userRes.rows[0].status === 'Paused') {
      return NextResponse.json({ error: 'User is paused, cannot record attendance' }, { status: 400 });
    }

    if (action === 'clock_in') {
      // Check if already clocked in
      const existing = await client.query(`
        SELECT id FROM attendance WHERE user_id = $1 AND date = $2
      `, [userId, date]);
      if (existing.rows.length > 0) {
        return NextResponse.json({ error: 'Already clocked in for this date' }, { status: 400 });
      }

      // Record clock-in
      await client.query(`
        INSERT INTO attendance (user_id, date, clock_in, status)
        VALUES ($1, $2, CURRENT_TIME, 'present')
      `, [userId, date]);
      return NextResponse.json({ message: 'Clocked in successfully' }, { status: 200 });
    } else {
      // Update clock-out and return computed hours_worked and overtime
      const result = await client.query(`
        UPDATE attendance 
        SET clock_out = CURRENT_TIME, status = 'present'
        WHERE user_id = $1 AND date = $2 AND clock_in IS NOT NULL AND clock_out IS NULL
        RETURNING clock_out, hours_worked
      `, [userId, date]);
      if (result.rows.length === 0) {
        return NextResponse.json({ error: 'No active clock-in found for this date' }, { status: 400 });
      }
      const row = result.rows[0];
      const hoursWorked = Number(row.hours_worked || 0);
      const overtimeHours = hoursWorked > 8 ? +(hoursWorked - 8).toFixed(2) : 0;
      return NextResponse.json({ message: 'Clocked out successfully', clockOutTime: row.clock_out, hoursWorked, overtimeHours }, { status: 200 });
    }
  } catch (error) {
    console.error('Attendance error:', error.message, error.code, error.stack);
    return NextResponse.json({ error: 'Failed to process attendance', details: error.message }, { status: 500 });
  } finally {
    if (client) client.release();
  }
}