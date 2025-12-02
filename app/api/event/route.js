import { NextResponse } from 'next/server';
import pool from '../../lib/db';
import path from 'path';
import fs from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';

/* ------------------------- Helper Functions ------------------------- */

function validateEventData(eventData) {
  const requiredFields = [
    'name', 'type', 'date', 'allotted_time', 'guests',
    'booked_by', 'supervisor', 'status', 'total_cost', 'menu', 'set'
  ];

  const missingFields = requiredFields.filter(field => !eventData[field]);
  if (missingFields.length > 0)
    return { valid: false, error: `Missing required fields: ${missingFields.join(', ')}` };

  if (isNaN(Number(eventData.guests)) || Number(eventData.guests) <= 0)
    return { valid: false, error: 'Guests must be a positive number' };

  if (isNaN(Number(eventData.total_cost)) || Number(eventData.total_cost) < 0)
    return { valid: false, error: 'Total cost must be a valid number' };

  if (eventData.additional_guests && (isNaN(Number(eventData.additional_guests)) || Number(eventData.additional_guests) < 0))
    return { valid: false, error: 'Additional guests must be a valid number' };

  if (isNaN(Date.parse(eventData.date)))
    return { valid: false, error: 'Invalid date format' };

  return { valid: true };
}

function safeJsonParse(str, defaultValue = []) {
  try {
    if (typeof str === 'string') return JSON.parse(str);
    return str || defaultValue;
  } catch {
    return defaultValue;
  }
}

function safeJsonStringify(data, defaultValue = '[]') {
  try {
    if (typeof data === 'string') {
      const parsed = JSON.parse(data);
      return JSON.stringify(parsed);
    }
    return JSON.stringify(data || []);
  } catch {
    return defaultValue;
  }
}

async function fetchEventBillingData(searchParams) {
  const startDate = searchParams.get('start_date');
  const endDate = searchParams.get('end_date');
  const customerName = searchParams.get('customer_name');

  const tblRes = await pool.query(`
    SELECT CASE
      WHEN to_regclass('pos.receipts') IS NOT NULL THEN 'pos.receipts'
      WHEN to_regclass('receipts') IS NOT NULL THEN 'receipts'
      ELSE NULL
    END as tbl
  `);
  const receiptsTable = tblRes.rows[0]?.tbl || null;

  const queryParams = [];
  const filters = [];

  if (startDate) {
    queryParams.push(startDate);
    filters.push(`e.date >= $${queryParams.length}`);
  }

  if (endDate) {
    queryParams.push(endDate);
    filters.push(`e.date <= $${queryParams.length}`);
  }

  if (customerName) {
    queryParams.push(`%${customerName}%`);
    filters.push(`(e.booked_by ILIKE $${queryParams.length} OR e.name ILIKE $${queryParams.length})`);
  }

  const receiptsJoin = receiptsTable
    ? `LEFT JOIN LATERAL (
        SELECT
          rec.id AS receipt_id,
          rec.cashier AS receipt_cashier,
          (rec.total)::numeric AS receipt_total
        FROM ${receiptsTable} rec
        WHERE (
          EXISTS (
            SELECT 1 FROM jsonb_array_elements(rec.items) elem
            WHERE (elem->>'event_id') = e.id::text
          )
          OR rec.items::text ILIKE ('%' || e.id::text || '%')
          OR (
            e.booked_by IS NOT NULL
            AND rec.customer ILIKE ('%' || e.booked_by || '%')
          )
          OR (
            e.total_cost IS NOT NULL
            AND (rec.total)::numeric = e.total_cost
          )
        )
        ORDER BY
          (CASE WHEN EXISTS (
            SELECT 1 FROM jsonb_array_elements(rec.items) elem
            WHERE (elem->>'event_id') = e.id::text
          ) THEN 0 ELSE 1 END),
          ABS(EXTRACT(EPOCH FROM (rec.created_at - e.date))) ASC
        LIMIT 1
      ) rec_match ON true`
    : '';

  const whereClause = filters.length ? `WHERE ${filters.join(' AND ')}` : '';

  const eventQuery = `
    SELECT
      e.id,
      e.name AS event_name,
      e.date AS event_date,
      COALESCE(e.total_cost, 0)::numeric AS total_cost,
      e.guests,
      e.booked_by,
      e.supervisor,
      e.status,
      COALESCE(dp.downpayment_paid, 0)::numeric AS downpayment_paid_amount,
      COALESCE(payments.total_regular, 0)::numeric AS payments_applied,
      GREATEST(
        0,
        COALESCE(e.total_cost, 0)::numeric
          - COALESCE(dp.downpayment_paid, 0)::numeric
          - COALESCE(payments.total_regular, 0)::numeric
      ) AS remaining_balance,
      rec_match.receipt_cashier,
      rec_match.receipt_total
    FROM events e
    LEFT JOIN LATERAL (
      SELECT COALESCE(SUM(amount), 0) AS downpayment_paid
      FROM payments
      WHERE event_id = e.id AND type = 'downpayment'
    ) dp ON true
    LEFT JOIN LATERAL (
      SELECT
        COALESCE(SUM(CASE WHEN type = 'payment' THEN amount ELSE 0 END), 0)
        - COALESCE(SUM(CASE WHEN type = 'refund' THEN amount ELSE 0 END), 0) AS total_regular
      FROM payments
      WHERE event_id = e.id
    ) payments ON true
    ${receiptsJoin}
    ${whereClause}
    ORDER BY e.date DESC NULLS LAST, e.id DESC
  `;

  const eventResult = await pool.query(eventQuery, queryParams);
  const eventReservations = eventResult.rows.map((row) => {
    const totalCost = Number(row.total_cost ?? 0);
    const downpaymentPaid = Number(row.downpayment_paid_amount ?? 0);
    const paymentsApplied = Number(row.payments_applied ?? 0);
    const remaining = Number(row.remaining_balance ?? Math.max(totalCost - downpaymentPaid - paymentsApplied, 0));

    return {
      id: row.id,
      event_name: row.event_name,
      event_date: row.event_date,
      total: totalCost,
      total_cost: totalCost,
      price: totalCost,
      guests: row.guests,
      customer_name: row.booked_by,
      booked_by: row.booked_by,
      supervisor: row.supervisor,
      status: row.status,
      downpayment_paid_amount: downpaymentPaid,
      downpayment: downpaymentPaid,
      downpayment_required: null,
      payments_applied: paymentsApplied,
      total_paid_amount: downpaymentPaid + paymentsApplied,
      remaining_balance: remaining,
      receipt_cashier: row.receipt_cashier,
      receipt_total: row.receipt_total ? Number(row.receipt_total) : null,
      display_name: row.booked_by,
    };
  });

  return NextResponse.json({ eventReservations }, { status: 200 });
}

/* ------------------------- POST: Create Event ------------------------- */

// POST handler
export async function POST(request) {
  let client;
  try {
    const formData = await request.formData();
    const eventData = JSON.parse(formData.get('event'));
    const customerIdFile = formData.get('customerId');
    const eSignatureFile = formData.get('eSignature');

    // ✅ Validate data
    const validation = validateEventData(eventData);
    if (!validation.valid)
      return NextResponse.json({ error: validation.error }, { status: 400 });

    if (!customerIdFile || !eSignatureFile)
      return NextResponse.json({ error: 'Customer ID and e-signature are required' }, { status: 400 });

    // ✅ Safe MIME type validation
    const filetypes = /jpeg|jpg|png|pdf/;
    const isCustomerIdValid = customerIdFile.type && filetypes.test(customerIdFile.type);
    const isESignatureValid = eSignatureFile.type && filetypes.test(eSignatureFile.type);

    if (!isCustomerIdValid || !isESignatureValid) {
      console.warn('⚠️ Invalid file types:', {
        idType: customerIdFile.type,
        signType: eSignatureFile.type,
      });
      return NextResponse.json({ error: 'Invalid file type for ID or signature' }, { status: 400 });
    }

    // ✅ Use /tmp for serverless environments
    const uploadDir = process.env.NODE_ENV === 'production' ? '/tmp/uploads' : path.join(process.cwd(), 'public/uploads');
    await fs.mkdir(uploadDir, { recursive: true });

    // ✅ Generate unique file paths
    const customerIdPath = `/uploads/customerId-${uuidv4()}-${customerIdFile.name}`;
    const eSignaturePath = `/uploads/eSignature-${uuidv4()}-${eSignatureFile.name}`;

    // ✅ Save files to /tmp in production
    await fs.writeFile(
      path.join(uploadDir, path.basename(customerIdPath)),
      Buffer.from(await customerIdFile.arrayBuffer())
    );
    await fs.writeFile(
      path.join(uploadDir, path.basename(eSignaturePath)),
      Buffer.from(await eSignatureFile.arrayBuffer())
    );

    // ✅ Insert into database
    client = await pool.connect();
    await client.query('BEGIN');

    const query = `
      INSERT INTO events (
        name, type, date, allotted_time, guests, booked_by, supervisor, status,
        additional_requests, additional_guests, remarks, total_cost, menu, dishes,
        customer_id_url, e_signature, set, event_package_id
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
      RETURNING *;
    `;

    const values = [
      eventData.name,
      eventData.type,
      eventData.date,
      eventData.allotted_time,
      eventData.guests,
      eventData.booked_by,
      eventData.supervisor,
      eventData.status,
      eventData.additional_requests || null,
      eventData.additional_guests || 0,
      eventData.remarks || null,
      eventData.total_cost,
      eventData.menu,
      safeJsonStringify(eventData.dishes),
      customerIdPath,
      eSignaturePath,
      eventData.set,
      eventData.event_package_id || null
    ];

    console.log('📦 Inserting event data:', values);

    const result = await client.query(query, values);
    await client.query('COMMIT');

    const newEvent = {
      ...result.rows[0],
      dishes: safeJsonParse(result.rows[0].dishes),
      total_cost: Number(result.rows[0].total_cost) || 0,
      set: result.rows[0].set || null,
    };

    return NextResponse.json(newEvent, { status: 201 });
  } catch (error) {
    if (client) await client.query('ROLLBACK');
    console.error('❌ Detailed error creating event:', error.stack || error);
    return NextResponse.json({ error: 'Failed to create event', details: error.message }, { status: 500 });
  } finally {
    if (client) client.release();
  }
}

/* ------------------------- GET: Fetch Events ------------------------- */

export async function GET(request) {
  try {
    if (request) {
      const url = new URL(request.url);
      if ((url.searchParams.get('scope') || '').toLowerCase() === 'billing') {
        return await fetchEventBillingData(url.searchParams);
      }
    }

    const result = await pool.query(`
      SELECT 
        id, name, type, date, allotted_time, guests, booked_by, supervisor, status,
        additional_requests, additional_guests, remarks, total_cost, menu, dishes,
        customer_id_url, e_signature, id_upload, created_at, updated_at, set, event_package_id,
        reference_number, downpayment_amount, remaining_balance, contact_number
      FROM events
      ORDER BY date DESC;
    `);

    const events = result.rows.map(row => ({
      ...row,
      dishes: safeJsonParse(row.dishes),
      total_cost: row.total_cost ? Number(row.total_cost) : null,
      totalCost: row.total_cost ? Number(row.total_cost) : null,
      set: row.set || null,
      e_signature: row.e_signature || null,
      id_upload: row.id_upload || null,
      reference_number: row.reference_number || null,
      contact_number: row.contact_number || null,
      downpayment_amount: row.downpayment_amount ? Number(row.downpayment_amount) : null,
      downpaymentAmount: row.downpayment_amount ? Number(row.downpayment_amount) : null,
      remaining_balance: row.remaining_balance ? Number(row.remaining_balance) : null,
      remainingBalance: row.remaining_balance ? Number(row.remaining_balance) : null
    }));

    return NextResponse.json(events, { status: 200 });
  } catch (error) {
    console.error('Error fetching events:', error);
    return NextResponse.json({ error: 'Failed to fetch events', details: error.message }, { status: 500 });
  }
}

/* ------------------------- PUT: Update Event ------------------------- */

export async function PUT(request) {
  let client;
  try {
    const formData = await request.formData();
    const eventData = JSON.parse(formData.get('event'));

    const validation = validateEventData(eventData);
    if (!validation.valid)
      return NextResponse.json({ error: validation.error }, { status: 400 });

    client = await pool.connect();
    await client.query('BEGIN');

    const existingEvent = await client.query('SELECT id FROM events WHERE id = $1', [eventData.id]);
    if (existingEvent.rowCount === 0) {
      await client.query('ROLLBACK');
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    const query = `
      UPDATE events
      SET
        name = $1, type = $2, date = $3, allotted_time = $4,
        guests = $5, booked_by = $6, supervisor = $7, status = $8,
        additional_requests = $9, additional_guests = $10, remarks = $11,
        total_cost = $12, menu = $13, dishes = $14, set = $15,
        updated_at = CURRENT_TIMESTAMP, event_package_id = $16
      WHERE id = $17
      RETURNING *;
    `;
    const values = [
      eventData.name,
      eventData.type,
      eventData.date,
      eventData.allotted_time,
      eventData.guests,
      eventData.booked_by,
      eventData.supervisor,
      eventData.status,
      eventData.additional_requests || null,
      eventData.additional_guests || 0,
      eventData.remarks || null,
      eventData.total_cost,
      eventData.menu,
      safeJsonStringify(eventData.dishes),
      eventData.set,
      eventData.event_package_id,
      eventData.id
    ];

    const result = await client.query(query, values);
    await client.query('COMMIT');

    const updatedEvent = {
      ...result.rows[0],
      dishes: safeJsonParse(result.rows[0].dishes),
      total_cost: result.rows[0].total_cost ? Number(result.rows[0].total_cost) : null,
      totalCost: result.rows[0].total_cost ? Number(result.rows[0].total_cost) : null,
      set: result.rows[0].set || null
    };

    return NextResponse.json(updatedEvent, { status: 200 });
  } catch (error) {
    if (client) await client.query('ROLLBACK');
    console.error('Error updating event:', error);
    return NextResponse.json({ error: 'Failed to update event', details: error.message }, { status: 500 });
  } finally {
    if (client) client.release();
  }
}

/* ------------------------- DELETE: Archive Event ------------------------- */

export async function DELETE(request) {
  let client;
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id)
      return NextResponse.json({ error: 'Event ID is required' }, { status: 400 });

    client = await pool.connect();
    await client.query('BEGIN');

    const historyCheck = await client.query(
      'SELECT COUNT(*) FROM event_reservation_history WHERE event_id = $1', [id]
    );

    if (historyCheck.rows[0].count > 0) {
      const deleteResult = await client.query('DELETE FROM events WHERE id = $1', [id]);
      if (deleteResult.rowCount === 0) {
        await client.query('ROLLBACK');
        return NextResponse.json({ error: 'Event not found' }, { status: 404 });
      }
      await client.query('COMMIT');
      return NextResponse.json({ message: 'Event deleted successfully' }, { status: 200 });
    }

    const archiveCheck = await client.query(
      'SELECT COUNT(*) FROM archive_events WHERE original_id = $1', [id]
    );

    if (archiveCheck.rows[0].count > 0) {
      await client.query('ROLLBACK');
      return NextResponse.json({ error: 'Event is already archived' }, { status: 400 });
    }

    const eventResult = await client.query('SELECT * FROM events WHERE id = $1', [id]);
    if (eventResult.rowCount === 0) {
      await client.query('ROLLBACK');
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    const event = eventResult.rows[0];
    const validDishes = safeJsonStringify(safeJsonParse(event.dishes));

    await client.query(`
      INSERT INTO archive_events (
        original_id, name, type, date, allotted_time, guests, booked_by, supervisor, status,
        additional_requests, additional_guests, remarks, total_cost, menu, dishes,
        customer_id_url, e_signature, "set", created_at, updated_at
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)
    `, [
      event.id, event.name, event.type, event.date, event.allotted_time, event.guests,
      event.booked_by, event.supervisor, event.status, event.additional_requests,
      event.additional_guests, event.remarks, event.total_cost, event.menu, validDishes,
      event.customer_id_url, event.e_signature, event.set, event.created_at, event.updated_at
    ]);

    await client.query('DELETE FROM events WHERE id = $1', [id]);
    await client.query('COMMIT');

    return NextResponse.json({ message: 'Event archived successfully' }, { status: 200 });
  } catch (error) {
    if (client) await client.query('ROLLBACK');
    console.error('Error archiving event:', error);
    return NextResponse.json({ error: 'Failed to archive event', details: error.message }, { status: 500 });
  } finally {
    if (client) client.release();
  }
}
