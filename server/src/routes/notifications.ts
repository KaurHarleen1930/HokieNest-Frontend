import { Router, Response } from 'express';
import { NotificationService } from '../services/notification';
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
 * Get user notifications (paginated)
 * GET /api/v1/notifications
 */
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    if (!requireAuth(req, res)) return;
    
    const userId = parseInt(req.user!.id);
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const unreadOnly = req.query.unread_only === 'true';

    const result = await NotificationService.getUserNotifications(
      userId,
      page,
      limit,
      unreadOnly
    );

    res.json({
      success: true,
      ...result
    });
  } catch (error: any) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Mark notification as read
 * PUT /api/v1/notifications/:id/read
 */
router.put('/:id/read', async (req: AuthRequest, res: Response) => {
  try {
    if (!requireAuth(req, res)) return;
    
    const notificationId = req.params.id;
    const userId = parseInt(req.user!.id);

    await NotificationService.markAsRead(notificationId, userId);

    res.json({
      success: true,
      message: 'Notification marked as read'
    });
  } catch (error: any) {
    console.error('Error marking notification as read:', error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * Mark all notifications as read
 * PUT /api/v1/notifications/read-all
 */
router.put('/read-all', async (req: AuthRequest, res: Response) => {
  try {
    if (!requireAuth(req, res)) return;
    
    const userId = parseInt(req.user!.id);

    await NotificationService.markAllAsRead(userId);

    res.json({
      success: true,
      message: 'All notifications marked as read'
    });
  } catch (error: any) {
    console.error('Error marking all notifications as read:', error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * Delete all notifications for the user
 * DELETE /api/v1/notifications/clear-all
 * CHANGE: Added endpoint to delete all notifications at once
 */
router.delete('/clear-all', async (req: AuthRequest, res: Response) => {
  try {
    if (!requireAuth(req, res)) return;
    
    const userId = parseInt(req.user!.id);

    await NotificationService.deleteAllNotifications(userId);

    res.json({
      success: true,
      message: 'All notifications deleted'
    });
  } catch (error: any) {
    console.error('Error deleting all notifications:', error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * Delete a notification
 * DELETE /api/v1/notifications/:id
 */
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    if (!requireAuth(req, res)) return;
    
    const notificationId = req.params.id;
    const userId = parseInt(req.user!.id);

    await NotificationService.deleteNotification(notificationId, userId);

    res.json({
      success: true,
      message: 'Notification deleted'
    });
  } catch (error: any) {
    console.error('Error deleting notification:', error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * Get notification preferences
 * GET /api/v1/notifications/preferences
 */
router.get('/preferences', async (req: AuthRequest, res: Response) => {
  try {
    if (!requireAuth(req, res)) return;
    
    const userId = parseInt(req.user!.id);

    const preferences = await NotificationService.getNotificationPreferences(userId);

    res.json({
      success: true,
      preferences
    });
  } catch (error: any) {
    console.error('Error fetching notification preferences:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Update notification preferences
 * PUT /api/v1/notifications/preferences
 */
router.put('/preferences', async (req: AuthRequest, res: Response) => {
  try {
    if (!requireAuth(req, res)) return;
    
    const userId = parseInt(req.user!.id);
    const preferences = req.body;

    const updatedPreferences = await NotificationService.updateNotificationPreferences(
      userId,
      preferences
    );

    res.json({
      success: true,
      preferences: updatedPreferences,
      message: 'Notification preferences updated'
    });
  } catch (error: any) {
    console.error('Error updating notification preferences:', error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * Get unread notification count
 * GET /api/v1/notifications/unread-count
 */
router.get('/unread-count', async (req: AuthRequest, res: Response) => {
  try {
    if (!requireAuth(req, res)) return;
    
    const userId = parseInt(req.user!.id);

    const result = await NotificationService.getUserNotifications(
      userId,
      1,
      1,
      true // unread only
    );

    res.json({
      success: true,
      unreadCount: result.total
    });
  } catch (error: any) {
    console.error('Error fetching unread count:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
