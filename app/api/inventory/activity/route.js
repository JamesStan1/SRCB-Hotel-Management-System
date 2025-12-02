import pool from "../../../lib/db";
import { requireRole, Permissions } from "../../../lib/rbac";

// Return inventory_activity entries for the inventory page activity modal
export async function GET(req) {
  try {
    const auth = requireRole(req, Permissions.Inventory, 'view');
    if (!auth.allowed) {
      const statusCode = auth.message?.toLowerCase().includes('no token') || 
                        auth.message?.toLowerCase().includes('invalid') || 
                        auth.message?.toLowerCase().includes('expired') ? 401 : 403;
      return new Response(JSON.stringify({ error: auth.message || 'Access denied' }), { status: statusCode });
    }

    // inventory_activity table expected schema: id, item_id, change_amount, type, note, performed_by, occurred_at
    const q = `
      SELECT ia.id, ia.item_id, ia.change_amount, ia.type, ia.note, ia.performed_by,
             u.name as performed_by_name, u.role as performed_by_role, ia.occurred_at
      FROM inventory_activity ia
      LEFT JOIN users u ON u.id = ia.performed_by
      ORDER BY ia.occurred_at DESC
      LIMIT 200
    `;
    const result = await pool.query(q);
    return new Response(JSON.stringify(result.rows), { status: 200 });
  } catch (err) {
    console.error(err);
    return new Response("Error fetching inventory activity", { status: 500 });
  }
}

