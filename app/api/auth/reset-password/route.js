import { NextResponse } from 'next/server';
import { Pool } from 'pg';
import bcrypt from 'bcrypt';

// Initialize PostgreSQL client
const pool = new Pool({
  connectionString: process.env.NEON_DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  timezone: 'UTC',
});

// Validate environment variables
const requiredEnvVars = ['NEON_DATABASE_URL'];
requiredEnvVars.forEach((varName) => {
  if (!process.env[varName]) {
    console.error(`Missing environment variable: ${varName}`);
    throw new Error(`Missing environment variable: ${varName}`);
  }
});

export async function POST(request) {
  try {
    const { email, code, password, step } = await request.json();

    // Log incoming request data
    console.log('Received reset-password request:', { email, code, step, password: password ? '[provided]' : '[missing]' });

    // Validate request body
    if (!email || !step) {
      console.error('Validation failed: Missing email or step', { email, step });
      return NextResponse.json({ message: 'Email and step are required' }, { status: 400 });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      console.error('Validation failed: Invalid email format', { email });
      return NextResponse.json({ message: 'Invalid email address' }, { status: 400 });
    }

    if (step === 'verify') {
      if (!code) {
        console.error('Validation failed: Code is required for verify step', { email });
        return NextResponse.json({ message: 'Verification code is required' }, { status: 400 });
      }

      // Validate code format (6 digits)
      if (!/^\d{6}$/.test(code)) {
        console.error('Validation failed: Invalid code format', { email, code });
        return NextResponse.json({ message: 'Verification code must be a 6-digit number' }, { status: 400 });
      }

      // Query verification_codes table, order by created_at DESC to get the latest code
      const result = await pool.query(
        'SELECT code, expires_at FROM verification_codes WHERE email = $1 AND expires_at > NOW() ORDER BY created_at DESC LIMIT 1',
        [email]
      );

      if (result.rows.length === 0) {
        console.error('No verification code found or code expired for', email);
        return NextResponse.json({ message: 'Invalid or expired verification code' }, { status: 400 });
      }

      if (result.rows[0].code !== code) {
        console.error('Code mismatch for', email, 'Expected:', result.rows[0].code, 'Received:', code);
        return NextResponse.json({ message: 'Invalid verification code' }, { status: 400 });
      }

      console.log('Code verified successfully for', email);
      return NextResponse.json({ message: 'Code verified' }, { status: 200 });
    } else if (step === 'reset') {
      if (!code) {
        console.error('Validation failed: Code is required for reset step', { email });
        return NextResponse.json({ message: 'Verification code is required' }, { status: 400 });
      }

      if (!/^\d{6}$/.test(code)) {
        console.error('Validation failed: Invalid code format', { email, code });
        return NextResponse.json({ message: 'Verification code must be a 6-digit number' }, { status: 400 });
      }

      if (!password) {
        console.error('Validation failed: Password is required', { email });
        return NextResponse.json({ message: 'Password is required' }, { status: 400 });
      }

      if (password.length < 6) {
        console.error('Validation failed: Password too short', { email });
        return NextResponse.json({ message: 'Password must be at least 6 characters' }, { status: 400 });
      }

      // Verify code again, order by created_at DESC
      const result = await pool.query(
        'SELECT code, expires_at FROM verification_codes WHERE email = $1 AND expires_at > NOW() ORDER BY created_at DESC LIMIT 1',
        [email]
      );

      if (result.rows.length === 0) {
        console.error('No verification code found or code expired for', email);
        return NextResponse.json({ message: 'Invalid or expired verification code' }, { status: 400 });
      }

      if (result.rows[0].code !== code) {
        console.error('Code mismatch for', email, 'Expected:', result.rows[0].code, 'Received:', code);
        return NextResponse.json({ message: 'Invalid verification code' }, { status: 400 });
      }

      // Hash new password
      const hashedPassword = await bcrypt.hash(password, 10);
      console.log('Password hashed successfully for', email);

      // Update user password
      const updateResult = await pool.query(
        'UPDATE users SET password = $1 WHERE email = $2 RETURNING email',
        [hashedPassword, email]
      );

      if (updateResult.rowCount === 0) {
        console.error('User not found for email:', email);
        return NextResponse.json({ message: 'User not found' }, { status: 404 });
      }

      // Delete used verification code
      await pool.query('DELETE FROM verification_codes WHERE email = $1', [email]);
      console.log('Password reset successfully for', email);

      return NextResponse.json({ message: 'Password reset successfully' }, { status: 200 });
    }

    console.error('Invalid step:', step);
    return NextResponse.json({ message: 'Invalid step' }, { status: 400 });
  } catch (error) {
    console.error('Error in reset-password API:', error.message, error.stack);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}

// Clean up expired verification codes
export async function cleanupExpiredCodes() {
  try {
    const result = await pool.query('DELETE FROM verification_codes WHERE expires_at < NOW()');
    console.log(`Cleaned up ${result.rowCount} expired verification codes`);
  } catch (error) {
    console.error('Error cleaning up expired codes:', error);
  }
}
