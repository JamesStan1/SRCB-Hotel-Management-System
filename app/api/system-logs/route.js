import pool from "../../lib/db";
import jwt from "jsonwebtoken";
import { NextResponse } from "next/server";
import { logAudit } from "../../lib/auditLogger";

export async function GET(req) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if ((decoded.role || '').toLowerCase() !== 'admin' && (decoded.role || '').toLowerCase() !== 'manager') {
      return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
    }

    const client = await pool.connect();
    try {
      // Recent activities from audit logs, mapped to higher-level labels
      const activitiesQuery = `
        SELECT al.id, al.timestamp, al.user_id, u.name AS user_name, al.action, al.entity,
               al.details,
               CASE
                 WHEN al.entity = 'page' OR al.action = 'page_view' THEN 'Page View'
                 WHEN al.action ILIKE '%room%' AND al.action ILIKE '%reservation%' THEN 'Room Reservation'
                 WHEN al.action ILIKE '%event%' AND (al.action ILIKE '%reservation%' OR al.action ILIKE '%checkout%' OR al.action ILIKE '%settle%') THEN 'Event Activity'
                 WHEN al.action ILIKE '%receipt%' OR al.entity = 'receipt' THEN 'POS Sale'
                 ELSE 'Activity'
               END AS category
        FROM audit_logs al
        LEFT JOIN users u ON u.id = al.user_id
        ORDER BY al.timestamp DESC
        LIMIT 100
      `;
      const activitiesRes = await client.query(activitiesQuery);

      // Active user count heuristic: users with audit activity in last 24h
      const activeUsersRes = await client.query(
        `SELECT COUNT(DISTINCT user_id) AS active_users
         FROM audit_logs
         WHERE timestamp >= NOW() - INTERVAL '24 hours'`
      );

      return NextResponse.json({
        activities: activitiesRes.rows,
        metrics: {
          active_users_24h: Number(activeUsersRes.rows[0]?.active_users || 0),
        }
      }, { status: 200 });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('System logs GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch system logs' }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    // Best-effort: system logs should not cause authentication failures for regular page views.
    // If an Authorization header exists, attempt to verify it and extract user id. If missing or
    // invalid, proceed as anonymous (userId = null) and still accept the log.
    const authHeader = req.headers.get('authorization');
    let userId = null;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        userId = decoded.sub || decoded.userId || decoded.id || null;
      } catch (err) {
        // Invalid/expired token: treat as anonymous and continue
        console.warn('system-logs: received invalid token for logging; recording anonymous log');
        userId = null;
      }
    }

    const body = await req.json();
    const action = body.action || 'page_view';
    const entity = body.entity || 'page';
    const entityId = body.entity_id || null;
    const details = body.details || {};


    // Best-effort logging; do not fail the API if logging fails. Use extracted userId (may be null).
    try {
      await logAudit(userId, action, entity, entityId, details, req);
    } catch (e) {
      console.warn('Failed to write audit log for system event', e?.message || e);
    }

    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    console.error('System logs POST error:', error);
    return NextResponse.json({ error: 'Failed to record system log' }, { status: 500 });
  }
}


