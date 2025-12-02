const pool = require('../app/lib/db').default;

async function addColumns() {
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
    await client.query(`
      UPDATE reservations SET status = 'confirmed' WHERE status IS NULL
    `);
    
    console.log('✅ Migration completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

addColumns();
