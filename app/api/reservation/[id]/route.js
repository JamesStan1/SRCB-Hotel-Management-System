import pool from "../../../lib/db";
import { NextResponse } from "next/server";

export async function DELETE(request, { params }) {
  let client;
  try {
    const { id } = params;

    if (!id) {
      return NextResponse.json(
        { error: "Reservation ID is required" },
        { status: 400 }
      );
    }

    client = await pool.connect();
    await client.query("BEGIN");

    const resResult = await client.query(
      "SELECT * FROM reservations WHERE id = $1",
      [id]
    );
    if (resResult.rowCount === 0) {
      await client.query("ROLLBACK");
      return NextResponse.json(
        { error: "Reservation not found" },
        { status: 404 }
      );
    }

    const reservation = resResult.rows[0];

    await client.query(
      `INSERT INTO archive_reservations (
        original_id, room_id, customer_name, customer_email, contact_number,
        address, nationality, additional_guests, additional_requests, remarks,
        check_in_date, check_out_date, id_upload, e_signature, archived_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, CURRENT_TIMESTAMP)`,
      [
        reservation.id,
        reservation.room_id,
        reservation.customer_name,
        reservation.customer_email,
        reservation.contact_number,
        reservation.address,
        reservation.nationality,
        reservation.additional_guests,
        reservation.additional_requests,
        reservation.remarks,
        reservation.check_in_date,
        reservation.check_out_date,
        reservation.id_upload,
        reservation.e_signature,
      ]
    );

    await client.query("UPDATE rooms SET status = $1 WHERE id = $2", [
      "Available",
      reservation.room_id,
    ]);

    await client.query("DELETE FROM reservations WHERE id = $1", [id]);

    await client.query("COMMIT");
    return NextResponse.json(
      { message: "Reservation archived successfully", reservationId: id },
      { status: 200 }
    );
  } catch (error) {
    if (client) await client.query("ROLLBACK");
    console.error("Error archiving reservation:", error);
    return NextResponse.json(
      { error: "Failed to archive reservation", details: error.message },
      { status: 500 }
    );
  } finally {
    if (client) client.release();
  }
}

export async function GET(request, { params }) {
  let client;
  try {
    const { id } = params;
    if (!id) return NextResponse.json({ error: 'Reservation ID is required' }, { status: 400 });

    client = await pool.connect();
    const resResult = await client.query('SELECT * FROM reservations WHERE id = $1', [id]);
    if (resResult.rowCount === 0) {
      return NextResponse.json({ error: 'Reservation not found' }, { status: 404 });
    }

    const r = resResult.rows[0];
    const reservation = {
      id: r.id,
      roomId: r.room_id,
      customerName: r.customer_name,
      customerEmail: r.customer_email,
      contactNumber: r.contact_number,
      address: r.address,
      nationality: r.nationality,
      additionalGuests: r.additional_guests,
      additionalRequests: r.additional_requests,
      remarks: r.remarks,
      checkInDate: r.check_in_date,
      checkOutDate: r.check_out_date,
      idUpload: r.id_upload,
      eSignature: r.e_signature,
      total_price: r.total_price !== undefined ? Number(r.total_price) : null,
      totalPrice: r.total_price !== undefined ? Number(r.total_price) : null,
    };

    return NextResponse.json(reservation, { status: 200 });
  } catch (error) {
    console.error('GET /api/reservation/[id] error:', error);
    return NextResponse.json({ error: 'Failed to fetch reservation', details: error.message }, { status: 500 });
  } finally {
    if (client) client.release();
  }
}