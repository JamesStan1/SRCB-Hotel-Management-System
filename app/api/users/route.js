import bcrypt from 'bcrypt';
import { NextResponse } from 'next/server';
import pool from '../../lib/db';
import { logAudit } from '../../lib/auditLogger'; // Adjust path
import jwt from 'jsonwebtoken';
import { requireManagerApproval } from '../../lib/adminApproval';

export async function GET(req) {
  let client;
  try {
    client = await pool.connect();
    const result = await client.query(`
      SELECT id, name, email, role, hourly_rate, phone, status, created_at
      FROM users
      ORDER BY created_at DESC
    `);
    // Log fetch action (optional, depending on sensitivity)
    const authHeader = req.headers.get('authorization');
    let userId = null;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        userId = decoded.id;
      } catch (error) {
        console.error("Token verification error:", error.message);
      }
    }
    await logAudit(userId, 'user_fetch', 'user', null, { count: result.rows.length }, req);
    return NextResponse.json(result.rows, { status: 200 });
  } catch (error) {
    console.error('GET users error:', error.message, error.code, error.stack);
    await logAudit(null, 'user_fetch_failed', 'user', null, { error: error.message }, req);
    return NextResponse.json({ error: 'Failed to fetch users', details: error.message }, { status: 500 });
  } finally {
    if (client) client.release();
  }
}

export async function POST(req) {
  let client;
  try {
    const authHeader = req.headers.get('authorization');
    let userId = null;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        userId = decoded.id;
      } catch (error) {
        console.error("Token verification error:", error.message);
        return NextResponse.json({ error: "Invalid or expired token" }, { status: 401 });
      }
    }

    const { name, role, email, phone, status, password, hourly_rate, managerPassword, managerId, managerEmail, managerQr } = await req.json();

    // Require manager/admin approval for creating users
    try {
      const approval = await requireManagerApproval(req, { managerPassword, managerId, managerEmail, qrCode: managerQr });
      if (!approval.allowed) {
        await logAudit(userId, 'user_create_failed', 'user', null, { error: approval.message || 'Manager or admin approval required' }, req);
        return NextResponse.json({ error: approval.message || 'Manager or admin approval required' }, { status: 401 });
      }
    } catch (e) {
      console.error('Approval check error:', e?.message || e);
      await logAudit(userId, 'user_create_failed', 'user', null, { error: 'Approval check failed' }, req);
      return NextResponse.json({ error: 'Approval check failed' }, { status: 500 });
    }
    const allowedRoles = ['Admin', 'Manager', 'Chef', 'Frontdesk', 'Security', 'Maintenance', 'Housekeeping'];

    if (!name || !email || !password || !role) {
      await logAudit(userId, 'user_create_failed', 'user', null, { error: 'Missing required fields' }, req);
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      await logAudit(userId, 'user_create_failed', 'user', null, { error: 'Invalid email format' }, req);
      return NextResponse.json({ error: 'Invalid email format' }, { status: 400 });
    }

    if (hourly_rate && (isNaN(hourly_rate) || hourly_rate < 0)) {
      await logAudit(userId, 'user_create_failed', 'user', null, { error: 'Invalid hourly rate' }, req);
      return NextResponse.json({ error: 'Invalid hourly rate' }, { status: 400 });
    }

    if (!allowedRoles.includes(role)) {
      await logAudit(userId, 'user_create_failed', 'user', null, { error: `Invalid role. Must be one of: ${allowedRoles.join(', ')}` }, req);
      return NextResponse.json({ error: `Invalid role. Must be one of: ${allowedRoles.join(', ')}` }, { status: 400 });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    client = await pool.connect();
    const result = await client.query(
      `INSERT INTO users (name, email, password, role, phone, status, hourly_rate)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, name, email, role, phone, status, hourly_rate`,
      [name, email, hashedPassword, role, phone || null, status || 'Active', hourly_rate || 0]
    );

    const newUser = result.rows[0];
    await logAudit(userId, 'user_create', 'user', newUser.id, { name, email, role }, req);

    return NextResponse.json({ 
      message: 'User created successfully',
      user: newUser
    }, { status: 201 });
  } catch (error) {
    console.error('POST user error:', error.message, error.code, error.stack);
    await logAudit(null, 'user_create_failed', 'user', null, { error: error.message }, req);
    if (error.code === '23505') {
      return NextResponse.json({ error: 'Email already exists' }, { status: 400 });
    }
    if (error.code === '23514') {
      return NextResponse.json({ error: 'Invalid role value provided' }, { status: 400 });
    }
    return NextResponse.json({ error: 'Failed to create user', details: error.message }, { status: 500 });
  } finally {
    if (client) client.release();
  }
}

export async function PUT(req) {
  let client;
  try {
    const authHeader = req.headers.get('authorization');
    let userId = null;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        userId = decoded.id;
      } catch (error) {
        console.error("Token verification error:", error.message);
        return NextResponse.json({ error: "Invalid or expired token" }, { status: 401 });
      }
    }

    const { id, name, role, email, phone, status, hourly_rate, password, managerPassword, managerId, managerEmail, managerQr } = await req.json();

    // Require manager/admin approval for updating users
    try {
      const approval = await requireManagerApproval(req, { managerPassword, managerId, managerEmail, qrCode: managerQr });
      if (!approval.allowed) {
        await logAudit(userId, 'user_update_failed', 'user', id, { error: approval.message || 'Manager or admin approval required' }, req);
        return NextResponse.json({ error: approval.message || 'Manager or admin approval required' }, { status: 401 });
      }
    } catch (e) {
      console.error('Approval check error:', e?.message || e);
      await logAudit(userId, 'user_update_failed', 'user', id, { error: 'Approval check failed' }, req);
      return NextResponse.json({ error: 'Approval check failed' }, { status: 500 });
    }

    if (!id || !name || !email || !role) {
      await logAudit(userId, 'user_update_failed', 'user', id, { error: 'Missing required fields' }, req);
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      await logAudit(userId, 'user_update_failed', 'user', id, { error: 'Invalid email format' }, req);
      return NextResponse.json({ error: 'Invalid email format' }, { status: 400 });
    }

    if (hourly_rate && (isNaN(hourly_rate) || hourly_rate < 0)) {
      await logAudit(userId, 'user_update_failed', 'user', id, { error: 'Invalid hourly rate' }, req);
      return NextResponse.json({ error: 'Invalid hourly rate' }, { status: 400 });
    }

    client = await pool.connect();
    const userRes = await client.query('SELECT id, name, email, role FROM users WHERE id = $1', [id]);
    if (userRes.rows.length === 0) {
      await logAudit(userId, 'user_update_failed', 'user', id, { error: 'User not found' }, req);
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const oldData = userRes.rows[0];

    let query = `UPDATE users SET name = $1, role = $2, email = $3, phone = $4, status = $5, hourly_rate = $6`;
    const params = [name, role, email, phone || null, status || 'Active', hourly_rate || 0];
    if (password) {
      const hashedPassword = await bcrypt.hash(password, 10);
      query += `, password = $${params.length + 1}`;
      params.push(hashedPassword);
    }
    query += ` WHERE id = $${params.length + 1} RETURNING id, name, email, role, phone, status, hourly_rate`;
    params.push(id);

    const result = await client.query(query, params);
    const updatedUser = result.rows[0];
    await logAudit(userId, 'user_update', 'user', updatedUser.id, { old: oldData, new: { name, email, role } }, req);

    return NextResponse.json({ 
      message: 'User updated successfully',
      user: updatedUser
    }, { status: 200 });
  } catch (error) {
    console.error('PUT user error:', error.message, error.code, error.stack);
    await logAudit(null, 'user_update_failed', 'user', null, { error: error.message }, req);
    if (error.code === '23505') {
      return NextResponse.json({ error: 'Email already exists' }, { status: 400 });
    }
    return NextResponse.json({ error: 'Failed to update user', details: error.message }, { status: 500 });
  } finally {
    if (client) client.release();
  }
}

export async function DELETE(req) {
  let client;
  try {
    const authHeader = req.headers.get('authorization');
    let userId = null;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        userId = decoded.id;
      } catch (error) {
        console.error("Token verification error:", error.message);
        return NextResponse.json({ error: "Invalid or expired token" }, { status: 401 });
      }
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      await logAudit(userId, 'user_delete_failed', 'user', null, { error: 'Missing user ID' }, req);
      return NextResponse.json({ error: 'Missing user ID' }, { status: 400 });
    }

    client = await pool.connect();
    await client.query('BEGIN');

    const userRes = await client.query('SELECT id FROM users WHERE id = $1', [id]);
    if (userRes.rows.length === 0) {
      await client.query('ROLLBACK');
      await logAudit(userId, 'user_delete_failed', 'user', id, { error: 'User not found' }, req);
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    await client.query('DELETE FROM attendance WHERE user_id = $1', [id]);
    await client.query('DELETE FROM users WHERE id = $1', [id]);

    await client.query('COMMIT');
    await logAudit(userId, 'user_delete', 'user', id, {}, req);

    return NextResponse.json({ message: 'User and associated attendance records deleted successfully' }, { status: 200 });
  } catch (error) {
    console.error('DELETE user error:', error.message, error.code, error.stack);
    await client.query('ROLLBACK');
    await logAudit(null, 'user_delete_failed', 'user', null, { error: error.message }, req);
    return NextResponse.json({ error: 'Failed to delete user', details: error.message }, { status: 500 });
  } finally {
    if (client) client.release();
  }
}
