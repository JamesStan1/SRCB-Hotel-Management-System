import pool from "../../lib/db";

export async function GET() {
  try {
    const result = await pool.query(`
      SELECT r.id AS room_id, r.room_number, r.type, r.price,
        rs.customer_name AS "customerName",
        rs.customer_email AS "customerEmail",
        rs.check_in_date AS "checkInDate",
        rs.check_out_date AS "checkOutDate"
      FROM rooms r
      INNER JOIN reservations rs ON r.id = rs.room_id
      ORDER BY rs.check_in_date
    `);

    return Response.json(result.rows);
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
