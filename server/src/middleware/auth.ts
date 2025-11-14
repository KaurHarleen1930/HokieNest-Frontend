import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { supabase } from '../lib/supabase';
import { getAdminWithPermissions, hasPermission, hasAnyPermission, AdminRole } from '../services/adminService';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    name: string;
    role: 'student' | 'staff' | 'admin';
    adminRole?: AdminRole;
    permissions?: string[];
  };
}

export const authenticateToken = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Access token required' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string };

    const { data: user } = await supabase
      .from('users')
      .select('user_id, email, first_name, last_name, is_admin, suspended')
      .eq('user_id', decoded.userId)
      .single();

    if (!user) {
      return res.status(401).json({ message: 'Invalid token' });
    }

    // Check if user is suspended
    if (user.suspended) {
      return res.status(403).json({ message: 'Your account has been suspended. Please contact support.' });
    }

    // Check if user is in admin_users table (for granular admin types)
    const adminData = await getAdminWithPermissions(user.user_id);

    // Format user for the application
    const formattedUser = {
      id: user.user_id, // Keep as original type (UUID or integer)
      email: user.email,
      name: `${user.first_name || ''} ${user.last_name || ''}`.trim() || 'User',
      role: (user.is_admin || adminData) ? 'admin' : 'student',
      ...(adminData && {
        adminRole: adminData.role,
        permissions: adminData.permissions,
      }),
    };

    req.user = formattedUser;
    next();
  } catch (error) {
    return res.status(403).json({ message: 'Invalid token' });
  }
};

export const requireAdmin = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Authentication required' });
  }

  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Admin access required' });
  }

  next();
};

/**
 * Middleware to require a specific permission
 * Usage: router.get('/admin/users', authenticateToken, requirePermission('view_all_users'), handler)
 */
export const requirePermission = (permissionName: string) => {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    // Check if user has the required permission
    const userHasPermission = await hasPermission(parseInt(req.user.id), permissionName);

    if (!userHasPermission) {
      return res.status(403).json({
        message: `Permission denied. Required permission: ${permissionName}`
      });
    }

    next();
  };
};

/**
 * Middleware to require ANY of the specified permissions
 * Usage: router.get('/admin/resource', authenticateToken, requireAnyPermission(['perm1', 'perm2']), handler)
 */
export const requireAnyPermission = (permissionNames: string[]) => {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    // Check if user has any of the required permissions
    const userHasPermission = await hasAnyPermission(parseInt(req.user.id), permissionNames);

    if (!userHasPermission) {
      return res.status(403).json({
        message: `Permission denied. Required permissions (any): ${permissionNames.join(', ')}`
      });
    }

    next();
  };
};

/**
 * Middleware to require admin role (uses new admin_users table)
 * This is similar to requireAdmin but specifically checks the admin_users table
 */
export const requireAdminRole = (roles: AdminRole[]) => {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    if (!req.user.adminRole || !roles.includes(req.user.adminRole)) {
      return res.status(403).json({
        message: `Access denied. Required role: ${roles.join(' or ')}`
      });
    }

    next();
  };
};