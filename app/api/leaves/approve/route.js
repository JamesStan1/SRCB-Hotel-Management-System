import pool from "../../../../lib/db";
import jwt from "jsonwebtoken";
import { logAudit } from "../../../../lib/auditLogger";

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

// POST: Approve or reject a leave request
export async function POST(req) {
  let client;
  try {
    client = await pool.connect();
    const approverId = await getUserIdFromToken(req);
    
    if (!approverId) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user has approval rights (manager/hr/admin)
    const approverRes = await client.query("SELECT role FROM users WHERE id = $1", [approverId]);
    const approverRole = approverRes.rows[0]?.role?.toLowerCase();
    
    if (!['manager', 'hr', 'admin'].includes(approverRole)) {
      return Response.json({ error: "Insufficient permissions to approve leaves" }, { status: 403 });
    }

    const { leave_id, action, rejection_reason } = await req.json();

    // Validation
    if (!leave_id || !action) {
      return Response.json({ error: "Missing required fields: leave_id, action" }, { status: 400 });
    }

    if (!['approve', 'reject'].includes(action)) {
      return Response.json({ error: "Invalid action. Must be 'approve' or 'reject'" }, { status: 400 });
    }

    if (action === 'reject' && !rejection_reason) {
      return Response.json({ error: "rejection_reason is required when rejecting" }, { status: 400 });
    }

    // Get the leave request
    const leaveRes = await client.query(
      "SELECT id, user_id, status FROM leaves WHERE id = $1",
      [leave_id]
    );

    if (leaveRes.rows.length === 0) {
      return Response.json({ error: "Leave request not found" }, { status: 404 });
    }

    const leave = leaveRes.rows[0];

    if (leave.status !== 'pending') {
      return Response.json({ error: "Only pending leave requests can be approved/rejected" }, { status: 400 });
    }

    // Update leave status
    const newStatus = action === 'approve' ? 'approved' : 'rejected';
    const updateQuery = action === 'approve'
      ? `UPDATE leaves 
         SET status = $1, approved_by = $2, approved_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
         WHERE id = $3
         RETURNING *`
      : `UPDATE leaves 
         SET status = $1, rejection_reason = $2, approved_by = $3, approved_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
         WHERE id = $4
         RETURNING *`;

    const updateParams = action === 'approve'
      ? [newStatus, approverId, leave_id]
      : [newStatus, rejection_reason, approverId, leave_id];

    const result = await client.query(updateQuery, updateParams);
    const updatedLeave = result.rows[0];

    // Log the action
    await logAudit(approverId, `leave_${action}ed`, 'leave', leave_id, 
      { user_id: leave.user_id, action }, req);

    return Response.json({
      message: `Leave request ${newStatus} successfully`,
      leave: updatedLeave
    }, { status: 200 });
  } catch (error) {
    console.error("POST approve/reject error:", error);
    return Response.json({ error: "Failed to process leave request" }, { status: 500 });
  } finally {
    if (client) client.release();
  }
}
