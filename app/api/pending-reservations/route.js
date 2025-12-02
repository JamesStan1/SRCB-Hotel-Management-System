import { NextResponse } from 'next/server';
import pool from '../../lib/db';
import packages from '../../dashboard/reservation/room-management/data/packages';
import { requireManagerApproval } from '../../lib/adminApproval';
import { sendReservationRejection, sendReservationApproval } from '../../lib/email';

// GET - Fetch all pending reservations (now from unified reservations table for rooms)
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const type = searchParams.get('type'); // optional 'room' or 'event'

    // Only fetch from the pending_reservations table (do not include rows from reservations table)
    let baseQuery = `
      SELECT pr.*, u.email as approved_by_email
      FROM pending_reservations pr
      LEFT JOIN users u ON pr.approved_by = u.id
    `;

    const params = [];
    const conditions = [];

    if (type) {
      // Expect exact values 'room' or 'event'
      conditions.push(`pr.type = $${params.length + 1}`);
      params.push(type);
    } else {
      // include both room and event types
      conditions.push(`pr.type IN ('event','room')`);
    }

    if (status) {
      conditions.push(`pr.status = $${params.length + 1}`);
      params.push(status);
    }

    if (conditions.length > 0) {
      baseQuery += ' WHERE ' + conditions.join(' AND ');
    }

    baseQuery += ' ORDER BY pr.created_at DESC';

    const result = await pool.query(baseQuery, params);

    return NextResponse.json({
      success: true,
      reservations: result.rows,
      type: type || 'all'
    }, { status: 200 });
    
  } catch (error) {
    console.error('Error fetching pending reservations:', error);
    return NextResponse.json({ 
      error: 'Failed to fetch pending reservations',
      details: error.message 
    }, { status: 500 });
  }
}

// POST - Create a new pending reservation (from public homepage)
export async function POST(request) {
  try {
    const body = await request.json();
    const {
  type,
      customer_name,
      customer_email,
      contact_number,
      // Room-specific fields
  room_id,
  package_id,
      package_name,
      check_in_date,
      check_out_date,
      address,
      nationality,
      additional_guests,
      additional_requests,
      // Event-specific fields
      event_name,
      event_type,
  event_package_name,
  event_package_id,
      event_date,
      event_time,
      attendees,
      set_name,
      selected_dishes,
      supervisor,
      remarks,
      // Common fields
      price,
      total,
      id_upload
    } = body;

    // Validate common required fields
    if (!type || !customer_name) {
      return NextResponse.json({
        error: 'Missing required fields: type and customer_name are required'
      }, { status: 400 });
    }

    // Type-specific validation
    if (type === 'room') {
      if (!check_in_date || !check_out_date || (!package_name && !package_id)) {
        return NextResponse.json({
          error: 'Missing required fields for room reservation: check_in_date, check_out_date, and package_name or package_id are required'
        }, { status: 400 });
      }
    } else if (type === 'event') {
      if (!event_name || !event_date || !attendees) {
        return NextResponse.json({
          error: 'Missing required fields for event reservation'
        }, { status: 400 });
      }
    } else {
      return NextResponse.json({
        error: 'Invalid reservation type. Must be "room" or "event"'
      }, { status: 400 });
    }

    const query = `
      INSERT INTO pending_reservations (
        type, customer_name, customer_email, contact_number,
        room_id, package_id, package_name, event_package_id, check_in_date, check_out_date,
        address, nationality, additional_guests, additional_requests,
        event_name, event_type, event_package_name, event_date, event_time,
        attendees, set_name, selected_dishes, supervisor, remarks,
        price, total, id_upload, status
      )
  VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, 'pending')
      RETURNING *
    `;

    const values = [
      type,
      customer_name,
      customer_email || null,
      contact_number || null,
      room_id || null,
      package_id || null,
      package_name || null,
      event_package_id || null,
      check_in_date || null,
      check_out_date || null,
      address || null,
      nationality || null,
      additional_guests || 0,
      additional_requests || null,
      event_name || null,
      event_type || null,
      event_package_name || null,
      event_date || null,
      event_time || null,
      attendees || null,
      set_name || null,
      selected_dishes ? JSON.stringify(selected_dishes) : null,
      supervisor || null,
      remarks || null,
      price || null,
      total || null,
      id_upload || null
    ];

    const result = await pool.query(query, values);

    return NextResponse.json({
      success: true,
      message: 'Reservation submitted successfully and is awaiting approval',
      reservation: result.rows[0]
    }, { status: 201 });

  } catch (error) {
    console.error('Error creating pending reservation:', error);
    return NextResponse.json({
      error: 'Failed to create reservation',
      details: error.message
    }, { status: 500 });
  }
}

// PUT - Update pending reservation status (approve/reject) - Requires manager approval
export async function PUT(request) {
  let client;
  let body;
  try {
    body = await request.json();
    const { id, action, rejection_reason, paymentOption, downpaymentAmount, paymentMethod } = body;

    if (!id || !action) {
      return NextResponse.json({
        error: 'Missing required fields: id and action'
      }, { status: 400 });
    }

    if (!['approve', 'reject', 'confirm_downpayment', 'final_approve'].includes(action)) {
      return NextResponse.json({
        error: 'Invalid action. Must be "approve", "reject", "confirm_downpayment", or "final_approve"'
      }, { status: 400 });
    }

    if (action === 'approve' && !paymentOption) {
      return NextResponse.json({
        error: 'Payment option is required for approval'
      }, { status: 400 });
    }
    
    if (action === 'approve' && paymentOption === 'downpayment' && !downpaymentAmount) {
      return NextResponse.json({
        error: 'Downpayment amount is required when selecting downpayment option'
      }, { status: 400 });
    }

    // Require manager/admin approval
    const approval = await requireManagerApproval(request, body);
    if (!approval.allowed) {
      return NextResponse.json({
        error: approval.message || 'Manager or admin approval required'
      }, { status: 403 });
    }

    client = await pool.connect();
    await client.query('BEGIN');

    // Fetch the reservation and validate current status
    const pendingRes = await client.query(
      'SELECT * FROM pending_reservations WHERE id = $1',
      [id]
    );

    if (pendingRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return NextResponse.json({
        error: 'Reservation not found. It may have been deleted or already processed.',
        requestedId: id
      }, { status: 404 });
    }

    const pending = pendingRes.rows[0];

    const expectedStatusByAction = {
      approve: ['pending'],
      confirm_downpayment: ['awaiting_downpayment'],
      final_approve: ['downpayment_paid'],
      reject: ['pending', 'awaiting_downpayment']
    };

    const expectedStatuses = expectedStatusByAction[action];
    if (expectedStatuses && !expectedStatuses.includes(pending.status)) {
      await client.query('ROLLBACK');
      return NextResponse.json({
        error: `Cannot ${action} reservation. Current status is '${pending.status}', expected ${expectedStatuses.join(' or ')}.`,
        currentStatus: pending.status,
        expectedStatus: expectedStatuses,
        reservationId: pending.id,
        customerName: pending.customer_name
      }, { status: 400 });
    }

    let updatedReservationForResponse = null;

    if (action === 'approve') {
      // ===== CHECK FOR DUPLICATE RESERVATIONS =====
      if (pending.type === 'room') {
        // Check if there's already a reservation for the same room and overlapping dates
        const duplicateRoomCheck = await client.query(
          `SELECT r.id, r.customer_name, rm.room_number
           FROM reservations r
           JOIN rooms rm ON r.room_id = rm.id
           WHERE r.room_id = $1
           AND r.approval_status = 'confirmed'
           AND (
             (r.check_in_date, r.check_out_date) OVERLAPS ($2::date, $3::date)
           )
           LIMIT 1`,
          [pending.room_id, pending.check_in_date, pending.check_out_date]
        );

        if (duplicateRoomCheck.rows.length > 0) {
          const duplicate = duplicateRoomCheck.rows[0];
          await client.query('ROLLBACK');
          return NextResponse.json({
            error: 'Room Already Reserved',
            message: `Room ${duplicate.room_number} is already reserved for the selected dates by ${duplicate.customer_name}. Please choose a different room or date range.`,
            duplicateReservation: {
              roomNumber: duplicate.room_number,
              customerName: duplicate.customer_name,
              reservationId: duplicate.id
            }
          }, { status: 409 });
        }
      } else if (pending.type === 'event') {
        // Check if there's already an event for the same date and time
        const duplicateEventCheck = await client.query(
          `SELECT id, name, booked_by, date, allotted_time
           FROM events
           WHERE DATE(date) = DATE($1::timestamp)
           AND allotted_time = $2
           LIMIT 1`,
          [pending.event_date, pending.event_time]
        );

        if (duplicateEventCheck.rows.length > 0) {
          const duplicate = duplicateEventCheck.rows[0];
          const eventDate = new Date(duplicate.date).toLocaleDateString();
          await client.query('ROLLBACK');
          return NextResponse.json({
            error: 'Event Venue Already Booked',
            message: `The event venue is already booked on ${eventDate} at ${duplicate.allotted_time} for "${duplicate.name}" by ${duplicate.booked_by}. Please choose a different date or time.`,
            duplicateEvent: {
              eventName: duplicate.name,
              bookedBy: duplicate.booked_by,
              date: eventDate,
              time: duplicate.allotted_time,
              eventId: duplicate.id
            }
          }, { status: 409 });
        }
      }
      // ===== END DUPLICATE CHECK =====

      // Calculate remaining balance if downpayment
      const totalAmount = parseFloat(pending.total || pending.price || 0);
      const downAmount = paymentOption === 'downpayment' ? parseFloat(downpaymentAmount || 0) : 0;
      const remainingBalance = totalAmount - downAmount;

      // Move to appropriate table based on type and payment option
      if (pending.type === 'room') {
        if (paymentOption === 'checkout') {
          // Pay upon checkout - add directly to reservation_history
          // Determine room assignment: prefer pending.room_id, otherwise map package_name -> package id -> find available room
          let assignedRoomId = pending.room_id;
          try {
            // Prefer explicit package_id stored in pending reservation (more reliable)
            const pkgIdToUse = pending.package_id || null;
            if (!assignedRoomId && pkgIdToUse) {
              const roomRes = await client.query(
                `SELECT id FROM rooms WHERE package_id = $1 AND status = 'Available' LIMIT 1`,
                [pkgIdToUse]
              );
              if (roomRes.rows.length > 0) assignedRoomId = roomRes.rows[0].id;
            }

            // Fallback to fuzzy name matching if package_id not present or mapping failed
            if (!assignedRoomId && pending.package_name) {
              const pkgName = pending.package_name;
              const pkg = packages.find(p => p.name.toLowerCase() === pkgName.toLowerCase()) || packages.find(p => p.name.toLowerCase().includes(pkgName.toLowerCase()));
              if (pkg && pkg.id) {
                const roomRes = await client.query(
                  `SELECT id FROM rooms WHERE package_id = $1 AND status = 'Available' LIMIT 1`,
                  [pkg.id]
                );
                if (roomRes.rows.length > 0) assignedRoomId = roomRes.rows[0].id;
              }
            }
          } catch (mapErr) {
            console.error('Error mapping package to room:', mapErr);
          }

          // CRITICAL: If no room was assigned, abort the approval
          if (!assignedRoomId) {
            await client.query('ROLLBACK');
            return NextResponse.json({
              error: 'No Available Room',
              message: `No available rooms found for package "${pending.package_name}". Please ensure rooms are available before approving this reservation.`,
              packageName: pending.package_name,
              packageId: pending.package_id
            }, { status: 400 });
          }

          // Pay upon checkout - add directly to reservation_history
          await client.query(
            `INSERT INTO reservation_history (
              room_id, customer_name, customer_email, contact_number,
              check_in_date, check_out_date, payment_details, room_number, package_name
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
            [
              assignedRoomId,
              pending.customer_name,
              pending.customer_email,
              pending.contact_number,
              pending.check_in_date,
              pending.check_out_date,
              { price: pending.price || pending.total, payment_method: 'pay_on_checkout' },
              pending.room_number,
              pending.package_name
            ]
          );

          // Update room status to occupied if applicable
          if (assignedRoomId) {
            await client.query(
              `UPDATE rooms SET status = 'Occupied' WHERE id = $1`,
              [assignedRoomId]
            );
          }
          
          // Also insert into reservations so approved homepage reservations appear in Room Management
          try {
            await client.query(
              `INSERT INTO reservations (
                  room_id, customer_name, customer_email, contact_number,
                  address, nationality, remarks, id_upload,
                  check_in_date, check_out_date, package_name,
                  additional_guests, total_price, reservation_source,
                  approval_status, status,
                  payment_option, downpayment_amount, downpayment_paid,
                  downpayment_method, remaining_balance,
                  created_at, updated_at
                ) VALUES (
                  $1, $2, $3, $4,
                  $5, $6, $7, $8,
                  $9, $10, $11,
                  $12, $13, $14,
                  $15, $16,
                  $17, $18, $19,
                  $20, $21,
                  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
                )`,
              [
                assignedRoomId,
                pending.customer_name,
                pending.customer_email,
                pending.contact_number,
                pending.address || null,
                pending.nationality || null,
                pending.remarks || pending.additional_requests || null,
                pending.id_upload || null,
                pending.check_in_date,
                pending.check_out_date,
                pending.package_name,
                pending.additional_guests || 0,
                pending.total || pending.price,
                'homepage',
                'confirmed',
                'confirmed',
                paymentOption || 'full_payment',
                0,
                false,
                null,
                pending.remaining_balance || pending.total || pending.price || 0
              ]
            );
          } catch (insErr) {
            // Log insertion error but don't fail the whole approval flow — reservation_history is the primary record for checkout flow
            console.error('Failed to insert into reservations during checkout-approval:', insErr);
          }
          
          // Update pending reservation status to approved since it's been processed
          await client.query(
            `UPDATE pending_reservations 
             SET status = 'approved', approved_by = $1, approved_at = CURRENT_TIMESTAMP,
                 payment_option = $2, updated_at = CURRENT_TIMESTAMP
             WHERE id = $3`,
            [approval.userId, paymentOption, id]
          );
        } else if (paymentOption === 'downpayment') {
          // Require downpayment - keep in pending with downpayment status
          await client.query(
            `UPDATE pending_reservations 
             SET status = 'awaiting_downpayment', approved_by = $1, approved_at = CURRENT_TIMESTAMP, 
                 payment_option = $2, downpayment_amount = $3, remaining_balance = $4, updated_at = CURRENT_TIMESTAMP
             WHERE id = $5`,
            [approval.userId, paymentOption, downAmount, remainingBalance, id]
          );
        }
      } else if (pending.type === 'event') {
        if (paymentOption === 'checkout') {
          // Pay upon checkout - add directly to event_reservation_history
          await client.query(
            `INSERT INTO event_reservation_history (
              event_name, event_package_name, customer_name,
              event_date, guests, total
            ) VALUES ($1, $2, $3, $4, $5, $6)`,
            [
              pending.event_name,
              pending.event_package_name,
              pending.customer_name,
              pending.event_date,
              pending.attendees,
              pending.total || pending.price
            ]
          );
          
          // Update pending reservation status to approved since it's been processed
          await client.query(
            `UPDATE pending_reservations 
             SET status = 'approved', approved_by = $1, approved_at = CURRENT_TIMESTAMP,
                 payment_option = $2, updated_at = CURRENT_TIMESTAMP
             WHERE id = $3`,
            [approval.userId, paymentOption, id]
          );
        } else if (paymentOption === 'downpayment') {
          // Require downpayment - keep in pending with downpayment status
          await client.query(
            `UPDATE pending_reservations 
             SET status = 'awaiting_downpayment', approved_by = $1, approved_at = CURRENT_TIMESTAMP,
                 payment_option = $2, downpayment_amount = $3, remaining_balance = $4, updated_at = CURRENT_TIMESTAMP
             WHERE id = $5`,
            [approval.userId, paymentOption, downAmount, remainingBalance, id]
          );
        }
      }

      // refresh pending snapshot for response if needed
      const refreshed = await client.query('SELECT * FROM pending_reservations WHERE id = $1', [id]);
      if (refreshed.rows.length > 0) {
        updatedReservationForResponse = refreshed.rows[0];
      }

    } else if (action === 'confirm_downpayment') {
      console.log('=== CONFIRM DOWNPAYMENT DEBUG ===');
      console.log('Received ID:', id, 'Type:', typeof id);
      console.log('Reservation status (fetched):', pending.status);
      console.log('Downpayment amount (recorded):', pending.downpayment_amount);

      // Accept optional downpayment reference sent by client for GCash
      const downpaymentReference = body.downpaymentReference || body.reference || body.reference_number || null;

      // Defensive: ensure the reference_number column exists (in case migrations weren't applied)
      // This makes the PUT idempotent in dev environments where the migration hasn't been run yet.
      try {
        await client.query(`ALTER TABLE pending_reservations ADD COLUMN IF NOT EXISTS reference_number VARCHAR(255)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_pending_reservations_reference_number ON pending_reservations (reference_number)`);
      } catch (schemaErr) {
        // Log the schema creation error but continue — it's non-fatal and update may still fail downstream
        console.error('Failed to ensure reference_number column exists:', schemaErr);
      }

      const updateResult = await client.query(
        `UPDATE pending_reservations 
         SET status = 'downpayment_paid', downpayment_paid = true, downpayment_date = CURRENT_TIMESTAMP,
             downpayment_method = $2, reference_number = $3, updated_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [id, paymentMethod || null, downpaymentReference || null]
      );

      console.log('confirm_downpayment update rowCount:', updateResult.rowCount);

      if (updateResult.rowCount === 0) {
        await client.query('ROLLBACK');
        const recent = await client.query('SELECT id, status FROM pending_reservations WHERE id = $1', [id]);
        return NextResponse.json({
          error: 'Failed to mark downpayment as received. Reservation may already be processed.',
          currentStatus: recent.rows.length ? recent.rows[0].status : null,
          requestedId: id
        }, { status: 400 });
      }

      const refreshed = await client.query('SELECT * FROM pending_reservations WHERE id = $1', [id]);
      if (refreshed.rows.length > 0) {
        updatedReservationForResponse = refreshed.rows[0];
      }

    } else if (action === 'final_approve') {
      // Final approval - move reservation to Room Management or Event Management
      console.log('=== FINAL APPROVE DEBUG ===');
      console.log('Received ID:', id, 'Type:', typeof id);
      console.log('Reservation type:', pending.type);
      console.log('Reservation status:', pending.status);

      // This action is for reservations with status 'downpayment_paid'
      if (pending.status !== 'downpayment_paid') {
        await client.query('ROLLBACK');
        return NextResponse.json({
          error: `Cannot approve reservation. Current status is '${pending.status}', expected 'downpayment_paid'.`,
          currentStatus: pending.status
        }, { status: 400 });
      }

      // ===== CHECK FOR DUPLICATE RESERVATIONS (FINAL APPROVE) =====
      if (pending.type === 'room') {
        // Check if there's already a reservation for the same room and overlapping dates
        const duplicateRoomCheck = await client.query(
          `SELECT r.id, r.customer_name, rm.room_number
           FROM reservations r
           JOIN rooms rm ON r.room_id = rm.id
           WHERE r.room_id = $1
           AND r.approval_status = 'confirmed'
           AND (
             (r.check_in_date, r.check_out_date) OVERLAPS ($2::date, $3::date)
           )
           LIMIT 1`,
          [pending.room_id, pending.check_in_date, pending.check_out_date]
        );

        if (duplicateRoomCheck.rows.length > 0) {
          const duplicate = duplicateRoomCheck.rows[0];
          await client.query('ROLLBACK');
          return NextResponse.json({
            error: 'Room Already Reserved',
            message: `Room ${duplicate.room_number} is already reserved for the selected dates by ${duplicate.customer_name}. Please choose a different room or date range.`,
            duplicateReservation: {
              roomNumber: duplicate.room_number,
              customerName: duplicate.customer_name,
              reservationId: duplicate.id
            }
          }, { status: 409 });
        }
      } else if (pending.type === 'event') {
        // Check if there's already an event for the same date and time
        const duplicateEventCheck = await client.query(
          `SELECT id, name, booked_by, date, allotted_time
           FROM events
           WHERE DATE(date) = DATE($1::timestamp)
           AND allotted_time = $2
           LIMIT 1`,
          [pending.event_date, pending.event_time]
        );

        if (duplicateEventCheck.rows.length > 0) {
          const duplicate = duplicateEventCheck.rows[0];
          const eventDate = new Date(duplicate.date).toLocaleDateString();
          await client.query('ROLLBACK');
          return NextResponse.json({
            error: 'Event Venue Already Booked',
            message: `The event venue is already booked on ${eventDate} at ${duplicate.allotted_time} for "${duplicate.name}" by ${duplicate.booked_by}. Please choose a different date or time.`,
            duplicateEvent: {
              eventName: duplicate.name,
              bookedBy: duplicate.booked_by,
              date: eventDate,
              time: duplicate.allotted_time,
              eventId: duplicate.id
            }
          }, { status: 409 });
        }
      }
      // ===== END DUPLICATE CHECK (FINAL APPROVE) =====

      // Move to appropriate management table based on type
      if (pending.type === 'room') {
        // Assign room if not set: map package_name -> package id -> find available room
        let assignedRoomId = pending.room_id;
        try {
          // Prefer explicit package_id stored in pending reservation (more reliable)
          const pkgIdToUse = pending.package_id || null;
          if (!assignedRoomId && pkgIdToUse) {
            const roomRes = await client.query(
              `SELECT id FROM rooms WHERE package_id = $1 AND status = 'Available' LIMIT 1`,
              [pkgIdToUse]
            );
            if (roomRes.rows.length > 0) assignedRoomId = roomRes.rows[0].id;
          }

          // Fallback to fuzzy name matching if package_id not present or mapping failed
          if (!assignedRoomId && pending.package_name) {
            const pkgName = pending.package_name;
            const pkg = packages.find(p => p.name.toLowerCase() === pkgName.toLowerCase()) || packages.find(p => p.name.toLowerCase().includes(pkgName.toLowerCase()));
            if (pkg && pkg.id) {
              const roomRes = await client.query(
                `SELECT id FROM rooms WHERE package_id = $1 AND status = 'Available' LIMIT 1`,
                [pkg.id]
              );
              if (roomRes.rows.length > 0) assignedRoomId = roomRes.rows[0].id;
            }
          }
        } catch (mapErr) {
          console.error('Error mapping package_name to room during final approve:', mapErr);
        }

        // CRITICAL: If no room was assigned, abort the approval
        if (!assignedRoomId) {
          await client.query('ROLLBACK');
          return NextResponse.json({
            error: 'No Available Room',
            message: `No available rooms found for package "${pending.package_name}". Please ensure rooms are available before approving this reservation.`,
            packageName: pending.package_name,
            packageId: pending.package_id
          }, { status: 400 });
        }

        // Insert into reservations table (active reservations for Room Management)
        await client.query(
          `INSERT INTO reservations (
            room_id, customer_name, customer_email, contact_number,
            address, nationality, remarks, id_upload,
            check_in_date, check_out_date, package_name,
            additional_guests, total_price, reservation_source,
            approval_status, status,
            payment_option, downpayment_amount, downpayment_paid,
            downpayment_method, remaining_balance, reference_number,
            created_at, updated_at
          ) VALUES (
            $1, $2, $3, $4,
            $5, $6, $7, $8,
            $9, $10, $11,
            $12, $13, $14,
            $15, $16,
            $17, $18, $19,
            $20, $21, $22,
            CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
          )`,
          [
            assignedRoomId,
            pending.customer_name,
            pending.customer_email,
            pending.contact_number,
            pending.address || null,
            pending.nationality || null,
            pending.remarks || pending.additional_requests || null,
            pending.id_upload || null,
            pending.check_in_date,
            pending.check_out_date,
            pending.package_name,
            pending.additional_guests || 0,
            pending.total || pending.price,
            'homepage',
            'confirmed',
            'confirmed',
            pending.payment_option || 'full_payment',
            pending.downpayment_amount || 0,
            pending.downpayment_paid || false,
            pending.downpayment_method || null,
            pending.remaining_balance || 0,
            pending.reference_number || null
          ]
        );

        // If we assigned a room via package mapping, update its status to Occupied
        if (assignedRoomId) {
          await client.query(`UPDATE rooms SET status = 'Occupied' WHERE id = $1`, [assignedRoomId]);
        }
      } else if (pending.type === 'event') {
        // Insert into events table (Event Management) for pending homepage event reservations
        console.log('=== EVENT DATA DEBUG ===');
        console.log('pending.event_name:', pending.event_name);
        console.log('pending.event_package_name:', pending.event_package_name);
        console.log('pending.event_date:', pending.event_date);
        console.log('pending.event_time:', pending.event_time);
        console.log('pending.attendees:', pending.attendees);

        // Try to resolve event_package_id from pending reservation if not provided
        let eventPackageId = pending.event_package_id || null;
        if (!eventPackageId && pending.event_package_name) {
          try {
            const pkgRes = await client.query(
              'SELECT id FROM event_packages WHERE LOWER(name) = LOWER($1) LIMIT 1',
              [pending.event_package_name]
            );
            if (pkgRes.rows.length > 0) eventPackageId = pkgRes.rows[0].id;
          } catch (pkgErr) {
            console.error('Error resolving event_package_id from name:', pkgErr);
          }
        }

        // Prepare values
        const dishesVal = pending.selected_dishes || pending.dishes || null;
        // customer_id_url is varchar(255) in events — homepage uploads are base64 and can be very long.
        // Persist the full upload in the TEXT `id_upload` column instead and leave customer_id_url null for now.
        const customerIdUrl = null;
        const setName = pending.set_name || pending.event_package_name || null;

        await client.query(
          `INSERT INTO events (
            name, type, date, allotted_time, guests, booked_by, supervisor, status,
            additional_requests, additional_guests, remarks, total_cost, menu, dishes,
            customer_id_url, e_signature, id_upload, set, event_package_id, price, total, 
            downpayment_amount, remaining_balance, reference_number, contact_number, created_at, updated_at
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
          [
            pending.event_name || 'Event Reservation', // name
            pending.event_type || pending.event_package_name || 'Event Reservation', // type (use event_type if available)
            pending.event_date,
            pending.event_time || '18:00:00',
            pending.attendees || 0,
            pending.customer_name, // booked_by
            pending.supervisor || 'Online Reservation', // supervisor from form or fallback
            'Confirmed', // status
            pending.additional_requests || null,
            pending.additional_guests || 0,
            pending.remarks || null,
            pending.total || pending.price || 0,
            pending.event_package_name || null,
            dishesVal ? (typeof dishesVal === 'string' ? dishesVal : JSON.stringify(dishesVal)) : null,
            customerIdUrl,
            pending.e_signature || null,
            pending.id_upload || null,
            setName,
            eventPackageId,
            pending.price || null,
            pending.total || null,
            pending.downpayment_amount || 0,
            pending.remaining_balance || 0,
            pending.reference_number || null,
            pending.contact_number || null
          ]
        );
      }

      // Update pending reservation to approved status
      await client.query(
        `UPDATE pending_reservations 
         SET status = 'approved', approved_by = $1, approved_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
         WHERE id = $2`,
        [approval.userId, id]
      );

      const finalRefreshed = await client.query('SELECT * FROM pending_reservations WHERE id = $1', [id]);
      if (finalRefreshed.rows.length > 0) {
        updatedReservationForResponse = finalRefreshed.rows[0];
      }

    } else if (action === 'reject') {
      // Update status to rejected
      await client.query(
        `UPDATE pending_reservations 
         SET status = 'rejected', rejection_reason = $1, approved_by = $2, approved_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
         WHERE id = $3`,
        [rejection_reason || 'No reason provided', approval.userId, id]
      );

      // Send rejection email notification to customer
      try {
        const reservationType = pending.type === 'room' ? 'Room Reservation' : 'Event Reservation';
        await sendReservationRejection(
          pending.customer_email,
          pending.customer_name,
          reservationType,
          rejection_reason || 'No specific reason provided'
        );
        console.log('Rejection email sent to:', pending.customer_email);
      } catch (emailError) {
        // Log email error but don't block the rejection
        console.error('Failed to send rejection email:', emailError);
      }

      const rejectRefresh = await client.query('SELECT * FROM pending_reservations WHERE id = $1', [id]);
      if (rejectRefresh.rows.length > 0) {
        updatedReservationForResponse = rejectRefresh.rows[0];
      }
    }

    // Send approval email notification to customer (for approve and final_approve actions)
    if ((action === 'approve' || action === 'final_approve') && pending.customer_email) {
      try {
        const reservationType = pending.type === 'room' ? 'Room Reservation' : 'Event Reservation';
        const reservationName = pending.type === 'room' ? pending.package_name : pending.event_name;
        
        await sendReservationApproval(
          pending.customer_email,
          pending.customer_name,
          {
            reservationType,
            reservationName,
            checkInDate: pending.check_in_date || pending.event_date,
            checkOutDate: pending.check_out_date,
            totalAmount: pending.total || pending.price || 0,
            downpaymentAmount: pending.downpayment_amount || 0,
            remainingBalance: pending.remaining_balance || (pending.total || pending.price || 0),
            paymentOption: pending.payment_option || paymentOption || 'full_payment'
          }
        );
        console.log('Approval email sent to:', pending.customer_email);
      } catch (emailError) {
        // Log email error but don't block the approval
        console.error('Failed to send approval email:', emailError);
      }
    }

    await client.query('COMMIT');

    const successMessageByAction = {
      approve: 'Reservation approved successfully',
      confirm_downpayment: 'Downpayment confirmed successfully',
      final_approve: 'Reservation finalized and moved to management',
      reject: 'Reservation rejected successfully'
    };

    return NextResponse.json({
      success: true,
      message: successMessageByAction[action] || 'Reservation updated successfully',
      approverId: approval.userId,
      approverEmail: approval.userId, // kept for backward compatibility with existing clients
      reservation: updatedReservationForResponse || pending
    }, { status: 200 });

  } catch (error) {
    if (client) await client.query('ROLLBACK');
    console.error('=== ERROR UPDATING PENDING RESERVATION ===');
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    console.error('Request body:', body);
    return NextResponse.json({
      error: 'Failed to update reservation status',
      details: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }, { status: 500 });
  } finally {
    if (client) client.release();
  }
}
