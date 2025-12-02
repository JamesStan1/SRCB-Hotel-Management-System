import { NextResponse } from 'next/server';
import pool from '@/app/lib/db';
import fs from 'fs/promises';
import path from 'path';

// Helper function to safely parse JSON
function safeJsonParse(str, defaultValue = []) {
  try {
    if (typeof str === 'string') {
      return JSON.parse(str);
    }
    return str || defaultValue;
  } catch (error) {
    console.warn('JSON parse error:', error);
    return defaultValue;
  }
}

// GET: Fetch catering orders (simplified event data)
export async function GET() {
  try {
    const result = await pool.query(`
      SELECT id, name AS event, menu, date, guests, status
      FROM events
      ORDER BY date DESC;
    `);
    return NextResponse.json(result.rows);
  } catch (error) {
    console.error('Error fetching catering orders:', error);
    return NextResponse.json({ error: 'Failed to fetch catering orders' }, { status: 500 });
  }
}

// DELETE: Delete a catering order (event)
export async function DELETE(request) {
  let client;
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    
    if (!id) {
      return NextResponse.json({ error: 'Event ID is required' }, { status: 400 });
    }

    client = await pool.connect();
    await client.query('BEGIN');

    // Fetch the event to archive
    const eventResult = await client.query('SELECT * FROM events WHERE id = $1', [id]);
    if (eventResult.rowCount === 0) {
      await client.query('ROLLBACK');
      return NextResponse.json({ error: 'Catering order not found' }, { status: 404 });
    }

    const event = eventResult.rows[0];
    
    // Parse and re-stringify the dishes to ensure valid JSON
    const validDishes = JSON.stringify(safeJsonParse(event.dishes));

    // Insert into archive_events with validated dishes
    await client.query(`
      INSERT INTO archive_events (
        original_id, name, type, date, allotted_time, guests, booked_by, supervisor, status,
        additional_requests, additional_guests, remarks, total_cost, menu, dishes,
        customer_id_url, e_signature, "set", created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
    `, [
      event.id, event.name, event.type, event.date, event.allotted_time, event.guests, event.booked_by,
      event.supervisor, event.status, event.additional_requests, event.additional_guests, event.remarks,
      event.total_cost, event.menu, validDishes, event.customer_id_url, event.e_signature, event.set,
      event.created_at, event.updated_at
    ]);

    // Delete from events
    await client.query('DELETE FROM events WHERE id = $1', [id]);

    // Delete associated files
    if (event.customer_id_url) {
      await fs.unlink(path.join(process.cwd(), 'public', event.customer_id_url)).catch(() => {});
    }
    if (event.e_signature) {
      await fs.unlink(path.join(process.cwd(), 'public', event.e_signature)).catch(() => {});
    }

    await client.query('COMMIT');
    return NextResponse.json({ message: 'Catering order archived successfully' }, { status: 200 });
  } catch (error) {
    if (client) {
      await client.query('ROLLBACK');
    }
    console.error('Error deleting catering order:', error);
    return NextResponse.json({ error: 'Failed to delete catering order', details: error.message }, { status: 500 });
  } finally {
    if (client) {
      client.release();
    }
  }
}
