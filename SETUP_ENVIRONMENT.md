# 🔐 Environment Security Setup Guide

## 📋 Quick Start

### 1. Install Dependencies
```bash
# Install all dependencies (frontend + backend)
npm run install:all

# Or install separately:
npm install          # Frontend dependencies
npm run server:install  # Backend dependencies
```

### 2. Set Up Environment Variables

#### Frontend Environment (Safe for browser)
Create `.env` in the root directory:
```bash
cp env.example .env
```

Edit `.env` with your values:
```env
# Supabase (Public keys - safe for frontend)
VITE_SUPABASE_URL=your_supabase_project_url_here
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key_here

# API Configuration
VITE_API_URL=http://localhost:4000
```

#### Backend Environment (Private - server only)
Create `server/.env`:
```bash
cp server/env.example server/.env
```

Edit `server/.env` with your values:
```env
# Supabase (Private keys - server only)
SUPABASE_URL=your_supabase_project_url_here
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key_here

# Security (Generate strong random strings)
JWT_SECRET=your_very_long_random_jwt_secret_key_here_at_least_32_characters
SESSION_SECRET=your_session_secret_key_here_at_least_32_characters

# API Keys (Optional)
RENTCAST_API_KEY=your_rentcast_api_key_here
RESEND_API_KEY=your_resend_api_key_here

# Server Configuration
PORT=4000
NODE_ENV=development
```

### 3. Run the Application

#### Development (Recommended)
```bash
# Run both frontend and backend together
npm run dev:full

# Or run separately:
npm run server:dev  # Backend only
npm run dev         # Frontend only
```

#### Production
```bash
# Build everything
npm run build:full

# Start production server
npm run start:full
```

## 🚀 Available Scripts

### Frontend Scripts
- `npm run dev` - Start frontend development server
- `npm run build` - Build frontend for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

### Backend Scripts
- `npm run server:dev` - Start backend development server
- `npm run server:build` - Build backend TypeScript
- `npm run server:start` - Start production backend server
- `npm run server:install` - Install backend dependencies

### Combined Scripts
- `npm run dev:full` - Run both frontend and backend in development
- `npm run build:full` - Build both frontend and backend
- `npm run start:full` - Start production server
- `npm run install:all` - Install all dependencies

## 🔑 API Key Security

### ✅ What's Protected
- **RentCast API Key** - Only accessible on backend
- **Supabase Service Role Key** - Server-side only
- **JWT Secrets** - Never exposed to frontend
- **Email API Keys** - Backend only

### ✅ What's Safe for Frontend
- **Supabase URL** - Public endpoint
- **Supabase Anon Key** - Designed for frontend use
- **API URLs** - Public endpoints

### 🛡️ Security Features
- Environment variables in `.gitignore`
- API keys never sent to frontend
- Protected backend routes with authentication
- CORS configuration for allowed origins

## 🔧 Environment Variables Reference

### Frontend (.env)
| Variable | Description | Example |
|----------|-------------|---------|
| `VITE_SUPABASE_URL` | Supabase project URL | `https://xxx.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Supabase anonymous key | `eyJhbGciOiJIUzI1NiIs...` |
| `VITE_API_URL` | Backend API URL | `http://localhost:4000` |

### Backend (server/.env)
| Variable | Description | Required | Example |
|----------|-------------|----------|---------|
| `SUPABASE_URL` | Supabase project URL | ✅ | `https://xxx.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key | ✅ | `eyJhbGciOiJIUzI1NiIs...` |
| `JWT_SECRET` | JWT signing secret | ✅ | `your-secret-32-chars+` |
| `SESSION_SECRET` | Session secret | ✅ | `your-session-secret-32+` |
| `RENTCAST_API_KEY` | RentCast API key | ❌ | `your-rentcast-key` |
| `RESEND_API_KEY` | Email service key | ❌ | `your-resend-key` |
| `PORT` | Server port | ❌ | `4000` |
| `NODE_ENV` | Environment | ❌ | `development` |

## 🚨 Important Security Notes

1. **Never commit `.env` files** - They're in `.gitignore`
2. **Use strong secrets** - Generate random 32+ character strings
3. **Rotate keys regularly** - Especially in production
4. **Use different keys** - Separate development and production
5. **Monitor API usage** - Watch for unexpected requests

## 🔍 Troubleshooting

### Common Issues

#### "RENTCAST_API_KEY not found"
- Add your RentCast API key to `server/.env`
- Or remove RentCast features if not needed

#### "Cannot find module" errors
- Run `npm run install:all` to install all dependencies

#### Port conflicts
- Change `PORT=4000` in `server/.env`
- Update `VITE_API_URL` in `.env` to match

#### CORS errors
- Check `CORS_ORIGINS` in `server/.env`
- Ensure frontend URL is included

### Getting API Keys

#### Supabase
1. Go to [supabase.com](https://supabase.com)
2. Create a project
3. Go to Settings > API
4. Copy URL and keys

#### RentCast (Optional)
1. Sign up at [rentcast.com](https://rentcast.com)
2. Get API key from dashboard
3. Add to `server/.env`

#### Resend (Optional)
1. Sign up at [resend.com](https://resend.com)
2. Get API key from dashboard
3. Add to `server/.env`

## 📚 Next Steps

1. ✅ Set up environment variables
2. ✅ Run `npm run dev:full`
3. ✅ Test the application
4. ✅ Add your API keys as needed
5. ✅ Deploy to production

---

**Need help?** Check the terminal output for specific error messages or refer to the individual service documentation.
