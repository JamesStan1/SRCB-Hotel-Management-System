import { NextResponse } from 'next/server';
import pool from '../../../lib/db';
import { requireManagerApproval } from '../../../lib/adminApproval';

export async function GET() {
  let client;
  try {
    client = await pool.connect();
    const result = await client.query('SELECT * FROM archive_cafe_dishes ORDER BY archived_at DESC');
    return NextResponse.json(result.rows, { status: 200 });
  } catch (error) {
    console.error('Error fetching archived cafe dishes:', error);
    return NextResponse.json({ error: 'Failed to fetch archived cafe dishes' }, { status: 500 });
  } finally {
    if (client) client.release();
  }
}

export async function POST(request) {
  let client;
  try {
    const body = await request.json();
    const approval = await requireManagerApproval(request, body);
    if (!approval.allowed) return NextResponse.json({ error: approval.message || 'Unauthorized' }, { status: 401 });

    const { itemId } = body;
    if (!itemId) return NextResponse.json({ error: 'itemId required' }, { status: 400 });

    client = await pool.connect();
    await client.query('BEGIN');

    const archiveRes = await client.query('SELECT * FROM archive_cafe_dishes WHERE id = $1', [itemId]);
    if (archiveRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return NextResponse.json({ error: 'Archived dish not found' }, { status: 404 });
    }

    const archived = archiveRes.rows[0];

    await client.query(`
      INSERT INTO cafe_dishes (name, description, price, category, photo_url, is_available)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [archived.name, archived.description, archived.price, archived.category, archived.photo_url || null, archived.is_available]);

    await client.query('DELETE FROM archive_cafe_dishes WHERE id = $1', [itemId]);

    await client.query('COMMIT');
    return NextResponse.json({ message: 'Dish restored successfully' }, { status: 200 });
  } catch (error) {
    if (client) await client.query('ROLLBACK');
    console.error('Error restoring dish:', error);
    if (error.code === '22001') { // PostgreSQL string too long
      return NextResponse.json({ 
        error: 'Photo data too large. Please use a smaller image or run the migration to update the photo_url column to TEXT in cafe_dishes.' 
      }, { status: 400 });
    }
    if (error.code === '23505') { // PostgreSQL unique violation
      return NextResponse.json({ error: 'Dish name already exists in cafe_dishes' }, { status: 400 });
    }
    return NextResponse.json({ error: 'Failed to restore dish' }, { status: 500 });
  } finally {
    if (client) client.release();
  }
}