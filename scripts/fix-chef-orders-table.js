// Quick fix script to add updated_at column to chef_orders table
// Run this with: node scripts/fix-chef-orders-table.js

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Database configuration - update these with your actual credentials
const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'hotel_management',
  password: process.env.DB_PASSWORD || 'your_password',
  port: process.env.DB_PORT || 5432,
});

async function fixChefOrdersTable() {
  const client = await pool.connect();
  
  try {
    console.log('🔧 Fixing chef_orders table...\n');
    
    // Read the SQL file
    const sqlPath = path.join(__dirname, '..', 'migrations', 'FIX_add_updated_at_to_chef_orders.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    // Execute the migration
    await client.query(sql);
    
    console.log('✅ Successfully added updated_at column to chef_orders table!');
    console.log('✅ Trigger created for automatic timestamp updates!');
    console.log('✅ Existing rows updated with timestamps!\n');
    
    // Verify the fix
    const result = await client.query(`
      SELECT column_name, data_type, column_default
      FROM information_schema.columns 
      WHERE table_name = 'chef_orders' 
      AND column_name = 'updated_at'
    `);
    
    if (result.rows.length > 0) {
      console.log('✅ Verification successful:');
      console.log(result.rows[0]);
    }
    
  } catch (error) {
    console.error('❌ Error fixing chef_orders table:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the fix
fixChefOrdersTable()
  .then(() => {
    console.log('\n🎉 Fix completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Fix failed:', error.message);
    process.exit(1);
  });
