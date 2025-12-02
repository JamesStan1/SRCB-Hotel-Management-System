import { NextResponse } from "next/server";
import pool from "../../../lib/db";
import bcrypt from 'bcrypt';

export async function GET(req, { params }) {
  const { id } = await params;

  try {
    const result = await pool.query(
      "SELECT id, name, email, role, phone, status, hourly_rate FROM users WHERE id = $1", 
      [id]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json(result.rows[0], { status: 200 });
  } catch (err) {
    console.error("GET Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PUT(req, { params }) {
  const { id } = await params;

  try {
    const body = await req.json();
    const { name, email, role, phone, status, hourly_rate, password } = body;

    if (!id) {
      return NextResponse.json({ error: "Missing user ID" }, { status: 400 });
    }

    const fields = [];
    const values = [];
    let paramIndex = 1;

    if (name) {
      fields.push(`name = $${paramIndex++}`);
      values.push(name);
    }
    if (email) {
      fields.push(`email = $${paramIndex++}`);
      values.push(email);
    }
    if (role) {
      fields.push(`role = $${paramIndex++}`);
      values.push(role);
    }
    if (phone) {
      fields.push(`phone = $${paramIndex++}`);
      values.push(phone);
    }
    if (status) {
      fields.push(`status = $${paramIndex++}`);
      values.push(status);
    }
    if (hourly_rate) {
      fields.push(`hourly_rate = $${paramIndex++}`);
      values.push(hourly_rate);
    }
    if (password) {
      const saltRounds = 10;
      const hashedPassword = await bcrypt.hash(password, saltRounds);
      fields.push(`password = $${paramIndex++}`);
      values.push(hashedPassword);
    }

    if (fields.length === 0) {
      return NextResponse.json(
        { error: "No fields provided to update" }, 
        { status: 400 }
      );
    }

    fields.push(`updated_at = NOW()`);
    values.push(id);

    const query = `
      UPDATE users
      SET ${fields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING id, name, email, role, phone, status, hourly_rate
    `;

    const result = await pool.query(query, values);

    if (result.rowCount === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({
      message: "User updated successfully",
      user: result.rows[0]
    }, { status: 200 });
  } catch (err) {
    console.error("PUT Error:", err);
    if (err.code === '23505') {
      return NextResponse.json(
        { error: "Email already exists" }, 
        { status: 400 }
      );
    }
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// Modified DELETE in users route.js (app/api/users/route.js or similar)
// Replace the existing DELETE function with this

export async function DELETE(req, { params }) {
  const { id } = params;

  try {
    const client = await pool.connect();
    await client.query('BEGIN');

    // Fetch the user to archive
    const userResult = await client.query('SELECT * FROM users WHERE id = $1', [id]);
    if (userResult.rowCount === 0) {
      await client.query('ROLLBACK');
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const user = userResult.rows[0];

    // Insert into archive_users
    await client.query(`
      INSERT INTO archive_users (original_id, name, email, role, phone, status, hourly_rate, password)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `, [user.id, user.name, user.email, user.role, user.phone, user.status, user.hourly_rate, user.password]);

    // Delete attendance records (as before)
    await client.query("DELETE FROM attendance WHERE user_id = $1", [id]);
    
    // Delete the user
    await client.query("DELETE FROM users WHERE id = $1", [id]);

    await client.query('COMMIT');
    return NextResponse.json({
      message: "User archived successfully"
    }, { status: 200 });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error("DELETE Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  } finally {
    client.release();
  }
}
