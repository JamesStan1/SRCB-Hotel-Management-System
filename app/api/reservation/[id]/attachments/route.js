import pool from '../../../../lib/db';
import { NextResponse } from 'next/server';
import { requireRole, Permissions } from '../../../../lib/rbac';
import { withTrafficHandler } from '../../../../lib/trafficHandler';

// Safe role wrapper
async function safeRequireRole(request, permission, action) {
  try {
    const auth = await requireRole(request, permission, action);
    return auth;
  } catch (err) {
    console.error('RBAC check failed:', err);
    return { allowed: false, message: 'Authorization error' };
  }
}

export async function GET(request, context) {
  let client;
  try {
    const t = await withTrafficHandler(request);
    if (!t.allowed) return NextResponse.json({ error: t.reason || 'Too many requests' }, { status: t.status || 429 });

    const auth = await safeRequireRole(request, Permissions.Reservations, 'view');
    if (!auth.allowed) {
      return NextResponse.json({ error: auth.message || 'Unauthorized' }, { status: 401 });
    }

    const params = await context.params;
    const reservationId = params?.id;
    if (!reservationId) return NextResponse.json({ error: 'Reservation id is required' }, { status: 400 });

    client = await pool.connect();
    const res = await client.query(
      'SELECT id_upload FROM reservations WHERE id = $1',
      [reservationId]
    );
    if (res.rowCount === 0) return NextResponse.json({ error: 'Reservation not found' }, { status: 404 });

    const row = res.rows[0];

    return NextResponse.json({ idUpload: row.id_upload }, { status: 200 });
  } catch (error) {
    console.error('GET /api/reservation/[id]/attachments error:', error);
    return NextResponse.json({ error: 'Internal Server Error', details: error.message }, { status: 500 });
  } finally {
    if (client) client.release();
  }
}
