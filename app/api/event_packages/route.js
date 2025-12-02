import { NextResponse } from 'next/server';
import pool from '../../lib/db';

// GET: Fetch all event packages
export async function GET() {
  try {
    const result = await pool.query(`
      SELECT id, name, price, guests, description, max_per_dish, image, created_at
      FROM event_packages
      ORDER BY created_at DESC;
    `);
    return NextResponse.json(result.rows);
  } catch (error) {
    console.error('Error fetching event packages:', error);
    return NextResponse.json({ error: 'Failed to fetch event packages' }, { status: 500 });
  }
}

// POST: Create a new event package
export async function POST(request) {
  try {
    const data = await request.json();
    const validation = validatePackageData(data);
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const query = `
      INSERT INTO event_packages (name, price, guests, description, max_per_dish, image)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *;
    `;
    const values = [
      data.name,
      data.price,
      data.guests,
      data.description,
      data.max_per_dish,
      data.image
    ];

    const result = await pool.query(query, values);
    return NextResponse.json(result.rows[0], { status: 201 });
  } catch (error) {
    console.error('Error creating event package:', error);
    return NextResponse.json({ error: 'Failed to create event package' }, { status: 500 });
  }
}

// PUT: Update an existing event package
export async function PUT(request) {
  try {
    const data = await request.json();
    const { id } = data;
    const validation = validatePackageData(data);
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const query = `
      UPDATE event_packages
      SET
        name = $1,
        price = $2,
        guests = $3,
        description = $4,
        max_per_dish = $5,
        image = $6,
        created_at = CURRENT_TIMESTAMP
      WHERE id = $7
      RETURNING *;
    `;
    const values = [
      data.name,
      data.price,
      data.guests,
      data.description,
      data.max_per_dish,
      data.image,
      id
    ];

    const result = await pool.query(query, values);
    if (result.rowCount === 0) {
      return NextResponse.json({ error: 'Event package not found' }, { status: 404 });
    }
    return NextResponse.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating event package:', error);
    return NextResponse.json({ error: 'Failed to update event package' }, { status: 500 });
  }
}

// DELETE: Delete an event package
export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    
    if (!id) {
      return NextResponse.json({ error: 'Package ID is required' }, { status: 400 });
    }

    const result = await pool.query('DELETE FROM event_packages WHERE id = $1 RETURNING *', [id]);
    if (result.rowCount === 0) {
      return NextResponse.json({ error: 'Event package not found' }, { status: 404 });
    }
    return NextResponse.json({ message: 'Event package deleted successfully' });
  } catch (error) {
    console.error('Error deleting event package:', error);
    return NextResponse.json({ error: 'Failed to delete event package' }, { status: 500 });
  }
}

// Helper function to validate package data
function validatePackageData(data) {
  const requiredFields = ['name', 'description', 'price', 'guests', 'max_per_dish', 'image'];
  for (const field of requiredFields) {
    if (!data[field]) {
      return { valid: false, error: `Missing required field: ${field}` };
    }
  }
  if (data.guests < 1) {
    return { valid: false, error: 'Guests must be at least 1' };
  }
  if (data.max_per_dish < 0) {
    return { valid: false, error: 'Max per dish must be non-negative' };
  }
  if (data.price < 0) {
    return { valid: false, error: 'Price must be non-negative' };
  }
  return { valid: true };
}
