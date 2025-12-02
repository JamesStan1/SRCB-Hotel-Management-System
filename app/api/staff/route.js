import pool from "../../lib/db.js";

export async function GET() {
  try {
    const result = await pool.query("SELECT * FROM users ORDER BY created_at DESC");
    return Response.json(result.rows, { status: 200 });
  } catch (error) {
    console.error("GET staff error:", error);
    return Response.json({ error: "Failed to fetch staff" }, { status: 500 });
  }
}

// 📌 POST: Add a new staff member
export async function POST(req) {
  try {
    const { name, role, email, phone, status, password, hourly_rate } = await req.json();

    if (!name || !email || !password || !role) {
      return Response.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Insert into users table (phone, hourly_rate, and status included)
    const userResult = await pool.query(
      `INSERT INTO users (name, email, password, role, phone, hourly_rate, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id`,
      [name, email, password, role, phone || null, hourly_rate || 0, status || "Active"]
    );

    const userId = userResult.rows[0].id;

    // Insert into staff table
    await pool.query(
      `INSERT INTO staff (user_id, name, role, email, phone, status)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [userId, name, role, email, phone || null, status || "Active"]
    );

    return Response.json({ message: "Staff created successfully" }, { status: 201 });
  } catch (error) {
    console.error("POST staff error:", error);
    return Response.json({ error: "Failed to create staff" }, { status: 500 });
  }
}

export async function DELETE(req) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return Response.json({ error: "Missing staff ID" }, { status: 400 });
    }

    // Get user_id before deleting staff
    const staffRes = await pool.query("SELECT user_id FROM staff WHERE id = $1", [id]);
    if (staffRes.rows.length === 0) {
      return Response.json({ error: "Staff not found" }, { status: 404 });
    }

    const userId = staffRes.rows[0].user_id;

    // Delete staff and user
    await pool.query("DELETE FROM staff WHERE id = $1", [id]);
    await pool.query("DELETE FROM users WHERE id = $1", [userId]);

    return Response.json({ message: "Staff deleted successfully" }, { status: 200 });
  } catch (error) {
    console.error("DELETE staff error:", error);
    return Response.json({ error: "Failed to delete staff" }, { status: 500 });
  }
}
