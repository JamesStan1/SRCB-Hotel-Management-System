import pool from "../../../lib/db";
import { NextResponse } from "next/server";

export async function GET(request, context) {
  const params = await context.params;
  const { id } = params;
  const roomId = Number(id); // Convert id to number

  // Validate roomId
  if (!id || isNaN(roomId)) {
    console.error("Invalid or missing roomId in GET request:", { params, id });
    return NextResponse.json({ error: "Invalid or missing roomId" }, { status: 400 });
  }

  try {
    const result = await pool.query(
      "SELECT h.room_id, h.status, h.notes, h.updated_at, r.room_number FROM housekeeping h JOIN rooms r ON h.room_id = r.id WHERE h.room_id = $1",
      [roomId]
    );
    if (result.rows.length === 0) {
      return NextResponse.json({ error: `Housekeeping record not found for room ID ${roomId}` }, { status: 404 });
    }
    return NextResponse.json(result.rows[0], { status: 200 });
  } catch (error) {
    console.error("GET /api/housekeeping/[roomId] error:", {
      message: error.message,
      stack: error.stack,
      roomId,
    });
    return NextResponse.json(
      { error: "Failed to fetch housekeeping record", details: error.message },
      { status: 500 }
    );
  }
}

export async function POST(request, context) {
  const params = await context.params;
  console.log("Received params in POST:", params); // Debug params
  const { id } = params;
  const roomId = Number(id); // Convert id to number
  const { status, notes } = await request.json();

  // Validate roomId
  if (!id || isNaN(roomId)) {
    console.error("Invalid or missing roomId in POST request:", { params, id });
    return NextResponse.json({ error: "Invalid or missing roomId" }, { status: 400 });
  }

  let client;

  try {
    if (!status) {
      return NextResponse.json({ error: "Status is required" }, { status: 400 });
    }

    client = await pool.connect();
    await client.query("BEGIN");

    const roomResult = await client.query("SELECT id, room_number FROM rooms WHERE id = $1", [roomId]);
    console.log("Room query result for ID", roomId, ":", roomResult.rows);
    if (roomResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return NextResponse.json(
        { error: `Room with ID ${roomId} not found in rooms table` },
        { status: 404 }
      );
    }

    const room = roomResult.rows[0];

    const existingHousekeeping = await client.query(
      "SELECT * FROM housekeeping WHERE room_id = $1",
      [roomId]
    );
    console.log("Existing housekeeping record for room ID", roomId, ":", existingHousekeeping.rows);

    if (existingHousekeeping.rows.length > 0) {
      await client.query(
        "UPDATE housekeeping SET status = $1, notes = $2, updated_at = CURRENT_TIMESTAMP WHERE room_id = $3",
        [status, notes || "", roomId]
      );
    } else {
      await client.query(
        "INSERT INTO housekeeping (room_id, status, notes) VALUES ($1, $2, $3)",
        [roomId, status, notes || ""]
      );
    }

    if (status === "pending" || status === "dirty" || status === "required") {
      const existingNotification = await client.query(
        "SELECT * FROM notifications WHERE room_id = $1 AND target_role = $2 AND status = $3",
        [roomId, "Housekeeping", "scheduled"]
      );
      if (existingNotification.rows.length === 0) {
        const housekeepingMessage = `Room ${room.room_number} requires housekeeping.`;
        await client.query(
          `INSERT INTO notifications (room_id, reservation_id, message, target_role, scheduled_time, status, created_at)
           VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, $5, CURRENT_TIMESTAMP)`,
          [roomId, null, housekeepingMessage, "Housekeeping", "scheduled"]
        );
      }
    } else if (status === "completed") {
      await client.query(
        "UPDATE rooms SET status = $1 WHERE id = $2",
        ["Available", roomId]
      );
      await client.query(
        "UPDATE notifications SET status = $1 WHERE room_id = $2 AND target_role = $3",
        ["read", roomId, "Housekeeping"]
      );

      const managerMessage = `Room ${room.room_number} is now ready for reservation.`;
      await client.query(
        `INSERT INTO notifications (room_id, reservation_id, message, target_role, scheduled_time, status, created_at)
         VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, $5, CURRENT_TIMESTAMP)`,
        [roomId, null, managerMessage, "Manager", "scheduled"]
      );

      const frontdeskMessage = `Room ${room.room_number} is now ready for reservation.`;
      await client.query(
        `INSERT INTO notifications (room_id, reservation_id, message, target_role, scheduled_time, status, created_at)
         VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, $5, CURRENT_TIMESTAMP)`,
        [roomId, null, frontdeskMessage, "Frontdesk", "scheduled"]
      );
    }

    await client.query("COMMIT");
    return NextResponse.json({ message: "Housekeeping updated successfully" }, { status: 200 });
  } catch (error) {
    if (client) await client.query("ROLLBACK");
    console.error("POST /api/housekeeping/[roomId] error:", {
      message: error.message,
      stack: error.stack,
      roomId,
      status,
      notes,
    });
    return NextResponse.json(
      { error: "Failed to update housekeeping record", details: error.message },
      { status: 500 }
    );
  } finally {
    if (client) client.release();
  }
}