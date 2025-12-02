import pool from './db';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

/**
 * Require manager or admin approval for sensitive archive actions.
 * Accepts:
 * - Authorization: Bearer <token> where token decodes to role 'manager' or 'admin'
 * - { managerId, managerPassword } in request body (POST/PUT/DELETE handlers)
 * - { qrCode } in request body (accepts JWT or user identity json)
 *
 * Returns: { allowed: boolean, userId?, role?, message? }
 */
export async function requireManagerApproval(request, body = {}) {
  // 1) Check Authorization header (Bearer JWT)
  try {
    const authHeader = request.headers.get('authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      if (process.env.JWT_SECRET) {
        try {
          const decoded = jwt.verify(token, process.env.JWT_SECRET);
          const role = (decoded.role || '').toLowerCase();
          if (role === 'admin' || role === 'manager') {
            return { allowed: true, userId: decoded.id, role };
          }
          return { allowed: false, message: 'Insufficient role' };
        } catch (e) {
          // fall through to other checks
        }
      }
    }
  } catch (e) {
    // ignore header parse errors and try other methods below
  }

  // 2) Check body QR code (may be full JWT or encoded user identity)
  const qrCode = body?.qrCode || body?.managerQr || null;
  if (qrCode) {
    // If QR contains a JWT
    if (qrCode.includes('.') && process.env.JWT_SECRET) {
      try {
        const decoded = jwt.verify(qrCode, process.env.JWT_SECRET);
        const role = (decoded.role || '').toLowerCase();
        if (role === 'admin' || role === 'manager') return { allowed: true, userId: decoded.id, role };
        return { allowed: false, message: 'QR does not belong to manager/admin' };
      } catch (e) {
        // ignore and attempt lookup
      }
    }

    // Try parse JSON-like qr payload or look up by id/email
    let lookupKey = String(qrCode || '').trim();
    try {
      if ((lookupKey.startsWith('{') && lookupKey.endsWith('}')) || lookupKey.includes('"userId"')) {
        const parsed = JSON.parse(lookupKey);
        if (parsed.userId) lookupKey = String(parsed.userId);
        else if (parsed.email) lookupKey = String(parsed.email);
      }
    } catch (e) {
      // ignore parse errors
    }

    let client;
    try {
      client = await pool.connect();
      const res = await client.query(
        `SELECT id, password, role, email FROM users WHERE CAST(id AS TEXT) = $1 OR LOWER(email) = LOWER($1) LIMIT 1`,
        [lookupKey]
      );
      if (res.rows.length === 0) return { allowed: false, message: 'QR not recognized' };
      const user = res.rows[0];
      const role = (user.role || '').toLowerCase();
      if (role === 'admin' || role === 'manager') return { allowed: true, userId: user.id, role };
      return { allowed: false, message: 'QR user is not manager/admin' };
    } catch (e) {
      return { allowed: false, message: 'Server error while verifying QR' };
    } finally {
      if (client) client.release();
    }
  }

  // 3) Check password override: managerId or managerEmail + managerPassword
  // Skip password check if skipPasswordCheck flag is set and user is already authenticated as manager
  const skipPasswordCheck = body?.skipPasswordCheck === true;
  const managerPassword = body?.managerPassword || null;
  const managerId = body?.managerId || null;
  const managerEmail = body?.managerEmail || null;
  
  if (skipPasswordCheck && managerEmail) {
    // When skipping password check, verify the user from the JWT token is a manager
    try {
      const authHeader = request.headers.get('authorization');
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];
        if (process.env.JWT_SECRET) {
          try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const role = (decoded.role || '').toLowerCase();
            // Verify the token email matches the provided managerEmail
            if ((role === 'admin' || role === 'manager') && decoded.email === managerEmail) {
              return { allowed: true, userId: decoded.id, role };
            }
          } catch (e) {
            // fall through to password check
          }
        }
      }
    } catch (e) {
      // fall through to password check
    }
  }
  
  if (managerPassword && (managerId || managerEmail)) {
    let client;
    try {
      client = await pool.connect();
      let res;
      if (managerId) {
        res = await client.query('SELECT id, password, role FROM users WHERE id = $1 LIMIT 1', [managerId]);
      } else {
        res = await client.query('SELECT id, password, role FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1', [managerEmail]);
      }
      if (res.rows.length === 0) return { allowed: false, message: 'Manager account not found' };
      const user = res.rows[0];
      const match = await bcrypt.compare(String(managerPassword), user.password);
      if (!match) return { allowed: false, message: 'Invalid manager password' };
      const role = (user.role || '').toLowerCase();
      if (role === 'admin' || role === 'manager') return { allowed: true, userId: user.id, role };
      return { allowed: false, message: 'Account is not manager/admin' };
    } catch (e) {
      return { allowed: false, message: 'Server error while verifying manager password' };
    } finally {
      if (client) client.release();
    }
  }

  return { allowed: false, message: 'Manager or admin approval required' };
}

export default { requireManagerApproval };
