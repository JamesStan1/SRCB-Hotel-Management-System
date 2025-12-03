import pool from '../../../lib/db';
import { NextResponse } from 'next/server';

// Minimal JWT verify helper so the print endpoint can accept a token query param
function verifyToken(token) {
  try {
    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    return { ok: true, decoded };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

export async function GET(request, { params }) {
  try {
    const url = new URL(request.url);
    const token = url.searchParams.get('token') || null;
    if (!token) return NextResponse.json({ error: 'Unauthorized: token required' }, { status: 401 });

    const v = verifyToken(token);
    if (!v.ok) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

  const { id } = await params;
    if (!id) return NextResponse.json({ error: 'Reservation id required' }, { status: 400 });

    // Query reservation and aggregated payments (only one row)
    const q = `
      SELECT
        r.id,
        r.room_id,
        r.check_in_date,
        r.check_out_date,
        COALESCE(r.total_price, 0) AS total_price,
        r.customer_name,
        rm.room_number,
        COALESCE(payments.total_regular, 0) AS payments_applied,
        COALESCE(payments.cafe_total, 0) AS cafe_payments
      FROM reservations r
      LEFT JOIN rooms rm ON rm.id = r.room_id
      LEFT JOIN LATERAL (
        SELECT
          COALESCE(SUM(CASE WHEN type = 'payment' THEN amount ELSE 0 END), 0)
          - COALESCE(SUM(CASE WHEN type = 'refund' THEN amount ELSE 0 END), 0) AS total_regular,
          COALESCE(SUM(CASE WHEN type = 'cafe' THEN amount ELSE 0 END), 0) AS cafe_total
        FROM payments
        WHERE reservation_id = r.id
      ) payments ON true
      WHERE r.id = $1
      LIMIT 1
    `;

    const res = await pool.query(q, [id]);
    if (res.rowCount === 0) return NextResponse.json({ error: 'Reservation not found' }, { status: 404 });

    const row = res.rows[0];
    const billedTotal = Number(row.total_price || 0);
    const cafePayment = Number(row.cafe_payments || 0);
    const paymentsApplied = Number(row.payments_applied || 0);
    const remaining = Math.max(0, billedTotal - paymentsApplied);
    const combinedTotal = Number((remaining + cafePayment) || 0);

    // Fetch any 'cafe' payments for this reservation so we can extract invoice IDs
    const payRes = await pool.query(`SELECT id, amount, note FROM payments WHERE reservation_id = $1 AND type = 'cafe'`, [id]);
    const cafePayments = payRes.rows || [];

    // Extract invoice IDs from payment notes - common format: 'Cafe order - Invoice: INVOICE_ID' or 'Invoice: INVOICE_ID'
    const invoiceIds = new Set();
    const invoiceRegex = /Invoice:\s*([A-Za-z0-9\-_.]+)/i;
    for (const p of cafePayments) {
      if (p && p.note) {
        const m = String(p.note).match(invoiceRegex);
        if (m && m[1]) invoiceIds.add(m[1]);
      }
    }

    // If we have invoice ids, fetch chef_orders to show itemized dishes
    let cafeItems = [];
    if (invoiceIds.size > 0) {
      const arr = Array.from(invoiceIds);
      const q = `SELECT invoice_id, items FROM chef_orders WHERE invoice_id = ANY($1)`;
      const ordersRes = await pool.query(q, [arr]);
      for (const o of ordersRes.rows) {
        try {
          const items = Array.isArray(o.items) ? o.items : JSON.parse(o.items || '[]');
          // items should contain objects like { id, name, quantity, price, subtotal }
          for (const it of items) {
            // normalize fields
            cafeItems.push({
              invoice_id: o.invoice_id,
              id: it.id || it.item_id || null,
              name: it.name || it.item_name || 'Item',
              quantity: Number(it.quantity || it.qty || 1),
              price: Number(it.price || it.unit_price || 0),
              subtotal: Number(it.subtotal || (Number(it.price || 0) * Number(it.quantity || 1)) || 0),
            });
          }
        } catch (e) {
          console.warn('Failed to parse chef_orders items for invoice', o && o.invoice_id, e);
        }
      }
    }

    // compute subtotal of collected cafe items
    const cafeItemsSubtotal = cafeItems.reduce((s, it) => s + (Number(it.subtotal) || 0), 0);

    const html = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Billing Summary - Reservation ${row.id}</title>
    <style>
      @page { size: A4; margin: 15mm; }
      body { 
        font-family: Arial, sans-serif; 
        padding: 20px; 
        color: #111827; 
        background: #f6f9fb;
        width: 210mm;
        min-height: 297mm;
      }
      .container { max-width: 760px; margin: 0 auto; background: #fff; padding: 22px; border-radius: 8px; box-shadow: 0 6px 22px rgba(16,24,40,0.06); }
      .header { text-align: center; margin-bottom: 12px; }
      .brand { display:flex; align-items:center; gap:12px; justify-content:center }
      .brand img { height:72px; width:auto; border-radius:8px }
      .hotel-name { font-size:20px; font-weight:700; color:#2563eb }
      .summary { max-width: 720px; margin: 12px auto 0; }
      .row { display:flex; justify-content:space-between; padding:10px 0; border-bottom:1px solid #f1f5f9 }
      .label { color:#475569 }
      .value { font-weight:600; color:#0f172a }
      .cafe { color:#92400e; font-weight:700 }
      .big-total { margin-top:18px; padding:16px; background:#ecfeff; border:1px solid #67e8f9; border-radius:8px; display:flex; justify-content:space-between; align-items:center }
      .big-total .left { font-size:15px; color:#2563eb }
      .big-total .amount { font-size:22px; font-weight:800; color:#2563eb }
      .meta { margin-top:10px; font-size:13px; color:#64748b }
      @media print { body { background: #fff; width: 210mm; min-height: 297mm; } .container { box-shadow:none; } }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header">
        <div class="brand">
          <img src="/SRCB.png" alt="SRCB Logo" />
          <div>
            <div class="hotel-name">SRCB & Café</div>
            <div style="font-size:13px;color:#6b7280">Consolidated Billing Summary</div>
          </div>
        </div>
        <div style="margin-top:10px;color:#374151">Reservation: <strong>${row.id}</strong> &nbsp; | &nbsp; Room: <strong>${row.room_number || 'N/A'}</strong></div>
        <div style="color:#374151">Guest: <strong>${row.customer_name || 'N/A'}</strong></div>
      </div>
      <div class="summary">
        <div class="row"><div class="label">Room Charges</div><div class="value">₱${billedTotal.toFixed(2)}</div></div>
        <div class="row"><div class="label">Payments Applied</div><div class="value">- ₱${paymentsApplied.toFixed(2)}</div></div>
        <div class="row"><div class="label cafe">Café Charges</div><div class="value cafe">₱${cafePayment.toFixed(2)}</div></div>

        ${
          cafeItems.length > 0
            ? `
        <div style="margin-top:14px; border-top:1px dashed #e6edf3; padding-top:10px;">
          <div style="font-weight:700;color:#92400e;margin-bottom:8px">Café Itemized Charges</div>
          <table style="width:100%; border-collapse:collapse; font-size:13px;">
            <thead>
              <tr style="text-align:left; color:#475569;">
                <th style="padding:6px 8px;">Invoice</th>
                <th style="padding:6px 8px;">Item</th>
                <th style="padding:6px 8px; text-align:right">Qty</th>
                <th style="padding:6px 8px; text-align:right">Unit</th>
                <th style="padding:6px 8px; text-align:right">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              ${cafeItems
                .map(it => `
                <tr>
                  <td style="padding:6px 8px;">${String(it.invoice_id || '')}</td>
                  <td style="padding:6px 8px;">${String(it.name || '')}</td>
                  <td style="padding:6px 8px; text-align:right">${Number(it.quantity || 1)}</td>
                  <td style="padding:6px 8px; text-align:right">₱${Number(it.price || 0).toFixed(2)}</td>
                  <td style="padding:6px 8px; text-align:right">₱${Number(it.subtotal || 0).toFixed(2)}</td>
                </tr>
              `)
                .join('')}
            </tbody>
            <tfoot>
              <tr style="border-top:1px solid #eef2f7; font-weight:700;">
                <td colspan="4" style="padding:8px; text-align:right">Items Subtotal</td>
                <td style="padding:8px; text-align:right">₱${cafeItemsSubtotal.toFixed(2)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
          `
            : ''
        }

        <div class="row"><div class="label">Remaining Room Balance</div><div class="value">₱${remaining.toFixed(2)}</div></div>
        <div class="big-total">
          <div class="left">Total Due (Remaining + Café Charges)</div>
          <div class="amount">₱${combinedTotal.toFixed(2)}</div>
        </div>
        <div class="meta">Generated: ${new Date().toLocaleString()}</div>
      </div>
    </div>
    <script>
      // Auto-print then close (graceful)
      window.addEventListener('load', function(){
        try { window.print(); } catch (e) { console.warn('Print call failed', e); }
        setTimeout(() => { try { window.close(); } catch (e) {} }, 900);
      });
    </script>
  </body>
</html>`;

    return new NextResponse(html, { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  } catch (error) {
    console.error('GET /print/billing error:', error && error.stack ? error.stack : error);
    return NextResponse.json({ error: 'Internal Server Error', details: error.message }, { status: 500 });
  }
}
