import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import session from 'express-session';
import passport from 'passport';
import { authRoutes } from './routes/auth';
import { listingRoutes } from './routes/listings';
import { adminRoutes } from './routes/admin';
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
import { errorHandler } from './middleware/errorHandler';
import { supabase } from './lib/supabase';
import attractionsRouter from './routes/attractions';
import transitRouter from './routes/transit';

dotenv.config({ path: './.env' });

const app = express();
const PORT = process.env.PORT || 4000;

// Middleware
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:8080', 'http://localhost:3000'],
  credentials: true,
}));
// CHANGE: Increased body size limits to support file uploads
// Base64 encoded files are ~33% larger than original, so 50MB limit supports ~37MB files
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use('/api/v1/attractions', attractionsRouter);
app.use('/api/v1/transit', transitRouter);

// Session configuration for OAuth
app.use(session({
  secret: process.env.JWT_SECRET || 'fallback-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false } // Set to true in production with HTTPS
}));

// Initialize Passport
app.use(passport.initialize());
app.use(passport.session());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/listings', listingRoutes);
app.use('/api/v1/admin', adminRoutes);
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

// Error handling
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
});

// 404 handler (must be last)
app.use('*', (req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

export default app;