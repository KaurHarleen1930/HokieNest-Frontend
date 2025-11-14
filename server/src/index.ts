// server/src/index.ts - COMPLETE WORKING VERSION
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

import session from 'express-session';
import passport from 'passport';
import { authRoutes } from './routes/auth';
import { listingRoutes } from './routes/listings';
import roomListingsRoutes from './routes/room-listings';
import { adminRoutes } from './routes/admin';
import { reportsRoutes } from './routes/reports';
import { analyticsRoutes } from './routes/analytics';
import { preferencesRoutes } from './routes/preferences';
import { roommatesRoutes } from './routes/roommates';
import { priorityWeightsRoutes } from './routes/priority-weights';
import chatbotRoutes from './routes/chatbot';
import connectionsRoutes from './routes/connections';
import chatRoutes from './routes/chat';
import notificationsRoutes from './routes/notifications';
import statusRoutes from './routes/status';
import { mapRoutes } from './routes/map';
import favoritesRoutes from './routes/favorites';
import settingsRoutes from './routes/settings';
import { errorHandler } from './middleware/errorHandler';
import { supabase } from './lib/supabase';

import attractionsRouter from './routes/attractions';
import transitRouter from './routes/transit';
import { communityRoutesGlobal } from "./routes/community.global";

console.log("✅ SUPABASE_URL =", process.env.SUPABASE_URL);
console.log("✅ SUPABASE_SERVICE_ROLE_KEY length =", process.env.SUPABASE_SERVICE_ROLE_KEY?.length);
dotenv.config({ path: './.env' });

const app = express();
const PORT = process.env.PORT || 4000;

// Middleware
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:8080', "http://localhost:8082",'http://localhost:8086', 'http://localhost:3000'],
  credentials: true,
}));

// Body parsing
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Session configuration
app.use(session({
  secret: process.env.JWT_SECRET || 'fallback-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false }
}));

// Initialize Passport
app.use(passport.initialize());
app.use(passport.session());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Register ALL API routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/listings', listingRoutes);
app.use('/api/v1/room-listings', roomListingsRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/reports', reportsRoutes);
app.use('/api/v1/analytics', analyticsRoutes);
app.use('/api/v1/preferences', preferencesRoutes);
app.use('/api/v1/roommates', roommatesRoutes);
app.use('/api/v1/priority-weights', priorityWeightsRoutes);
app.use('/api/v1/chatbot', chatbotRoutes);
app.use('/api/v1/connections', connectionsRoutes);
app.use('/api/v1/chat', chatRoutes);
app.use('/api/v1/notifications', notificationsRoutes);
app.use('/api/v1/status', statusRoutes);
app.use('/api/v1/favorites', favoritesRoutes);
app.use('/api/v1/map', mapRoutes);
app.use('/api/v1/settings', settingsRoutes);
app.use("/api/v1/community", communityRoutesGlobal);


// Register simple attractions and transit routes
console.log('📍 Registering attractions router...');
app.use('/api/v1/attractions', attractionsRouter);
console.log('✅ Attractions router registered at /api/v1/attractions');

console.log('🚇 Registering transit router...');
app.use('/api/v1/transit', transitRouter);
console.log('✅ Transit router registered at /api/v1/transit');

// Error handling
app.use(errorHandler);

// 404 handler (must be last)
app.use('*', (req, res) => {
  console.log('❌ 404 - Route not found:', req.originalUrl);
  res.status(404).json({ message: 'Route not found', path: req.originalUrl });
});

app.listen(PORT, () => {
  console.log('\n🚀 ================================');
  console.log(`🚀 Server running on port ${PORT}`);
  console.log('🚀 ================================');
  console.log(`📊 Health: http://localhost:${PORT}/health`);
  console.log(`📍 Attractions: http://localhost:${PORT}/api/v1/attractions/test`);
  console.log(`🚇 Transit: http://localhost:${PORT}/api/v1/transit/test`);
  console.log('🚀 ================================\n');
});

export default app;