import { Router } from 'express';
import { supabase } from '../lib/supabase';
import { authenticateToken, requireAdmin, AuthRequest } from '../middleware/auth';
import { createAdminLogger, AdminAction, getAdminLogs } from '../middleware/adminLogger';

const router = Router();

// Apply auth middleware to all admin routes
router.use(authenticateToken);
router.use(requireAdmin);

// Get all users with optional search
router.get('/users', createAdminLogger(AdminAction.VIEW_USERS), async (req: AuthRequest, res, next) => {
  try {
    const { search } = req.query;

    let query = supabase
      .from('users')
      .select('user_id, email, first_name, last_name, is_admin, suspended, created_at')
      .order('created_at', { ascending: false });

    // Add search filter if provided
    if (search && typeof search === 'string') {
      const searchLower = search.toLowerCase();
      query = query.or(`email.ilike.%${searchLower}%,first_name.ilike.%${searchLower}%,last_name.ilike.%${searchLower}%`);
    }

    const { data: users, error } = await query;

    if (error) {
      throw error;
    }

    const formattedUsers = users.map(user => ({
      id: user.user_id.toString(),
      email: user.email,
      name: `${user.first_name || ''} ${user.last_name || ''}`.trim() || 'User',
      role: user.is_admin ? 'admin' : 'student',
      suspended: user.suspended || false,
      createdAt: user.created_at,
    }));

    res.json(formattedUsers);
  } catch (error) {
    next(error);
  }
});

// Suspend user
router.post('/users/:id/suspend', createAdminLogger(AdminAction.SUSPEND_USER), async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;

    // Don't allow admins to suspend themselves
    if (id === req.user?.id) {
      return res.status(400).json({ message: 'Cannot suspend yourself' });
    }

    // Check if user exists and is not already suspended
    const { data: user, error: fetchError } = await supabase
      .from('users')
      .select('user_id, email, is_admin, suspended')
      .eq('user_id', id)
      .single();

    if (fetchError || !user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (user.suspended) {
      return res.status(400).json({ message: 'User is already suspended' });
    }

    // Don't allow suspending other admins
    if (user.is_admin) {
      return res.status(403).json({ message: 'Cannot suspend admin users' });
    }

    // Suspend the user
    const { error: updateError } = await supabase
      .from('users')
      .update({ suspended: true })
      .eq('user_id', id);

    if (updateError) {
      throw updateError;
    }

    res.json({ success: true, message: 'User suspended successfully' });
  } catch (error) {
    next(error);
  }
});

// Unsuspend user
router.post('/users/:id/unsuspend', createAdminLogger(AdminAction.UNSUSPEND_USER), async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;

    // Check if user exists and is suspended
    const { data: user, error: fetchError } = await supabase
      .from('users')
      .select('user_id, email, is_admin, suspended')
      .eq('user_id', id)
      .single();

    if (fetchError || !user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (!user.suspended) {
      return res.status(400).json({ message: 'User is not suspended' });
    }

    // Unsuspend the user
    const { error: updateError } = await supabase
      .from('users')
      .update({ suspended: false })
      .eq('user_id', id);

    if (updateError) {
      throw updateError;
    }

    res.json({ success: true, message: 'User unsuspended successfully' });
  } catch (error) {
    next(error);
  }
});

// Delete user (soft delete by marking as deleted)
router.delete('/users/:id', createAdminLogger(AdminAction.DELETE_USER), async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;

    // Don't allow admins to delete themselves
    if (id === req.user?.id) {
      return res.status(400).json({ message: 'Cannot delete yourself' });
    }

    // Check if user exists
    const { data: user, error: fetchError } = await supabase
      .from('users')
      .select('user_id, email, is_admin')
      .eq('user_id', id)
      .single();

    if (fetchError || !user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Don't allow deleting other admins
    if (user.is_admin) {
      return res.status(403).json({ message: 'Cannot delete admin users' });
    }

    // Soft delete by setting a deleted flag (or you can hard delete if preferred)
    // For now, we'll just suspend and mark with a special flag in the future
    // If you want hard delete, use: await supabase.from('users').delete().eq('user_id', id);

    // For soft delete, we'll suspend and add a deleted_at timestamp
    const { error: deleteError } = await supabase
      .from('users')
      .update({
        suspended: true,
        // Note: You may want to add a 'deleted_at' column for proper soft delete
      })
      .eq('user_id', id);

    if (deleteError) {
      throw deleteError;
    }

    res.json({ success: true, message: 'User deleted successfully' });
  } catch (error) {
    next(error);
  }
});

// Get admin activity logs
router.get('/logs', createAdminLogger(AdminAction.VIEW_LOGS), async (req: AuthRequest, res, next) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const action = req.query.action as AdminAction | undefined;
    const adminId = req.query.adminId ? parseInt(req.query.adminId as string) : undefined;
    const targetUserId = req.query.targetUserId ? parseInt(req.query.targetUserId as string) : undefined;
    const startDate = req.query.startDate as string | undefined;
    const endDate = req.query.endDate as string | undefined;

    const result = await getAdminLogs(page, limit, {
      action,
      adminId,
      targetUserId,
      startDate,
      endDate,
    });

    res.json(result);
  } catch (error) {
    next(error);
  }
});

export { router as adminRoutes };