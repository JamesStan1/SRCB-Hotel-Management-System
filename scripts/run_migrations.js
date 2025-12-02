#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

async function main() {
  const databaseUrl = process.env.NEON_DATABASE_URL || process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('NEON_DATABASE_URL or DATABASE_URL environment variable is required');
    process.exit(1);
  }

  const pool = new Pool({ connectionString: databaseUrl, ssl: { rejectUnauthorized: false } });
  const migrationsDir = path.resolve(__dirname, '..', 'migrations');

  const client = await pool.connect();
  try {
    await client.query(`CREATE TABLE IF NOT EXISTS migrations_applied (filename TEXT PRIMARY KEY, applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP)`);

    const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();
    for (const file of files) {
      const already = await client.query('SELECT 1 FROM migrations_applied WHERE filename=$1', [file]);
      if (already.rowCount > 0) {
        console.log('Skipping already applied:', file);
        continue;
      }

      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      console.log('Applying migration:', file);
      try {
        await client.query('BEGIN');
        await client.query(sql);
        await client.query('INSERT INTO migrations_applied (filename) VALUES ($1)', [file]);
        await client.query('COMMIT');
        console.log('Applied:', file);
      } catch (err) {
        await client.query('ROLLBACK');
        console.error('Failed to apply', file, err.message);
        throw err;
      }
    }

    console.log('Migrations complete');
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
