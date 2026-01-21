import pool from "../../lib/db";
import jwt from "jsonwebtoken";
import { logAudit } from "../../lib/auditLogger";

// Helper: Get user ID from authorization header
async function getUserIdFromToken(req) {
  const authHeader = req.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  
  try {
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    return decoded.id;
  } catch (error) {
    return null;
  }
}

// GET: Fetch all leave types
export async function GET(req) {
  let client;
  try {
    client = await pool.connect();
    const userId = await getUserIdFromToken(req);

    const result = await client.query(
      "SELECT id, name, description, days_per_year, requires_approval, is_paid, created_at FROM leave_types ORDER BY name"
    );

    if (userId) {
      await logAudit(userId, 'leave_types_fetch', 'leave_type', null, { count: result.rows.length }, req);
    }

    return Response.json(result.rows, { status: 200 });
  } catch (error) {
    console.error("GET leave types error:", error);
    return Response.json({ error: "Failed to fetch leave types" }, { status: 500 });
  } finally {
    if (client) client.release();
  }
}
