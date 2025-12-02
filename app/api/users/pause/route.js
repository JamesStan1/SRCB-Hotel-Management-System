import { NextResponse } from 'next/server';
import pool from '../../../lib/db'; // Adjust path as needed

export async function POST(request) {
  let client;
  try {
    const { userId, pause, requesterRole } = await request.json();
    if (!userId || pause === undefined) {
      return NextResponse.json({ error: 'User ID and pause status are required' }, { status: 400 });
    }
    if (!['admin', 'manager'].includes(requesterRole)) {
      return NextResponse.json({ error: 'Unauthorized: Only admins or managers can modify status' }, { status: 403 });
    }

    client = await pool.connect();
    const status = pause ? 'Paused' : 'Active';
    const result = await client.query(`
      UPDATE users SET status = $1 WHERE id = $2 RETURNING id, status
    `, [status, userId]);

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({ message: `User ${pause ? 'paused' : 'resumed'} successfully` }, { status: 200 });
  } catch (error) {
    console.error('Error updating user status:', error.message, error.code, error.stack);
    return NextResponse.json({ error: 'Failed to update user status', details: error.message }, { status: 500 });
  } finally {
    if (client) client.release();
  }
}
