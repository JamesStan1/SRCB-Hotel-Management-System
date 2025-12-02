// lib/email.js - Etherial test email solution
import nodemailer from 'nodemailer';

// Create a test account automatically - no setup needed
let transporter;

// Initialize test email account
async function createTestAccount() {
  try {
    const testAccount = await nodemailer.createTestAccount();
    
    transporter = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass,
      },
    });
    
    console.log('Ethereal email account created:');
    console.log('Username:', testAccount.user);
    console.log('Password:', testAccount.pass);
    console.log('Login at: https://ethereal.email/login');
    
    return true;
  } catch (error) {
    console.error('Error creating test account:', error);
    return false;
  }
}

// Initialize on import
createTestAccount();

export async function sendVerificationCode(email, code) {
  // If transporter isn't ready yet, wait a bit
  if (!transporter) {
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  const mailOptions = {
    from: '"Joanna\'s Hotel Management" <no-reply@joannashotel.com>',
    to: email,
    subject: 'Password Reset Verification Code',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #16a34a;">Joanna's Hotel Management</h2>
        <p>You requested a password reset. Your verification code is:</p>
        <div style="background-color: #f3f4f6; padding: 15px; text-align: center; margin: 20px 0; border-radius: 8px;">
          <h1 style="margin: 0; color: #16a34a; letter-spacing: 8px; font-size: 28px;">${code}</h1>
        </div>
        <p>This code will expire in 10 minutes.</p>
        <p>If you didn't request this reset, please ignore this email.</p>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
        <p style="font-size: 12px; color: #6b7280;">This is an automated message, please do not reply to this email.</p>
      </div>
    `,
    text: `Joanna's Hotel Management - Password Reset\n\nYour verification code is: ${code}\n\nThis code will expire in 10 minutes.\n\nIf you didn't request this reset, please ignore this email.`
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('Preview URL: %s', nodemailer.getTestMessageUrl(info));
    console.log('Verification code sent to:', email, 'Code:', code);
    return true;
  } catch (error) {
    console.error('Email sending error:', error);
    return false;
  }
}

export async function sendReservationRejection(email, customerName, reservationType, rejectionReason) {
  // If transporter isn't ready yet, wait a bit
  if (!transporter) {
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  const mailOptions = {
    from: '"Joanna\'s Hotel Management" <no-reply@joannashotel.com>',
    to: email,
    subject: 'Reservation Update - Joanna\'s Hotel',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9fafb; border-radius: 10px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h2 style="color: #16a34a; margin: 0;">Joanna's Hotel Management</h2>
          <p style="color: #6b7280; margin: 5px 0;">Excellence in Hospitality</p>
        </div>
        
        <div style="background-color: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <h3 style="color: #dc2626; margin-top: 0;">Reservation Status Update</h3>
          
          <p style="color: #374151;">Dear ${customerName || 'Valued Guest'},</p>
          
          <p style="color: #374151; line-height: 1.6;">
            We regret to inform you that your <strong>${reservationType || 'reservation'}</strong> request has not been approved at this time.
          </p>
          
          <div style="background-color: #fef2f2; padding: 15px; border-left: 4px solid #dc2626; margin: 20px 0; border-radius: 4px;">
            <p style="margin: 0; color: #991b1b; font-weight: 600;">Reason:</p>
            <p style="margin: 10px 0 0 0; color: #7f1d1d;">${rejectionReason || 'Please contact us for more details'}</p>
          </div>
          
          <p style="color: #374151; line-height: 1.6;">
            We apologize for any inconvenience this may cause. If you have any questions or would like to discuss alternative options, please don't hesitate to contact us.
          </p>
          
          <div style="margin: 30px 0; padding: 20px; background-color: #f0fdf4; border-radius: 8px; border: 1px solid #86efac;">
            <p style="margin: 0; color: #166534; font-weight: 600;">Contact Information:</p>
            <p style="margin: 10px 0 0 0; color: #15803d;">
              📞 Phone: [Your Phone Number]<br>
              📧 Email: reservations@joannashotel.com<br>
              📍 Address: Madroño St., Brgy 4, Balingasag, Misamis Oriental
            </p>
          </div>
          
          <p style="color: #374151;">
            Thank you for considering Joanna's Hotel. We hope to serve you in the future.
          </p>
          
          <p style="color: #374151; margin-top: 30px;">
            Best regards,<br>
            <strong style="color: #16a34a;">Joanna's Hotel Management Team</strong>
          </p>
        </div>
        
        <div style="text-align: center; margin-top: 20px;">
          <p style="font-size: 12px; color: #9ca3af;">
            This is an automated message, please do not reply to this email.<br>
            For inquiries, please contact us through our official channels.
          </p>
        </div>
      </div>
    `,
    text: `Joanna's Hotel Management - Reservation Status Update

Dear ${customerName || 'Valued Guest'},

We regret to inform you that your ${reservationType || 'reservation'} request has not been approved at this time.

Reason: ${rejectionReason || 'Please contact us for more details'}

We apologize for any inconvenience this may cause. If you have any questions or would like to discuss alternative options, please don't hesitate to contact us.

Contact Information:
Phone: [Your Phone Number]
Email: reservations@joannashotel.com
Address: Madroño St., Brgy 4, Balingasag, Misamis Oriental

Thank you for considering Joanna's Hotel. We hope to serve you in the future.

Best regards,
Joanna's Hotel Management Team

---
This is an automated message, please do not reply to this email.
For inquiries, please contact us through our official channels.`
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('Rejection email preview URL: %s', nodemailer.getTestMessageUrl(info));
    console.log('Rejection email sent to:', email);
    return true;
  } catch (error) {
    console.error('Email sending error:', error);
    return false;
  }
}

export async function sendReservationApproval(email, customerName, reservationDetails) {
  // If transporter isn't ready yet, wait a bit
  if (!transporter) {
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  const {
    reservationType,
    reservationName, // Room package name or Event name
    checkInDate,
    checkOutDate,
    totalAmount,
    downpaymentAmount,
    remainingBalance,
    paymentOption
  } = reservationDetails;
  
  const mailOptions = {
    from: '"Joanna\'s Hotel Management" <no-reply@joannashotel.com>',
    to: email,
    subject: 'Reservation Approved - Joanna\'s Hotel',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9fafb; border-radius: 10px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h2 style="color: #16a34a; margin: 0;">Joanna's Hotel Management</h2>
          <p style="color: #6b7280; margin: 5px 0;">Excellence in Hospitality</p>
        </div>
        
        <div style="background-color: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <div style="text-align: center; margin-bottom: 25px;">
            <div style="display: inline-block; background-color: #10b981; color: white; padding: 10px 30px; border-radius: 50px; font-weight: bold;">
              ✓ RESERVATION APPROVED
            </div>
          </div>
          
          <p style="color: #374151;">Dear ${customerName || 'Valued Guest'},</p>
          
          <p style="color: #374151; line-height: 1.6;">
            Great news! Your <strong>${reservationType || 'reservation'}</strong> has been approved. We look forward to welcoming you to Joanna's Hotel!
          </p>
          
          <div style="background-color: #f0fdf4; padding: 20px; border-radius: 8px; margin: 20px 0; border: 2px solid #86efac;">
            <h4 style="color: #16a34a; margin-top: 0;">Reservation Details:</h4>
            <table style="width: 100%; color: #374151;">
              <tr>
                <td style="padding: 8px 0; font-weight: 600;">${reservationType === 'room' ? 'Package:' : 'Event:'}</td>
                <td style="padding: 8px 0;">${reservationName || 'N/A'}</td>
              </tr>
              ${checkInDate ? `
              <tr>
                <td style="padding: 8px 0; font-weight: 600;">Check-in Date:</td>
                <td style="padding: 8px 0;">${new Date(checkInDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</td>
              </tr>` : ''}
              ${checkOutDate ? `
              <tr>
                <td style="padding: 8px 0; font-weight: 600;">Check-out Date:</td>
                <td style="padding: 8px 0;">${new Date(checkOutDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</td>
              </tr>` : ''}
              <tr>
                <td style="padding: 8px 0; font-weight: 600; border-top: 2px solid #d1fae5; padding-top: 15px;">Total Amount:</td>
                <td style="padding: 8px 0; border-top: 2px solid #d1fae5; padding-top: 15px; font-size: 18px; color: #16a34a; font-weight: bold;">₱${parseFloat(totalAmount || 0).toLocaleString('en-PH', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
              </tr>
              ${paymentOption === 'downpayment' ? `
              <tr>
                <td style="padding: 8px 0; font-weight: 600;">Downpayment Paid:</td>
                <td style="padding: 8px 0; color: #059669;">₱${parseFloat(downpaymentAmount || 0).toLocaleString('en-PH', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-weight: 600;">Remaining Balance:</td>
                <td style="padding: 8px 0; color: #dc2626;">₱${parseFloat(remainingBalance || 0).toLocaleString('en-PH', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
              </tr>` : ''}
            </table>
          </div>
          
          ${paymentOption === 'downpayment' ? `
          <div style="background-color: #fffbeb; padding: 15px; border-left: 4px solid #f59e0b; margin: 20px 0; border-radius: 4px;">
            <p style="margin: 0; color: #92400e; font-weight: 600;">⚠️ Payment Reminder:</p>
            <p style="margin: 10px 0 0 0; color: #78350f;">Please settle the remaining balance of <strong>₱${parseFloat(remainingBalance || 0).toLocaleString('en-PH', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</strong> upon arrival or as agreed with the hotel management.</p>
          </div>` : `
          <div style="background-color: #f0fdf4; padding: 15px; border-left: 4px solid #10b981; margin: 20px 0; border-radius: 4px;">
            <p style="margin: 0; color: #065f46; font-weight: 600;">✓ Payment Status:</p>
            <p style="margin: 10px 0 0 0; color: #064e3b;">Full payment of <strong>₱${parseFloat(totalAmount || 0).toLocaleString('en-PH', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</strong> has been confirmed. Thank you!</p>
          </div>`}
          
          <div style="margin: 30px 0; padding: 20px; background-color: #eff6ff; border-radius: 8px; border: 1px solid #93c5fd;">
            <p style="margin: 0; color: #1e40af; font-weight: 600;">📋 What's Next?</p>
            <ul style="margin: 10px 0 0 20px; color: #1e3a8a; line-height: 1.8;">
              <li>You will receive a confirmation upon arrival</li>
              <li>Please bring a valid ID for verification</li>
              ${paymentOption === 'downpayment' ? '<li>Prepare the remaining balance for payment</li>' : ''}
              <li>Contact us if you need to make any changes</li>
            </ul>
          </div>
          
          <div style="margin: 30px 0; padding: 20px; background-color: #f0fdf4; border-radius: 8px; border: 1px solid #86efac;">
            <p style="margin: 0; color: #166534; font-weight: 600;">Contact Information:</p>
            <p style="margin: 10px 0 0 0; color: #15803d;">
              📞 Phone: [Your Phone Number]<br>
              📧 Email: reservations@joannashotel.com<br>
              📍 Address: Madroño St., Brgy 4, Balingasag, Misamis Oriental
            </p>
          </div>
          
          <p style="color: #374151; line-height: 1.6;">
            If you have any questions or need to modify your reservation, please contact us immediately.
          </p>
          
          <p style="color: #374151; margin-top: 30px;">
            We can't wait to host you!<br>
            <strong style="color: #16a34a;">Joanna's Hotel Management Team</strong>
          </p>
        </div>
        
        <div style="text-align: center; margin-top: 20px;">
          <p style="font-size: 12px; color: #9ca3af;">
            This is an automated message, please do not reply to this email.<br>
            For inquiries, please contact us through our official channels.
          </p>
        </div>
      </div>
    `,
    text: `Joanna's Hotel Management - Reservation Approved

Dear ${customerName || 'Valued Guest'},

Great news! Your ${reservationType || 'reservation'} has been approved. We look forward to welcoming you to Joanna's Hotel!

Reservation Details:
${reservationType === 'room' ? 'Package:' : 'Event:'} ${reservationName || 'N/A'}
${checkInDate ? `Check-in Date: ${new Date(checkInDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}` : ''}
${checkOutDate ? `Check-out Date: ${new Date(checkOutDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}` : ''}
Total Amount: ₱${parseFloat(totalAmount || 0).toLocaleString('en-PH', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
${paymentOption === 'downpayment' ? `
Downpayment Paid: ₱${parseFloat(downpaymentAmount || 0).toLocaleString('en-PH', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
Remaining Balance: ₱${parseFloat(remainingBalance || 0).toLocaleString('en-PH', {minimumFractionDigits: 2, maximumFractionDigits: 2})}

Payment Reminder: Please settle the remaining balance upon arrival or as agreed with the hotel management.` : `
Payment Status: Full payment confirmed. Thank you!`}

What's Next?
- You will receive a confirmation upon arrival
- Please bring a valid ID for verification
${paymentOption === 'downpayment' ? '- Prepare the remaining balance for payment' : ''}
- Contact us if you need to make any changes

Contact Information:
Phone: [Your Phone Number]
Email: reservations@joannashotel.com
Address: Madroño St., Brgy 4, Balingasag, Misamis Oriental

If you have any questions or need to modify your reservation, please contact us immediately.

We can't wait to host you!
Joanna's Hotel Management Team

---
This is an automated message, please do not reply to this email.
For inquiries, please contact us through our official channels.`
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('Approval email preview URL: %s', nodemailer.getTestMessageUrl(info));
    console.log('Approval email sent to:', email);
    return true;
  } catch (error) {
    console.error('Email sending error:', error);
    return false;
  }
}
