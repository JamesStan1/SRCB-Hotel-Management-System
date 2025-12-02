import { NextResponse } from 'next/server';
import pool from '../../lib/db';

// GET: Fetch all dishes
export async function GET() {
  try {
    const result = await pool.query(`
      SELECT id, name, description, category, created_at
      FROM dishes
      ORDER BY created_at DESC;
    `);
    return NextResponse.json(result.rows);
  } catch (error) {
    console.error('Error fetching dishes:', error);
    return NextResponse.json({ error: 'Failed to fetch dishes' }, { status: 500 });
  }
}

// POST: Create a new dish
export async function POST(request) {
  try {
    const data = await request.json();
    const validation = validateDishData(data);
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const query = `
      INSERT INTO dishes (name, description, category)
      VALUES ($1, $2, $3)
      RETURNING *;
    `;
    const values = [data.name, data.description, data.category || 'A']; // Default to 'A' if category is not provided

    const result = await pool.query(query, values);
    return NextResponse.json(result.rows[0], { status: 201 });
  } catch (error) {
    console.error('Error creating dish:', error);
    return NextResponse.json({ error: 'Failed to create dish' }, { status: 500 });
  }
}

// PUT: Update an existing dish
export async function PUT(request) {
  try {
    const data = await request.json();
    const { id } = data;
    const validation = validateDishData(data);
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const query = `
      UPDATE dishes
      SET
        name = $1,
        description = $2,
        category = $3,
        created_at = CURRENT_TIMESTAMP
      WHERE id = $4
      RETURNING *;
    `;
    const values = [data.name, data.description, data.category || 'A', id]; // Default to 'A' if category is not provided

    const result = await pool.query(query, values);
    if (result.rowCount === 0) {
      return NextResponse.json({ error: 'Dish not found' }, { status: 404 });
    }
    return NextResponse.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating dish:', error);
    return NextResponse.json({ error: 'Failed to update dish' }, { status: 500 });
  }
}

// DELETE: Delete a dish
export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    
    if (!id) {
      return NextResponse.json({ error: 'Dish ID is required' }, { status: 400 });
    }

    const result = await pool.query('DELETE FROM dishes WHERE id = $1 RETURNING *', [id]);
    if (result.rowCount === 0) {
      return NextResponse.json({ error: 'Dish not found' }, { status: 404 });
    }
    return NextResponse.json({ message: 'Dish deleted successfully' });
  } catch (error) {
    console.error('Error deleting dish:', error);
    return NextResponse.json({ error: 'Failed to delete dish' }, { status: 500 });
  }
}

// Helper function to validate dish data
function validateDishData(data) {
  const requiredFields = ['name', 'description'];
  for (const field of requiredFields) {
    if (!data[field]) {
      return { valid: false, error: `Missing required field: ${field}` };
    }
  }
  if (data.category && !['A', 'B', 'C', 'D'].includes(data.category)) {
    return { valid: false, error: 'Invalid category: must be A, B, C, or D' };
  }
  return { valid: true };
}