import { NextResponse } from "next/server";
import pool from "../../../lib/db";
import { requireManagerApproval } from '../../../lib/adminApproval';

export async function GET() {
  let client;
  try {
    client = await pool.connect();
    const result = await client.query(
      "SELECT id, original_id, room_number, type, price, status, package_id, archived_at FROM archive_rooms ORDER BY archived_at DESC"
    );
    return NextResponse.json(result.rows, { status: 200 });
  } catch (error) {
    console.error("Error fetching archived rooms:", error);
    return NextResponse.json(
      { error: "Failed to fetch archived rooms", details: error.message, code: "DB_QUERY_ERROR" },
      { status: 500 }
    );
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
    if (!itemId || !action) {
      return NextResponse.json(
        { error: "Missing itemId or action", code: "INVALID_REQUEST" },
        { status: 400 }
      );
    }

    if (action !== "restore") {
      return NextResponse.json(
        { error: "Invalid action. Only 'restore' is supported", code: "INVALID_ACTION" },
        { status: 400 }
      );
    }

    client = await pool.connect();
    await client.query("BEGIN");

    const archiveRes = await client.query(
      "SELECT id, original_id, room_number, type, price, status, package_id, archived_at FROM archive_rooms WHERE id = $1",
      [itemId]
    );
    if (archiveRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return NextResponse.json(
        { error: "Archived room not found", code: "NOT_FOUND" },
        { status: 404 }
      );
    }

    const archived = archiveRes.rows[0];
    await client.query(
      `INSERT INTO rooms (id, room_number, type, price, status, package_id)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        archived.original_id,
        archived.room_number,
        archived.type,
        archived.price,
        archived.status,
        archived.package_id,
      ]
    );
    await client.query("DELETE FROM archive_rooms WHERE id = $1", [itemId]);
    await client.query("COMMIT");
    return NextResponse.json(
      { message: "Room restored successfully", roomId: itemId },
      { status: 200 }
    );
  } catch (error) {
    if (client) await client.query("ROLLBACK");
    console.error("Error processing restore request:", error);
    return NextResponse.json(
      { error: "Failed to restore room", details: error.message, code: "DB_OPERATION_ERROR" },
      { status: 500 }
    );
  } finally {
    if (client) client.release();
  }
}

export async function DELETE(request) {
  let client;
  try {
  const bodyDel = await request.json();
  const approvalDel = await requireManagerApproval(request, bodyDel);
  if (!approvalDel.allowed) return NextResponse.json({ error: approvalDel.message || 'Unauthorized' }, { status: 401 });

  const { itemId } = bodyDel;
    if (!itemId) {
      return NextResponse.json(
        { error: "Missing itemId", code: "INVALID_REQUEST" },
        { status: 400 }
      );
    }

    client = await pool.connect();
    const result = await client.query(
      "DELETE FROM archive_rooms WHERE id = $1 RETURNING id, room_number",
      [itemId]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: "Archived room not found", code: "NOT_FOUND" },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        message: "Room permanently deleted successfully",
        deletedRoom: { id: result.rows[0].id, room_number: result.rows[0].room_number },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error deleting archived room:", error);
    return NextResponse.json(
      { error: "Failed to delete archived room", details: error.message, code: "DB_OPERATION_ERROR" },
      { status: 500 }
    );
  } finally {
    if (client) client.release();
  }
}
