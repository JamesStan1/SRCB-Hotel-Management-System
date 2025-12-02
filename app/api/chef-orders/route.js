import { NextResponse } from 'next/server';
import pool from '../../lib/db';

// GET - Fetch all chef orders
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status'); // pending, preparing, ready, served
    
    let query = `
      SELECT 
        id,
        invoice_id,
        customer_name,
        items,
        order_time,
        status,
        completed_time,
        notes
      FROM chef_orders
    `;
    
    const conditions = [];
    const values = [];
    
    if (status) {
      conditions.push(`status = $${values.length + 1}`);
      values.push(status);
    }
    
    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }
    
    query += ` ORDER BY order_time DESC`;
    
    const result = await pool.query(query, values);
    
    return NextResponse.json(result.rows);
  } catch (error) {
    console.error('Error fetching chef orders:', error);
    return NextResponse.json(
      { error: 'Failed to fetch chef orders' },
      { status: 500 }
    );
  }
}

// POST - Create a new chef order
export async function POST(request) {
  try {
    const body = await request.json();
    const { invoice_id, customer_name, items, notes } = body;
    
    if (!invoice_id || !items || items.length === 0) {
      return NextResponse.json(
        { error: 'Invoice ID and items are required' },
        { status: 400 }
      );
    }
    
    // Filter only food/dish items (not rooms)
    const dishItems = items.filter(item => item.type !== 'room');
    
    if (dishItems.length === 0) {
      return NextResponse.json(
        { message: 'No food items to send to chef' },
        { status: 200 }
      );
    }
    
    const result = await pool.query(
      `INSERT INTO chef_orders 
        (invoice_id, customer_name, items, order_time, status, notes)
      VALUES ($1, $2, $3, NOW(), 'pending', $4)
      RETURNING *`,
      [invoice_id, customer_name || 'Guest', JSON.stringify(dishItems), notes || '']
    );
    
    return NextResponse.json(result.rows[0], { status: 201 });
  } catch (error) {
    console.error('Error creating chef order:', error);
    return NextResponse.json(
      { error: 'Failed to create chef order' },
      { status: 500 }
    );
  }
}

// PATCH - Update order status
export async function PATCH(request) {
  try {
    const body = await request.json();
    const { id, status } = body;
    
    if (!id || !status) {
      return NextResponse.json(
        { error: 'Order ID and status are required' },
        { status: 400 }
      );
    }
    
    const validStatuses = ['pending', 'preparing', 'ready', 'served'];
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        { error: 'Invalid status' },
        { status: 400 }
      );
    }
    
    let query = `UPDATE chef_orders SET status = $1`;
    const values = [status, id];
    
    // Set completed_time when status is 'ready'
    if (status === 'ready') {
      query += `, completed_time = NOW()`;
    }
    
    query += ` WHERE id = $2 RETURNING *`;
    
    const result = await pool.query(query, values);
    
    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating chef order:', error);
    return NextResponse.json(
      { error: 'Failed to update chef order' },
      { status: 500 }
    );
  }
}

// DELETE - Delete an order (for served orders cleanup)
export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const invoiceId = searchParams.get('invoice_id') || searchParams.get('invoiceId');

    if (!id && !invoiceId) {
      return NextResponse.json(
        { error: 'Order ID or invoice_id is required' },
        { status: 400 }
      );
    }

    let result;
    if (id) {
      result = await pool.query('DELETE FROM chef_orders WHERE id = $1 RETURNING *', [id]);
    } else {
      result = await pool.query('DELETE FROM chef_orders WHERE invoice_id = $1 RETURNING *', [invoiceId]);
    }

    if (!result || result.rowCount === 0) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Order deleted successfully', deleted: result.rows[0] });
  } catch (error) {
    console.error('Error deleting chef order:', error);
    return NextResponse.json(
      { error: 'Failed to delete chef order' },
      { status: 500 }
    );
  }
}
