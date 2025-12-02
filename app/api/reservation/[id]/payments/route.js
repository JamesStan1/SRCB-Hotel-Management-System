import pool from '../../../../lib/db';
import { NextResponse } from 'next/server';
import { requireRole } from '../../../../lib/rbac';
import { withTrafficHandler } from '../../../../lib/trafficHandler';

async function safeRequireRole(request, permission, action) {
  try { return await requireRole(request, permission, action); }
  catch (err) { console.error('RBAC check failed:', err); return { allowed: false, message: 'Authorization error' }; }
}

export async function GET(request, { params }) {
  try {
    const t = await withTrafficHandler(request);
    if (!t.allowed) return NextResponse.json({ error: t.reason || 'Too many requests' }, { status: t.status || 429 });

    const auth = await safeRequireRole(request, 'reservations', 'view');
    if (!auth.allowed) return NextResponse.json({ error: auth.message || 'Unauthorized' }, { status: 401 });

    const reservationId = params.id;
    if (!reservationId) return NextResponse.json({ error: 'Reservation id is required' }, { status: 400 });

    const paymentsRes = await pool.query('SELECT id, amount, method, type, note, created_by, created_at FROM payments WHERE reservation_id = $1 ORDER BY created_at ASC', [reservationId]);
    const paidRes = await pool.query("SELECT COALESCE(SUM(amount),0) AS paid FROM payments WHERE reservation_id=$1 AND type='payment'", [reservationId]);
    const refundRes = await pool.query("SELECT COALESCE(SUM(amount),0) AS refund FROM payments WHERE reservation_id=$1 AND type='refund'", [reservationId]);
    const totalPaid = Number(paidRes.rows[0].paid || 0) - Number(refundRes.rows[0].refund || 0);

    const resRow = await pool.query('SELECT id, receipt_total FROM reservations WHERE id = $1', [reservationId]);
    const totalDue = resRow.rowCount ? (resRow.rows[0].receipt_total || 0) : 0;

    return NextResponse.json({ payments: paymentsRes.rows, totals: { totalPaid, totalDue, remaining: Math.max(0, totalDue - totalPaid) } }, { status: 200 });
  } catch (error) {
    console.error('GET /api/reservation/[id]/payments error:', error);
    return NextResponse.json({ error: 'Internal Server Error', details: error.message }, { status: 500 });
  }
}
