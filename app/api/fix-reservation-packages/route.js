import { NextResponse } from 'next/server';
import pool from '../../lib/db';

export async function POST(request) {
  const client = await pool.connect();
  try {
    console.log('Fixing package names for existing reservations...');
    
    // Get all reservations with NULL package_name that have corresponding pending_reservations
    const result = await client.query(`
      UPDATE reservations r
      SET package_name = pr.package_name
      FROM pending_reservations pr
      WHERE r.customer_name = pr.customer_name
        AND r.customer_email = pr.customer_email
        AND r.check_in_date = pr.check_in_date
        AND r.package_name IS NULL
        AND pr.package_name IS NOT NULL
        AND pr.status = 'approved'
      RETURNING r.id, r.customer_name, r.package_name
    `);
    
    console.log('✅ Package names updated successfully!');
    console.log('Updated reservations:', result.rows);
    
    return NextResponse.json({
      success: true,
      message: 'Package names updated successfully',
      updatedCount: result.rowCount,
      updatedReservations: result.rows
    }, { status: 200 });
  } catch (error) {
    console.error('❌ Failed to update package names:', error);
    return NextResponse.json({
      error: 'Failed to update package names',
      details: error.message
    }, { status: 500 });
  } finally {
    client.release();
  }
}
