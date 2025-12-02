import pool from "../../../lib/db";

// GET all users and POST new user
export async function GET() {
  try {
    const result = await pool.query("SELECT * FROM users ORDER BY created_at DESC");
    return Response.json(result.rows, { status: 200 });
  } catch (error) {
    console.error("GET users error:", error);
    return Response.json({ error: "Failed to fetch users" }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const { name, role, email, phone, status, password, confirmPassword, hourly_rate } = await req.json();

    if (!name || !email || !password || !role) {
      return Response.json({ error: "Missing required fields" }, { status: 400 });
    }

    if (password !== confirmPassword) {
      return Response.json({ error: "Passwords don't match" }, { status: 400 });
    }

    const result = await pool.query(
      `INSERT INTO users (name, email, password, role, phone, status, hourly_rate)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        name,
        email,
        password,
        role,
        phone || null,
        status || "Active",
        hourly_rate || 0,
      ]
    );

    return Response.json({ user: result.rows[0], message: "User created successfully" }, { status: 201 });
  } catch (error) {
    console.error("POST user error:", error);
    if (error.code === '23505') { // Unique violation
      return Response.json({ error: "Email already exists" }, { status: 400 });
    }
    return Response.json({ error: "Failed to create user" }, { status: 500 });
  }
}
