import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export const sendVerificationEmail = async (
  email: string,
  name: string,
  verificationToken: string
) => {
  const verificationUrl = `${process.env.FRONTEND_URL || 'http://localhost:8080'}/verify-email?token=${verificationToken}`;

  try {
    const { data, error } = await resend.emails.send({
      from: 'HokieNest <onboarding@resend.dev>',
      to: [email],
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
    });

    if (error) {
      console.error('❌ Error sending verification email:', error);
      throw error;
    }

    console.log('✅ Verification email sent successfully:', data);
    return { success: true, data };
  } catch (error) {
    console.error('❌ Failed to send verification email:', error);
    throw error;
  }
};
