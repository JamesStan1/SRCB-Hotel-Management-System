// File: app/api/archive/restore-staff/route.js
// Handles GET for fetching archived users, POST for archiving/restoring users, DELETE for permanent deletion, and other user operations

import { NextResponse } from 'next/server';
import pool from '../../../lib/db'; // adjust path if needed
import { requireManagerApproval } from '../../../lib/adminApproval';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');

  let client;
  try {
    client = await pool.connect();

    if (action === 'archived') {
      // Fetch archived users
      const result = await client.query('SELECT * FROM archive_users ORDER BY archived_at DESC');
      return NextResponse.json(result.rows, { status: 200 });
    } else {
      // Fetch active users (existing logic from /api/users)
      const result = await client.query('SELECT * FROM users ORDER BY id');
      return NextResponse.json(result.rows, { status: 200 });
    }
  } catch (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
  } finally {
    if (client) client.release();
  }
}

export async function POST(request) {
  let client;
  try {
  const body = await request.json();
  const { id, itemId, action } = body;

    client = await pool.connect();
    await client.query('BEGIN');

    if (action === 'archive') {
      // Archive a user
      // require manager approval for archiving
  const approval = await requireManagerApproval(request, body);
      if (!approval.allowed) return NextResponse.json({ error: approval.message || 'Unauthorized' }, { status: 401 });

      if (!id) return NextResponse.json({ error: 'User ID required' }, { status: 400 });

      const userRes = await client.query('SELECT * FROM users WHERE id = $1', [id]);
      if (userRes.rows.length === 0) {
        await client.query('ROLLBACK');
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }

      const user = userRes.rows[0];

      await client.query(`
        INSERT INTO archive_users (original_id, name, email, role, phone, status, hourly_rate, password, archived_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP)
      `, [user.id, user.name, user.email, user.role, user.phone, user.status, user.hourly_rate, user.password]);

      await client.query('DELETE FROM users WHERE id = $1', [id]);

      await client.query('COMMIT');
      return NextResponse.json({ message: 'User archived successfully' }, { status: 200 });
    } else if (action === 'restore') {
      // Restore an archived user
      // require manager approval for restore
  const approval = await requireManagerApproval(request, body);
      if (!approval.allowed) return NextResponse.json({ error: approval.message || 'Unauthorized' }, { status: 401 });

      if (!itemId) return NextResponse.json({ error: 'itemId required' }, { status: 400 });

      const archiveRes = await client.query('SELECT * FROM archive_users WHERE id = $1', [itemId]);
      if (archiveRes.rows.length === 0) {
        await client.query('ROLLBACK');
        return NextResponse.json({ error: 'Archived user not found' }, { status: 404 });
      }

      const archived = archiveRes.rows[0];

      await client.query(`
        INSERT INTO users (id, name, email, role, phone, status, hourly_rate, password)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [archived.original_id, archived.name, archived.email, archived.role, archived.phone, archived.status, archived.hourly_rate, archived.password]);

      await client.query('DELETE FROM archive_users WHERE id = $1', [itemId]);

      await client.query('COMMIT');
      return NextResponse.json({ message: 'Staff restored successfully' }, { status: 200 });
    } else {
      // Existing POST logic for creating a new user
  const { name, email, role, phone, status, hourly_rate, password } = body;
      if (!email || !password) {
        return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
      }

      const allowedRoles = ['Admin', 'Manager', 'Chef', 'Frontdesk', 'Security', 'Maintenance', 'Housekeeping'];
      if (!allowedRoles.includes(role)) {
        return NextResponse.json({ error: `Invalid role. Must be one of: ${allowedRoles.join(', ')}` }, { status: 400 });
      }

      await client.query(`
        INSERT INTO users (name, email, role, phone, status, hourly_rate, password)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [name, email, role, phone, status || 'Active', hourly_rate || 0, password]);

      await client.query('COMMIT');
      return NextResponse.json({ message: 'User created successfully' }, { status: 201 });
    }
  } catch (error) {
    if (client) await client.query('ROLLBACK');
    console.error('Error processing request:', error);
    return NextResponse.json({ error: 'Failed to process request' }, { status: 500 });
  } finally {
    if (client) client.release();
  }
}

export async function PUT(request) {
  let client;
  try {
    const { id, name, email, role, phone, status, hourly_rate } = await request.json();
    if (!id) return NextResponse.json({ error: 'User ID required' }, { status: 400 });

    client = await pool.connect();
    await client.query('BEGIN');

    const userRes = await client.query('SELECT * FROM users WHERE id = $1', [id]);
    if (userRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    await client.query(`
      UPDATE users
      SET name = $1, email = $2, role = $3, phone = $4, status = $5, hourly_rate = $6
      WHERE id = $7
    `, [name, email, role, phone, status, hourly_rate, id]);

    await client.query('COMMIT');
    return NextResponse.json({ message: 'User updated successfully' }, { status: 200 });
  } catch (error) {
    if (client) await client.query('ROLLBACK');
    console.error('Error updating user:', error);
    return NextResponse.json({ error: 'Failed to update user' }, { status: 500 });
  } finally {
    if (client) client.release();
  }
}

export async function DELETE(request) {
  let client;
  try {
    const { itemId } = await request.json();
    if (!itemId) return NextResponse.json({ error: 'itemId required' }, { status: 400 });

    client = await pool.connect();
    await client.query('BEGIN');

    const archiveRes = await client.query('SELECT * FROM archive_users WHERE id = $1', [itemId]);
    if (archiveRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return NextResponse.json({ error: 'Archived user not found' }, { status: 404 });
    }

    await client.query('DELETE FROM archive_users WHERE id = $1', [itemId]);

    await client.query('COMMIT');
    return NextResponse.json({ message: 'Staff permanently deleted' }, { status: 200 });
  } catch (error) {
    if (client) await client.query('ROLLBACK');
    console.error('Error deleting staff:', error);
    return NextResponse.json({ error: 'Failed to delete staff' }, { status: 500 });
  } finally {
    if (client) client.release();
  }
}
