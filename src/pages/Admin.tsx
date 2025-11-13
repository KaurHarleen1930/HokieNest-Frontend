import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ErrorState } from "@/components/ui/error-state";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { usersAPI, User } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Shield, Users, UserX, AlertTriangle, Search, Trash2, UserCheck, FileText } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { AdminLogsTable } from "@/components/admin/AdminLogsTable";

export default function Admin() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [suspendingUsers, setSuspendingUsers] = useState<Set<string>>(new Set());
  const [unsuspendingUsers, setUnsuspendingUsers] = useState<Set<string>>(new Set());
  const [deletingUsers, setDeletingUsers] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [userToDelete, setUserToDelete] = useState<string | null>(null);

  const { user: currentUser } = useAuth();
  const { toast } = useToast();

  const fetchUsers = async (search?: string) => {
    try {
      setLoading(true);
      setError(null);
      const data = await usersAPI.getAll(search);
      setUsers(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch users");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleSuspendUser = async (userId: string) => {
    if (userId === currentUser?.id) {
      toast({
        title: "Cannot suspend yourself",
        description: "You cannot suspend your own account.",
        variant: "destructive",
      });
      return;
    }

    try {
      setSuspendingUsers(prev => new Set(prev).add(userId));
      await usersAPI.suspend(userId);

      // Update local state
      setUsers(prev => prev.map(user =>
        user.id === userId ? { ...user, suspended: true } : user
      ));

      toast({
        title: "User suspended",
        description: "The user has been successfully suspended.",
      });
    } catch (err) {
      toast({
        title: "Suspension failed",
        description: err instanceof Error ? err.message : "Failed to suspend user",
        variant: "destructive",
      });
    } finally {
      setSuspendingUsers(prev => {
        const newSet = new Set(prev);
        newSet.delete(userId);
        return newSet;
      });
    }
  };

  const handleUnsuspendUser = async (userId: string) => {
    try {
      setUnsuspendingUsers(prev => new Set(prev).add(userId));
      await usersAPI.unsuspend(userId);

      // Update local state
      setUsers(prev => prev.map(user =>
        user.id === userId ? { ...user, suspended: false } : user
      ));

      toast({
        title: "User unsuspended",
        description: "The user has been successfully unsuspended.",
      });
    } catch (err) {
      toast({
        title: "Unsuspension failed",
        description: err instanceof Error ? err.message : "Failed to unsuspend user",
        variant: "destructive",
      });
    } finally {
      setUnsuspendingUsers(prev => {
        const newSet = new Set(prev);
        newSet.delete(userId);
        return newSet;
      });
    }
  };

  const handleDeleteUser = async () => {
    if (!userToDelete) return;

    try {
      setDeletingUsers(prev => new Set(prev).add(userToDelete));
      await usersAPI.deleteUser(userToDelete);

      // Remove from local state
      setUsers(prev => prev.filter(user => user.id !== userToDelete));

      toast({
        title: "User deleted",
        description: "The user has been permanently deleted.",
      });
    } catch (err) {
      toast({
        title: "Deletion failed",
        description: err instanceof Error ? err.message : "Failed to delete user",
        variant: "destructive",
      });
    } finally {
      setDeletingUsers(prev => {
        const newSet = new Set(prev);
        newSet.delete(userToDelete);
        return newSet;
      });
      setUserToDelete(null);
    }
  };

  const handleSearch = (value: string) => {
    setSearchQuery(value);
    if (value.trim()) {
      fetchUsers(value);
    } else {
      fetchUsers();
    }
  };

  // Check if current user is admin
  if (currentUser?.role !== 'admin') {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8">
          <ErrorState
            icon={<Shield className="h-12 w-12" />}
            title="Access Denied"
            description="You don't have permission to access the admin panel."
          />
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8">
          <div className="animate-pulse space-y-6">
            <div className="h-8 bg-surface-2 rounded w-1/4"></div>
            <div className="h-64 bg-surface-2 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8">
          <ErrorState
            title="Failed to load admin data"
            description={error}
            onRetry={fetchUsers}
          />
        </div>
      </div>
    );
  }

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'admin': return 'destructive';
      case 'staff': return 'accent';
      default: return 'secondary';
    }
  };

  const activeUsers = users.filter(user => !user.suspended);
  const suspendedUsers = users.filter(user => user.suspended);

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <Shield className="h-8 w-8 text-accent" />
            <h1 className="text-3xl font-bold text-foreground">Admin Panel</h1>
          </div>
          <p className="text-muted">Manage users and platform settings</p>
        </div>

        <Tabs defaultValue="users" className="space-y-6">
          <TabsList>
            <TabsTrigger value="users">
              <Users className="h-4 w-4 mr-2" />
              User Management
            </TabsTrigger>
            <TabsTrigger value="logs">
              <FileText className="h-4 w-4 mr-2" />
              Admin Logs
            </TabsTrigger>
          </TabsList>

          <TabsContent value="users" className="space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card className="bg-surface border-surface-3">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-muted text-sm">Total Users</p>
                      <p className="text-2xl font-bold text-foreground">{users.length}</p>
                    </div>
                    <Users className="h-8 w-8 text-accent" />
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-surface border-surface-3">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-muted text-sm">Active Users</p>
                      <p className="text-2xl font-bold text-success">{activeUsers.length}</p>
                    </div>
                    <Users className="h-8 w-8 text-success" />
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-surface border-surface-3">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-muted text-sm">Suspended Users</p>
                      <p className="text-2xl font-bold text-error">{suspendedUsers.length}</p>
                    </div>
                    <UserX className="h-8 w-8 text-error" />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Warning Alert */}
            <Alert className="border-warning/20 bg-warning/10">
              <AlertTriangle className="h-4 w-4 text-warning" />
              <AlertDescription className="text-warning">
                Admin actions are permanent and cannot be undone. Use with caution.
              </AlertDescription>
            </Alert>

            {/* Users Table */}
            <Card className="bg-surface border-surface-3">
              <CardHeader>
                <CardTitle>User Management</CardTitle>
                <CardDescription>
                  View and manage all platform users
                </CardDescription>
              </CardHeader>
              <CardContent>
                {/* Search Input */}
                <div className="mb-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search users by name or email..."
                      value={searchQuery}
                      onChange={(e) => handleSearch(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {users.map((user) => (
                        <TableRow key={user.id}>
                          <TableCell className="font-medium text-foreground">
                            {user.name}
                          </TableCell>
                          <TableCell className="text-muted">
                            {user.email}
                          </TableCell>
                          <TableCell>
                            <Badge variant={getRoleBadgeVariant(user.role)}>
                              {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant={user.suspended ? "destructive" : "success"}>
                              {user.suspended ? "Suspended" : "Active"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              {user.id === currentUser?.id ? (
                                <Badge variant="muted" className="text-xs">
                                  You
                                </Badge>
                              ) : user.role !== 'admin' ? (
                                <>
                                  {user.suspended ? (
                                    <Button
                                      variant="default"
                                      size="sm"
                                      onClick={() => handleUnsuspendUser(user.id)}
                                      disabled={unsuspendingUsers.has(user.id)}
                                    >
                                      <UserCheck className="h-4 w-4 mr-1" />
                                      {unsuspendingUsers.has(user.id) ? "Unsuspending..." : "Unsuspend"}
                                    </Button>
                                  ) : (
                                    <Button
                                      variant="secondary"
                                      size="sm"
                                      onClick={() => handleSuspendUser(user.id)}
                                      disabled={suspendingUsers.has(user.id)}
                                      data-testid={`suspend-user-${user.id}`}
                                    >
                                      <UserX className="h-4 w-4 mr-1" />
                                      {suspendingUsers.has(user.id) ? "Suspending..." : "Suspend"}
                                    </Button>
                                  )}
                                  <Button
                                    variant="destructive"
                                    size="sm"
                                    onClick={() => setUserToDelete(user.id)}
                                    disabled={deletingUsers.has(user.id)}
                                  >
                                    <Trash2 className="h-4 w-4 mr-1" />
                                    Delete
                                  </Button>
                                </>
                              ) : null}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="logs" className="space-y-6">
            <AdminLogsTable />
          </TabsContent>
        </Tabs>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={!!userToDelete} onOpenChange={() => setUserToDelete(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. This will permanently delete the user account
                and remove all associated data from our servers.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteUser}
                className="bg-destructive hover:bg-destructive/90"
              >
                Delete User
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}