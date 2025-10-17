# 🚀 HokieNest Quick Start Guide

## ⚡ Super Quick Start

```bash
# 1. Clone and setup (one-time)
git clone <your-repo>
cd HokieNest-Frontend-jyothi

# 2. Install everything
npm run install:all

# 3. Setup environment (copy examples)
cp env.example .env
cp server/env.example server/.env

# 4. Edit your environment files with your API keys
# (See SETUP_ENVIRONMENT.md for details)

# 5. Run the application
npm run dev:full
```

## 🎯 Available Commands

### 🏃‍♂️ Quick Commands
```bash
npm run dev:full      # Start both frontend & backend
npm run install:all   # Install all dependencies
./start.sh           # Automated startup script
```

### 🔧 Individual Commands
```bash
# Frontend only
npm run dev           # Start frontend dev server
npm run build         # Build frontend
npm run preview       # Preview frontend build

# Backend only
npm run server:dev    # Start backend dev server
npm run server:build  # Build backend
npm run server:start  # Start backend production

# Combined
npm run build:full    # Build everything
npm run start:full    # Start production
```

## 🔐 Environment Setup

### Frontend (.env) - Safe for browser
```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_anon_key
VITE_API_URL=http://localhost:4000
```

### Backend (server/.env) - Private keys only
```env
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_key
JWT_SECRET=your_jwt_secret_32_chars_minimum
SESSION_SECRET=your_session_secret_32_chars_minimum
RENTCAST_API_KEY=your_rentcast_key  # Optional
PORT=4000
```

## 🌐 URLs

- **Frontend**: http://localhost:8080
- **Backend API**: http://localhost:4000
- **Health Check**: http://localhost:4000/health

## 🛠️ Development Workflow

1. **Start Development**:
   ```bash
   npm run dev:full
   ```

2. **Make Changes**: Edit files in `src/` or `server/src/`

3. **Test**: Both frontend and backend auto-reload

4. **Build for Production**:
   ```bash
   npm run build:full
   ```

## 🔑 API Key Security

✅ **Protected (Backend Only)**:
- RentCast API Key
- Supabase Service Role Key
- JWT Secrets
- Email API Keys

✅ **Safe for Frontend**:
- Supabase URL
- Supabase Anon Key
- API URLs

## 🚨 Troubleshooting

### Common Issues

**"RENTCAST_API_KEY not found"**
- Add your key to `server/.env` or ignore if not using RentCast

**"Cannot find module"**
- Run `npm run install:all`

**Port conflicts**
- Change `PORT=4000` in `server/.env`
- Update `VITE_API_URL` in `.env`

**Database errors**
- Check your Supabase credentials in both `.env` files

## 📚 Full Documentation

- **Environment Setup**: See `SETUP_ENVIRONMENT.md`
- **Backend Setup**: See `BACKEND_SETUP.md`
- **Email Setup**: See `SETUP_EMAIL_VERIFICATION.md`

## 🎉 You're Ready!

Your HokieNest application is now running with:
- ✅ Secure API key management
- ✅ Unified development workflow
- ✅ Auto-reloading frontend & backend
- ✅ Production build system
- ✅ RentCast API integration

**Happy coding!** 🏠✨
