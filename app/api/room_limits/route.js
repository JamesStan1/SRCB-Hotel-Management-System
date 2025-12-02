import pool from "../../lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const result = await pool.query("SELECT id, room_type, max_count FROM room_limits ORDER BY room_type");
    return NextResponse.json(result.rows || [], { status: 200 });
  } catch (error) {
    console.error("GET /api/room_limits error:", error);
    return NextResponse.json({ error: "Failed to fetch room limits" }, { status: 500 });
  }
}
