// lib/db.js
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.NEON_DATABASE_URL,
  ssl: { rejectUnauthorized: false }, // Neon requires SSL
});

export default pool;
