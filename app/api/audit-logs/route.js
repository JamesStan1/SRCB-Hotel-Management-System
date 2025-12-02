import pool from '../../lib/db';
import jwt from 'jsonwebtoken';
import { NextResponse } from 'next/server';
import { logAudit } from '../../lib/auditLogger';
export async function GET(req) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      await logAudit(null, 'audit_log_fetch_failed', 'audit_log', null, { error: 'No token provided' }, req);
      return NextResponse.json({ error: 'No token provided' }, { status: 401 });
    }
    const token = authHeader.split(' ')[1];
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (e) {
      // log and return explicit message for easier debugging
      await logAudit(null, 'audit_log_fetch_failed', 'audit_log', null, { error: `Token verify failed: ${e.message}` }, req);
      return NextResponse.json({ error: `Token verify failed: ${e.message}` }, { status: 401 });
    }
    const isAdmin = decoded.role === 'admin';

    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('user_id');
    const action = searchParams.get('action');
    const fromDate = searchParams.get('from_date');
    const toDate = searchParams.get('to_date');
    const limitParam = parseInt(searchParams.get('limit') || '100', 10) || 100;

    // Select only the fields requested by the UI: timestamp, item_sold, and sales_amount
    // Prefer summary/primary keys inserted by POS handlers (items_summary, primary_item), then fall back to item, package_name, or entity
    let query = `
      SELECT
        al.timestamp,
        u.name AS user_name,
        COALESCE(
          NULLIF(al.details->>'items_summary',''),
          NULLIF(al.details->>'primary_item',''),
          NULLIF(al.details->>'item',''),
          NULLIF(al.details->>'package_name',''),
          al.entity
        ) AS item_sold,
        COALESCE(
          NULLIF(al.details->>'total', '')::numeric,
          NULLIF(al.details->>'package_price', '')::numeric,
          NULLIF(al.details->>'amount', '')::numeric,
          0
        ) AS sales_amount
      FROM audit_logs al
      LEFT JOIN users u ON u.id = al.user_id
    `;
    const params = [];
    const whereClauses = [];

    if (userId && isAdmin) {
      // admin can filter by arbitrary user_id
      whereClauses.push(`al.user_id = $${params.length + 1}`);
      params.push(userId);
    }
    if (action) {
      whereClauses.push(`al.action = $${params.length + 1}`);
      params.push(action);
    }
    if (fromDate) {
      whereClauses.push(`al.timestamp >= $${params.length + 1}`);
      params.push(fromDate);
    }
    if (toDate) {
      whereClauses.push(`al.timestamp <= $${params.length + 1}`);
      params.push(toDate);
    }

    // If caller is not admin, restrict to their own sales-related logs only
    if (!isAdmin) {
      whereClauses.push(`al.user_id = $${params.length + 1}`);
      params.push(decoded.id);

      // sales-related actions/entities: receipts, reservations (room/event), checkout/settle
      whereClauses.push(`(
        al.entity IN ('receipt','reservation','event','room')
        OR al.action ILIKE '%receipt%'
        OR al.action ILIKE '%sale%'
        OR al.action ILIKE '%reservation%'
        OR al.action ILIKE '%checkout%'
        OR al.action ILIKE '%settle%'
      )`);
    }

    if (whereClauses.length > 0) {
      query += ` WHERE ${whereClauses.join(' AND ')}`;
    }
  query += ` ORDER BY al.timestamp DESC LIMIT ${Math.min(limitParam, 1000)}`;

    const client = await pool.connect();
    const result = await client.query(query, params);
    client.release();

    // Log that the current user fetched audit logs (keeps count for monitoring)
    await logAudit(decoded.id, 'audit_log_fetch', 'audit_log', null, { count: result.rows.length }, req);

    // Return the trimmed rows only (timestamp, user_name, item_sold, sales_amount)
    return NextResponse.json(result.rows.map(r => ({
      timestamp: r.timestamp,
      user_name: r.user_name,
      item_sold: r.item_sold,
      sales_amount: r.sales_amount
    })), { status: 200 });
  } catch (error) {
    console.error('Audit logs GET error:', error);
    try { await logAudit(null, 'audit_log_fetch_failed', 'audit_log', null, { error: error?.message || String(error) }, req); } catch (e) { console.warn('Failed to log audit-fetch failure', e); }
    return NextResponse.json({ error: 'Failed to fetch audit logs', details: error?.message || String(error) }, { status: 500 });
  }
}