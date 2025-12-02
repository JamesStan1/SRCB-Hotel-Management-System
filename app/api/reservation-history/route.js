// app/api/reservation-history/route.js
import { NextResponse } from 'next/server';
import pool from '../../lib/db';

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const customerName = searchParams.get('customer_name') || '';

    // Query room reservations (both active and historical)
    const roomQuery = `
      SELECT 
        r.id,
        r.customer_name,
        r.customer_email,
        r.contact_number,
        r.address,
        r.nationality,
        r.check_in_date,
        r.check_out_date,
        r.created_at,
        'room' as reservation_type
      FROM reservations r
      WHERE r.customer_name ILIKE $1 
         OR r.customer_email ILIKE $1 
         OR r.contact_number ILIKE $1
      
      UNION ALL
      
      SELECT 
        rh.id,
        rh.customer_name,
        rh.customer_email,
        rh.contact_number,
        rh.address,
        rh.nationality,
        rh.check_in_date,
        rh.check_out_date,
        rh.created_at,
        'room_history' as reservation_type
      FROM reservation_history rh
      WHERE rh.customer_name ILIKE $1 
         OR rh.customer_email ILIKE $1 
         OR rh.contact_number ILIKE $1
      
      ORDER BY check_in_date DESC
      LIMIT 50
    `;

    // Query event reservations
    const eventQuery = `
      SELECT 
        e.id,
        e.booked_by as customer_name,
        e.contact_number,
        e.date as event_date,
        e.created_at,
        'event' as reservation_type
      FROM events e
      WHERE e.booked_by ILIKE $1 
         OR e.contact_number ILIKE $1
      ORDER BY e.date DESC
      LIMIT 50
    `;

    const searchPattern = `%${customerName}%`;
    
    const [roomResult, eventResult] = await Promise.all([
      pool.query(roomQuery, [searchPattern]),
      pool.query(eventQuery, [searchPattern])
    ]);

    // Format the response to match expected structure
    const response = {
      roomReservations: roomResult.rows.map(row => ({
        id: row.id,
        customer_name: row.customer_name,
        customer_email: row.customer_email,
        contact_number: row.contact_number,
        address: row.address,
        nationality: row.nationality,
        check_in_date: row.check_in_date,
        check_out_date: row.check_out_date,
        created_at: row.created_at,
        reservation_type: row.reservation_type
      })),
      eventReservations: eventResult.rows.map(row => ({
        id: row.id,
        customer_name: row.customer_name,
        booked_by: row.customer_name,
        contact_number: row.contact_number,
        event_date: row.event_date,
        date: row.event_date,
        created_at: row.created_at,
        reservation_type: row.reservation_type
      }))
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error fetching reservation history:', error);
    return NextResponse.json({ 
      error: 'Failed to fetch history',
      details: error.message 
    }, { status: 500 });
  }
}

