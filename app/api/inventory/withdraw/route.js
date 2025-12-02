import pool from "../../../lib/db";
import { requireRole, Permissions } from "../../../lib/rbac";
import { logAudit } from "../../../lib/auditLogger";

// POST /api/inventory/withdraw
export async function POST(req) {
  let client;
  try {
    const auth = requireRole(req, Permissions.Inventory, 'manage');
    if (!auth.allowed) return new Response(JSON.stringify({ error: auth.message || 'Forbidden' }), { status: 403 });

    const body = await req.json();
    const itemId = Number(body.item_id || body.id);
    const amount = Number(body.amount || 0);
    const note = body.note || null;

    if (!itemId || amount <= 0) {
      return new Response(JSON.stringify({ error: 'Invalid item_id or amount' }), { status: 400 });
    }

    client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Lock the row for update to avoid race conditions
      const cur = await client.query('SELECT * FROM inventory WHERE id = $1 FOR UPDATE', [itemId]);
      if (cur.rows.length === 0) {
        await client.query('ROLLBACK');
        return new Response(JSON.stringify({ error: 'Item not found' }), { status: 404 });
      }

      const current = cur.rows[0];
      const currentQty = Number(current.quantity || 0);
      if (amount > currentQty) {
        await client.query('ROLLBACK');
        return new Response(JSON.stringify({ error: 'Withdraw amount exceeds available quantity' }), { status: 400 });
      }

      const newQty = Math.max(0, currentQty - amount);
      const upd = await client.query(
        `UPDATE inventory SET quantity = $1, updated_at = now() WHERE id = $2 RETURNING *`,
        [newQty, itemId]
      );

      const activityInsert = await client.query(
        `INSERT INTO inventory_activity (item_id, change_amount, type, note, performed_by, occurred_at)
         VALUES ($1, $2, $3, $4, $5, now()) RETURNING id`,
        [itemId, -Math.abs(amount), 'withdraw', note, auth?.userId || null]
      );
      const activityId = activityInsert.rows[0]?.id;

      await client.query('COMMIT');

      // Fetch the inserted activity with performer name and role for frontend convenience
      let activityRow = null;
      try {
        const a = await pool.query(
          `SELECT ia.id, ia.item_id, ia.change_amount, ia.type, ia.note, ia.performed_by,
                  u.name as performed_by_name, u.role as performed_by_role, ia.occurred_at
           FROM inventory_activity ia
           LEFT JOIN users u ON u.id = ia.performed_by
           WHERE ia.id = $1`,
          [activityId]
        );
        activityRow = a.rows[0] || null;
      } catch (e) {
        console.warn('Failed to fetch activity row after insert', e);
      }

      try {
        await logAudit(auth?.userId || null, 'inventory_withdraw', 'inventory', itemId, { amount, note }, req);
      } catch (e) {
        console.warn('Audit logging failed', e);
      }

      return new Response(JSON.stringify({ message: 'Withdrawal recorded', item: upd.rows[0], activity: activityRow }), { status: 200 });
    } catch (err) {
      if (client) await client.query('ROLLBACK');
      console.error(err);
      return new Response(JSON.stringify({ error: 'Failed to process withdrawal' }), { status: 500 });
    } finally {
      if (client) client.release();
    }
  } catch (error) {
    console.error(error);
    return new Response(JSON.stringify({ error: 'Server error' }), { status: 500 });
  }
}
