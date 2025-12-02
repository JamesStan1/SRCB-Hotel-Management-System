import pool from '../../lib/db';
import { NextResponse } from 'next/server';
import { requireRole } from '../../lib/rbac';
import { withTrafficHandler } from '../../lib/trafficHandler';

async function safeRequireRole(request, permission, action) {
  try {
    return await requireRole(request, permission, action);
  } catch (err) {
    console.error('RBAC check failed:', err);
    return { allowed: false, message: 'Authorization error' };
  }
}

export async function POST(request) {
  let client;
  try {
    const t = await withTrafficHandler(request);
    if (!t.allowed) return NextResponse.json({ error: t.reason || 'Too many requests' }, { status: t.status || 429 });

  // Allow users with read access to view payments (so event/room views can fetch references)
  const auth = await safeRequireRole(request, 'reservations', 'read');
    if (!auth.allowed) return NextResponse.json({ error: auth.message || 'Forbidden' }, { status: 403 });

  const body = await request.json();
  console.log('POST /api/payments body:', body);
  const { reservationId, eventId, amount, method = 'cash', type = 'payment', note, reference, referenceNumber, reference_number } = body;
  const referenceValue = reference || referenceNumber || reference_number || null;

    if (!amount || Number(amount) <= 0) {
      return NextResponse.json({ error: 'Invalid payload: amount required' }, { status: 400 });
    }

    client = await pool.connect();
    await client.query('BEGIN');

    // If reservationId is provided, validate it. Otherwise allow NULL reservation payments.
    if (reservationId) {
      const r = await client.query('SELECT id FROM reservations WHERE id = $1 FOR UPDATE', [reservationId]);
      if (r.rowCount === 0) {
        await client.query('ROLLBACK');
        return NextResponse.json({ error: 'Reservation not found' }, { status: 404 });
      }
    }

    const insert = await client.query(
      `INSERT INTO payments (reservation_id, event_id, amount, method, type, note, reference_number, created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id, reservation_id, event_id, amount, method, type, note, reference_number, created_at`,
      [reservationId || null, eventId || null, amount, method, type, note, referenceValue, auth.userId || null]
    );

    await client.query('COMMIT');

    // Compute totals only if reservationId provided
    let totals = null;
    if (reservationId) {
      // Sum normal payments
      const paidRes = await pool.query("SELECT COALESCE(SUM(amount),0) AS paid FROM payments WHERE reservation_id=$1 AND type='payment'", [reservationId]);
      const refundRes = await pool.query("SELECT COALESCE(SUM(amount),0) AS refund FROM payments WHERE reservation_id=$1 AND type='refund'", [reservationId]);
      const downRes = await pool.query("SELECT COALESCE(SUM(amount),0) AS down FROM payments WHERE reservation_id=$1 AND type='downpayment'", [reservationId]);

      const totalPaid = Number(paidRes.rows[0].paid || 0) - Number(refundRes.rows[0].refund || 0) + Number(downRes.rows[0].down || 0);

  // Some schemas use `total_price` rather than `receipt_total`. Prefer total_price if available.
  const resRow = await pool.query('SELECT id, total_price FROM reservations WHERE id = $1', [reservationId]);
  const totalDue = resRow.rowCount ? (resRow.rows[0].total_price || 0) : 0;

      const downTotal = Number(downRes.rows[0].down || 0);

      totals = { totalPaid, totalDue, downTotal, remaining: Math.max(0, totalDue - totalPaid) };
    }

    // If reservation reached full payment, notify Housekeeping so they can act quickly.
    try {
      if (reservationId && totals && Number(totals.remaining) === 0) {
        // Get room number for nicer message
        const resInfo = await pool.query(
          `SELECT r.id AS reservation_id, r.room_id, rm.room_number FROM reservations r LEFT JOIN rooms rm ON r.room_id = rm.id WHERE r.id = $1`,
          [reservationId]
        );
        if (resInfo.rowCount > 0) {
          const roomId = resInfo.rows[0].room_id || null;
          const roomNumber = resInfo.rows[0].room_number || `Reservation ${reservationId}`;
          const message = `Payment completed for ${roomNumber} (Reservation ${reservationId}).`;
          await pool.query(
            `INSERT INTO notifications (room_id, reservation_id, message, target_role, scheduled_time, status, created_at) VALUES ($1,$2,$3,$4,CURRENT_TIMESTAMP,$5,CURRENT_TIMESTAMP)`,
            [roomId, reservationId, message, 'Housekeeping', 'scheduled']
          );
        }
      }
    } catch (e) {
      // Non-fatal: log and continue. Notifications are best-effort.
      console.error('Failed to insert housekeeping notification after payment:', e);
    }

    return NextResponse.json({ success: true, payment: insert.rows[0], totals }, { status: 201 });
  } catch (error) {
    if (client) await client.query('ROLLBACK');
    console.error('POST /api/payments error:', error && error.stack ? error.stack : error);
    // Include error message in response for easier dev debugging
    const msg = error && error.message ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: 'Internal Server Error', details: msg }, { status: 500 });
  } finally {
    if (client) client.release();
  }
}

export async function GET(request) {
  try {
    const auth = await safeRequireRole(request, 'reservations', 'manage');
    if (!auth.allowed) return NextResponse.json({ error: auth.message || 'Forbidden' }, { status: 403 });

    const { searchParams } = new URL(request.url);
  const reservationId = searchParams.get('reservationId') || searchParams.get('reservation_id') || null;
  const eventId = searchParams.get('eventId') || searchParams.get('event_id') || null;
  const type = searchParams.get('type') || null;
  const createdBy = searchParams.get('created_by') || searchParams.get('createdBy') || null;

    let where = [];
    let params = [];
    let idx = 1;

    if (reservationId) {
      where.push(`reservation_id = $${idx++}`);
      params.push(reservationId);
    }
    if (eventId) {
      // prefer explicit event_id column when passed
      where.push(`event_id = $${idx++}`);
      params.push(eventId);
    }
    // if eventId wasn't provided but a note-based search was requested, still allow searching by note
    const noteEventId = searchParams.get('noteEventId') || null;
    if (!eventId && noteEventId) {
      where.push(`note ILIKE $${idx++}`);
      params.push(`%event:${noteEventId}%`);
    }
    if (type) {
      where.push(`type = $${idx++}`);
      params.push(type);
    }
    if (createdBy) {
      where.push(`created_by = $${idx++}`);
      params.push(createdBy);
    }

    const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';

    // Pagination & date filters
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(200, parseInt(searchParams.get('limit') || '50', 10));
    const offset = (page - 1) * limit;
    const fromDate = searchParams.get('fromDate') || null;
    const toDate = searchParams.get('toDate') || null;
    if (fromDate) {
      where.push(`created_at >= $${idx++}`);
      params.push(fromDate);
    }
    if (toDate) {
      where.push(`created_at <= $${idx++}`);
      params.push(toDate);
    }

    const finalWhere = where.length ? `WHERE ${where.join(' AND ')}` : '';
    // Return list of payments matching filters with pagination
  const q = `SELECT id, reservation_id, event_id, amount, method, type, note, reference_number, created_by, created_at FROM payments ${finalWhere} ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`;
    const res = await pool.query(q, params);

    // Also compute sum for downpayments when requested per reservation or event
    let summary = null;
    if (reservationId && (!type || type === 'downpayment')) {
      const s = await pool.query("SELECT COALESCE(SUM(amount),0) AS downTotal FROM payments WHERE reservation_id=$1 AND type='downpayment'", [reservationId]);
      summary = { downTotal: Number(s.rows[0].downTotal || s.rows[0].downtotal || 0) };
    }
    if (eventId && (!type || type === 'downpayment')) {
      const s = await pool.query("SELECT COALESCE(SUM(amount),0) AS downTotal FROM payments WHERE event_id=$1 AND type='downpayment'", [eventId]);
      summary = { downTotal: Number(s.rows[0].downTotal || s.rows[0].downtotal || 0) };
    }

    return NextResponse.json({ payments: res.rows, summary }, { status: 200 });
  } catch (err) {
    console.error('GET /api/payments error:', err);
    return NextResponse.json({ error: 'Failed to fetch payments' }, { status: 500 });
  }
}
