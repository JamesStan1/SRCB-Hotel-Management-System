import pool from '../../../lib/db';
import jwt from 'jsonwebtoken';
import { NextResponse } from 'next/server';

export async function GET(req) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.id;

    // Return sales-related audit logs for this user
    const q = `
      SELECT al.*, u.name AS user_name,
        COALESCE(
          NULLIF(al.details->>'total', '')::numeric,
          NULLIF(al.details->>'amount', '')::numeric,
          NULLIF(al.details->>'package_price', '')::numeric,
          0
        ) AS sales_amount
      FROM audit_logs al
      LEFT JOIN users u ON u.id = al.user_id
      WHERE al.user_id = $1
        AND (
          al.entity IN ('receipt','reservation','event','room')
          OR al.action ILIKE '%receipt%'
          OR al.action ILIKE '%sale%'
          OR al.action ILIKE '%reservation%'
          OR al.action ILIKE '%checkout%'
          OR al.action ILIKE '%settle%'
        )
      ORDER BY al.timestamp DESC
      LIMIT 200
    `;

    const result = await pool.query(q, [userId]);
    return NextResponse.json(result.rows, { status: 200 });
  } catch (err) {
    console.error('my-sales error', err);
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 });
  }
}
