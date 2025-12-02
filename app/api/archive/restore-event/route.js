// app/api/archive/restore-event/route.js
import { NextResponse } from 'next/server';
import pool from '../../../lib/db';
import { requireManagerApproval } from '../../../lib/adminApproval';

// Helper function to safely parse JSON
function safeJsonParse(str, defaultValue = []) {
  if (typeof str === 'object') return str; // Already parsed
  try {
    return str ? JSON.parse(str) : defaultValue;
  } catch (error) {
    console.warn('JSON parse error:', error);
    return Array.isArray(str) ? str : defaultValue;
  }
}

// Helper function to safely stringify JSON
function safeJsonStringify(data, defaultValue = '[]') {
  try {
    return JSON.stringify(data || []);
  } catch (error) {
    console.warn('JSON stringify error:', error);
    return defaultValue;
  }
}

export async function GET() {
  let client;
  try {
    client = await pool.connect();
    const result = await client.query('SELECT * FROM archive_events ORDER BY archived_at DESC');
    return NextResponse.json(result.rows, { status: 200 });
  } catch (error) {
    console.error('Error fetching archived events:', error);
    return NextResponse.json({ error: 'Failed to fetch archived events' }, { status: 500 });
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

    const archiveRes = await client.query('SELECT * FROM archive_events WHERE id = $1', [itemId]);
    if (archiveRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return NextResponse.json({ error: 'Archived event not found' }, { status: 404 });
    }

    const archived = archiveRes.rows[0];
    
    // Fix the dishes data to ensure it's valid JSON
    const validDishes = safeJsonParse(archived.dishes);
    const dishesJson = safeJsonStringify(validDishes);

    const insertResult = await client.query(`
      INSERT INTO events (
        name, type, date, allotted_time, guests, booked_by, supervisor, status,
        additional_requests, additional_guests, remarks, total_cost, menu, dishes,
        customer_id_url, e_signature, "set"
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
      RETURNING *
    `, [
      archived.name, 
      archived.type, 
      archived.date, 
      archived.allotted_time, 
      archived.guests, 
      archived.booked_by,
      archived.supervisor, 
      archived.status, 
      archived.additional_requests, 
      archived.additional_guests, 
      archived.remarks,
      archived.total_cost, 
      archived.menu, 
      dishesJson, // Use the validated JSON
      archived.customer_id_url, 
      archived.e_signature, 
      archived.set
    ]);

    await client.query('DELETE FROM archive_events WHERE id = $1', [itemId]);
    await client.query('COMMIT');
    
    return NextResponse.json({ 
      message: 'Event restored successfully', 
      newEvent: insertResult.rows[0] 
    }, { status: 200 });
    
  } catch (error) {
    if (client) await client.query('ROLLBACK');
    console.error('Error restoring event:', error);
    return NextResponse.json({ error: 'Failed to restore event' }, { status: 500 });
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
    const result = await client.query('DELETE FROM archive_events WHERE id = $1 RETURNING *', [itemId]);
    
    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Archived event not found' }, { status: 404 });
    }

    return NextResponse.json({ 
      message: 'Event permanently deleted successfully',
      deletedEvent: result.rows[0] 
    }, { status: 200 });
    
  } catch (error) {
    console.error('Error deleting archived event:', error);
    return NextResponse.json({ error: 'Failed to delete archived event' }, { status: 500 });
  } finally {
    if (client) client.release();
  }
}