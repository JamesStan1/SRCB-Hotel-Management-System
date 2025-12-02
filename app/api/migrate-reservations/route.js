import { NextResponse } from 'next/server';
import pool from '../../lib/db';

export async function POST(request) {
  const client = await pool.connect();
  try {
    console.log('Adding status and package_name columns to reservations table...');
    
    await client.query(`
      ALTER TABLE reservations
        ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'confirmed',
        ADD COLUMN IF NOT EXISTS package_name VARCHAR(255),
        ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    `);
    
    console.log('Creating index on status column...');
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_reservations_status ON reservations(status)
    `);
    
    console.log('Updating existing records...');
    const result = await client.query(`
      UPDATE reservations SET status = 'confirmed' WHERE status IS NULL
    `);
    
    console.log('✅ Migration completed successfully!');
    
    return NextResponse.json({
      success: true,
      message: 'Migration completed successfully',
      rowsUpdated: result.rowCount
    }, { status: 200 });
  } catch (error) {
    console.error('❌ Migration failed:', error);
    return NextResponse.json({
      error: 'Migration failed',
      details: error.message
    }, { status: 500 });
  } finally {
    client.release();
  }
}
