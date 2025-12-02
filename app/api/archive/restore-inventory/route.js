import { NextResponse } from 'next/server';
import pool from '../../../lib/db';
import { requireManagerApproval } from '../../../lib/adminApproval';

export async function GET() {
  let client;
  try {
    client = await pool.connect();
    const result = await client.query('SELECT * FROM archive_inventory ORDER BY archived_at DESC');
    return NextResponse.json(result.rows, { status: 200 });
  } catch (error) {
    console.error('Error fetching archived inventory:', error);
    return NextResponse.json({ error: 'Failed to fetch archived inventory' }, { status: 500 });
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

    const archiveRes = await client.query('SELECT * FROM archive_inventory WHERE id = $1', [itemId]);
    if (archiveRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return NextResponse.json({ error: 'Archived inventory item not found' }, { status: 404 });
    }

    const archived = archiveRes.rows[0];

    // Insert back into inventory, excluding status (generated column)
    await client.query(`
      INSERT INTO inventory (id, name, category, quantity, threshold, section, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)
    `, [
      archived.original_id, // Restore using original_id
      archived.name,
      archived.category,
      archived.quantity,
      archived.threshold,
      archived.section,
      archived.created_at || new Date()
    ]);

    await client.query('DELETE FROM archive_inventory WHERE id = $1', [itemId]);

    await client.query('COMMIT');
    return NextResponse.json({ message: 'Inventory item restored successfully' }, { status: 200 });
  } catch (error) {
    if (client) await client.query('ROLLBACK');
    console.error('Error restoring inventory item:', error);
    return NextResponse.json({ error: 'Failed to restore inventory item' }, { status: 500 });
  } finally {
    if (client) client.release();
  }
}

export async function PUT(request) {
  let client;
  try {
    const { itemId, reasonForArchiving, archivedBy } = await request.json();
    if (!itemId) return NextResponse.json({ error: 'itemId required' }, { status: 400 });
    if (!reasonForArchiving) return NextResponse.json({ error: 'reasonForArchiving required' }, { status: 400 });

    client = await pool.connect();
    await client.query('BEGIN');

    // Fetch item from inventory
    const inventoryRes = await client.query('SELECT * FROM inventory WHERE id = $1', [itemId]);
    if (inventoryRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return NextResponse.json({ error: 'Inventory item not found' }, { status: 404 });
    }

    const item = inventoryRes.rows[0];

    // Insert into archive_inventory, including status
    await client.query(`
      INSERT INTO archive_inventory (name, category, quantity, threshold, status, section, created_at, archived_at, archived_by, original_id, reason_for_archiving)
      VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP, $8, $9, $10)
    `, [
      item.name,
      item.category,
      item.quantity,
      item.threshold,
      item.status, // Store the generated status
      item.section,
      item.created_at,
      archivedBy || 'system', // Default to 'system' if archivedBy is not provided
      item.id, // Store inventory id as original_id
      reasonForArchiving
    ]);

    // Delete from inventory
    await client.query('DELETE FROM inventory WHERE id = $1', [itemId]);

    await client.query('COMMIT');
    return NextResponse.json({ message: 'Item archived successfully' }, { status: 200 });
  } catch (error) {
    if (client) await client.query('ROLLBACK');
    console.error('Error archiving inventory item:', error);
    return NextResponse.json({ error: 'Failed to archive inventory item' }, { status: 500 });
  } finally {
    if (client) client.release();
  }
}
