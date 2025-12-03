import pool from '../../../lib/db';
import jwt from 'jsonwebtoken';
import { logAudit } from '../../../lib/auditLogger';
import { NextResponse } from 'next/server';

export async function POST(req) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      await logAudit(null, 'login_failed', 'auth', null, { error: 'No token provided' }, req);
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    const { userId } = await req.json();
    if (!userId || userId !== decoded.id) {
      await logAudit(decoded.id, 'login_failed', 'auth', null, { error: 'Invalid user ID' }, req);
      return NextResponse.json({ message: 'Invalid user ID' }, { status: 400 });
    }

    await logAudit(userId, 'login', 'auth', userId, { role: decoded.role }, req);
    return NextResponse.json({ message: 'Login logged successfully' }, { status: 200 });
  } catch (error) {
    console.error('Login log error:', error);
    await logAudit(null, 'login_failed', 'auth', null, { error: error.message }, req);
    return NextResponse.json({ error: 'Failed to log login' }, { status: 500 });
  }
}
