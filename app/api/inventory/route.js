// app/api/inventory/route.js
import pool from "../../lib/db";
import { requireRole, Permissions, Roles } from "../../lib/rbac";
import { logAudit } from "../../lib/auditLogger";
import { withTrafficHandler } from "../../lib/trafficHandler";

export async function GET(req) {
  try {
    const t = await withTrafficHandler(req);
    if (!t.allowed) return new Response(JSON.stringify({ error: t.reason || 'Too many requests' }), { status: t.status || 429 });

    // Allow listed roles to view inventory
    const auth = requireRole(req, Permissions.Inventory, 'view');
    if (!auth.allowed) {
      // Use 403 for authorization failures (user is authenticated but lacks permission)
      // Use 401 only for authentication failures (invalid/missing token)
      const statusCode = auth.message?.toLowerCase().includes('no token') ? 401 : 403;
      return new Response(JSON.stringify({ error: auth.message || 'Access denied' }), { status: statusCode });
    }
    const result = await pool.query("SELECT * FROM inventory ORDER BY id DESC");
    return Response.json(result.rows);
  } catch (error) {
    console.error(error);
    return new Response("Error fetching inventory", { status: 500 });
  }
}

export async function POST(req) {
  try {
    const t = await withTrafficHandler(req);
    if (!t.allowed) return new Response(JSON.stringify({ error: t.reason || 'Too many requests' }), { status: t.status || 429 });

    const auth = requireRole(req, Permissions.Inventory, 'manage');
    if (!auth.allowed) {
      return new Response(JSON.stringify({ error: auth.message || 'Forbidden' }), { status: 403 });
    }
    const body = await req.json();
    // Accept either 'category' or legacy 'section' from the client. Ensure category is populated
    const categoryValue = body.category || body.section || null;
    const { name, quantity, unit, threshold, on_delivery } = body;
    const result = await pool.query(
      `INSERT INTO inventory (name, category, quantity, unit, threshold, section, on_delivery)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [name, categoryValue, quantity, unit || 'piece', threshold, categoryValue, on_delivery || false]
    );
  // Log audit (use resolved categoryValue and ensure correct user id)
  try { await logAudit(auth?.userId || null, 'inventory_create', 'inventory', result.rows[0].id, { name, category: categoryValue, quantity }, req); } catch (e) { console.warn('Audit log failed', e); }
    return Response.json(result.rows[0]);
  } catch (error) {
    console.error(error);
    return new Response("Error adding item", { status: 500 });
  }
}

export async function DELETE(req) {
  let client;
  try {
    const t = await withTrafficHandler(req);
    if (!t.allowed) return new Response(JSON.stringify({ error: t.reason || 'Too many requests' }), { status: t.status || 429 });

    const auth = requireRole(req, Permissions.Inventory, 'manage');
    if (!auth.allowed) {
      return new Response(JSON.stringify({ error: auth.message || 'Forbidden' }), { status: 403 });
    }
    const { id } = await req.json();
    
    client = await pool.connect();
    await client.query('BEGIN');
    
    // Archive the item with new fields
    await client.query(`
      INSERT INTO archive_inventory (
        name, category, quantity, unit, threshold, status, section, on_delivery, created_at, updated_at, original_id, reason_for_archiving
      )
      SELECT name, category, quantity, unit, threshold, status, section, on_delivery, created_at, updated_at, id, 'Archived by user'
      FROM inventory 
      WHERE id = $1
    `, [id]);
    
    // Delete from main table
    await client.query("DELETE FROM inventory WHERE id = $1", [id]);
    
    await client.query('COMMIT');
    try { await logAudit(auth.userId || null, 'inventory_delete', 'inventory', id, { reason: 'Archived by user' }, req); } catch (e) { console.warn('Audit log failed', e); }
    return new Response("Deleted and archived", { status: 200 });
  } catch (error) {
    if (client) await client.query('ROLLBACK');
    console.error(error);
    return new Response("Error deleting item", { status: 500 });
  } finally {
    if (client) client.release();
  }
}
