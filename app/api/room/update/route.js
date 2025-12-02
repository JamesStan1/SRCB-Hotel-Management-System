import pool from "../../../lib/db";
import { NextResponse } from "next/server";
import { requireRole, Permissions } from "../../../lib/rbac";

// POST /api/room/update - Update an existing room (simpler alternative to PUT /api/room/:id)
export async function POST(request) {
  let client;
  try {
    // Authorization
    const auth = await requireRole(request, Permissions.RoomManagement, "manage");
    if (!auth.allowed) {
      return NextResponse.json({ error: auth.message || "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
  const { id, room_number, type, price, status, packageId, roomLimitId } = body;

    if (!id) return NextResponse.json({ error: "Room id is required" }, { status: 400 });

    client = await pool.connect();
    await client.query("BEGIN");

    // If full room update fields are provided, validate them
    if (room_number || type || price !== undefined || packageId !== undefined) {
      if (!room_number || !type || price === undefined || price < 0) {
        await client.query("ROLLBACK");
        return NextResponse.json({ error: "Room number, type, and non-negative price are required for full updates" }, { status: 400 });
      }
      if (!packageId) {
        await client.query("ROLLBACK");
        return NextResponse.json({ error: "Package ID is required for room updates" }, { status: 400 });
      }

      // Check duplicate room_number
      const dup = await client.query("SELECT id FROM rooms WHERE room_number = $1 AND id != $2", [room_number, id]);
      if (dup.rows.length > 0) {
        await client.query("ROLLBACK");
        return NextResponse.json({ error: "Room number already exists" }, { status: 400 });
      }

      // Validate package
      const pkg = await client.query("SELECT id FROM packages WHERE id = $1", [packageId]);
      if (pkg.rows.length === 0) {
        await client.query("ROLLBACK");
        return NextResponse.json({ error: "Invalid package ID" }, { status: 400 });
      }

      // Validate roomLimitId (optional) and enforce max_count
      if (roomLimitId !== undefined && roomLimitId !== null) {
        const rl = await client.query("SELECT id, max_count FROM room_limits WHERE id = $1", [roomLimitId]);
        if (rl.rows.length === 0) {
          await client.query("ROLLBACK");
          return NextResponse.json({ error: "Invalid roomLimitId" }, { status: 400 });
        }
        const maxCount = rl.rows[0].max_count;
        const existingCountRes = await client.query("SELECT COUNT(*) FROM rooms WHERE room_limit_id = $1 AND id != $2", [roomLimitId, id]);
        const existingCount = parseInt(existingCountRes.rows[0].count, 10) || 0;
        if (existingCount >= maxCount) {
          await client.query("ROLLBACK");
          return NextResponse.json({ error: "Room limit reached for the selected room limit" }, { status: 400 });
        }
      }

      await client.query(
        `UPDATE rooms SET room_number = $1, type = $2, price = $3, status = $4, package_id = $5, room_limit_id = $6 WHERE id = $7`,
        [room_number, type, parseFloat(price), status || "Available", packageId, roomLimitId || null, id]
      );
    } else if (status) {
      // Allow status-only update
      await client.query(`UPDATE rooms SET status = $1 WHERE id = $2`, [status, id]);
    } else {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "No update fields provided" }, { status: 400 });
    }

    await client.query("COMMIT");

    const updated = await pool.query(`SELECT id, room_number, type, price, status, package_id AS "packageId" FROM rooms WHERE id = $1`, [id]);
    return NextResponse.json({ room: updated.rows[0] }, { status: 200 });
  } catch (error) {
    if (client) await client.query("ROLLBACK");
    console.error("POST /api/room/update error:", error);
    return NextResponse.json({ error: "Failed to update room", details: error.message }, { status: 500 });
  } finally {
    if (client) client.release();
  }
}
