import { Router } from 'express';
import { supabase } from '../lib/supabase';
import { authenticateToken, requireAdmin, AuthRequest } from '../middleware/auth';

const router = Router();

// Apply auth middleware to all admin routes
router.use(authenticateToken);
router.use(requireAdmin);

// Get all users
router.get('/users', async (req: AuthRequest, res, next) => {
  try {
    const { data: users, error } = await supabase
      .from('users')
      .select('user_id, email, first_name, last_name, is_admin, suspended, created_at')
      .order('created_at', { ascending: false });

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
router.post('/users/:id/suspend', async (req: AuthRequest, res, next) => {
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

export { router as adminRoutes };