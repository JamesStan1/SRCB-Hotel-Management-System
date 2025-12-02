import pool from "../../../lib/db";
import { stringify } from 'csv-stringify/sync';
import { requireManagerApproval } from '../../../lib/adminApproval';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const month = searchParams.get('month'); // Format: YYYY-MM
  // Require manager/admin approval via Bearer token or qr query param
  const qr = searchParams.get('qr') || null;
  const approval = await requireManagerApproval(request, { qrCode: qr });
  if (!approval.allowed) return new Response(JSON.stringify({ error: approval.message || 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });

  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return new Response(JSON.stringify({ error: 'Invalid or missing month parameter' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const [year, monthNum] = month.split('-').map(Number);
    const startDate = new Date(Date.UTC(year, monthNum - 1, 1, 0, 0, 0));
    const endDate = new Date(Date.UTC(year, monthNum, 0, 23, 59, 59, 999));

    console.log('Querying data for:', { startDate, endDate });

    // Fetch reservations
    const reservationsQuery = `
      SELECT 
        res.id AS reservation_id, res.room_id, r.room_number, r.type, r.price, r.status, r.package_id,
        res.customer_name, res.customer_email, res.contact_number, res.address, res.nationality,
        res.additional_guests, res.additional_requests, res.remarks, res.check_in_date,
        res.check_out_date, res.created_at, res.id_upload, res.e_signature
      FROM reservations res
      INNER JOIN rooms r ON res.room_id = r.id
      WHERE res.check_in_date >= $1 AND res.check_in_date <= $2
    `;
    const reservationsResult = await pool.query(reservationsQuery, [startDate, endDate]);

    // Fetch events
    const eventsQuery = `
      SELECT 
        e.id, e.name, e.type, e.date, e.allotted_time, e.guests, e.booked_by,
        e.supervisor, e.status, e.additional_requests, e.additional_guests,
        e.remarks, e.total_cost, e.menu, e.created_at, e.updated_at,
        e.customer_id_url, e.e_signature, e.dishes, e.set
      FROM events e
      WHERE e.date >= $1 AND e.date <= $2
    `;
    const eventsResult = await pool.query(eventsQuery, [startDate, endDate]);

    console.log('Reservations data:', reservationsResult.rows);
    console.log('Events data:', eventsResult.rows);

    if (reservationsResult.rows.length === 0 && eventsResult.rows.length === 0) {
      return new Response(JSON.stringify({ message: 'No data found for the specified month' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Define columns for reservations CSV
    const reservationColumns = [
      { key: 'reservation_id', header: 'Reservation ID' },
      { key: 'room_id', header: 'Room ID' },
      { key: 'room_number', header: 'Room Number' },
      { key: 'type', header: 'Room Type' },
      { key: 'price', header: 'Price' },
      { key: 'status', header: 'Room Status' },
      { key: 'package_id', header: 'Package ID' },
      { key: 'customer_name', header: 'Customer Name' },
      { key: 'customer_email', header: 'Customer Email' },
      { key: 'contact_number', header: 'Contact Number' },
      { key: 'address', header: 'Address' },
      { key: 'nationality', header: 'Nationality' },
      { key: 'additional_guests', header: 'Additional Guests' },
      { key: 'additional_requests', header: 'Additional Requests' },
      { key: 'remarks', header: 'Remarks' },
      { key: 'check_in_date', header: 'Check In Date' },
      { key: 'check_out_date', header: 'Check Out Date' },
      { key: 'created_at', header: 'Created At' },
      { key: 'id_upload', header: 'ID Upload' },
      { key: 'e_signature', header: 'E-Signature' },
    ];

    const reservationsCSV = reservationsResult.rows.length > 0
      ? stringify(
          reservationsResult.rows.map(row => ({
            reservation_id: row.reservation_id ?? '',
            room_id: row.room_id ?? '',
            room_number: row.room_number ?? '',
            type: row.type ?? '',
            price: row.price ?? '',
            status: row.status ?? '',
            package_id: row.package_id ?? '',
            customer_name: row.customer_name ?? '',
            customer_email: row.customer_email ?? '',
            contact_number: row.contact_number ?? '',
            address: row.address ?? '',
            nationality: row.nationality ?? '',
            additional_guests: row.additional_guests ?? 0,
            additional_requests: row.additional_requests ?? '',
            remarks: row.remarks ?? '',
            check_in_date: row.check_in_date ? row.check_in_date.toISOString() : '',
            check_out_date: row.check_out_date ? row.check_out_date.toISOString() : '',
            created_at: row.created_at ? row.created_at.toISOString() : '',
            id_upload: row.id_upload ?? '',
            e_signature: row.e_signature ?? '',
          })),
          { header: true, columns: reservationColumns, quoted_string: true }
        )
      : '';

    // Define columns for events CSV
    const eventColumns = [
      { key: 'id', header: 'Event ID' },
      { key: 'name', header: 'Name' },
      { key: 'type', header: 'Type' },
      { key: 'date', header: 'Date' },
      { key: 'allotted_time', header: 'Allotted Time' },
      { key: 'guests', header: 'Guests' },
      { key: 'booked_by', header: 'Booked By' },
      { key: 'supervisor', header: 'Supervisor' },
      { key: 'status', header: 'Status' },
      { key: 'additional_requests', header: 'Additional Requests' },
      { key: 'additional_guests', header: 'Additional Guests' },
      { key: 'remarks', header: 'Remarks' },
      { key: 'total_cost', header: 'Total Cost' },
      { key: 'menu', header: 'Menu' },
      { key: 'created_at', header: 'Created At' },
      { key: 'updated_at', header: 'Updated At' },
      { key: 'customer_id_url', header: 'Customer ID URL' },
      { key: 'e_signature', header: 'E-Signature' },
      { key: 'dishes', header: 'Dishes' },
      { key: 'set', header: 'Set' },
    ];

    const eventsCSV = eventsResult.rows.length > 0
      ? stringify(
          eventsResult.rows.map(row => ({
            id: row.id ?? '',
            name: row.name ?? '',
            type: row.type ?? '',
            date: row.date ? row.date.toISOString() : '',
            allotted_time: row.allotted_time ?? '',
            guests: row.guests ?? 0,
            booked_by: row.booked_by ?? '',
            supervisor: row.supervisor ?? '',
            status: row.status ?? '',
            additional_requests: row.additional_requests ?? '',
            additional_guests: row.additional_guests ?? 0,
            remarks: row.remarks ?? '',
            total_cost: row.total_cost ?? '',
            menu: row.menu ?? '',
            created_at: row.created_at ? row.created_at.toISOString() : '',
            updated_at: row.updated_at ? row.updated_at.toISOString() : '',
            customer_id_url: row.customer_id_url ?? '',
            e_signature: row.e_signature ?? '',
            dishes: row.dishes ? JSON.stringify(row.dishes) : '',
            set: row.set ?? '',
          })),
          { header: true, columns: eventColumns, quoted_string: true }
        )
      : '';

    const combinedCSV = [
      reservationsCSV ? 'Reservations:\n' + reservationsCSV : 'No reservation data available\n',
      '\n',
      eventsCSV ? 'Events:\n' + eventsCSV : 'No event data available\n',
    ].join('');

    return new Response(combinedCSV, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="reservation_event_data_${month}.csv"`,
      },
    });
  } catch (error) {
    console.error('Error downloading data:', error.message, error.stack);
    return new Response(JSON.stringify({ error: 'Failed to download data', details: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
