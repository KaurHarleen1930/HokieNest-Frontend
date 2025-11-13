# Google OAuth "deleted_client" Error Fix

## Problem
You're getting a `401: deleted_client` error when trying to use Google OAuth login. This means your Google OAuth client ID has been deleted or is invalid.

## Solution Options

### Option 1: Fix Google OAuth (Recommended for Production)

1. **Go to Google Cloud Console**
   - Visit: https://console.cloud.google.com/
   - Select your project (or create a new one)

2. **Create OAuth 2.0 Credentials**
   - Go to "APIs & Services" > "Credentials"
   - Click "Create Credentials" > "OAuth client ID"
   - Application type: "Web application"
   - Name: "HokieNest App" (or any name)
   - Authorized redirect URIs:
     - `http://localhost:4000/api/v1/auth/google/callback` (for development)
     - `https://yourdomain.com/api/v1/auth/google/callback` (for production)

3. **Update Environment Variables**
   - Copy the Client ID and Client Secret
   - Update your `.env` file:
     ```
     GOOGLE_CLIENT_ID=your_new_client_id_here
     GOOGLE_CLIENT_SECRET=your_new_client_secret_here
     GOOGLE_REDIRECT_URI=http://localhost:4000/api/v1/auth/google/callback
     ```

4. **Restart Your Server**
   ```bash
   cd server
   npm run dev
   ```

### Option 2: Disable Google OAuth (Quick Fix)

If you don't need Google OAuth right now, you can disable it:

1. **Remove or Comment Out Google OAuth Variables**
   - In your `.env` file, remove or comment out:
     ```
     # GOOGLE_CLIENT_ID=your_google_client_id_here
     # GOOGLE_CLIENT_SECRET=your_google_client_secret_here
     # GOOGLE_REDIRECT_URI=your_redirect_uri_here
     ```

2. **Restart Your Server**
   - The app will now work with email/password login only
   - Google OAuth button will show an error (you can hide it in the frontend)

3. **Update Signup Flow** (if needed)
   - The code now allows direct signup without OAuth verification when OAuth is not configured
   - Users can sign up directly with email/password

### Option 3: Allow Direct Signup Without OAuth

The code has been updated to allow direct signup when OAuth is not configured. Users can now:

1. Sign up directly with email/password (if OAuth is disabled)
2. Use email/password login
3. Google OAuth is optional

## Testing

After fixing, test the login:
1. Try Google OAuth login (if configured)
2. Try email/password login
3. Try signup (should work with or without OAuth)

## Notes

- The app now gracefully handles missing OAuth credentials
- Users can still sign up and login with email/password
- Google OAuth is optional but recommended for production
- Check server logs for OAuth configuration status

