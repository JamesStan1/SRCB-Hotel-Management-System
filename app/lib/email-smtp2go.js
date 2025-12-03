// lib/email-smtp2go.js
import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: 'mail.smtp2go.com',
  port: 2525, // Alternative ports: 8025, 587, 25
  secure: false,
  auth: {
    user: process.env.SMTP2GO_USERNAME,
    pass: process.env.SMTP2GO_PASSWORD,
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
    console.log('Email sent via SMTP2GO to:', email);
    return true;
  } catch (error) {
    console.error('SMTP2GO error:', error);
    return false;
  }
}