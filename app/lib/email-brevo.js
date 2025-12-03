// lib/email-brevo.js
import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: 'smtp-relay.brevo.com',
  port: 587,
  secure: false,
  auth: {
    user: process.env.BREVO_SMTP_USER,
    pass: process.env.BREVO_SMTP_KEY,
  },
});

export async function sendVerificationCode(email, code) {
  const mailOptions = {
    from: '"SRCB Management" <no-reply@srcb.com>',
    to: email,
    subject: 'Password Reset Verification Code',
    html: `...same HTML as before...`,
    text: `...same text as before...`
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log('Email sent via Brevo to:', email);
    return true;
  } catch (error) {
    console.error('Brevo error:', error);
    return false;
  }
}
