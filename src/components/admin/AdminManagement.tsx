import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { adminAPI, usersAPI, AdminUser, Permission, User } from '@/lib/api';
import { Shield, UserPlus, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { ErrorState } from '@/components/ui/error-state';
import { useAuth } from '@/lib/auth';

// Role-based permission presets
const ROLE_PERMISSIONS: Record<string, string[]> = {
  SUPER_ADMIN: ['all_permissions'], // Super admins get all permissions
  CONTENT_ADMIN: [
    'view_all_users',
    'view_analytics',
    'view_admin_logs',
  ],
  COMMUNITY_ADMIN: [
    'view_all_users',
    'suspend_users',
    'review_reports',
    'view_admin_logs',
  ],
};

export function AdminManagement() {
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create admin dialog state
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [selectedRole, setSelectedRole] = useState<'SUPER_ADMIN' | 'CONTENT_ADMIN' | 'COMMUNITY_ADMIN'>('CONTENT_ADMIN');
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const [isCreating, setIsCreating] = useState(false);


  const { toast } = useToast();
  const { user: currentUser } = useAuth();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [adminsData, permissionsData, usersData] = await Promise.all([
        adminAPI.getAllAdmins(),
        adminAPI.getAllPermissions(),
        usersAPI.getAll(),
      ]);
      setAdmins(adminsData);
      setPermissions(permissionsData);
      setUsers(usersData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load admin data');
    } finally {
      setLoading(false);
    }
  };

  // Update permissions when role changes
  useEffect(() => {
    if (selectedRole && createDialogOpen) {
      setSelectedPermissions(ROLE_PERMISSIONS[selectedRole] || []);
    }
  }, [selectedRole, createDialogOpen]);

  const handleCreateAdmin = async () => {
    if (!selectedUserId || !selectedRole) {
      toast({
        title: 'Validation error',
        description: 'Please select a user and role',
        variant: 'destructive',
      });
      return;
    }

    try {
      setIsCreating(true);
      await adminAPI.createAdmin({
        userId: selectedUserId,
        role: selectedRole,
        permissions: selectedPermissions,
      });

      toast({
        title: 'Admin created',
        description: 'The user has been successfully granted admin access.',
      });

      setCreateDialogOpen(false);
      setSelectedUserId('');
      setSelectedRole('CONTENT_ADMIN');
      setSelectedPermissions([]);
      fetchData();
    } catch (err) {
      toast({
        title: 'Creation failed',
        description: err instanceof Error ? err.message : 'Failed to create admin',
        variant: 'destructive',
      });
    } finally {
      setIsCreating(false);
    }
  };

  const handleRemoveAdmin = async (admin: AdminUser) => {
    // Prevent removing yourself
    const adminUserId = admin.user_id.toString();
    if (adminUserId === currentUser?.id) {
      toast({
        title: 'Cannot remove yourself',
        description: 'You cannot remove your own admin access.',
        variant: 'destructive',
      });
      return;
    }

    if (!confirm(`Are you sure you want to remove admin access for ${admin.first_name} ${admin.last_name}?`)) {
      return;
    }

    try {
      await adminAPI.removeAdmin(admin.admin_id);

      toast({
        title: 'Admin removed',
        description: 'Admin access has been successfully removed.',
      });

      fetchData();
    } catch (err) {
      toast({
        title: 'Removal failed',
        description: err instanceof Error ? err.message : 'Failed to remove admin',
        variant: 'destructive',
      });
    }
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'SUPER_ADMIN':
        return 'destructive';
      case 'CONTENT_ADMIN':
        return 'default';
      case 'COMMUNITY_ADMIN':
        return 'accent';
      default:
        return 'secondary';
    }
  };

  const formatRoleName = (role: string) => {
    return role.replace(/_/g, ' ');
  };

  const handlePermissionToggle = (permissionName: string) => {
    setSelectedPermissions(prev =>
      prev.includes(permissionName)
        ? prev.filter(p => p !== permissionName)
        : [...prev, permissionName]
    );
  };

  // Filter out users who are already admins
  const availableUsers = users.filter(
    user => !admins.some(admin => admin.user_id.toString() === user.id)
  );

  if (loading) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="h-32 bg-surface-2 rounded"></div>
        <div className="h-96 bg-surface-2 rounded"></div>
      </div>
    );
  }

  if (error) {
    return (
      <ErrorState
        title="Failed to load admin data"
        description={error}
        onRetry={fetchData}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Create Button */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Admin Management</h2>
          <p className="text-muted">Manage admin users and their permissions</p>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)}>
          <UserPlus className="h-4 w-4 mr-2" />
          Create Admin
        </Button>
      </div>

      {/* Admins Table */}
      <Card className="bg-surface border-surface-3">
        <CardHeader>
          <CardTitle>Administrator Accounts</CardTitle>
          <CardDescription>
            {admins.length} admin{admins.length !== 1 ? 's' : ''} with platform management access
          </CardDescription>
        </CardHeader>
        <CardContent>
          {admins.length === 0 ? (
            <div className="text-center py-12">
              <Shield className="h-12 w-12 text-muted mx-auto mb-4" />
              <p className="text-muted">No administrators found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Permissions</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {admins.map((admin) => {
                    const isCurrentUser = admin.user_id.toString() === currentUser?.id;
                    return (
                      <TableRow key={admin.admin_id}>
                        <TableCell className="font-medium text-foreground">
                          {admin.first_name} {admin.last_name}
                          {isCurrentUser && (
                            <Badge variant="outline" className="ml-2 text-xs">You</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-muted">{admin.email}</TableCell>
                        <TableCell>
                          <Badge variant={getRoleBadgeVariant(admin.role)}>
                            {formatRoleName(admin.role)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {admin.permissions.includes('all_permissions') ? (
                              <Badge variant="secondary" className="text-xs">All Permissions</Badge>
                            ) : (
                              admin.permissions.slice(0, 3).map(perm => (
                                <Badge key={perm} variant="secondary" className="text-xs">
                                  {perm.replace(/_/g, ' ')}
                                </Badge>
                              ))
                            )}
                            {admin.permissions.length > 3 && !admin.permissions.includes('all_permissions') && (
                              <Badge variant="secondary" className="text-xs">
                                +{admin.permissions.length - 3} more
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={admin.is_active ? 'success' : 'secondary'}>
                            {admin.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            {!isCurrentUser && (
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => handleRemoveAdmin(admin)}
                              >
                                <Trash2 className="h-4 w-4 mr-1" />
                                Remove
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Admin Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create New Admin</DialogTitle>
            <DialogDescription>
              Grant admin access to a user and configure their role and permissions.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* User Selection */}
            <div>
              <Label htmlFor="user">Select User</Label>
              <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a user..." />
                </SelectTrigger>
                <SelectContent>
                  {availableUsers.map(user => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.name} ({user.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Role Selection */}
            <div>
              <Label htmlFor="role">Admin Role</Label>
              <Select value={selectedRole} onValueChange={(val) => setSelectedRole(val as any)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="SUPER_ADMIN">Super Admin (Full Access)</SelectItem>
                  <SelectItem value="CONTENT_ADMIN">Content Admin (Analytics & Content)</SelectItem>
                  <SelectItem value="COMMUNITY_ADMIN">Community Admin (Users & Reports)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-sm text-muted mt-1">
                Selecting a role will auto-select relevant permissions
              </p>
            </div>

            {/* Permissions */}
            <div>
              <Label>Permissions</Label>
              <div className="mt-2 space-y-2 max-h-64 overflow-y-auto border border-surface-3 rounded p-3">
                {permissions.map(permission => (
                  <div key={permission.permission_id} className="flex items-start space-x-2">
                    <Checkbox
                      id={`create-perm-${permission.permission_id}`}
                      checked={selectedPermissions.includes(permission.name)}
                      onCheckedChange={() => handlePermissionToggle(permission.name)}
                    />
                    <div className="flex flex-col">
                      <label
                        htmlFor={`create-perm-${permission.permission_id}`}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                      >
                        {permission.name.replace(/_/g, ' ')}
                      </label>
                      {permission.description && (
                        <p className="text-xs text-muted">{permission.description}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateAdmin} disabled={isCreating}>
              {isCreating ? 'Creating...' : 'Create Admin'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
