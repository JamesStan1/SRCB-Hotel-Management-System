// Example debug endpoint: /api/attendance/check
import { NextResponse } from 'next/server';
import pool from '../../../lib/db';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const today = new Date().toISOString().split('T')[0];
    const result = await pool.query(
      'SELECT * FROM attendance WHERE user_id = $1 AND date = $2',
      [userId, today]
    );
    return NextResponse.json(result.rows || [], { status: 200 });
  } catch (err) {
    console.error('Attendance check error:', err);
    return NextResponse.json({ error: 'Failed to perform attendance check', details: err.message }, { status: 500 });
  }
}