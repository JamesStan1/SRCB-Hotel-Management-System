import pool from '../../../lib/db';
import { withTrafficHandler } from '../../../lib/trafficHandler';
import { requireRole, Roles } from '../../../lib/rbac';

export async function GET(req) {
  try {
    // Check traffic for this request itself (rate limiting)
    const check = await withTrafficHandler(req);
    if (!check.allowed) return new Response(JSON.stringify({ error: check.reason || 'Too many requests' }), { status: check.status || 429 });

    // Ensure caller is admin
    const auth = requireRole(req, null, 'view');
    if (!auth.allowed || auth.role !== Roles.Admin) {
      return new Response(JSON.stringify({ error: auth.message || 'Forbidden' }), { status: 403 });
    }

  const recent = await pool.query(`SELECT * FROM traffic_logs ORDER BY created_at DESC LIMIT 200`);
  const blocked = await pool.query(`SELECT ip_address, COUNT(*) as attempts FROM traffic_logs WHERE status IN ('throttled','blocked') GROUP BY ip_address ORDER BY attempts DESC LIMIT 50`);

    return new Response(JSON.stringify({ recent: recent.rows, blocked: blocked.rows }), { status: 200 });
  } catch (err) {
    console.error('traffic-status error', err);
    return new Response(JSON.stringify({ error: 'Server error' }), { status: 500 });
  }
}
