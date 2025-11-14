import { supabase } from '../lib/supabase';

export type AdminRole = 'SUPER_ADMIN' | 'CONTENT_ADMIN' | 'COMMUNITY_ADMIN';

export interface AdminUser {
  admin_id: number;
  user_id: number;
  email: string;
  first_name: string | null;
  last_name: string | null;
  role: AdminRole;
  is_active: boolean;
  created_at: string;
}

export interface Permission {
  permission_id: number;
  name: string;
  description: string | null;
}

export interface AdminWithPermissions extends AdminUser {
  permissions: string[];
}

/**
 * Permission cache to reduce database queries
 * Maps admin_id to their permissions
 */
const permissionCache = new Map<number, { permissions: string[]; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Get admin user by user_id
 */
export async function getAdminByUserId(userId: number): Promise<AdminUser | null> {
  const { data, error } = await supabase
    .from('admin_users')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true)
    .single();

  if (error || !data) {
    return null;
  }

  return data as AdminUser;
}

/**
 * Get admin user with all their permissions
 */
export async function getAdminWithPermissions(userId: number): Promise<AdminWithPermissions | null> {
  // Get admin user
  const admin = await getAdminByUserId(userId);
  if (!admin) {
    return null;
  }

  // Check cache first
  const cached = permissionCache.get(admin.admin_id);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return {
      ...admin,
      permissions: cached.permissions,
    };
  }

  // Fetch permissions from database
  const { data: permissionData, error } = await supabase
    .from('admin_user_permissions')
    .select(`
      permission_id,
      admin_permissions (
        name
      )
    `)
    .eq('admin_id', admin.admin_id);

  if (error) {
    console.error('Error fetching admin permissions:', error);
    return {
      ...admin,
      permissions: [],
    };
  }

  // Extract permission names
  const permissions = permissionData
    .map((p: any) => p.admin_permissions?.name)
    .filter(Boolean) as string[];

  // Update cache
  permissionCache.set(admin.admin_id, {
    permissions,
    timestamp: Date.now(),
  });

  return {
    ...admin,
    permissions,
  };
}

/**
 * Check if admin has a specific permission
 * SUPER_ADMIN with 'all_permissions' gets access to everything
 */
export async function hasPermission(userId: number, permissionName: string): Promise<boolean> {
  const admin = await getAdminWithPermissions(userId);

  if (!admin) {
    return false;
  }

  // SUPER_ADMIN with all_permissions meta permission gets everything
  if (admin.permissions.includes('all_permissions')) {
    return true;
  }

  // Check for specific permission
  return admin.permissions.includes(permissionName);
}

/**
 * Check if admin has ANY of the specified permissions
 */
export async function hasAnyPermission(userId: number, permissionNames: string[]): Promise<boolean> {
  const admin = await getAdminWithPermissions(userId);

  if (!admin) {
    return false;
  }

  // SUPER_ADMIN with all_permissions gets everything
  if (admin.permissions.includes('all_permissions')) {
    return true;
  }

  // Check if admin has any of the permissions
  return permissionNames.some(perm => admin.permissions.includes(perm));
}

/**
 * Check if admin has ALL of the specified permissions
 */
export async function hasAllPermissions(userId: number, permissionNames: string[]): Promise<boolean> {
  const admin = await getAdminWithPermissions(userId);

  if (!admin) {
    return false;
  }

  // SUPER_ADMIN with all_permissions gets everything
  if (admin.permissions.includes('all_permissions')) {
    return true;
  }

  // Check if admin has all of the permissions
  return permissionNames.every(perm => admin.permissions.includes(perm));
}

/**
 * Assign a permission to an admin
 * Only SUPER_ADMIN with 'manage_admins' permission can do this
 */
export async function assignPermission(
  requestingAdminUserId: number,
  targetAdminId: number,
  permissionName: string
): Promise<{ success: boolean; message: string }> {
  // Check if requesting admin has permission to manage admins
  const hasManagePermission = await hasPermission(requestingAdminUserId, 'manage_admins');
  if (!hasManagePermission) {
    return { success: false, message: 'Insufficient permissions to manage admins' };
  }

  // Get permission ID
  const { data: permission } = await supabase
    .from('admin_permissions')
    .select('permission_id')
    .eq('name', permissionName)
    .single();

  if (!permission) {
    return { success: false, message: 'Permission not found' };
  }

  // Assign permission
  const { error } = await supabase
    .from('admin_user_permissions')
    .insert({
      admin_id: targetAdminId,
      permission_id: permission.permission_id,
    });

  if (error) {
    // Handle unique constraint violation (permission already assigned)
    if (error.code === '23505') {
      return { success: false, message: 'Permission already assigned' };
    }
    return { success: false, message: 'Failed to assign permission' };
  }

  // Clear cache for this admin
  permissionCache.delete(targetAdminId);

  return { success: true, message: 'Permission assigned successfully' };
}

/**
 * Revoke a permission from an admin
 * Only SUPER_ADMIN with 'manage_admins' permission can do this
 */
export async function revokePermission(
  requestingAdminUserId: number,
  targetAdminId: number,
  permissionName: string
): Promise<{ success: boolean; message: string }> {
  // Check if requesting admin has permission to manage admins
  const hasManagePermission = await hasPermission(requestingAdminUserId, 'manage_admins');
  if (!hasManagePermission) {
    return { success: false, message: 'Insufficient permissions to manage admins' };
  }

  // Get permission ID
  const { data: permission } = await supabase
    .from('admin_permissions')
    .select('permission_id')
    .eq('name', permissionName)
    .single();

  if (!permission) {
    return { success: false, message: 'Permission not found' };
  }

  // Revoke permission
  const { error } = await supabase
    .from('admin_user_permissions')
    .delete()
    .eq('admin_id', targetAdminId)
    .eq('permission_id', permission.permission_id);

  if (error) {
    return { success: false, message: 'Failed to revoke permission' };
  }

  // Clear cache for this admin
  permissionCache.delete(targetAdminId);

  return { success: true, message: 'Permission revoked successfully' };
}

/**
 * Get all available permissions
 */
export async function getAllPermissions(): Promise<Permission[]> {
  const { data, error } = await supabase
    .from('admin_permissions')
    .select('*')
    .order('name');

  if (error) {
    console.error('Error fetching permissions:', error);
    return [];
  }

  return data as Permission[];
}

/**
 * Get all admin users with their roles and permissions
 * Only accessible by SUPER_ADMIN with 'manage_admins'
 */
export async function getAllAdmins(requestingAdminUserId: number): Promise<AdminWithPermissions[]> {
  // Check permission
  const hasManagePermission = await hasPermission(requestingAdminUserId, 'manage_admins');
  if (!hasManagePermission) {
    return [];
  }

  // Get all admin users
  const { data: admins, error: adminError } = await supabase
    .from('admin_users')
    .select('*')
    .order('created_at', { ascending: false });

  if (adminError || !admins) {
    return [];
  }

  // Get permissions for each admin
  const adminsWithPermissions: AdminWithPermissions[] = [];

  for (const admin of admins) {
    const { data: permissionData } = await supabase
      .from('admin_user_permissions')
      .select(`
        admin_permissions (
          name
        )
      `)
      .eq('admin_id', admin.admin_id);

    const permissions = permissionData
      ?.map((p: any) => p.admin_permissions?.name)
      .filter(Boolean) || [];

    adminsWithPermissions.push({
      ...admin,
      permissions,
    });
  }

  return adminsWithPermissions;
}

/**
 * Clear permission cache (useful after bulk permission changes)
 */
export function clearPermissionCache(): void {
  permissionCache.clear();
}

/**
 * Clear cache for a specific admin
 */
export function clearAdminCache(adminId: number): void {
  permissionCache.delete(adminId);
}
