import { NextResponse } from "next/server";
import pool from "../../lib/db";

export async function GET(req) {
    try {
        const { searchParams } = new URL(req.url);
        const userId = searchParams.get("user_id");

        if (!userId) {
            return NextResponse.json({ error: "Missing user_id" }, { status: 400 });
        }

        // fetch carts
        const result = await pool.query("SELECT * FROM carts WHERE user_id = $1 ORDER BY id ASC", [userId]);

        // check if Default Cart exists
        const defaultCart = result.rows.find(c => c.name === "Default Cart");

        if (!defaultCart) {
            const insert = await pool.query(
                `INSERT INTO carts (user_id, name, customer_name, items)
         VALUES ($1, $2, $3, $4) RETURNING *`,
                [userId, "Default Cart", "Guest", JSON.stringify([])]
            );
            return NextResponse.json([insert.rows[0], ...result.rows]);
        }

        return NextResponse.json(result.rows);
    } catch (err) {
        console.error("GET /api/carts error:", err);
        return NextResponse.json({ error: "Failed to fetch carts" }, { status: 500 });
    }
}



// ✅ Create or update a cart
export async function POST(req) {
    try {
        const { user_id, name, customer_name, items } = await req.json();

        const result = await pool.query(
            `INSERT INTO carts (user_id, name, customer_name, items, updated_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (user_id, name)
       DO UPDATE SET customer_name = EXCLUDED.customer_name,
                     items = EXCLUDED.items,
                     updated_at = NOW()
       RETURNING *`,
            [user_id, name, customer_name, JSON.stringify(items)]
        );

        return NextResponse.json(result.rows[0]);
    } catch (err) {
        console.error("POST /api/carts error:", err);
        return NextResponse.json({ error: "Failed to save cart" }, { status: 500 });
    }
}

// ✅ Delete a cart by id
export async function DELETE(req) {
    try {
        const { searchParams } = new URL(req.url);
        const id = searchParams.get("id");

        await pool.query("DELETE FROM carts WHERE id = $1", [id]);
        return NextResponse.json({ success: true });
    } catch (err) {
        console.error("DELETE /api/carts error:", err);
        return NextResponse.json({ error: "Failed to delete cart" }, { status: 500 });
    }
}
