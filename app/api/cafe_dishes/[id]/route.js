import pool from '../../../lib/db';

// Utility function to validate dish data
const validateDish = (dish) => {
  if (!dish.name || typeof dish.name !== 'string' || dish.name.trim() === '') {
    return 'Name is required and must be a non-empty string';
  }
  if (!dish.description || typeof dish.description !== 'string' || dish.description.trim() === '') {
    return 'Description is required and must be a non-empty string';
  }
  if (!dish.price || typeof dish.price !== 'number' || dish.price <= 0) {
    return 'Price is required and must be a positive number';
  }
  if (!dish.category || typeof dish.category !== 'string' || dish.category.trim() === '') {
    return 'Category is required and must be a non-empty string';
  }
  if (dish.photo_url && typeof dish.photo_url !== 'string') {
    return 'Photo URL must be a string if provided';
  }
  if (dish.photo_url) {
    const isDataUrl = /^data:image\/(png|jpeg);base64,.+/i.test(dish.photo_url);
    const isHttpUrl = /^https?:\/\//i.test(dish.photo_url);
    if (!isDataUrl && !isHttpUrl) {
      return 'Photo must be a valid image URL (http/https) or base64-encoded PNG/JPEG';
    }
  }
  if (typeof dish.is_available !== 'boolean') {
    return 'Availability must be a boolean';
  }
  return null;
};

// Migration scripts to update photo_url columns (run these once in your database):
/*
-- For cafe_dishes table
ALTER TABLE cafe_dishes
ALTER COLUMN photo_url TYPE TEXT;

-- For archive_cafe_dishes table
ALTER TABLE archive_cafe_dishes
ALTER COLUMN photo_url TYPE TEXT;
*/

export async function GET(req) {
  try {
    const { rows } = await pool.query('SELECT * FROM cafe_dishes ORDER BY created_at DESC');
    return new Response(JSON.stringify(rows), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('API error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

export async function POST(req) {
  try {
    const newDish = await req.json();
    const validationError = validateDish(newDish);
    if (validationError) {
      return new Response(JSON.stringify({ error: validationError }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const insertQuery = `
      INSERT INTO cafe_dishes (name, description, price, category, photo_url, is_available)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *;
    `;
    const insertValues = [
      newDish.name.trim(),
      newDish.description.trim(),
      newDish.price,
      newDish.category.trim(),
      newDish.photo_url ? newDish.photo_url : null,
      newDish.is_available,
    ];

    const { rows: createdRows } = await pool.query(insertQuery, insertValues);
    return new Response(JSON.stringify(createdRows[0]), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('API error:', error);
    if (error.code === '23505') { // PostgreSQL unique violation
      return new Response(JSON.stringify({ error: 'Dish name already exists' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    if (error.code === '22001') { // PostgreSQL string too long
      return new Response(JSON.stringify({ error: 'Photo data too large. Please use a smaller image or run the migration to update the photo_url column to TEXT.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

export async function PUT(req) {
  try {
    const url = new URL(req.url);
    const id = url.pathname.split('/').pop();
    if (!id || isNaN(parseInt(id))) {
      return new Response(JSON.stringify({ error: 'Invalid dish ID' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const updatedDish = await req.json();
    const validationError = validateDish(updatedDish);
    if (validationError) {
      return new Response(JSON.stringify({ error: validationError }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const updateQuery = `
      UPDATE cafe_dishes
      SET name = $1, description = $2, price = $3, category = $4, photo_url = $5, is_available = $6
      WHERE id = $7
      RETURNING *;
    `;
    const updateValues = [
      updatedDish.name.trim(),
      updatedDish.description.trim(),
      updatedDish.price,
      updatedDish.category.trim(),
      updatedDish.photo_url ? updatedDish.photo_url : null,
      updatedDish.is_available,
      parseInt(id),
    ];

    const { rows: updatedRows } = await pool.query(updateQuery, updateValues);
    if (updatedRows.length === 0) {
      return new Response(JSON.stringify({ error: 'Dish not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify(updatedRows[0]), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('API error:', error);
    if (error.code === '23505') { // PostgreSQL unique violation
      return new Response(JSON.stringify({ error: 'Dish name already exists' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    if (error.code === '22001') { // PostgreSQL string too long
      return new Response(JSON.stringify({ error: 'Photo data too large. Please use a smaller image or run the migration to update the photo_url column to TEXT.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

export async function DELETE(req) {
  try {
    const url = new URL(req.url);
    const id = url.pathname.split('/').pop();
    if (!id || isNaN(parseInt(id))) {
      return new Response(JSON.stringify({ error: 'Invalid dish ID' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Fetch the dish to archive it
    const { rows: dishRows } = await pool.query('SELECT * FROM cafe_dishes WHERE id = $1', [parseInt(id)]);
    if (dishRows.length === 0) {
      return new Response(JSON.stringify({ error: 'Dish not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const dish = dishRows[0];

    // Start a transaction
    await pool.query('BEGIN');

    try {
      // Insert into archive_cafe_dishes
      await pool.query(`
        INSERT INTO archive_cafe_dishes (original_id, name, description, price, category, photo_url, is_available)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [dish.id, dish.name, dish.description, dish.price, dish.category, dish.photo_url || null, dish.is_available]);

      // Delete from cafe_dishes
      await pool.query('DELETE FROM cafe_dishes WHERE id = $1', [parseInt(id)]);

      // Commit the transaction
      await pool.query('COMMIT');

      return new Response(JSON.stringify({ message: 'Dish deleted and archived successfully' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error) {
      // Rollback on error
      await pool.query('ROLLBACK');
      throw error;
    }
  } catch (error) {
    console.error('API error:', error);
    if (error.code === '22001') { // PostgreSQL string too long
      return new Response(JSON.stringify({ error: 'Photo data too large. Please use a smaller image or run the migration to update the photo_url column to TEXT in archive_cafe_dishes.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
