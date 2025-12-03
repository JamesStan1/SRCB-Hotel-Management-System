import { NextResponse } from 'next/server';
import pool from '../../lib/db';

// API route to fetch type, item_name, and total from payment_history
export async function GET() {
  try {
    // Use the pool to get a client
    const client = await pool.connect();

    // Query to fetch type, item_name, and total
    const query = 'SELECT type, item_name, total FROM payment_history';
    const { rows } = await client.query(query);

    // Release the client back to the pool
    client.release();

    // Return the results as JSON
    return NextResponse.json(rows, { status: 200 });
  } catch (error) {
    console.error('Error fetching payment history:', error.message, error.stack);
    return NextResponse.json(
      { error: 'Failed to fetch payment history', details: error.message },
      { status: 500 }
    );
  }
}

// API route to save payment history to payment_history table
export async function POST(request) {
  try {
    // Parse the request body
    const paymentData = await request.json();

    // Validate required fields
    const requiredFields = [
      'invoice_id',
      'type',
      'item_id',
      'item_name',
      'customer_name',
      'payment_method',
      'subtotal',
      'total',
      'cashier_name',
      'payment_date',
    ];
    for (const field of requiredFields) {
      if (!paymentData[field]) {
        return NextResponse.json(
          { error: `Missing required field: ${field}` },
          { status: 400 }
        );
      }
    }

    // Use the pool to get a client
    const client = await pool.connect();

    // Insert payment data into payment_history table
    const query = `
      INSERT INTO payment_history (
        invoice_id, type, item_id, item_name, customer_name, payment_method,
        discount_type, discount_amount, subtotal, total, cashier_name, payment_date
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING id, invoice_id, type, item_name, total
    `;
    const values = [
      paymentData.invoice_id,
      paymentData.type,
      paymentData.item_id,
      paymentData.item_name,
      paymentData.customer_name,
      paymentData.payment_method,
      paymentData.discount_type || null,
      paymentData.discount_amount || 0,
      paymentData.subtotal,
      paymentData.total,
      paymentData.cashier_name,
      paymentData.payment_date,
    ];

    const { rows } = await client.query(query, values);

    // Release the client back to the pool
    client.release();

    // Return the saved payment record
    return NextResponse.json(rows[0], { status: 201 });
  } catch (error) {
    console.error('Error saving payment history:', error.message, error.stack);
    return NextResponse.json(
      { error: 'Failed to save payment history', details: error.message },
      { status: 500 }
    );
  }
}
