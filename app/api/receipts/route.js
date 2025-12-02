import pool from "../../lib/db";
import jwt from 'jsonwebtoken';
import { logAudit } from '../../lib/auditLogger';
import { requireRole, Permissions } from '../../lib/rbac';

export async function POST(req) {
  try {
    const auth = requireRole(req, Permissions.Receipts, 'manage');
    if (!auth.allowed) {
      await logAudit(null, 'receipt_create_failed', 'receipt', null, { error: auth.message || 'Unauthorized' }, req);
      return new Response(JSON.stringify({ error: auth.message || 'Unauthorized' }), { status: 403 });
    }
    const userId = auth.userId;

    const body = await req.json();
    const {
      cashier,
      customer,
      items,
      subtotal,
      tax,
      discount,
      total,
      paymentMethod,
    } = body;

    // Accept both `cashGiven` (client-friendly camelCase) and `amountGiven`
    // normalize to amountGiven which will be persisted as `amount_given` in DB.
    const amountGiven = body.cashGiven ?? body.amountGiven ?? null;

    if (!cashier || !customer || !items || !paymentMethod) {
      await logAudit(userId, 'receipt_create_failed', 'receipt', null, { error: "Missing required fields" }, req);
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400 }
      );
    }

    // Resolve which receipts table exists (pos.receipts preferred)
    const tblRes = await pool.query("SELECT CASE WHEN to_regclass('pos.receipts') IS NOT NULL THEN 'pos.receipts' WHEN to_regclass('receipts') IS NOT NULL THEN 'receipts' ELSE NULL END as tbl");
    const receiptsTable = tblRes.rows[0] && tblRes.rows[0].tbl;
    if (!receiptsTable) {
      await logAudit(userId, 'receipt_create_failed', 'receipt', null, { error: 'Receipts table not found' }, req);
      return new Response(JSON.stringify({ error: 'Receipts table not found' }), { status: 500 });
    }

    const query = `
      INSERT INTO ${receiptsTable} (
        cashier,
        customer,
        items,
        subtotal,
        discount,
        total,
        payment_method,
        amount_given
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *;
    `;

    const values = [
      cashier,
      customer,
      JSON.stringify(items),
      subtotal,
      discount,
      total,
      paymentMethod,
      amountGiven,
    ];

    const result = await pool.query(query, values);

    // Build an items summary and primary item for easier audit consumption
    const itemNames = items.map(it => it.name || it.title || it.item || '').filter(Boolean);
    const primaryItem = itemNames[0] || null;
    const itemsSummary = itemNames.slice(0, 5).join(', ') + (itemNames.length > 5 ? ` (+${itemNames.length - 5} more)` : '');

    await logAudit(
      userId,
      'receipt_create',
      'receipt',
      result.rows[0].id,
      {
        cashier,
        customer,
        total,
        paymentMethod,
        itemCount: items.length,
        primary_item: primaryItem,
        items_summary: itemsSummary,
        amount_given: amountGiven,
      },
      req
    );

    return new Response(JSON.stringify(result.rows[0]), { status: 201 });
  } catch (error) {
    console.error("Error inserting receipt:", error);
    await logAudit(
      null,
      'receipt_create_failed',
      'receipt',
      null,
      { error: error.message },
      req
    );
    return new Response(JSON.stringify({ error: "Internal Server Error" }), {
      status: 500,
    });
  }
}

export async function GET(req) {
  try {
    const auth = requireRole(req, Permissions.Receipts, 'view');
    if (!auth.allowed) {
      await logAudit(null, 'receipt_fetch_failed', 'receipt', null, { error: auth.message || 'Unauthorized' }, req);
      return new Response(JSON.stringify({ error: auth.message || 'Unauthorized' }), { status: 403 });
    }
    const userId = auth.userId;

    // Resolve receipts table (pos.receipts preferred)
    const tblRes = await pool.query("SELECT CASE WHEN to_regclass('pos.receipts') IS NOT NULL THEN 'pos.receipts' WHEN to_regclass('receipts') IS NOT NULL THEN 'receipts' ELSE NULL END as tbl");
    const receiptsTable = tblRes.rows[0] && tblRes.rows[0].tbl;
    if (!receiptsTable) {
      await logAudit(null, 'receipt_fetch_failed', 'receipt', null, { error: 'Receipts table not found' }, req);
      return new Response(JSON.stringify({ error: 'Receipts table not found' }), { status: 500 });
    }

    const result = await pool.query(
      `SELECT id, cashier, customer, items::text as items, subtotal, discount, total, payment_method, amount_given, created_at 
       FROM ${receiptsTable} ORDER BY created_at DESC`
    );

    await logAudit(
      userId,
      'receipt_fetch',
      'receipt',
      null,
      { count: result.rows.length },
      req
    );

    return new Response(JSON.stringify(result.rows), { status: 200 });
  } catch (error) {
    console.error("Error fetching receipts:", error);
    await logAudit(
      null,
      'receipt_fetch_failed',
      'receipt',
      null,
      { error: error.message },
      req
    );
    return new Response(JSON.stringify({ error: "Internal Server Error" }), {
      status: 500,
    });
  }
}
