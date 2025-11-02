import nodemailer from 'nodemailer';

// Gmail SMTP transporter (use app password)
const smtpUser = process.env.SMTP_USERNAME; // e.g., vthokienest@gmail.com
const smtpPass = process.env.SMTP_PASSWORD?.trim(); // Gmail App Password (trim spaces)
const smtpFrom = process.env.SMTP_FROM || (smtpUser ? `HokieNest <${smtpUser}>` : 'HokieNest <no-reply@hokienest.local>');

if (!smtpUser || !smtpPass) {
  console.warn('⚠️  SMTP_USERNAME or SMTP_PASSWORD not set - emails will fail');
}

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: Number(process.env.SMTP_PORT || 465),
  secure: String(process.env.SMTP_SECURE || 'true') === 'true',
  auth: smtpUser && smtpPass ? { 
    user: smtpUser, 
    pass: smtpPass 
  } : undefined,
  debug: process.env.NODE_ENV === 'development', // Enable debug logging in dev
  logger: process.env.NODE_ENV === 'development', // Log to console in dev
});

export const sendVerificationEmail = async (
  email: string,
  name: string,
  verificationToken: string
) => {
  const verificationUrl = `${process.env.FRONTEND_URL || 'http://localhost:8080'}/verify-email?token=${verificationToken}`;

  try {
    const info = await transporter.sendMail({
      from: smtpFrom,
      to: email,
      subject: 'Verify your HokieNest account',
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background-color: #861F41; color: white; padding: 20px; text-align: center; }
              .content { padding: 30px; background-color: #f9f9f9; }
              .button { 
                display: inline-block; 
                padding: 12px 30px; 
                background-color: #861F41; 
                color: white; 
                text-decoration: none; 
                border-radius: 5px; 
                margin: 20px 0;
              }
              .footer { text-align: center; padding: 20px; font-size: 12px; color: #666; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>Welcome to HokieNest!</h1>
              </div>
              <div class="content">
                <h2>Hi ${name},</h2>
                <p>Thank you for signing up with your Virginia Tech email! Please verify your email address to complete your registration.</p>
                <p>Click the button below to verify your account:</p>
                <center>
                  <a href="${verificationUrl}" class="button">Verify Email Address</a>
                </center>
                <p>Or copy and paste this link into your browser:</p>
                <p style="word-break: break-all; color: #666;">${verificationUrl}</p>
                <p><strong>This link will expire in 24 hours.</strong></p>
                <p>If you didn't create an account, you can safely ignore this email.</p>
              </div>
              <div class="footer">
                <p>© 2024 HokieNest - Virginia Tech Student Housing</p>
              </div>
            </div>
          </body>
        </html>
      `,
      text: `Welcome to HokieNest!\n\nVisit the link to verify your email: ${verificationUrl}`,
    });

    console.log('✅ Verification email sent:', info.messageId);
    return { success: true, data: { messageId: info.messageId } };
  } catch (error) {
    console.error('❌ Failed to send verification email:', error);
    throw error;
  }
};

export const sendPasswordResetEmail = async (
  email: string,
  resetToken: string,
  name: string
) => {
  const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:5174'}/reset-password?token=${resetToken}`;

  try {
    const info = await transporter.sendMail({
      from: smtpFrom,
      to: email,
      subject: 'Reset your HokieNest password',
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background-color: #861F41; color: white; padding: 20px; text-align: center; }
              .content { padding: 30px; background-color: #f9f9f9; }
              .button { 
                display: inline-block; 
                padding: 12px 30px; 
                background-color: #861F41; 
                color: white; 
                text-decoration: none; 
                border-radius: 5px; 
                margin: 20px 0;
              }
              .footer { text-align: center; padding: 20px; font-size: 12px; color: #666; }
              .warning { background-color: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 5px; margin: 20px 0; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>Password Reset Request</h1>
              </div>
              <div class="content">
                <h2>Hi ${name},</h2>
                <p>We received a request to reset your password for your HokieNest account.</p>
                <p>Click the button below to reset your password:</p>
                <center>
                  <a href="${resetUrl}" class="button">Reset Password</a>
                </center>
                <p>Or copy and paste this link into your browser:</p>
                <p style="word-break: break-all; color: #666;">${resetUrl}</p>
                <div class="warning">
                  <p><strong>⚠️ Important Security Information:</strong></p>
                  <ul>
                    <li>This link will expire in 15 minutes</li>
                    <li>If you didn't request this password reset, please ignore this email</li>
                    <li>Your password will not be changed until you click the link above</li>
                  </ul>
                </div>
                <p>If you continue to have issues, please contact our support team.</p>
              </div>
              <div class="footer">
                <p>© 2024 HokieNest - Virginia Tech Student Housing</p>
              </div>
            </div>
          </body>
        </html>
      `,
      text: `Password reset requested. Use this link to reset your password: ${resetUrl}`,
    });

    console.log('✅ Password reset email sent:', info.messageId);
    return { success: true, data: { messageId: info.messageId } };
  } catch (error) {
    console.error('❌ Failed to send password reset email:', error);
    throw error;
  }
};

// Send a generic/raw email with provided subject and HTML/text body
export const sendRawEmail = async (
  email: string,
  subject: string,
  body: { html?: string; text?: string }
) => {
  try {
    const fallbackText = body.text ?? (body.html ? body.html.replace(/<[^>]+>/g, '') : '');
    const info = await transporter.sendMail({
      from: smtpFrom,
      to: email,
      subject,
      html: body.html,
      text: fallbackText,
    });

    console.log('✅ Email sent:', info.messageId);
    return { success: true, data: { messageId: info.messageId } };
  } catch (error) {
    console.error('❌ Failed to send email:', error);
    throw error;
  }
};
