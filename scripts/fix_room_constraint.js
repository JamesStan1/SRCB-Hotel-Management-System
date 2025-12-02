// Quick script to drop the room_id foreign key constraint
// Run this with: node scripts/fix_room_constraint.js

const pool = require('../app/lib/db').default;

async function fixConstraint() {
  try {
    console.log('Dropping foreign key constraint on room_id...');
    
    await pool.query(`
      ALTER TABLE pending_reservations 
      DROP CONSTRAINT IF EXISTS pending_reservations_room_id_fkey;
    `);
    
    console.log('✓ Foreign key constraint dropped successfully!');
    console.log('Room reservations from homepage can now be submitted without existing room IDs.');
    
    process.exit(0);
  } catch (error) {
    console.error('Error dropping constraint:', error.message);
    process.exit(1);
  }
}

fixConstraint();
