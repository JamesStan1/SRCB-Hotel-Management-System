import pool from "../../../lib/db";
import jwt from "jsonwebtoken";
import { logAudit } from '../../../lib/auditLogger'; // Adjust path

export async function POST(req) {
  try {
    if (!process.env.JWT_SECRET) {
      console.error("JWT_SECRET is not set");
      await logAudit(null, 'token_verify_failed', 'auth', null, { error: "JWT_SECRET not set" }, req);
      return Response.json({ message: "Server configuration error" }, { status: 500 });
    }

    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      await logAudit(null, 'token_verify_failed', 'auth', null, { error: "No token provided" }, req);
      return Response.json({ message: "No token provided" }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      const result = await pool.query(
        "SELECT id, email, name, role FROM users WHERE id = $1",
        [decoded.id]
      );

      if (result.rows.length === 0) {
        await logAudit(null, 'token_verify_failed', 'auth', null, { error: "User not found" }, req);
        return Response.json({ message: "User not found" }, { status: 401 });
      }

      const user = result.rows[0];
      let userRole = user.role || user.position;
      if (!userRole) {
        console.error("No role found for user:", user.id);
        await logAudit(user.id, 'token_verify_failed', 'auth', user.id, { error: "User role not defined" }, req);
        return Response.json({ message: "User role not defined" }, { status: 401 });
      }
      
      userRole = userRole.toLowerCase();
      
      await logAudit(user.id, 'token_verify', 'auth', user.id, { role: userRole }, req);
      
      return Response.json({ 
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: userRole
        }
      }, { status: 200 });
      
    } catch (error) {
      console.error("Token verification error:", error.message);
      await logAudit(null, 'token_verify_failed', 'auth', null, { error: error.message }, req);
      return Response.json(
        { message: `Invalid or expired token: ${error.message}` },
        { status: 401 }
      );
    }
  } catch (error) {
    console.error("Verify API Error:", error.message);
    await logAudit(null, 'token_verify_failed', 'auth', null, { error: error.message }, req);
    return Response.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
