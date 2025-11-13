import { Response, NextFunction } from 'express';
import { supabase } from '../lib/supabase';
import { AuthRequest } from './auth';

/**
 * Admin action types for logging
 */
export enum AdminAction {
  SUSPEND_USER = 'suspend_user',
  UNSUSPEND_USER = 'unsuspend_user',
  DELETE_USER = 'delete_user',
  PROMOTE_USER = 'promote_user',
  DEMOTE_USER = 'demote_user',
  VIEW_USERS = 'view_users',
  VIEW_LOGS = 'view_logs',
  UPDATE_USER = 'update_user',
}

/**
 * Log an admin action to the admin_activity_logs table
 */
export async function logAdminAction(
  adminId: number,
  action: AdminAction,
  targetUserId: number | null = null,
  details: Record<string, any> = {},
  ipAddress: string | null = null,
  userAgent: string | null = null
): Promise<void> {
  try {
    const { error } = await supabase
      .from('admin_activity_logs')
      .insert({
        admin_id: adminId,
        action,
        target_user_id: targetUserId,
        details,
        ip_address: ipAddress,
        user_agent: userAgent,
      });

    if (error) {
      console.error('Failed to log admin action:', error);
      // Don't throw - logging failures shouldn't break the main operation
    }
  } catch (error) {
    console.error('Error in logAdminAction:', error);
  }
}

/**
 * Middleware to automatically log admin actions
 * Extracts action info from request and logs after successful response
 */
export function createAdminLogger(action: AdminAction) {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    // Store original send function
    const originalSend = res.send;

    // Override send to log after successful response
    res.send = function (body: any): Response {
      // Only log if response was successful (2xx status)
      if (res.statusCode >= 200 && res.statusCode < 300) {
        const adminId = req.user?.id ? parseInt(req.user.id) : 0;
        const targetUserId = req.params.id ? parseInt(req.params.id) : null;
        const ipAddress = req.ip || req.socket.remoteAddress || null;
        const userAgent = req.get('user-agent') || null;

        // Extract relevant details from request
        const details: Record<string, any> = {
          method: req.method,
          path: req.path,
          timestamp: new Date().toISOString(),
        };

        // Add query params if present
        if (Object.keys(req.query).length > 0) {
          details.query = req.query;
        }

        // Add body params for certain actions (excluding sensitive data)
        if (req.body && Object.keys(req.body).length > 0) {
          const safeBody = { ...req.body };
          delete safeBody.password;
          delete safeBody.password_hash;
          delete safeBody.reset_token;
          details.body = safeBody;
        }

        // Log the action asynchronously
        logAdminAction(adminId, action, targetUserId, details, ipAddress, userAgent).catch(
          (err) => console.error('Failed to log admin action:', err)
        );
      }

      // Call original send
      return originalSend.call(this, body);
    };

    next();
  };
}

/**
 * Get admin logs with pagination and filtering
 */
export async function getAdminLogs(
  page: number = 1,
  limit: number = 50,
  filters: {
    action?: AdminAction;
    adminId?: number;
    targetUserId?: number;
    startDate?: string;
    endDate?: string;
  } = {}
): Promise<{ logs: any[]; total: number; page: number; limit: number }> {
  try {
    // Build query
    let query = supabase
      .from('admin_activity_logs')
      .select(
        `
        *,
        admin:admin_id (user_id, email, first_name, last_name),
        target_user:target_user_id (user_id, email, first_name, last_name)
      `,
        { count: 'exact' }
      );

    // Apply filters
    if (filters.action) {
      query = query.eq('action', filters.action);
    }
    if (filters.adminId) {
      query = query.eq('admin_id', filters.adminId);
    }
    if (filters.targetUserId) {
      query = query.eq('target_user_id', filters.targetUserId);
    }
    if (filters.startDate) {
      query = query.gte('created_at', filters.startDate);
    }
    if (filters.endDate) {
      query = query.lte('created_at', filters.endDate);
    }

    // Apply pagination
    const offset = (page - 1) * limit;
    query = query.order('created_at', { ascending: false }).range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      throw error;
    }

    return {
      logs: data || [],
      total: count || 0,
      page,
      limit,
    };
  } catch (error) {
    console.error('Error fetching admin logs:', error);
    throw error;
  }
}
