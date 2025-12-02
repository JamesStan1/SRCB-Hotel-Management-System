import { NextResponse } from 'next/server';
import pool from '../../../lib/db'; // Adjust path as necessary

export async function GET(request) {
  let client;
  try {
    const url = new URL(request.url);
    const periodStart = url.searchParams.get('periodStart');
    const periodEnd = url.searchParams.get('periodEnd');

    if (!periodStart || !periodEnd) {
      return NextResponse.json({ error: 'Period start and end dates are required' }, { status: 400 });
    }

    client = await pool.connect();
    const result = await client.query(`
      SELECT 
        p.id, p.user_id, p.period_start, p.period_end, p.total_hours, p.total_pay, p.generated_at,
        u.name AS user_name, u.role AS user_role, u.email, u.hourly_rate, u.status
      FROM payroll p
      JOIN users u ON p.user_id = u.id
      WHERE p.period_start = $1 AND p.period_end = $2
      ORDER BY u.name ASC
    `, [periodStart, periodEnd]);
    return NextResponse.json(result.rows, { status: 200 });
  } catch (error) {
    console.error('Error fetching payroll:', error.message, error.code, error.stack);
    return NextResponse.json({ error: 'Failed to fetch payroll', details: error.message }, { status: 500 });
  } finally {
    if (client) client.release();
  }
}

export async function POST(request) {
  let client;
  try {
    const { userId, periodStart, periodEnd, requesterRole } = await request.json();
    if (!userId || !periodStart || !periodEnd) {
      return NextResponse.json({ error: 'User ID, period start, and end are required' }, { status: 400 });
    }
    if (!['admin', 'manager'].includes(requesterRole)) {
      return NextResponse.json({ error: 'Unauthorized: Only admins or managers can process payroll' }, { status: 403 });
    }

    client = await pool.connect();

    // Check user and status
    const userRes = await client.query(`
      SELECT hourly_rate, status FROM users WHERE id = $1
    `, [userId]);
    if (userRes.rows.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    const { hourly_rate, status } = userRes.rows[0];
    if (!hourly_rate) {
      return NextResponse.json({ error: 'User has no hourly rate set' }, { status: 400 });
    }
    if (status === 'Paused') {
      return NextResponse.json({ error: 'User is paused, cannot generate payroll' }, { status: 400 });
    }

    // Calculate total hours from attendance
    const hoursRes = await client.query(`
      SELECT COALESCE(SUM(hours_worked), 0) AS total_hours
      FROM attendance
      WHERE user_id = $1 AND date BETWEEN $2 AND $3 AND clock_out IS NOT NULL
    `, [userId, periodStart, periodEnd]);
    const totalHours = hoursRes.rows[0].total_hours;

    const totalPay = (totalHours * hourly_rate).toFixed(2);

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