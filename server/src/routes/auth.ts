import { Router, Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { supabase, User } from '../lib/supabase';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { sendVerificationEmail } from '../utils/email';
import crypto from 'crypto';
import { sendPasswordResetEmail } from '../utils/email';
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';

const router = Router();

// Configure Google OAuth Strategy
passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID!,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
  callbackURL: process.env.GOOGLE_REDIRECT_URI!
}, async (accessToken, refreshToken, profile, done) => {
  try {
    console.log('Google OAuth strategy - profile:', profile);
    // Check if email ends with @vt.edu
    const email = profile.emails?.[0]?.value;
    console.log('Google OAuth strategy - email:', email);
    if (!email || !email.endsWith('@vt.edu')) {
      console.log('Google OAuth strategy - email validation failed:', email);
      return done(null, false); // This will trigger failureRedirect
    }

    // Check if user already exists
    console.log('Google OAuth strategy - checking existing user for email:', email);
    const { data: existingUser, error: fetchError } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') {
      console.error('Google OAuth strategy - error fetching user:', fetchError);
      return done(fetchError, undefined);
    }

    if (existingUser) {
      // User exists, return them with the expected format
      console.log('Google OAuth strategy - existing user found:', existingUser);
      const user = {
        id: existingUser.user_id.toString(),
        email: existingUser.email,
        name: `${existingUser.first_name || ''} ${existingUser.last_name || ''}`.trim() || 'User',
        role: existingUser.is_admin ? 'admin' : 'student'
      };
      return done(null, user);
    } else {
      // Create new user
      const name = profile.displayName || profile.name?.givenName || 'User';
      const nameParts = name.split(' ');
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';

      // Determine if admin based on email
      const isAdmin = email === 'admin@vt.edu';
      const isStaff = email === 'staff@vt.edu';

      console.log('Google OAuth strategy - creating new user (signup pending):', { email, firstName, lastName, isAdmin });
      const { data: newUser, error } = await supabase
        .from('users')
        .insert({
          email,
          password_hash: '', // Empty password indicates signup not completed yet
          first_name: firstName,
          last_name: lastName,
          is_admin: isAdmin,
        })
        .select()
        .single();

      if (error) {
        console.error('Google OAuth strategy - error creating user:', error);
        return done(error, undefined);
      }

      console.log('Google OAuth strategy - new user created:', newUser);
      const user = {
        id: newUser.user_id.toString(),
        email: newUser.email,
        name: `${newUser.first_name || ''} ${newUser.last_name || ''}`.trim() || 'User',
        role: newUser.is_admin ? 'admin' : 'student'
      };
      return done(null, user);
    }
  } catch (error) {
    return done(error, undefined);
  }
}));

// Serialize user for session
passport.serializeUser((user: any, done) => {
  done(null, user.id);
});

// Deserialize user from session
passport.deserializeUser(async (id: string, done) => {
  try {
    const { data: user } = await supabase
      .from('users')
      .select('user_id, email, first_name, last_name, is_admin')
      .eq('user_id', id)
      .single();

    if (user) {
      const formattedUser = {
        id: user.user_id.toString(),
        email: user.email,
        name: `${user.first_name || ''} ${user.last_name || ''}`.trim() || 'User',
        role: user.is_admin ? 'admin' : 'student'
      };
      done(null, formattedUser);
    } else {
      done(null, null);
    }
  } catch (error) {
    done(error, null);
  }
});

// Validation schemas
const signupSchema = z.object({
  email: z.string().email().refine(email => email.endsWith('@vt.edu'), {
    message: 'Must be a Virginia Tech email address'
  }),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  name: z.string().min(1, 'Name is required'),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1, 'Password is required'),
});

// Sign up - Requires Google OAuth verification first
router.post('/signup', async (req, res, next) => {
  try {
    const { email, password, name, oauth_token } = req.body;

    // Validate basic fields
    if (!email || !password || !name) {
      return res.status(400).json({ message: 'Email, password, and name are required' });
    }

    // Validate VT.edu email
    if (!email.endsWith('@vt.edu')) {
      return res.status(400).json({ message: 'Must be a Virginia Tech email address' });
    }

    // Validate password length
    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }

    // Check if user exists from Google OAuth (should have empty password_hash)
    const { data: existingOAuthUser } = await supabase
      .from('users')
      .select('user_id, password_hash')
      .eq('email', email)
      .single();

    if (!existingOAuthUser) {
      return res.status(400).json({
        message: 'Please verify your VT.edu email with Google first using "Continue with Google"'
      });
    }

    if (existingOAuthUser.password_hash) {
      return res.status(400).json({
        message: 'Account already exists. Please sign in instead.'
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Parse name into first and last name
    const nameParts = name.split(' ');
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';

    // Determine if admin based on email
    const isAdmin = email === 'admin@vt.edu';

    // Update existing OAuth user with password and complete info
    const { data: user, error } = await supabase
      .from('users')
      .update({
        password_hash: hashedPassword,
        first_name: firstName,
        last_name: lastName,
        is_admin: isAdmin,
      })
      .eq('email', email)
      .select('user_id, email, first_name, last_name, is_admin')
      .single();

    if (error) {
      throw new Error('Failed to complete signup');
    }

    const userResponse = {
      id: user.user_id.toString(),
      email: user.email,
      name: `${user.first_name || ''} ${user.last_name || ''}`.trim() || 'User',
      role: user.is_admin ? 'admin' : 'student'
    };

    res.status(200).json({
      message: 'Signup completed successfully! You can now sign in with your email and password.',
      user: userResponse,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        message: 'Validation error',
        errors: error.errors,
      });
    }
    next(error);
  }
});

// Login - Only for users who have completed signup process
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = loginSchema.parse(req.body);

    // Find user
    const { data: user } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single();

    if (!user) {
      return res.status(401).json({
        message: 'Account does not exist. Please sign up first.'
      });
    }

    // Check if user has a password (meaning they completed signup)
    if (!user.password_hash) {
      return res.status(401).json({
        message: 'Account incomplete. Please complete signup first.'
      });
    }

    // Check password
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    // Generate JWT
    const token = jwt.sign(
      { userId: user.user_id.toString() },
      process.env.JWT_SECRET!,
      { expiresIn: '7d' }
    );

    const userResponse = {
      id: user.user_id.toString(),
      email: user.email,
      name: `${user.first_name || ''} ${user.last_name || ''}`.trim() || 'User',
      role: user.is_admin ? 'admin' : 'student',
    };

    res.json({
      message: 'Login successful',
      token,
      user: userResponse,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        message: 'Validation error',
        errors: error.errors,
      });
    }
    next(error);
  }
});

// Verify email
router.get('/verify-email', async (req, res, next) => {
  try {
    const { token } = req.query;

    if (!token || typeof token !== 'string') {
      return res.status(400).json({ message: 'Verification token is required' });
    }

    const { data: user } = await supabase
      .from('users')
      .select('*')
      .eq('verification_token', token)
      .single();

    if (!user) {
      return res.status(400).json({ message: 'Invalid verification token' });
    }

    if (user.verification_expiry && new Date(user.verification_expiry) < new Date()) {
      return res.status(400).json({ message: 'Verification token has expired' });
    }

    if (user.email_verified) {
      return res.status(400).json({ message: 'Email already verified' });
    }

    // Update user as verified
    await supabase
      .from('users')
      .update({
        email_verified: true,
        verification_token: null,
        verification_expiry: null,
      })
      .eq('id', user.id);

    res.json({
      message: 'Email verified successfully! You can now log in.',
      success: true
    });
  } catch (error) {
    next(error);
  }
});

// Resend verification email
router.post('/resend-verification', async (req, res, next) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }

    const { data: user } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single();

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (user.email_verified) {
      return res.status(400).json({ message: 'Email already verified' });
    }

    // Generate new verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await supabase
      .from('users')
      .update({
        verification_token: verificationToken,
        verification_expiry: verificationExpiry.toISOString(),
      })
      .eq('id', user.id);

    // Send verification email
    await sendVerificationEmail(user.email, user.name, verificationToken);

    res.json({ message: 'Verification email sent successfully' });
  } catch (error) {
    next(error);
  }
});

// Get current user
router.get('/me', authenticateToken as any, async (req: any, res: Response) => {
  res.json(req.user);
});

// Google OAuth routes
router.get('/google', passport.authenticate('google', {
  scope: ['profile', 'email'],
  prompt: 'select_account' // Force account selection
}));

router.get('/google/callback',
  passport.authenticate('google', { session: false, failureRedirect: '/api/v1/auth/google/error' }),
  async (req: any, res) => {
    try {
      console.log('Google OAuth callback - req.user:', req.user);
      const user = req.user;

      if (!user) {
        console.error('No user in request after Google OAuth');
        return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5174'}/login?error=no_user`);
      }

      // Generate JWT token
      const token = jwt.sign(
        { userId: user.id },
        process.env.JWT_SECRET!,
        { expiresIn: '7d' }
      );

      const userResponse = {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      };

      console.log('Google OAuth success, redirecting with user:', userResponse);

      // Check if user needs to complete signup by querying the database
      const { data: dbUser } = await supabase
        .from('users')
        .select('password_hash')
        .eq('email', user.email)
        .single();

      const needsSignup = !dbUser?.password_hash;

      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5174';

      if (needsSignup) {
        // Redirect to signup page to complete registration with OAuth success
        res.redirect(`${frontendUrl}/signup?token=${token}&user=${encodeURIComponent(JSON.stringify(userResponse))}`);
      } else {
        // User already has password, log them in
        res.redirect(`${frontendUrl}/login?token=${token}&user=${encodeURIComponent(JSON.stringify(userResponse))}`);
      }
    } catch (error) {
      console.error('Google OAuth callback error:', error);
      res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5174'}/login?error=oauth_failed`);
    }
  }
);

// Google OAuth error handler
router.get('/google/error', (req, res) => {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5174';
  res.redirect(`${frontendUrl}/login?error=vt_email_required`);
});

// Logout route (with optional auth for better UX)
router.post('/logout', (req: Request, res: Response): void => {
  try {
    // Invalidate the session (if using sessions)
    if ((req as any).session) {
      (req as any).session.destroy((err: any) => {
        if (err) {
          console.error('Session destruction error:', err);
        }
      });
    }

    // Clear any passport session data
    if ((req as any).logout) {
      (req as any).logout((err: any) => {
        if (err) {
          console.error('Passport logout error:', err);
        }
      });
    }

    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ message: 'Logout failed' });
  }
});

// Password reset request
router.post('/forgot-password', async (req, res, next) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }

    // Validate VT.edu email
    if (!email.endsWith('@vt.edu')) {
      return res.status(400).json({ message: 'Must be a Virginia Tech email address' });
    }

    // Check if user exists and has completed signup
    const { data: user } = await supabase
      .from('users')
      .select('user_id, email, first_name, last_name, password_hash')
      .eq('email', email)
      .single();

    if (!user) {
      return res.status(404).json({ message: 'Account not found. Please sign up first.' });
    }

    if (!user.password_hash) {
      return res.status(400).json({
        message: 'Account incomplete. Please complete signup first using Google OAuth.'
      });
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpiry = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    // Store reset token in database
    console.log('Storing reset token for user:', email);
    const { error } = await supabase
      .from('users')
      .update({
        reset_token: resetToken,
        reset_token_expiry: resetTokenExpiry.toISOString()
      })
      .eq('email', email);

    if (error) {
      console.error('Database error storing reset token:', error);
      throw new Error(`Failed to generate reset token: ${error.message}`);
    }

    console.log('Reset token stored successfully, sending email...');

    // Send reset email
    try {
      await sendPasswordResetEmail(email, resetToken, user.first_name || 'User');
      console.log('Password reset email sent successfully');

      res.json({
        message: 'Password reset link sent to your VT.edu email address'
      });
    } catch (emailError) {
      console.error('Email sending error:', emailError);

      // For development: return the reset link in the response
      const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:5174'}/reset-password?token=${resetToken}`;

      res.json({
        message: 'Password reset link generated (email service unavailable)',
        resetLink: resetUrl,
        note: 'Copy this link to reset your password (expires in 15 minutes)'
      });
    }

  } catch (error) {
    next(error);
  }
});

// Password reset confirmation
router.post('/reset-password', async (req, res, next) => {
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      return res.status(400).json({ message: 'Token and password are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }

    // Find user with valid reset token
    const { data: user } = await supabase
      .from('users')
      .select('user_id, email, reset_token, reset_token_expiry')
      .eq('reset_token', token)
      .single();

    if (!user) {
      return res.status(400).json({ message: 'Invalid or expired reset token' });
    }

    // Check if token is expired
    if (new Date() > new Date(user.reset_token_expiry)) {
      return res.status(400).json({ message: 'Reset token has expired' });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Update password and clear reset token
    const { error } = await supabase
      .from('users')
      .update({
        password_hash: hashedPassword,
        reset_token: null,
        reset_token_expiry: null
      })
      .eq('user_id', user.user_id);

    if (error) {
      throw new Error('Failed to reset password');
    }

    res.json({ message: 'Password reset successfully. You can now sign in.' });

  } catch (error) {
    next(error);
  }
});

// Test email endpoint (remove in production)
router.post('/test-email', async (req, res, next) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }

    console.log('Testing email to:', email);

    // Import the email function
    const { sendPasswordResetEmail } = await import('../utils/email');

    // Send test email
    await sendPasswordResetEmail(email, 'test123456789', 'Test User');

    res.json({ message: 'Test email sent successfully' });
  } catch (error) {
    console.error('Email test error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ message: 'Email test failed', error: errorMessage });
  }
});

export { router as authRoutes };