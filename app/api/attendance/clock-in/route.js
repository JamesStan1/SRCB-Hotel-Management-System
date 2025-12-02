import { NextResponse } from 'next/server';
import pool from '../../../lib/db'; // Adjust the import path as necessary

export async function POST(request) {
  let client;
  try {
    const { userId, clockInTime } = await request.json();
    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    console.log('Attempting to connect to database...');
    client = await pool.connect().catch(err => {
      console.error('Connection error:', err.message, err.code, err.stack);
      throw new Error(`Failed to connect to database: ${err.message}`);
    });

  // Use local date (YYYY-MM-DD) to match client-side date selection
  // so that when users in different timezones clock in near midnight, the
  // recorded date matches the client's selected date.
  const today = new Date().toLocaleDateString('en-CA');

    // Check if already clocked in today
    const existing = await client.query(`
      SELECT clock_in, clock_out FROM attendance
      WHERE user_id = $1 AND date = $2
    `, [userId, today]);

    if (existing.rows.length > 0) {
      const record = existing.rows[0];
      if (record.clock_in) {
        // Return 200 with existing clock-in time so the client can be idempotent
        // and avoid treating repeated clock-in attempts as errors.
        return NextResponse.json({
          message: 'Already clocked in today',
          clockInTime: record.clock_in,
          alreadyClockedIn: true,
        }, { status: 200 });
      }
    }

    // Insert or update and return the recorded clock_in time so client can
    // display the accurate clock-in time immediately. If the client provided
    // a local time string (HH:MM:SS) use that to avoid server/DB timezone
    // differences; otherwise fall back to CURRENT_TIME.
    let res;
    if (clockInTime) {
      res = await client.query(`
      INSERT INTO attendance (user_id, date, clock_in)
      VALUES ($1, $2, $3::time)
      ON CONFLICT (user_id, date) DO UPDATE
      SET clock_in = $3::time
      WHERE attendance.clock_in IS NULL
      RETURNING clock_in
    `, [userId, today, clockInTime]);
    } else {
      res = await client.query(`
      INSERT INTO attendance (user_id, date, clock_in)
      VALUES ($1, $2, CURRENT_TIME)
      ON CONFLICT (user_id, date) DO UPDATE
      SET clock_in = CURRENT_TIME
      WHERE attendance.clock_in IS NULL
      RETURNING clock_in
    `, [userId, today]);
    }

    const recorded = res.rows && res.rows[0] ? res.rows[0].clock_in : null;
    return NextResponse.json({ message: 'Clocked in successfully', clockInTime: recorded }, { status: 200 });
  } catch (error) {
    console.error('Clock-in error:', error.message, error.code, error.stack);
    return NextResponse.json({ 
      error: 'Failed to clock in', 
      details: error.message 
    }, { status: 500 });
  } finally {
    if (client) {
      client.release();
      console.log('Database client released');
    }
  }
}