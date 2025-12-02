import { NextResponse } from 'next/server';
import pool from '../../lib/db';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type'); // 'room' or 'event'

    if (type === 'room') {
      // Fetch approved room reservations from reservations table
      const result = await pool.query(`
        SELECT 
          r.id,
          r.room_id,
          r.customer_name,
          r.customer_email,
          r.contact_number,
          r.check_in_date,
          r.check_out_date,
          r.additional_guests,
          r.total_price,
          r.status,
          r.package_name,
          r.created_at,
          r.updated_at,
          rooms.room_number,
          rooms.type as room_type,
          rooms.price as room_price
        FROM reservations r
        LEFT JOIN rooms ON r.room_id = rooms.id
        ORDER BY r.created_at DESC
      `);

      return NextResponse.json({
        success: true,
        reservations: result.rows
      }, { status: 200 });

    } else if (type === 'event') {
      // Fetch approved event reservations from events table
      const result = await pool.query(`
        SELECT 
          id,
          name as event_name,
          type as event_type,
          date as event_date,
          allotted_time,
          guests,
          booked_by as customer_name,
          supervisor,
          status,
          additional_requests,
          additional_guests,
          remarks,
          total_cost,
          menu,
          dishes,
          set as package_name,
          event_package_id,
          created_at,
          updated_at
        FROM events
        ORDER BY created_at DESC
      `);

      return NextResponse.json({
        success: true,
        reservations: result.rows
      }, { status: 200 });

    } else {
      return NextResponse.json({
        error: 'Type parameter is required. Must be "room" or "event"'
      }, { status: 400 });
    }

  } catch (error) {
    console.error('Error fetching approved reservations:', error);
    return NextResponse.json({
      error: 'Failed to fetch approved reservations',
      details: error.message
    }, { status: 500 });
  }
}
