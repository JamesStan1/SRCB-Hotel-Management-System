// app/api/event/checkout/route.js
import pool from '../../../lib/db';

export async function POST(req) {
  const { eventId, paymentDetails } = await req.json();
  const {
    invoiceId,
    customerName,
    paymentMethod,
    discountType,
    discountAmount,
    subtotal,
    total,
    cashierName,
  } = paymentDetails;

  // If GCash is used, require a reference number
  const refNumber = paymentDetails.referenceNumber || paymentDetails.reference_number || paymentDetails.ref || paymentDetails.gcash_ref || null;
  if ((paymentMethod || '').toLowerCase() === 'gcash' && !refNumber) {
    return new Response(JSON.stringify({ error: 'GCash payments require a reference number' }), { status: 400 });
  }

  // Ensure nullable fields have safe defaults to satisfy DB NOT NULL constraints
  const safeDiscountType = discountType ?? '';
  const safeDiscountAmount = discountAmount == null ? 0 : discountAmount;
  const safeCashierName = cashierName ?? '';

  let client;
  try {
    client = await pool.connect();
    await client.query('BEGIN');

    // Fetch event details
    const eventQuery = 'SELECT * FROM events WHERE id = $1';
    const eventResult = await client.query(eventQuery, [eventId]);
    if (eventResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return new Response(JSON.stringify({ error: 'Event not found' }), { status: 404 });
    }
    const event = eventResult.rows[0];

    // Check for outstanding payments
    const paymentSums = await client.query(
      `SELECT
         COALESCE(SUM(CASE WHEN type IN ('payment','downpayment') THEN amount ELSE 0 END),0) AS paid,
         COALESCE(SUM(CASE WHEN type = 'refund' THEN amount ELSE 0 END),0) AS refunded
       FROM payments
       WHERE event_id = $1`,
      [eventId]
    );
    const sums = paymentSums.rows[0] || { paid: 0, refunded: 0 };
    const totalPaid = Number(sums.paid || 0) - Number(sums.refunded || 0);
    const totalDue = Number(event.total_cost || event.total || 0);

    // Outstanding = total due - payments made
    const outstanding = Math.max(0, totalDue - totalPaid);
    // Allow small float rounding tolerance
    if (outstanding > 0.009) {
      await client.query('ROLLBACK');
      return new Response(
        JSON.stringify({ 
          error: 'Outstanding payment required before checkout', 
          outstanding: outstanding, 
          message: `Outstanding amount ₱${outstanding.toFixed(2)}. Please settle all charges before checkout.` 
        }), 
        { status: 402 }
      );
    }

    // Insert into event_reservation_history
    const insertQuery = `
      INSERT INTO event_reservation_history (
        event_id, event_package_id, invoice_id, customer_name, event_name, event_date, 
        total_cost, guests, payment_method, discount_type, discount_amount, 
        subtotal, total, cashier_name, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, CURRENT_TIMESTAMP)
      RETURNING *
    `;
    const values = [
      event.id,
      event.event_package_id || null,
      invoiceId,
      customerName,
      event.name,
      event.date,
      event.total_cost || 0,
      event.guests || 0,
      paymentMethod,
      safeDiscountType,
      safeDiscountAmount,
      subtotal || 0,
      total || 0,
      safeCashierName,
    ];
    const insertResult = await client.query(insertQuery, values);

    // ✅ Also insert a unified archived record (archived_reservations) for consolidated history
    try {
      // Include package information when available
      const pkgName = event.package_name || event.event_package_name || (event.package && event.package.name) || null;
      const pkgId = event.event_package_id || null;
      const referenceNumberToStore = refNumber || null;
      await client.query(
        `INSERT INTO archived_reservations (
          reservation_type, source_table, source_id, invoice_id, customer_name, event_name, event_date,
          guests, subtotal, total, payment_method, cashier_name, package_name, event_package_id, reference_number, metadata
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
        [
          'event',
          'events',
          event.id,
          invoiceId || null,
          customerName || event.booked_by || null,
          event.name || null,
          event.date || null,
          event.guests || 0,
          subtotal || event.total_cost || 0,
          total || event.total || event.total_cost || 0,
          paymentMethod || null,
          safeCashierName || null,
          pkgName,
          pkgId,
          referenceNumberToStore,
          JSON.stringify({ archived_from: 'event_checkout', history_id: insertResult.rows[0].id })
        ]
      );
    } catch (archErr) {
      console.warn('Failed to write to archived_reservations:', archErr);
    }

    // ✅ Delete the event from active events after saving to history
    const deleteQuery = 'DELETE FROM events WHERE id = $1';
    await client.query(deleteQuery, [eventId]);

    await client.query('COMMIT');

    // Log audit: connect this checkout to POS/audit logs with cashier and item sold
    try {
      const history = insertResult.rows[0];
      await import('../../../lib/auditLogger').then(m => m.logAudit(
        null,
        'event_checkout',
        'event',
        history.id,
        {
          cashier: safeCashierName,
          item_sold: event.name,
          total: history.total || total || 0,
          guest_count: history.guests || 0,
        },
        req
      ));
    } catch (e) {
      console.warn('Failed to write audit for event checkout', e);
    }

    return new Response(
      JSON.stringify({ success: true, history: insertResult.rows[0] }),
      { status: 200 }
    );
  } catch (error) {
    if (client) await client.query('ROLLBACK');
    console.error('Event checkout error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error', details: error.message }), { status: 500 });
  } finally {
    if (client) client.release();
  }
}
