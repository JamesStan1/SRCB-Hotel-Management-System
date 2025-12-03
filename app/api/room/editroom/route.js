import pool from "../../../lib/db";
import { NextResponse } from "next/server";

// POST /api/room/editroom - Create a new room
export async function POST(request) {
  try {
    const body = await request.json();
    console.log("POST /api/room/editroom request body:", body); // Debug log
  const { room_number, type, price, status, packageId, roomLimitId } = body;

    // Validate required fields
    if (!room_number || !type || price === undefined || price < 0) {
      return NextResponse.json(
        { error: "Room number, type, and non-negative price are required" },
        { status: 400 }
      );
    }
    if (!packageId) {
      return NextResponse.json(
        { error: "Package ID is required" },
        { status: 400 }
      );
    }

    const client = await pool.connect();
    try {
      // Check for duplicate room_number
      const duplicateCheck = await client.query(
        "SELECT id FROM rooms WHERE room_number = $1",
        [room_number]
      );
      if (duplicateCheck.rows.length > 0) {
        client.release();
        return NextResponse.json(
          { error: "Room number already exists" },
          { status: 400 }
        );
      }

      // Validate packageId
      const packageCheck = await client.query(
        "SELECT id FROM packages WHERE id = $1",
        [packageId]
      );
      if (packageCheck.rows.length === 0) {
        client.release();
        return NextResponse.json(
          { error: "Invalid package ID" },
          { status: 400 }
        );
      }

      // Validate roomLimitId (optional) and enforce max_count
      if (roomLimitId !== undefined && roomLimitId !== null) {
        const rl = await client.query("SELECT id, max_count FROM room_limits WHERE id = $1", [roomLimitId]);
        if (rl.rows.length === 0) {
          client.release();
          return NextResponse.json({ error: "Invalid roomLimitId" }, { status: 400 });
        }
        const maxCount = rl.rows[0].max_count;
        const existingCountRes = await client.query("SELECT COUNT(*) FROM rooms WHERE room_limit_id = $1", [roomLimitId]);
        const existingCount = parseInt(existingCountRes.rows[0].count, 10) || 0;
        if (existingCount >= maxCount) {
          client.release();
          return NextResponse.json({ error: "Room limit reached for the selected room limit" }, { status: 400 });
        }
      }

      // Insert new room
      const result = await client.query(
        `
        INSERT INTO rooms (room_number, type, price, status, package_id, room_limit_id)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id, room_number, type, price, status, package_id AS packageId, room_limit_id AS "roomLimitId"
      `,
        [
          room_number,
          type,
          parseFloat(price),
          status || "Available",
          packageId,
          roomLimitId || null,
        ]
      );

      client.release();
      return NextResponse.json(result.rows[0], { status: 201 });
    } catch (error) {
      client.release();
      if (error.code === "23503") {
        return NextResponse.json(
          { error: "Invalid package ID" },
          { status: 400 }
        );
      }
      throw error;
    }
  } catch (error) {
    console.error("Error creating room:", error);
    return NextResponse.json(
      { error: "Failed to create room", details: error.message },
      { status: 500 }
    );
  }
}
