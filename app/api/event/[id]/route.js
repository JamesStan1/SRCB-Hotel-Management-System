import { NextResponse } from 'next/server';
import pool from '../../../lib/db';

// PUT: Update specific fields of an event by ID
export async function PUT(request, { params }) {
  let client;
  try {
    const { id } = params; // Extract ID from dynamic route
    const eventData = await request.json(); // Expect JSON payload with fields to update

    // Validate ID
    if (!id || isNaN(parseInt(id))) {
      return NextResponse.json({ error: 'Valid Event ID is required' }, { status: 400 });
    }

    // Validate status if provided
    if (eventData.status && !['Pending', 'Confirmed', 'Completed', 'Cancelled'].includes(eventData.status)) {
      return NextResponse.json({ error: 'Invalid status value' }, { status: 400 });
    }

    client = await pool.connect();
    await client.query('BEGIN');

    // Build dynamic update query to only update provided fields
    const fields = [];
    const values = [];
    let paramIndex = 1;

    if (eventData.status) {
      fields.push(`status = $${paramIndex++}`);
      values.push(eventData.status);
    }

    // Add updated_at timestamp
    fields.push(`updated_at = CURRENT_TIMESTAMP`);

    if (fields.length === 0) {
      await client.query('ROLLBACK');
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    const query = `
      UPDATE events
      SET ${fields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *;
    `;
    values.push(id);

    const result = await client.query(query, values);
    if (result.rowCount === 0) {
      await client.query('ROLLBACK');
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    await client.query('COMMIT');

    const updatedEvent = {
      ...result.rows[0],
      dishes: safeJsonParse(result.rows[0].dishes),
      total_cost: result.rows[0].total_cost ? Number(result.rows[0].total_cost) : null,
      set: result.rows[0].set || null,
      e_signature: result.rows[0].e_signature || null,
    };

    return NextResponse.json(updatedEvent, { status: 200 });
  } catch (error) {
    if (client) {
      await client.query('ROLLBACK');
    }
    console.error('Error updating event:', error);
    return NextResponse.json({ error: 'Failed to update event', details: error.message }, { status: 500 });
  } finally {
    if (client) {
      client.release();
    }
  }
}

// Helper function to safely parse JSON (reused from your existing code)
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