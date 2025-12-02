import { NextResponse } from "next/server";
import pool from "../../../lib/db";
import { requireManagerApproval } from '../../../lib/adminApproval';

export async function GET() {
  let client;
  try {
    client = await pool.connect();
    const result = await client.query('SELECT * FROM archive_reservations ORDER BY archived_at DESC');
    return NextResponse.json(result.rows, { status: 200 });
  } catch (error) {
    console.error('Error fetching archived reservations:', error);
    return NextResponse.json({ error: 'Failed to fetch archived reservations', details: error.message }, { status: 500 });
  } finally {
    if (client) client.release();
  }
}

export async function POST(request) {
  let client;
  try {
    const body = await request.json();
    const approval = await requireManagerApproval(request, body);
    if (!approval.allowed) return NextResponse.json({ error: approval.message || 'Unauthorized' }, { status: 401 });

    const { action, itemId } = body;
    if (!itemId || !action) return NextResponse.json({ error: 'Missing itemId or action' }, { status: 400 });
    if (action !== 'restore') return NextResponse.json({ error: "Invalid action. Only 'restore' is supported" }, { status: 400 });

    client = await pool.connect();
    await client.query('BEGIN');

    const archiveRes = await client.query('SELECT * FROM archive_reservations WHERE id = $1', [itemId]);
    if (archiveRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return NextResponse.json({ error: 'Archived reservation not found' }, { status: 404 });
    }

    const archived = archiveRes.rows[0];

    await client.query(`
      INSERT INTO reservations (
        id, room_id, customer_name, customer_email, contact_number, address,
        nationality, additional_guests, additional_requests, remarks,
        check_in_date, check_out_date, id_upload, e_signature, created_at, updated_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
    `, [
      archived.original_id,
      archived.room_id,
      archived.customer_name,
      archived.customer_email,
      archived.contact_number,
      archived.address,
      archived.nationality,
      archived.additional_guests,
      archived.additional_requests,
      archived.remarks,
      archived.check_in_date,
      archived.check_out_date,
      archived.id_upload,
      archived.e_signature,
      archived.created_at || new Date(),
      archived.updated_at || new Date(),
    ]);

    await client.query('DELETE FROM archive_reservations WHERE id = $1', [itemId]);

    await client.query('COMMIT');
    return NextResponse.json({ message: 'Reservation restored successfully', reservationId: itemId }, { status: 200 });
  } catch (error) {
    if (client) await client.query('ROLLBACK');
    console.error('Error restoring reservation:', error);
    return NextResponse.json({ error: 'Failed to restore reservation', details: error.message }, { status: 500 });
  } finally {
    if (client) client.release();
  }
}

export async function DELETE(request) {
  let client;
  try {
    const body = await request.json();
    const approval = await requireManagerApproval(request, body);
    if (!approval.allowed) return NextResponse.json({ error: approval.message || 'Unauthorized' }, { status: 401 });

    const { itemId } = body;
    if (!itemId) return NextResponse.json({ error: 'Missing itemId', code: 'INVALID_REQUEST' }, { status: 400 });

    client = await pool.connect();
    const result = await client.query('DELETE FROM archive_reservations WHERE id = $1 RETURNING id', [itemId]);
    if (result.rows.length === 0) return NextResponse.json({ error: 'Archived reservation not found', code: 'NOT_FOUND' }, { status: 404 });

    return NextResponse.json({ message: 'Archived reservation permanently deleted', deletedId: result.rows[0].id }, { status: 200 });
  } catch (error) {
    console.error('Error deleting archived reservation:', error);
    return NextResponse.json({ error: 'Failed to delete archived reservation', details: error.message }, { status: 500 });
  } finally {
    if (client) client.release();
  }
}