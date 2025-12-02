import pool from '../../lib/db';
import { requireRole } from '../../lib/rbac';

// Very small settings API: GET returns all settings, PUT upserts a key
export async function GET(req) {
  try {
    // allow any authenticated user to read settings
    const auth = requireRole(req, 'settings', 'view');
    if (!auth.allowed) {
      const statusCode = auth.message?.toLowerCase().includes('no token') || 
                        auth.message?.toLowerCase().includes('invalid') || 
                        auth.message?.toLowerCase().includes('expired') ? 401 : 403;
      return new Response(JSON.stringify({ error: auth.message || 'Access denied' }), { status: statusCode });
    }

    const res = await pool.query('SELECT key, value FROM settings');
    const obj = {};
    for (const row of res.rows) {
      try {
        obj[row.key] = JSON.parse(row.value);
      } catch (e) {
        obj[row.key] = row.value;
      }
    }
    return new Response(JSON.stringify(obj), { status: 200 });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message || 'Failed to read settings' }), { status: 500 });
  }
}

export async function PUT(req) {
  try {
    const auth = requireRole(req, 'settings', 'manage');
    if (!auth.allowed) {
      const statusCode = auth.message?.toLowerCase().includes('no token') || 
                        auth.message?.toLowerCase().includes('invalid') || 
                        auth.message?.toLowerCase().includes('expired') ? 401 : 403;
      return new Response(JSON.stringify({ error: auth.message || 'Access denied' }), { status: statusCode });
    }

    const body = await req.json();
    // expect { key: string, value: any }
    const { key, value } = body || {};
    if (!key) return new Response(JSON.stringify({ error: 'Missing key' }), { status: 400 });

    const valueStr = typeof value === 'string' ? value : JSON.stringify(value);
    await pool.query(`INSERT INTO settings(key, value) VALUES($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`, [key, valueStr]);
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message || 'Failed to save setting' }), { status: 500 });
  }
}
