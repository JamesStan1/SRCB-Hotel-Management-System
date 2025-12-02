import { NextResponse } from 'next/server';
import pool from '../../../../lib/db';

export async function POST(request, { params }) {
  const roomId = parseInt(params.roomId);
  const { status, notes } = await request.json();
  // In existing POST function, after housekeeping update:
  if (status === 'Available' || status === 'completed') {
    // Update room status
    await client.query('UPDATE rooms SET status = $1 WHERE id = $2', ['Available', roomId]);

    // Mark related notifications as read
    await client.query('UPDATE notifications SET status = $1 WHERE room_id = $2 AND target_role = $3', ['read', roomId, 'Housekeeping']);

    // Delete housekeeping task if completed
    await client.query('DELETE FROM housekeeping WHERE room_id = $1', [roomId]);
  }
  if (isNaN(roomId)) {
    return NextResponse.json({ error: 'Invalid room ID' }, { status: 400 });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Check if housekeeping task exists for the room
    const existingTask = await client.query('SELECT * FROM public.housekeeping WHERE room_id = $1', [roomId]);

    let housekeeping;
    if (existingTask.rows.length > 0) {
      // Update existing task
      const result = await client.query(
        'UPDATE public.housekeeping SET status = $1, notes = $2, updated_at = NOW() WHERE room_id = $3 RETURNING *',
        [status, notes || null, roomId]
      );
      housekeeping = result.rows[0];
    } else {
      // Create new task
      const result = await client.query(
        'INSERT INTO public.housekeeping (room_id, status, notes) VALUES ($1, $2, $3) RETURNING *',
        [roomId, status, notes || null]
      );
      housekeeping = result.rows[0];
    }

    // If status is 'pending', create a notification
    if (status === 'pending') {
      await client.query(
        'INSERT INTO public.notifications (room_id, message, scheduled_time, status, target_role) VALUES ($1, $2, NOW(), $3, $4)',
        [roomId, notes || `Room ${roomId} is ready for cleaning.`, 'scheduled', 'Housekeeping']
      );
    }

    await client.query('COMMIT');

    return NextResponse.json({
      room_id: housekeeping.room_id,
      status: housekeeping.status,
      notes: housekeeping.notes,
      updated_at: housekeeping.updated_at,
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error in housekeeping API:', error);
    return NextResponse.json({ error: 'Failed to update housekeeping' }, { status: 500 });
  } finally {
    client.release();
  }
}

export async function DELETE(request, { params }) {
  const roomId = parseInt(params.roomId);

  if (isNaN(roomId)) {
    return NextResponse.json({ error: 'Invalid room ID' }, { status: 400 });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    const result = await client.query('DELETE FROM public.housekeeping WHERE room_id = $1 RETURNING *', [roomId]);
    await client.query('COMMIT');

    if (result.rowCount === 0) {
      return NextResponse.json({ error: 'Housekeeping task not found' }, { status: 404 });
    }
    return NextResponse.json({ message: 'Housekeeping task deleted' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error deleting housekeeping task:', error);
    return NextResponse.json({ error: 'Failed to delete housekeeping task' }, { status: 500 });
  } finally {
    client.release();
  }
}