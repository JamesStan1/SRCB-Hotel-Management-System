import { NextResponse } from 'next/server';
import pool from '../../lib/db';

export async function GET(request) {
  const url = new URL(request.url);
  const role = url.searchParams.get('role');

  if (!role) {
    return NextResponse.json({ error: 'Role parameter is required' }, { status: 400 });
  }

  const client = await pool.connect();

  try {
    // Fetch regular notifications
    const notificationsResult = await client.query(
      'SELECT * FROM public.notifications WHERE target_role = $1 AND status = $2 ORDER BY created_at DESC',
      [role, 'scheduled']
    );

    let notifications = notificationsResult.rows;

    // If the role is manager or admin, also fetch pending reservations
    const isManagerOrAdmin = role.toLowerCase() === 'manager' || role.toLowerCase() === 'admin';
    
    if (isManagerOrAdmin) {
      const pendingReservationsResult = await client.query(
        `SELECT 
          pr.*,
          r.room_number,
          r.type as room_type
        FROM pending_reservations pr
        LEFT JOIN rooms r ON pr.room_id = r.id
        WHERE pr.status = 'pending'
        ORDER BY pr.created_at DESC`
      );

      // Transform pending reservations into notification format
      const pendingNotifications = pendingReservationsResult.rows.map(pr => ({
        id: `pending-${pr.id}`,
        type: 'pending_reservation',
        reservation_type: pr.type,
        pending_reservation_id: pr.id,
        message: pr.type === 'room' 
          ? `New room reservation pending approval from ${pr.customer_name}`
          : `New event reservation pending approval from ${pr.customer_name}`,
        created_at: pr.created_at,
        status: 'pending',
        data: pr
      }));

      // Combine notifications
      notifications = [...pendingNotifications, ...notifications];
    }

    return NextResponse.json(notifications);
  } catch (error) {
    console.error('Error fetching notifications:', error);
    return NextResponse.json({ error: 'Failed to fetch notifications' }, { status: 500 });
  } finally {
    client.release();
  }
}

export async function POST(request) {
  const { id, status } = await request.json();

  if (!id || !status) {
    return NextResponse.json({ error: 'ID and status are required' }, { status: 400 });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    // Ensure the id is a valid integer before passing to the DB.
    // Some notifications are synthetic (e.g. `pending-123`) and do not map to the notifications table.
    let numericId = null;
    if (typeof id === 'number' && Number.isInteger(id)) {
      numericId = id;
    } else if (typeof id === 'string' && /^\d+$/.test(id.trim())) {
      numericId = parseInt(id.trim(), 10);
    } else {
      await client.query('ROLLBACK');
      return NextResponse.json({ error: 'Invalid notification id. Expected an integer ID.' }, { status: 400 });
    }

    const result = await client.query(
      'UPDATE public.notifications SET status = $1 WHERE id = $2 RETURNING *',
      [status, numericId]
    );
    await client.query('COMMIT');

    if (result.rowCount === 0) {
      return NextResponse.json({ error: 'Notification not found' }, { status: 404 });
    }

    const notification = result.rows[0];
    return NextResponse.json({
      id: notification.id,
      status: notification.status,
      room_id: notification.room_id,
      message: notification.message,
      scheduled_time: notification.scheduled_time,
      target_role: notification.target_role,
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error updating notification:', error);
    return NextResponse.json({ error: 'Failed to update notification' }, { status: 500 });
  } finally {
    client.release();
  }
}
