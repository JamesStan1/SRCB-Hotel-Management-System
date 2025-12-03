import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';

// Initialize PostgreSQL client
const pool = new Pool({
  connectionString: process.env.NEON_DATABASE_URL,
});

export async function POST(request) {
  try {
    const { email } = await request.json();

    // Validate request
    if (!email) {
      console.error('Request error: Email is required');
      return NextResponse.json({ message: 'Email is required' }, { status: 400 });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      console.error('Request error: Invalid email format', email);
      return NextResponse.json({ message: 'Invalid email address' }, { status: 400 });
    }

    // Check environment variables
    if (!process.env.GMAIL_USER || !process.env.GMAIL_PASS) {
      console.error('Environment error: Missing GMAIL_USER or GMAIL_PASS', {
        GMAIL_USER: process.env.GMAIL_USER ? 'Set' : 'Missing',
        GMAIL_PASS: process.env.GMAIL_PASS ? 'Set' : 'Missing',
      });
      return NextResponse.json({ message: 'Server configuration error' }, { status: 500 });
    }
    console.log('Environment variables loaded:', {
      GMAIL_USER: process.env.GMAIL_USER,
      GMAIL_PASS: process.env.GMAIL_PASS ? 'Set' : 'Missing',
    });

    // Test database connection
    try {
      await pool.query('SELECT NOW()');
      console.log('Database connection successful');
    } catch (dbError) {
      console.error('Database connection error:', dbError);
      return NextResponse.json({ message: 'Database connection error' }, { status: 500 });
    }

    // Generate a 6-digit verification code
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();

    // Store code in database
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes from now
    try {
      await pool.query(
        'INSERT INTO verification_codes (email, code, expires_at) VALUES ($1, $2, $3)',
        [email, verificationCode, expiresAt]
      );
      console.log(`Verification code stored for ${email}`);
    } catch (dbError) {
      console.error('Database insert error:', dbError);
      return NextResponse.json({ message: 'Failed to store verification code' }, { status: 500 });
    }

    // Set up Nodemailer transporter
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_PASS,
      },
    });

    // Verify transporter connection
    try {
      await transporter.verify();
      console.log('Nodemailer transporter verified successfully');
    } catch (verifyError) {
      console.error('Nodemailer verification error:', verifyError);
      return NextResponse.json({ message: 'Email server configuration error' }, { status: 500 });
    }

    // Read the image file (use the new SRCB.png placed in public/)
    const imagePath = path.join(process.cwd(), 'public', 'SRCB.png');
    let imageAttachment;
    try {
      imageAttachment = fs.readFileSync(imagePath);
    } catch (imageError) {
      console.error('Error reading image file:', imageError);
      return NextResponse.json({ message: 'Failed to load email image' }, { status: 500 });
    }

    // Email options
    const mailOptions = {
      from: process.env.GMAIL_USER,
      to: email,
      subject: 'Password Reset Verification Code',
      text: `Your verification code is: ${verificationCode}\n\nPlease use this code to reset your password. The code is valid for 10 minutes.`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <img src="cid:srcb-logo" alt="SRCB Logo" style="max-width: 150px; display: block; margin: 0 auto 20px;">
          <h2 style="color: #1f2937; text-align: center;">Password Reset Request</h2>
          <p style="color: #4b5563;">Your verification code is:</p>
          <h3 style="color: #15803d; text-align: center; font-size: 24px; margin: 10px 0;">${verificationCode}</h3>
          <p style="color: #4b5563;">Please use this code to reset your password. The code is valid for 10 minutes.</p>
          <p style="color: #4b5563;">If you did not request a password reset, please ignore this email.</p>
        </div>
      `,
      attachments: [
        {
          filename: 'SRCB.png',
          content: imageAttachment,
          cid: 'srcb-logo',
        },
      ],
    };

    // Send email
    try {
      await transporter.sendMail(mailOptions);
      console.log(`Verification code sent to ${email}`);
    } catch (emailError) {
      console.error('Error sending email:', emailError);
      return NextResponse.json({ message: 'Failed to send verification code' }, { status: 500 });
    }

    return NextResponse.json({ message: 'Verification code sent successfully' }, { status: 200 });
  } catch (error) {
    console.error('Error in forgot_password API:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}