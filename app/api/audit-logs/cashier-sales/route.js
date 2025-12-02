import { NextResponse } from 'next/server';
import pool from '../../../lib/db';

function safeJsonParse(str, fallback = null) {
  try {
    return str ? JSON.parse(str) : fallback;
  } catch {
    return fallback;
  }
}

function normalizeItemName(item) {
  if (!item) return null;
  return item.name || item.title || item.item || null;
}

export async function GET(req) {
  try {
    // Fetch receipts
    // detect receipts table (pos.receipts preferred)
    const tblRes0 = await pool.query("SELECT CASE WHEN to_regclass('pos.receipts') IS NOT NULL THEN 'pos.receipts' WHEN to_regclass('receipts') IS NOT NULL THEN 'receipts' ELSE NULL END as tbl");
    const receiptsTable = tblRes0.rows[0] && tblRes0.rows[0].tbl;
    if (!receiptsTable) {
      return NextResponse.json({ error: 'Receipts table not found' }, { status: 500 });
    }

    const receiptsRes = await pool.query(
      `SELECT id, cashier, customer, items::text as items, subtotal, discount, total, payment_method, created_at FROM ${receiptsTable} ORDER BY created_at DESC`
    );

    const receipts = receiptsRes.rows.map((r) => ({
      id: r.id,
      cashier: r.cashier,
      customer: r.customer,
      items: safeJsonParse(r.items, []),
      subtotal: r.subtotal !== null && r.subtotal !== undefined ? Number(r.subtotal) : 0,
      discount: r.discount !== null && r.discount !== undefined ? Number(r.discount) : 0,
      total: r.total !== null && r.total !== undefined ? Number(r.total) : 0,
      payment_method: r.payment_method,
      created_at: r.created_at,
    }));

    // Build lookup by id
    const receiptsById = new Map(receipts.map((r) => [String(r.id), r]));

    // Helper: fuzzy find by customer name, total and date proximity
    function fuzzyFindReceipt({ customerName, amount, date }) {
      if (!customerName) return null;
      const cust = String(customerName).toLowerCase();
      const targetTime = date ? new Date(date).getTime() : null;
      // score receipts by exact total match + customer substring + date proximity
      let best = null;
      let bestScore = -Infinity;
      for (const r of receipts) {
        let score = 0;
        if (String(r.customer || '').toLowerCase().includes(cust)) score += 3;
        if (typeof amount === 'number' && !Number.isNaN(amount) && Math.abs(Number(r.total || 0) - amount) < 0.005) score += 4;
        if (targetTime && r.created_at) {
          const dt = Math.abs(new Date(r.created_at).getTime() - targetTime);
          // within 2 days
          if (dt <= 1000 * 60 * 60 * 24 * 2) score += 2;
        }
        if (score > bestScore) { bestScore = score; best = r; }
      }
      // require minimal confidence
      return bestScore >= 3 ? best : null;
    }

    // Fetch events
    const eventsRes = await pool.query(
      `SELECT id, invoice_id, event_name, customer_name, total, cashier_name, event_date, created_at FROM event_reservation_history ORDER BY event_date DESC`
    );
    const events = eventsRes.rows.map((e) => ({
      id: e.id,
      invoice_id: e.invoice_id,
      event_name: e.event_name,
      customer_name: e.customer_name,
      total: e.total !== null && e.total !== undefined ? Number(e.total) : 0,
      cashier_name: e.cashier_name || null,
      event_date: e.event_date,
      created_at: e.created_at,
    }));

    // Fetch room reservation history
    const roomsRes = await pool.query(
      `SELECT id, customer_name, payment_details::text as payment_details, check_out_date, checkout_date, room_number, package_name, created_at FROM reservation_history ORDER BY check_out_date DESC`
    );
    const rooms = roomsRes.rows.map((r) => {
      const pd = safeJsonParse(r.payment_details, {});
      const price = pd && (pd.price || pd.total || pd.amount) ? Number(pd.price || pd.total || pd.amount) : null;
      return {
        id: r.id,
        customer_name: r.customer_name,
        payment_details: pd,
        price,
        check_out_date: r.check_out_date || r.checkout_date,
        room_number: r.room_number,
        package_name: r.package_name,
        created_at: r.created_at,
      };
    });

    const matched = [];

    // Match events to receipts preferentially by invoice_id
    for (const ev of events) {
      let matchedReceipt = null;
      if (ev.invoice_id) {
        matchedReceipt = receiptsById.get(String(ev.invoice_id)) || null;
      }
      if (!matchedReceipt) {
        matchedReceipt = fuzzyFindReceipt({ customerName: ev.customer_name, amount: ev.total, date: ev.event_date || ev.created_at });
      }

      const primaryItem = ev.event_name || null;
      matched.push({
        source: 'event',
        id: ev.id,
        item: primaryItem,
        cashier: matchedReceipt ? matchedReceipt.cashier : (ev.cashier_name || null),
        sales: matchedReceipt ? matchedReceipt.total : ev.total || 0,
        event_date: ev.event_date,
        invoice_id: ev.invoice_id || null,
        receipt_id: matchedReceipt ? matchedReceipt.id : null,
      });
    }

    // Match room reservations to receipts heuristically
    for (const rm of rooms) {
      const matchedReceipt = fuzzyFindReceipt({ customerName: rm.customer_name, amount: rm.price, date: rm.check_out_date || rm.created_at });
      const item = rm.package_name || `Room ${rm.room_number || ''}`.trim();
      matched.push({
        source: 'room',
        id: rm.id,
        item: item || 'Room',
        cashier: matchedReceipt ? matchedReceipt.cashier : null,
        sales: matchedReceipt ? matchedReceipt.total : (rm.price || 0),
        check_out_date: rm.check_out_date,
        receipt_id: matchedReceipt ? matchedReceipt.id : null,
      });
    }

    // Also include receipts items individually (break down items sold per cashier)
    const receiptItemRecords = [];
    for (const r of receipts) {
      const items = Array.isArray(r.items) ? r.items : [];
      for (const it of items) {
        const name = normalizeItemName(it) || String(it || 'Item');
        // try to extract price from common fields
        const price = (it && (it.price || it.amount || it.total)) ? Number(it.price || it.amount || it.total) : null;
        receiptItemRecords.push({
          source: 'receipt_item',
          receipt_id: r.id,
          cashier: r.cashier,
          customer: r.customer,
          item: name,
          item_price: price,
          receipt_total: r.total,
          created_at: r.created_at,
        });
      }
      // if no items array or empty, still include receipt summary
      if (!Array.isArray(r.items) || r.items.length === 0) {
        receiptItemRecords.push({
          source: 'receipt_summary',
          receipt_id: r.id,
          cashier: r.cashier,
          customer: r.customer,
          item: null,
          item_price: null,
          receipt_total: r.total,
          created_at: r.created_at,
        });
      }
    }

    return NextResponse.json({ matched, receipt_items: receiptItemRecords }, { status: 200 });
  } catch (error) {
    console.error('Error in cashier-sales endpoint:', error);
    return NextResponse.json({ error: 'Failed to fetch cashier sales', details: error.message }, { status: 500 });
  }
}
