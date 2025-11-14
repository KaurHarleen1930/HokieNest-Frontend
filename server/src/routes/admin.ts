import { Router } from 'express';
import { supabase } from '../lib/supabase';
import { authenticateToken, requireAdmin, requirePermission, AuthRequest } from '../middleware/auth';
import { createAdminLogger, AdminAction, getAdminLogs } from '../middleware/adminLogger';
import { getAllAdmins, getAllPermissions } from '../services/adminService';

const router = Router();

// Apply auth middleware to all admin routes
router.use(authenticateToken);
// Note: We no longer use blanket requireAdmin - each route has specific permission checks

// Get all users with optional search
// Requires: view_all_users permission (COMMUNITY_ADMIN, SUPER_ADMIN)
router.get('/users', requirePermission('view_all_users'), createAdminLogger(AdminAction.VIEW_USERS), async (req: AuthRequest, res, next) => {
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
// Requires: suspend_users permission (COMMUNITY_ADMIN, SUPER_ADMIN)
router.post('/users/:id/suspend', requirePermission('suspend_users'), createAdminLogger(AdminAction.SUSPEND_USER), async (req: AuthRequest, res, next) => {
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
// Requires: suspend_users permission (COMMUNITY_ADMIN, SUPER_ADMIN)
router.post('/users/:id/unsuspend', requirePermission('suspend_users'), createAdminLogger(AdminAction.UNSUSPEND_USER), async (req: AuthRequest, res, next) => {
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
// Requires: suspend_users permission (COMMUNITY_ADMIN, SUPER_ADMIN) - delete requires same as suspend
router.delete('/users/:id', requirePermission('suspend_users'), createAdminLogger(AdminAction.DELETE_USER), async (req: AuthRequest, res, next) => {
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
// Requires: view_admin_logs permission (SUPER_ADMIN only)
router.get('/logs', requirePermission('view_admin_logs'), createAdminLogger(AdminAction.VIEW_LOGS), async (req: AuthRequest, res, next) => {
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

// Get all admin users with their permissions
// Requires: manage_admins permission (SUPER_ADMIN only)
router.get('/admins', requirePermission('manage_admins'), async (req: AuthRequest, res, next) => {
  try {
    const admins = await getAllAdmins(parseInt(req.user!.id));
    res.json(admins);
  } catch (error) {
    next(error);
  }
});

// Get all available permissions
// Requires: manage_admins permission (SUPER_ADMIN only)
router.get('/permissions', requirePermission('manage_admins'), async (req: AuthRequest, res, next) => {
  try {
    const permissions = await getAllPermissions();
    res.json(permissions);
  } catch (error) {
    next(error);
  }
});

// Get current admin's permissions
// Any authenticated admin can view their own permissions
router.get('/me/permissions', requireAdmin, async (req: AuthRequest, res, next) => {
  try {
    res.json({
      adminRole: req.user?.adminRole || null,
      permissions: req.user?.permissions || [],
    });
  } catch (error) {
    next(error);
  }
});

// Create a new admin user
// Requires: manage_admins permission (SUPER_ADMIN only)
router.post('/admins', requirePermission('manage_admins'), createAdminLogger(AdminAction.CREATE_ADMIN), async (req: AuthRequest, res, next) => {
  try {
    const { userId, role, permissions } = req.body;

    // Validate input
    if (!userId || !role) {
      return res.status(400).json({ message: 'userId and role are required' });
    }

    // Validate role
    const validRoles = ['SUPER_ADMIN', 'CONTENT_ADMIN', 'COMMUNITY_ADMIN'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ message: 'Invalid role' });
    }

    // Check if user exists
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('user_id, email, first_name, last_name')
      .eq('user_id', userId)
      .single();

    if (userError || !user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check if user is already an admin
    const { data: existingAdmin } = await supabase
      .from('admin_users')
      .select('admin_id')
      .eq('user_id', userId)
      .single();

    if (existingAdmin) {
      return res.status(400).json({ message: 'User is already an admin' });
    }

    // Create admin user
    const { data: newAdmin, error: adminError } = await supabase
      .from('admin_users')
      .insert({
        user_id: userId,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        role,
        is_active: true,
      })
      .select()
      .single();

    if (adminError) {
      throw adminError;
    }

    // Mark user as admin in users table
    await supabase
      .from('users')
      .update({ is_admin: true })
      .eq('user_id', userId);

    // Assign permissions if provided
    if (permissions && Array.isArray(permissions) && permissions.length > 0) {
      // Get permission IDs
      const { data: permissionData } = await supabase
        .from('admin_permissions')
        .select('permission_id, name')
        .in('name', permissions);

      if (permissionData && permissionData.length > 0) {
        const permissionsToInsert = permissionData.map(p => ({
          admin_id: newAdmin.admin_id,
          permission_id: p.permission_id,
        }));

        await supabase
          .from('admin_user_permissions')
          .insert(permissionsToInsert);
      }
    }

    res.status(201).json({ success: true, message: 'Admin created successfully', admin: newAdmin });
  } catch (error) {
    next(error);
  }
});

// Update admin role
// Requires: manage_admins permission (SUPER_ADMIN only)
router.put('/admins/:adminId/role', requirePermission('manage_admins'), createAdminLogger(AdminAction.UPDATE_ADMIN), async (req: AuthRequest, res, next) => {
  try {
    const { adminId } = req.params;
    const { role } = req.body;

    // Validate role
    const validRoles = ['SUPER_ADMIN', 'CONTENT_ADMIN', 'COMMUNITY_ADMIN'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ message: 'Invalid role' });
    }

    // Prevent admin from demoting themselves
    const { data: targetAdmin } = await supabase
      .from('admin_users')
      .select('user_id')
      .eq('admin_id', adminId)
      .single();

    if (targetAdmin && targetAdmin.user_id.toString() === req.user!.id) {
      return res.status(400).json({ message: 'Cannot modify your own admin role' });
    }

    // Update admin role
    const { error: updateError } = await supabase
      .from('admin_users')
      .update({ role })
      .eq('admin_id', adminId);

    if (updateError) {
      throw updateError;
    }

    res.json({ success: true, message: 'Admin role updated successfully' });
  } catch (error) {
    next(error);
  }
});

// Update admin permissions (set specific permissions)
// Requires: manage_admins permission (SUPER_ADMIN only)
router.put('/admins/:adminId/permissions', requirePermission('manage_admins'), createAdminLogger(AdminAction.UPDATE_ADMIN), async (req: AuthRequest, res, next) => {
  try {
    const { adminId } = req.params;
    const { permissions } = req.body;

    if (!Array.isArray(permissions)) {
      return res.status(400).json({ message: 'Permissions must be an array' });
    }

    // Prevent admin from modifying their own permissions
    const { data: targetAdmin } = await supabase
      .from('admin_users')
      .select('user_id')
      .eq('admin_id', adminId)
      .single();

    if (targetAdmin && targetAdmin.user_id.toString() === req.user!.id) {
      return res.status(400).json({ message: 'Cannot modify your own permissions' });
    }

    // Delete all existing permissions for this admin
    await supabase
      .from('admin_user_permissions')
      .delete()
      .eq('admin_id', adminId);

    // Add new permissions if any provided
    if (permissions.length > 0) {
      // Get permission IDs
      const { data: permissionData } = await supabase
        .from('admin_permissions')
        .select('permission_id, name')
        .in('name', permissions);

      if (permissionData && permissionData.length > 0) {
        const permissionsToInsert = permissionData.map(p => ({
          admin_id: parseInt(adminId),
          permission_id: p.permission_id,
        }));

        await supabase
          .from('admin_user_permissions')
          .insert(permissionsToInsert);
      }
    }

    res.json({ success: true, message: 'Admin permissions updated successfully' });
  } catch (error) {
    next(error);
  }
});

// Remove admin access
// Requires: manage_admins permission (SUPER_ADMIN only)
router.delete('/admins/:adminId', requirePermission('manage_admins'), createAdminLogger(AdminAction.DELETE_ADMIN), async (req: AuthRequest, res, next) => {
  try {
    const { adminId } = req.params;

    // Prevent admin from removing themselves
    const { data: targetAdmin } = await supabase
      .from('admin_users')
      .select('user_id')
      .eq('admin_id', adminId)
      .single();

    if (!targetAdmin) {
      return res.status(404).json({ message: 'Admin not found' });
    }

    if (targetAdmin.user_id.toString() === req.user!.id) {
      return res.status(400).json({ message: 'Cannot remove your own admin access' });
    }

    // Delete admin permissions
    await supabase
      .from('admin_user_permissions')
      .delete()
      .eq('admin_id', adminId);

    // Delete admin user record
    const { error: deleteError } = await supabase
      .from('admin_users')
      .delete()
      .eq('admin_id', adminId);

    if (deleteError) {
      throw deleteError;
    }

    // Remove admin flag from users table
    await supabase
      .from('users')
      .update({ is_admin: false })
      .eq('user_id', targetAdmin.user_id);

    res.json({ success: true, message: 'Admin access removed successfully' });
  } catch (error) {
    next(error);
  }
});

export { router as adminRoutes };