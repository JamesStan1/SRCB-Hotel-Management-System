import { NextResponse } from 'next/server';
import pool from '../../../lib/db'; // Adjust the import path as necessary

export async function POST(request) {
  let client;
  try {
    const { userId, periodStart, periodEnd } = await request.json();
    if (!userId || !periodStart || !periodEnd) {
      return NextResponse.json({ error: 'User ID, period start, and end are required' }, { status: 400 });
    }

    client = await pool.connect();

    // Get hourly rate
    const userRes = await client.query(`
      SELECT hourly_rate FROM users WHERE id = $1
    `, [userId]);
    if (userRes.rows.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    const hourlyRate = userRes.rows[0].hourly_rate;
    if (!hourlyRate) {
      return NextResponse.json({ error: 'User has no hourly rate set' }, { status: 400 });
    }

    // Calculate total hours from attendance
    const hoursRes = await client.query(`
      SELECT COALESCE(SUM(hours_worked), 0) AS total_hours
      FROM attendance
      WHERE user_id = $1 AND date BETWEEN $2 AND $3 AND clock_out IS NOT NULL
    `, [userId, periodStart, periodEnd]);
    const totalHours = hoursRes.rows[0].total_hours;

    const totalPay = (totalHours * hourlyRate).toFixed(2);

    // Insert or update payroll
    await client.query(`
      INSERT INTO payroll (user_id, period_start, period_end, total_hours, total_pay)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (user_id, period_start, period_end)
      DO UPDATE SET total_hours = $4, total_pay = $5, generated_at = CURRENT_TIMESTAMP
    `, [userId, periodStart, periodEnd, totalHours, totalPay]);

    return NextResponse.json({ 
      message: 'Payroll generated successfully',
      totalHours,
      totalPay
    }, { status: 200 });
  } catch (error) {
    console.error('Payroll generate error:', error.message, error.code, error.stack);
    return NextResponse.json({ error: 'Failed to generate payroll', details: error.message }, { status: 500 });
  } finally {
    if (client) client.release();
  }
}
