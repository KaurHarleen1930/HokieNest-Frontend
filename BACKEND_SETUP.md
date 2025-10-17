# HokieNest Backend Setup

The "Failed to load properties" error occurs because the backend server is not running. Here's how to fix it:

## Quick Setup

1. **Install backend dependencies:**
   ```bash
   cd server
   npm install
   ```

2. **Generate Prisma client:**
   ```bash
   npm run prisma:generate
   ```

3. **Set up the database:**
   ```bash
   npm run prisma:migrate
   npm run prisma:seed
   ```

4. **Start the backend server:**
   ```bash
   npm run dev
   ```

5. **In another terminal, start the frontend:**
   ```bash
   cd ..
   npm run dev
   ```

## Alternative Single Command

From the root directory, you can also run:
```bash
npm run server:setup
npm run dev
```

## Verification

Once the backend is running, you should see:
- Backend server on http://localhost:4000
- Frontend on http://localhost:8080
- Console logs showing API requests in the browser dev tools

The backend includes 12 seeded property listings and 3 demo user accounts for testing.