import pool from "../../../lib/db";
import jwt from "jsonwebtoken";
import { logAudit } from "../../../lib/auditLogger";

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

// GET: Fetch leaves for current user or all leaves (admin/manager)
export async function GET(req) {
  let client;
  try {
    client = await pool.connect();
    const userId = await getUserIdFromToken(req);
    
    if (!userId) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get current user's role
    const userRes = await client.query("SELECT role FROM users WHERE id = $1", [userId]);
    const userRole = userRes.rows[0]?.role?.toLowerCase();

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const leaveTypeId = searchParams.get('leave_type_id');
    const viewAllLeavesParam = searchParams.get('viewAll');

    let query = `
      SELECT 
        l.id, l.user_id, l.leave_type_id, l.start_date, l.end_date, 
        l.reason, l.status, l.approved_by, l.approved_at, l.rejection_reason,
        l.created_at, l.updated_at,
        u.name as user_name, u.email as user_email,
        lt.name as leave_type_name,
        approver.name as approved_by_name
      FROM leaves l
      JOIN users u ON l.user_id = u.id
      JOIN leave_types lt ON l.leave_type_id = lt.id
      LEFT JOIN users approver ON l.approved_by = approver.id
    `;

    let params = [];
    let conditions = [];

    // Regular staff can only view their own leaves
    // Managers/HR can view all leaves or specific user's leaves
    if (userRole !== 'manager' && userRole !== 'hr' && userRole !== 'admin') {
      conditions.push(`l.user_id = $${params.length + 1}`);
      params.push(userId);
    } else if (viewAllLeavesParam !== 'true') {
      // If manager/hr but not explicitly requesting all, show their own by default
      conditions.push(`l.user_id = $${params.length + 1}`);
      params.push(userId);
    }

    if (status) {
      conditions.push(`l.status = $${params.length + 1}`);
      params.push(status);
    }

    if (leaveTypeId) {
      conditions.push(`l.leave_type_id = $${params.length + 1}`);
      params.push(leaveTypeId);
    }

    if (conditions.length > 0) {
      query += " WHERE " + conditions.join(" AND ");
    }

    query += " ORDER BY l.start_date DESC";

    const result = await client.query(query, params);
    
    await logAudit(userId, 'leaves_fetch', 'leave', null, { count: result.rows.length }, req);
    
    return Response.json(result.rows, { status: 200 });
  } catch (error) {
    console.error("GET leaves error:", error);
    return Response.json({ error: "Failed to fetch leaves" }, { status: 500 });
  } finally {
    if (client) client.release();
  }
}

// POST: Create a new leave request
export async function POST(req) {
  let client;
  try {
    client = await pool.connect();
    const userId = await getUserIdFromToken(req);
    
    if (!userId) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { leave_type_id, start_date, end_date, reason } = await req.json();

    // Validation
    if (!leave_type_id || !start_date || !end_date) {
      return Response.json({ 
        error: "Missing required fields: leave_type_id, start_date, end_date" 
      }, { status: 400 });
    }

    if (new Date(end_date) < new Date(start_date)) {
      return Response.json({ error: "End date must be after start date" }, { status: 400 });
    }

    // Check if leave type exists
    const typeRes = await client.query("SELECT id FROM leave_types WHERE id = $1", [leave_type_id]);
    if (typeRes.rows.length === 0) {
      return Response.json({ error: "Leave type not found" }, { status: 404 });
    }

    // Calculate number of days (excluding weekends if needed - simplified version just counts days)
    const startDate = new Date(start_date);
    const endDate = new Date(end_date);
    const days = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;

    // Create the leave request
    const result = await client.query(
      `INSERT INTO leaves (user_id, leave_type_id, start_date, end_date, reason, status)
       VALUES ($1, $2, $3, $4, $5, 'pending')
       RETURNING id, user_id, leave_type_id, start_date, end_date, reason, status, created_at`,
      [userId, leave_type_id, start_date, end_date, reason || null]
    );

    const leave = result.rows[0];

    await logAudit(userId, 'leave_request_created', 'leave', leave.id, 
      { leave_type_id, days, start_date, end_date }, req);

    return Response.json({
      message: "Leave request created successfully",
      leave
    }, { status: 201 });
  } catch (error) {
    console.error("POST leaves error:", error);
    await logAudit(null, 'leave_request_failed', 'leave', null, { error: error.message }, req);
    return Response.json({ error: "Failed to create leave request" }, { status: 500 });
  } finally {
    if (client) client.release();
  }
}
