import pool from "../../../lib/db";
import { requireRole, Permissions } from "../../../lib/rbac";
import { logAudit } from "../../../lib/auditLogger";

// =================== GET ===================
export async function GET(request, { params }) {
  try {
    const authCheck = requireRole(request, Permissions.Inventory, 'view');
    if (!authCheck.allowed) {
      const statusCode = authCheck.message?.toLowerCase().includes('no token') || 
                        authCheck.message?.toLowerCase().includes('invalid') || 
                        authCheck.message?.toLowerCase().includes('expired') ? 401 : 403;
      return new Response(JSON.stringify({ error: authCheck.message || 'Access denied' }), { status: statusCode });
    }

  const { id } = await params;
    const result = await pool.query("SELECT * FROM inventory WHERE id = $1", [id]);
    if (result.rows.length === 0) {
      return new Response("Not found", { status: 404 });
    }

    return new Response(JSON.stringify(result.rows[0]), { status: 200 });
  } catch (error) {
    console.error(error);
    return new Response("Error fetching item", { status: 500 });
  }
}

// =================== PUT ===================
export async function PUT(request, { params }) {
  try {
    const authCheck = requireRole(request, Permissions.Inventory, 'manage');
    if (!authCheck.allowed) {
      return new Response(JSON.stringify({ error: authCheck.message || 'Forbidden' }), { status: 403 });
    }
  const { id } = await params;

    const body = await request.json();
    const { name, category, quantity, unit, threshold, on_delivery, logActivity } = body;

    if (logActivity && typeof logActivity.change === 'number' && ['add', 'withdraw'].includes(logActivity.type)) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        const updateRes = await client.query(
          `UPDATE inventory SET name = $1, category = $2, quantity = $3, unit = $4, threshold = $5, on_delivery = $6, updated_at = now()
           WHERE id = $7 RETURNING *`,
          [name, category, quantity, unit || 'piece', threshold, on_delivery || false, id]
        );

        if (updateRes.rows.length === 0) {
          await client.query('ROLLBACK');
          return new Response('Item not found', { status: 404 });
        }

        const insertRes = await client.query(
          `INSERT INTO inventory_activity (item_id, change_amount, type, note, performed_by, occurred_at)
           VALUES ($1, $2, $3, $4, $5, now()) RETURNING *`,
          [id, logActivity.change, logActivity.type, logActivity.note || null, authCheck?.userId || null]
        );

        await client.query('COMMIT');
        try {
          await logAudit(authCheck?.userId || null, 'inventory_update', 'inventory', id, { change: logActivity.change, type: logActivity.type }, request);
        } catch (e) {
          console.warn('Audit logging failed', e);
        }

        return new Response(JSON.stringify({ item: updateRes.rows[0], activity: insertRes.rows[0] }), { status: 200 });
      } catch (err) {
        await client.query('ROLLBACK');
        console.error(err);
        return new Response('Error updating item with activity', { status: 500 });
      } finally {
        client.release();
      }
    }

    const result = await pool.query(
      `UPDATE inventory
       SET name = $1, category = $2, quantity = $3, unit = $4, threshold = $5, on_delivery = $6, updated_at = now()
       WHERE id = $7 RETURNING *`,
      [name, category, quantity, unit || 'piece', threshold, on_delivery || false, id]
    );

    if (result.rows.length === 0)
      return new Response("Item not found", { status: 404 });

    try {
      await logAudit(authCheck?.userId || null, 'inventory_update', 'inventory', id, { name, category, quantity }, request);
    } catch (e) {
      console.warn('Audit log failed', e);
    }

    return new Response(JSON.stringify(result.rows[0]), { status: 200 });
  } catch (error) {
    console.error(error);
    return new Response("Error updating item", { status: 500 });
  }
}
