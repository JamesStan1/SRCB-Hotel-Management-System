import pool from "../../../lib/db";
import { NextResponse } from "next/server";
import { requireRole, Permissions } from "../../../lib/rbac";

// PUT /api/room/:id - Update room details or reservation
export async function PUT(request, context) {
  const { params } = context;
  const { id } = await params; // Await params to access id
  try {
    const auth = requireRole(request, Permissions.RoomManagement, 'manage');
    if (!auth.allowed) {
      return NextResponse.json({ error: auth.message || 'Forbidden' }, { status: 403 });
    }
    const body = await request.json();
    console.log("PUT /api/room/[id] request body:", body); // Debug log
    const { room_number, type, price, status, packageId, reservation } = body;

    await pool.query("BEGIN");

    // Handle room update
    if (room_number || type || price !== undefined || status || packageId !== undefined) {
      // If only status is provided, allow partial update
      if (status && !room_number && !type && price === undefined && !packageId) {
        await pool.query(
          `
          UPDATE rooms
          SET status = $1
          WHERE id = $2
          `,
          [status, id]
        );
      } else {
        // Full update with all required fields
        if (!room_number || !type || price === undefined || price < 0) {
          await pool.query("ROLLBACK");
          return NextResponse.json(
            { error: "Room number, type, and non-negative price are required for room updates" },
            { status: 400 }
          );
        }
        if (!packageId) {
          await pool.query("ROLLBACK");
          return NextResponse.json(
            { error: "Package ID is required for room updates" },
            { status: 400 }
          );
        }

        // Check for duplicate room_number
        const duplicateCheck = await pool.query(
          "SELECT id FROM rooms WHERE room_number = $1 AND id != $2",
          [room_number, id]
        );
        if (duplicateCheck.rows.length > 0) {
          await pool.query("ROLLBACK");
          return NextResponse.json(
            { error: "Room number already exists" },
            { status: 400 }
          );
        }

        // Validate packageId
        const packageCheck = await pool.query(
          "SELECT id FROM packages WHERE id = $1",
          [packageId]
        );
        if (packageCheck.rows.length === 0) {
          await pool.query("ROLLBACK");
          return NextResponse.json(
            { error: "Invalid package ID" },
            { status: 400 }
          );
        }

        // Update room with all fields
        await pool.query(
          `
          UPDATE rooms
          SET room_number = $1, type = $2, price = $3, status = $4, package_id = $5
          WHERE id = $6
          `,
          [
            room_number,
            type,
            parseFloat(price),
            status || "Available",
            packageId,
            id,
          ]
        );
      }
    }

    // Check for duplicate reservation
    if (reservation) {
      const existingReservation = await pool.query(
        `SELECT id FROM reservations 
         WHERE customer_name = $1 
         AND customer_email = $2 
         AND contact_number = $3
         AND room_id != $4`,
        [
          reservation.customerName,
          reservation.customerEmail,
          reservation.contactNumber,
          id,
        ]
      );

      if (existingReservation.rows.length > 0) {
        await pool.query("ROLLBACK");
        return NextResponse.json(
          { error: "A reservation already exists for this customer" },
          { status: 400 }
        );
      }
    }

    let reservationResult;
    if (reservation) {
      const existingRes = await pool.query(
        `SELECT id FROM reservations WHERE room_id = $1`,
        [id]
      );

      if (existingRes.rows.length > 0) {
        // Update existing reservation
          const computeNights = (startRaw, endRaw) => {
            if (!startRaw || !endRaw) return 1;
            const s = new Date(startRaw);
            const e = new Date(endRaw);
            if (isNaN(s.getTime()) || isNaN(e.getTime())) return 1;
            const toMid = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
            const diff = Math.round((toMid(e) - toMid(s)) / (1000 * 60 * 60 * 24));
            return diff > 0 ? diff : 1;
          };
          const nights = computeNights(reservation.checkInDate, reservation.checkOutDate);
          const roomPriceRes = await pool.query('SELECT price FROM rooms WHERE id = $1', [id]);
          const perNight = roomPriceRes.rows[0] ? Number(roomPriceRes.rows[0].price || 0) : 0;
          const totalPrice = (nights * perNight) - perNight;

          reservationResult = await pool.query(
            `UPDATE reservations SET
              customer_name = $1,
              customer_email = $2,
              contact_number = $3,
              address = $4,
              nationality = $5,
              additional_guests = $6,
              additional_requests = $7,
              remarks = $8,
              check_in_date = $9,
              check_out_date = $10,
              id_upload = $11,
              e_signature = $12,
              total_price = $13
            WHERE room_id = $14
            RETURNING *`,
            [
              reservation.customerName,
              reservation.customerEmail,
              reservation.contactNumber,
              reservation.address || "",
              reservation.nationality || "",
              reservation.additionalGuests || 0,
              reservation.additionalRequests || "",
              reservation.remarks || "",
              reservation.checkInDate,
              reservation.checkOutDate,
              reservation.idUpload || null,
              reservation.eSignature || null,
              totalPrice,
              id,
            ]
          );
      } else {
        // Insert new reservation
          const computeNights = (startRaw, endRaw) => {
            if (!startRaw || !endRaw) return 1;
            const s = new Date(startRaw);
            const e = new Date(endRaw);
            if (isNaN(s.getTime()) || isNaN(e.getTime())) return 1;
            const toMid = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
            const diff = Math.round((toMid(e) - toMid(s)) / (1000 * 60 * 60 * 24));
            return diff > 0 ? diff : 1;
          };
          const nights = computeNights(reservation.checkInDate, reservation.checkOutDate);
          const roomPriceRes = await pool.query('SELECT price FROM rooms WHERE id = $1', [id]);
          const perNight = roomPriceRes.rows[0] ? Number(roomPriceRes.rows[0].price || 0) : 0;
          const totalPrice = (nights * perNight) - perNight;

          reservationResult = await pool.query(
            `INSERT INTO reservations (
              room_id, customer_name, customer_email, contact_number,
              address, nationality, additional_guests, additional_requests,
              remarks, check_in_date, check_out_date, id_upload, e_signature, total_price
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) 
            RETURNING *`,
            [
              id,
              reservation.customerName,
              reservation.customerEmail,
              reservation.contactNumber,
              reservation.address || "",
              reservation.nationality || "",
              reservation.additionalGuests || 0,
              reservation.additionalRequests || "",
              reservation.remarks || "",
              reservation.checkInDate,
              reservation.checkOutDate,
              reservation.idUpload || null,
              reservation.eSignature || null,
              totalPrice,
            ]
          );
      }
    }

    // Fetch updated room for response
    const updatedRoom = await pool.query(
      `
      SELECT id, room_number, type, price, status, package_id AS packageId
      FROM rooms WHERE id = $1
      `,
      [id]
    );

    await pool.query("COMMIT");

    return NextResponse.json(
      {
        message: "Room and/or reservation updated successfully",
        room: updatedRoom.rows[0],
        reservation: reservationResult?.rows[0]
          ? {
              ...reservationResult.rows[0],
              idUpload: reservationResult.rows[0].id_upload,
              eSignature: reservationResult.rows[0].e_signature,
            }
          : null,
      },
      { status: 200 }
    );
  } catch (error) {
    await pool.query("ROLLBACK");
    console.error("PUT /api/room/[id] error:", error);
    return NextResponse.json(
      { error: "Error updating room or reservation", details: error.message },
      { status: 500 }
    );
  }
}

// DELETE /api/room/:id - Archive room
export async function DELETE(request, context) {
  const { params } = context;
  const { id } = await params; // Await params to access id
  let client;
  try {
    const auth = requireRole(request, Permissions.RoomManagement, 'manage');
    if (!auth.allowed) {
      return NextResponse.json({ error: auth.message || 'Forbidden' }, { status: 403 });
    }
    client = await pool.connect();
    await client.query("BEGIN");

    // Check for active reservations
    const resCheck = await pool.query(
      "SELECT * FROM reservations WHERE room_id = $1",
      [id]
    );
    if (resCheck.rows.length > 0) {
      await client.query("ROLLBACK");
      return NextResponse.json(
        { error: "Cannot archive room with active reservations" },
        { status: 400 }
      );
    }

    // Fetch the room to archive
    const roomResult = await client.query("SELECT * FROM rooms WHERE id = $1", [
      id,
    ]);
    if (roomResult.rowCount === 0) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    }

    const room = roomResult.rows[0];

    // Insert into archive_rooms
    await client.query(
      `
      INSERT INTO archive_rooms (original_id, room_number, type, price, status, package_id)
      VALUES ($1, $2, $3, $4, $5, $6)
    `,
      [room.id, room.room_number, room.type, room.price, room.status, room.package_id]
    );

    // Delete from rooms
    await client.query("DELETE FROM rooms WHERE id = $1", [id]);

    await client.query("COMMIT");
    return NextResponse.json(
      { message: "Room archived successfully" },
      { status: 200 }
    );
  } catch (error) {
    if (client) await pool.query("ROLLBACK");
    console.error("Error archiving room:", error);
    return NextResponse.json(
      { error: "Failed to archive room", details: error.message },
      { status: 500 }
    );
  } finally {
    if (client) client.release();
  }
}

// GET /api/room/:id - fetch a single room
export async function GET(request, context) {
  const { params } = context;
  const { id } = await params;
  try {
    const auth = requireRole(request, Permissions.RoomManagement, 'view');
    if (!auth.allowed) {
      return NextResponse.json({ error: auth.message || 'Unauthorized' }, { status: 401 });
    }

    const result = await pool.query(`
      SELECT r.*, p.name AS package_name, p.price AS package_price, p.guests AS package_guests, p.image AS package_image, p.description AS package_description,
      res.id AS reservation_id, res.customer_name, res.customer_email, res.contact_number, res.address, res.nationality, res.additional_guests, res.additional_requests, res.remarks, res.check_in_date, res.check_out_date
      FROM rooms r
      LEFT JOIN packages p ON r.package_id = p.id
      LEFT JOIN reservations res ON res.room_id = r.id
      WHERE r.id = $1
    `, [id]);

    if (result.rowCount === 0) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 });
    }

    const row = result.rows[0];
    const room = {
      id: row.id,
      room_number: row.room_number,
      type: row.type,
      price: row.price,
      status: row.status,
      package_id: row.package_id,
      packageId: row.package_id,
      package: {
        name: row.package_name,
        price: row.package_price,
        guests: row.package_guests,
        image: row.package_image,
        description: row.package_description,
      },
      reservation: row.reservation_id
        ? {
            id: row.reservation_id,
            customerName: row.customer_name,
            customerEmail: row.customer_email,
            contactNumber: row.contact_number,
            address: row.address,
            nationality: row.nationality,
            additionalGuests: row.additional_guests,
            additionalRequests: row.additional_requests,
            remarks: row.remarks,
            checkInDate: row.check_in_date,
            checkOutDate: row.check_out_date,
              totalPrice: row.total_price !== undefined ? Number(row.total_price) : undefined,
          }
        : null,
    };

    return NextResponse.json(room, { status: 200 });
  } catch (error) {
    console.error('GET /api/room/[id] error:', error);
    return NextResponse.json({ error: 'Internal Server Error', details: error.message }, { status: 500 });
  }
}