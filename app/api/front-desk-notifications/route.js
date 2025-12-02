import { NextResponse } from 'next/server';
import pool from '../../lib/db';

// GET - Fetch front desk notifications (ready chef orders)
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'ready';
    
    // Fetch chef orders that are ready for serving
    const query = `
      SELECT 
        id,
        invoice_id,
        customer_name,
        items,
        order_time,
        status,
        completed_time,
        created_at
      FROM chef_orders
      WHERE status = $1
      ORDER BY completed_time DESC
    `;
    
    const result = await pool.query(query, [status]);
    
    return NextResponse.json({ 
      success: true,
      notifications: result.rows 
    }, { status: 200 });
    
  } catch (error) {
    console.error('Error fetching front desk notifications:', error);
    return NextResponse.json({ 
      error: 'Failed to fetch notifications',
      details: error.message 
    }, { status: 500 });
  }
}

// PATCH - Mark notification as acknowledged (update order to 'served')
export async function PATCH(request) {
  try {
    const body = await request.json();
    const { id, markAll } = body;

    // Mark all ready orders as served
    if (markAll) {
      const updateAllQuery = `
        UPDATE chef_orders
        SET status = 'served', updated_at = CURRENT_TIMESTAMP
        WHERE status = 'ready'
        RETURNING *
      `;

      const result = await pool.query(updateAllQuery);

      return NextResponse.json({
        success: true,
        message: `Marked ${result.rowCount} orders as served`,
        count: result.rowCount
      }, { status: 200 });
    }

    // Mark single order as served
    if (!id) {
      return NextResponse.json({
        error: 'Order ID is required'
      }, { status: 400 });
    }

    // Update order status to 'served'
    const updateQuery = `
      UPDATE chef_orders
      SET status = 'served', updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `;

    const result = await pool.query(updateQuery, [id]);

    if (result.rows.length === 0) {
      return NextResponse.json({
        error: 'Order not found'
      }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: 'Order marked as served',
      order: result.rows[0]
    }, { status: 200 });

  } catch (error) {
    console.error('Error updating order status:', error);
    return NextResponse.json({
      error: 'Failed to update order status',
      details: error.message
    }, { status: 500 });
  }
}
