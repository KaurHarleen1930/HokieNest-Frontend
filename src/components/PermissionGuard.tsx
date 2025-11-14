import { ReactNode } from 'react';
import { useAuth } from '@/lib/auth';

interface PermissionGuardProps {
  /** Single permission required */
  permission?: string;
  /** Multiple permissions - user needs ANY of these */
  anyPermission?: string[];
  /** Multiple permissions - user needs ALL of these */
  allPermissions?: string[];
  /** Admin role required */
  role?: 'SUPER_ADMIN' | 'CONTENT_ADMIN' | 'COMMUNITY_ADMIN';
  /** Children to render if user has permission */
  children: ReactNode;
  /** Optional fallback to render if permission is denied */
  fallback?: ReactNode;
}

/**
 * Permission Guard Component
 *
 * Conditionally renders children based on user permissions.
 *
 * @example
 * // Single permission
 * <PermissionGuard permission="approve_listings">
 *   <ApproveButton />
 * </PermissionGuard>
 *
 * @example
 * // Any of multiple permissions
 * <PermissionGuard anyPermission={['view_analytics', 'manage_listings']}>
 *   <DashboardLink />
 * </PermissionGuard>
 *
 * @example
 * // Specific role
 * <PermissionGuard role="SUPER_ADMIN">
 *   <AdminSettingsButton />
 * </PermissionGuard>
 *
 * @example
 * // With fallback
 * <PermissionGuard permission="suspend_users" fallback={<p>Access denied</p>}>
 *   <SuspendButton />
 * </PermissionGuard>
 */
export function PermissionGuard({
  permission,
  anyPermission,
  allPermissions,
  role,
  children,
  fallback = null,
}: PermissionGuardProps) {
  const { user, hasPermission, hasAnyPermission } = useAuth();

  // Not logged in or not an admin
  if (!user || user.role !== 'admin') {
    return <>{fallback}</>;
  }

  // Check specific role if provided
  if (role && user.adminRole !== role) {
    return <>{fallback}</>;
  }

  // Check single permission
  if (permission && !hasPermission(permission)) {
    return <>{fallback}</>;
  }

  // Check any of multiple permissions
  if (anyPermission && !hasAnyPermission(anyPermission)) {
    return <>{fallback}</>;
  }

  // Check all permissions (all must be present)
  if (allPermissions) {
    const hasAll = allPermissions.every(perm => hasPermission(perm));
    if (!hasAll) {
      return <>{fallback}</>;
    }
  }

  // User has required permissions, render children
  return <>{children}</>;
}

/**
 * Hook version of PermissionGuard for more complex logic
 *
 * @example
 * const canApprove = usePermissionCheck({ permission: 'approve_listings' });
 * if (!canApprove) return null;
 */
export function usePermissionCheck(options: {
  permission?: string;
  anyPermission?: string[];
  allPermissions?: string[];
  role?: 'SUPER_ADMIN' | 'CONTENT_ADMIN' | 'COMMUNITY_ADMIN';
}): boolean {
  const { user, hasPermission, hasAnyPermission } = useAuth();

  // Not logged in or not an admin
  if (!user || user.role !== 'admin') {
    return false;
  }

  // Check specific role if provided
  if (options.role && user.adminRole !== options.role) {
    return false;
  }

  // Check single permission
  if (options.permission && !hasPermission(options.permission)) {
    return false;
  }

  // Check any of multiple permissions
  if (options.anyPermission && !hasAnyPermission(options.anyPermission)) {
    return false;
  }

  // Check all permissions
  if (options.allPermissions) {
    return options.allPermissions.every(perm => hasPermission(perm));
  }

  return true;
}
