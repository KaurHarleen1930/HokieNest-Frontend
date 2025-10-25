import { Router, Response } from 'express';
import { RealtimeService } from '../services/realtime';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { supabase } from '../lib/supabase';

const router = Router();

// Apply authentication middleware to all routes
router.use(authenticateToken);

// Helper function to check authentication
const requireAuth = (req: AuthRequest, res: any) => {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required' });
    return false;
  }
  return true;
};

/**
 * Set user online status
 * POST /api/v1/status/online
 */
router.post('/online', async (req: AuthRequest, res: Response) => {
  try {
    if (!requireAuth(req, res)) return;
    
    const userId = parseInt(req.user!.id);

    const status = await RealtimeService.setUserOnline(userId);

    res.json({
      success: true,
      status,
      message: 'User set to online'
    });
  } catch (error: any) {
    console.error('Error setting user online:', error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * Set user offline status
 * POST /api/v1/status/offline
 */
router.post('/offline', async (req: AuthRequest, res: Response) => {
  try {
    if (!requireAuth(req, res)) return;
    
    const userId = parseInt(req.user!.id);

    const status = await RealtimeService.setUserOffline(userId);

    res.json({
      success: true,
      status,
      message: 'User set to offline'
    });
  } catch (error: any) {
    console.error('Error setting user offline:', error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * Get user's online status
 * GET /api/v1/status/:userId
 */
router.get('/:userId', async (req: AuthRequest, res: Response) => {
  try {
    if (!requireAuth(req, res)) return;
    
    const { userId } = req.params;
    const currentUserId = parseInt(req.user!.id);

    // For now, allow users to check any user's status
    // In a real app, you might want to restrict this to connected users only
    const status = await RealtimeService.getUserStatus(parseInt(userId));

    res.json({
      success: true,
      status
    });
  } catch (error: any) {
    console.error('Error fetching user status:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get all online users
 * GET /api/v1/status/online
 */
router.get('/online', async (req: AuthRequest, res: Response) => {
  try {
    if (!requireAuth(req, res)) return;
    
    const onlineUsers = await RealtimeService.getOnlineUsers();

    res.json({
      success: true,
      users: onlineUsers
    });
  } catch (error: any) {
    console.error('Error fetching online users:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get current user's status
 * GET /api/v1/status/me
 */
router.get('/me', async (req: AuthRequest, res: Response) => {
  try {
    if (!requireAuth(req, res)) return;
    
    const userId = parseInt(req.user!.id);

    const status = await RealtimeService.getUserStatus(userId);

    res.json({
      success: true,
      status
    });
  } catch (error: any) {
    console.error('Error fetching current user status:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
