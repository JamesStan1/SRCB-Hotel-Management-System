import { NextResponse } from 'next/server';
import pool from '../../../lib/db'; // Adjust the import path as necessary

export async function POST(request) {
  let client;
  try {
    const { userId, clockOutTime } = await request.json();
    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    client = await pool.connect();
    // Use local date (YYYY-MM-DD) to match client-side date selection
    const today = new Date().toLocaleDateString('en-CA');

    // Find today's record
    const existing = await client.query(`
      SELECT clock_in, clock_out FROM attendance
      WHERE user_id = $1 AND date = $2
    `, [userId, today]);

    if (existing.rows.length === 0 || !existing.rows[0].clock_in) {
      return NextResponse.json({ error: 'No clock-in record found for today' }, { status: 400 });
    }

    if (existing.rows[0].clock_out) {
      return NextResponse.json({ error: 'Already clocked out today' }, { status: 400 });
    }

    // Use provided client local time if available, otherwise server current time
    let updateResult;
    if (clockOutTime) {
      updateResult = await client.query(`
        UPDATE attendance
        SET clock_out = $3::time
        WHERE user_id = $1 AND date = $2
        RETURNING clock_in, clock_out
      `, [userId, today, clockOutTime]);
    } else {
      updateResult = await client.query(`
        UPDATE attendance
        SET clock_out = CURRENT_TIME
        WHERE user_id = $1 AND date = $2
        RETURNING clock_in, clock_out
      `, [userId, today]);
    }

    const row = updateResult.rows[0];
    const clockIn = row.clock_in; // time string
    const clockOut = row.clock_out; // time string

    // Compute hours worked using the date context, handling overnight shifts
    const start = new Date(`${today}T${clockIn}`);
    let end = new Date(`${today}T${clockOut}`);
    // If end is less than or equal to start, assume it crossed midnight -> add 1 day
    if (end <= start) {
      end = new Date(end.getTime() + 24 * 60 * 60 * 1000);
    }
    const hoursWorked = +(Math.abs(end - start) / 36e5).toFixed(2);
    const overtimeHours = hoursWorked > 8 ? +(hoursWorked - 8).toFixed(2) : 0;

    return NextResponse.json({
      message: 'Clocked out successfully',
      time: clockOut,
      hoursWorked,
      overtimeHours,
    }, { status: 200 });
  } catch (error) {
    console.error('Clock-out error:', error.message, error.code, error.stack);
    return NextResponse.json({ 
      error: 'Failed to clock out', 
      details: error.message 
    }, { status: 500 });
  } finally {
    if (client) client.release();
  }
}