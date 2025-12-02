import pool from '../../../lib/db'; // Adjust path to match your project structure
import { NextResponse } from 'next/server';

export async function POST(request) {
  let client;
  try {
    const body = await request.json().catch(() => ({}));
    const {
      roomId,
      paymentDetails = {},
      housekeepingNote,
      customerName: payloadCustomerName,
      reservationId: payloadReservationId,
      roomNumber: payloadRoomNumber,
    } = body || {};

  const normalizedRoomId = roomId !== undefined ? Number(roomId) : NaN;

    if (!roomId && !payloadReservationId) {
      return NextResponse.json({ error: 'Room ID is required' }, { status: 400 });
    }

    let targetRoomId = Number.isNaN(normalizedRoomId) ? null : normalizedRoomId;

    client = await pool.connect();
    await client.query('BEGIN');

    if (!targetRoomId && payloadReservationId) {
      const reservationLookup = await client.query(
        `SELECT room_id FROM reservations WHERE id = $1`,
        [payloadReservationId]
      );
      if (reservationLookup.rows.length > 0) {
        targetRoomId = reservationLookup.rows[0].room_id;
      }
    }

    const baseSelect = `SELECT 
         r.id AS room_id,
         r.room_number,
         r.status AS room_status,
         r.type AS room_type,
         res.id AS reservation_id,
         res.customer_name,
         res.customer_email,
         res.contact_number,
         res.address,
         res.nationality,
         res.additional_guests,
         res.additional_requests,
         res.remarks,
         res.check_in_date,
         res.check_out_date,
         res.id_upload,
         res.package_name,
         res.payment_option,
         res.downpayment_amount,
         res.downpayment_paid,
         res.downpayment_method,
         res.remaining_balance,
         res.total_price
       FROM rooms r
       LEFT JOIN reservations res ON r.id = res.room_id
       WHERE r.id = $1`;

    let record = null;
    if (targetRoomId) {
      const roomRes = await client.query(baseSelect, [targetRoomId]);
      record = roomRes.rows[0] || null;
    }

    if (!record && payloadRoomNumber) {
      const roomRes = await client.query(
        baseSelect.replace('WHERE r.id = $1', 'WHERE LOWER(r.room_number) = LOWER($1)'),
        [payloadRoomNumber]
      );
      if (roomRes.rows.length > 0) {
        record = roomRes.rows[0];
        targetRoomId = record.room_id;
      }
    }

    if (!targetRoomId) {
      await client.query('ROLLBACK');
      return NextResponse.json({ error: 'Room ID could not be resolved' }, { status: 400 });
    }

    if (!record) {
      await client.query('ROLLBACK');
      return NextResponse.json({ error: 'Room not found' }, { status: 404 });
    }

    const attachedReservationId = record.reservation_id || payloadReservationId || null;
    const occupantName = record.customer_name || payloadCustomerName || 'guest';
    const roomStatus = (record.room_status || '').toLowerCase();
    const hasActiveReservation = Boolean(record.reservation_id);

    if (!hasActiveReservation) {
      const notificationMessage = housekeepingNote || `Room ${record.room_number} checked out manually. Ready for cleaning.`;

      await client.query('UPDATE rooms SET status = $1 WHERE id = $2', ['Needs Cleaning', targetRoomId]);
      await client.query(
        `INSERT INTO housekeeping (room_id, status, notes, updated_at)
         VALUES ($1, $2, $3, NOW())
         ON CONFLICT (room_id) DO UPDATE
           SET status = EXCLUDED.status,
               notes = EXCLUDED.notes,
               updated_at = NOW()`,
        [targetRoomId, 'pending', notificationMessage]
      );

      await client.query(
        `INSERT INTO notifications (room_id, message, scheduled_time, status, target_role)
         VALUES ($1, $2, NOW(), 'scheduled', 'Housekeeping')`,
        [targetRoomId, notificationMessage]
      );

      await client.query('COMMIT');

      return NextResponse.json({
        message: 'Room flagged for cleaning. No active reservation was associated.',
        roomId: targetRoomId,
      }, { status: 200 });
    }

    if (roomStatus !== 'occupied' && roomStatus !== 'reserved') {
      await client.query('ROLLBACK');
      return NextResponse.json({ error: 'Room not ready for checkout' }, { status: 400 });
    }

      // Recompute payments and cafe charges for the reservation to ensure full settlement
  if (attachedReservationId) {
        const paymentSums = await client.query(
          `SELECT
             COALESCE(SUM(CASE WHEN type IN ('payment','downpayment') THEN amount ELSE 0 END),0) AS paid,
             COALESCE(SUM(CASE WHEN type = 'refund' THEN amount ELSE 0 END),0) AS refunded,
             COALESCE(SUM(CASE WHEN type = 'cafe' THEN amount ELSE 0 END),0) AS cafe_total
           FROM payments
           WHERE reservation_id = $1`,
          [attachedReservationId]
        );
        const sums = paymentSums.rows[0] || { paid: 0, refunded: 0, cafe_total: 0 };
        const totalPaid = Number(sums.paid || 0) - Number(sums.refunded || 0);
        const cafeTotal = Number(sums.cafe_total || 0);
        const totalDue = Number(record.total_price || 0);

        // Outstanding = (room total - payments) + cafe charges
        const outstanding = Math.max(0, (totalDue - totalPaid) + cafeTotal);
        // Allow small float rounding tolerance
        if (outstanding > 0.009) {
          await client.query('ROLLBACK');
          return NextResponse.json({ error: 'Outstanding payment required before checkout', outstanding: outstanding, message: `Outstanding amount ₱${outstanding.toFixed(2)}. Please settle all charges before checkout.` }, { status: 402 });
        }
      }

      // If payment method is GCash, require a reference number
      const paymentMethodCandidate = (paymentDetails.paymentMethod || paymentDetails.payment_method || paymentDetails.payment_option || '').toString();
      const paymentMethodLower = paymentMethodCandidate.toLowerCase();
      const providedRef = paymentDetails.referenceNumber || paymentDetails.reference_number || paymentDetails.ref || paymentDetails.gcash_ref || null;
      if (paymentMethodLower === 'gcash' && !providedRef) {
        await client.query('ROLLBACK');
        return NextResponse.json({ error: 'GCash payments require a reference number' }, { status: 400 });
      }

    const checkoutDetails = {
      source: paymentDetails.source || 'room-management',
      checkedOutAt: new Date().toISOString(),
      payment_option: record.payment_option,
      downpayment_amount: record.downpayment_amount,
      downpayment_paid: record.downpayment_paid,
      downpayment_method: record.downpayment_method,
      remaining_balance: record.remaining_balance,
  total: paymentDetails.total ?? record.total_price ?? 0,
      ...paymentDetails,
    };

    await client.query(
      `INSERT INTO reservation_history (
        room_id,
        customer_name,
        customer_email,
        contact_number,
        address,
        nationality,
        additional_guests,
        additional_requests,
        remarks,
        check_in_date,
        check_out_date,
        id_upload,
        e_signature,
        payment_details,
        room_number,
        package_name
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16
      )`,
      [
        record.room_id,
  record.customer_name || payloadCustomerName || 'Guest',
        record.customer_email,
        record.contact_number,
        record.address,
        record.nationality,
        record.additional_guests,
        record.additional_requests,
        record.remarks,
        record.check_in_date,
        record.check_out_date,
        record.id_upload,
        null,
        JSON.stringify(checkoutDetails),
        record.room_number,
        record.package_name,
      ]
    );

    // Also write a unified archived_reservations entry for consolidated reservation history
    try {
      const pkgName = record.package_name || record.package || null;
      await client.query(
        `INSERT INTO archived_reservations (
          reservation_type, source_table, source_id, invoice_id, customer_name, room_number,
          check_in_date, check_out_date, guests, subtotal, total, payment_method, cashier_name, package_name, event_package_id, reference_number, metadata
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)`,
        [
          'room',
          'reservations',
          attachedReservationId,
          checkoutDetails.invoiceId || null,
          record.customer_name || payloadCustomerName || null,
          record.room_number || null,
          record.check_in_date || null,
          record.check_out_date || null,
          record.additional_guests || null,
          checkoutDetails.subtotal || 0,
          checkoutDetails.total || record.total_price || 0,
          checkoutDetails.paymentMethod || checkoutDetails.payment_option || null,
          checkoutDetails.cashierName || checkoutDetails.cashier || null,
          pkgName,
          null,
          providedRef || null,
          JSON.stringify({ archived_from: 'room_checkout', reservation_history: checkoutDetails })
        ]
      );
    } catch (archErr) {
      console.warn('Failed to write archived_reservations for room checkout:', archErr);
    }

    await client.query('DELETE FROM reservations WHERE room_id = $1', [targetRoomId]);

    const nextStatus = 'Needs Cleaning';
    await client.query('UPDATE rooms SET status = $1 WHERE id = $2', [nextStatus, targetRoomId]);

    const notificationMessage = housekeepingNote || `Room ${record.room_number} checked out by ${occupantName}. Needs cleaning.`;

    await client.query(
      `INSERT INTO housekeeping (room_id, status, notes, updated_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (room_id) DO UPDATE
         SET status = EXCLUDED.status,
             notes = EXCLUDED.notes,
             updated_at = NOW()`,
      [targetRoomId, 'pending', notificationMessage]
    );

    await client.query(
      `INSERT INTO notifications (room_id, message, scheduled_time, status, target_role)
       VALUES ($1, $2, NOW(), 'scheduled', 'Housekeeping')`,
      [targetRoomId, notificationMessage]
    );

    await client.query('COMMIT');

    try {
      const total = checkoutDetails.total || 0;
      const cashier = checkoutDetails.cashierName || checkoutDetails.cashier || null;
      await import('../../../lib/auditLogger').then((m) =>
        m.logAudit(
          null,
          'room_checkout',
          'room',
          attachedReservationId,
          {
            cashier,
            item_sold: `Room ${record.room_number}`,
            total,
          },
          request
        )
      );
    } catch (e) {
      console.warn('Failed to write audit for room checkout', e);
    }

    return NextResponse.json({ message: 'Checkout successful', roomId: targetRoomId }, { status: 200 });
  } catch (error) {
    if (client) await client.query('ROLLBACK');
    console.error('Checkout error:', error);
    return NextResponse.json({ error: 'Failed to process checkout', details: error.message }, { status: 500 });
  } finally {
    if (client) client.release();
  }
}
