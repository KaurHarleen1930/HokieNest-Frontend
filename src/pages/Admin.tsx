import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ErrorState } from "@/components/ui/error-state";
import { usersAPI, User } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Shield, Users, UserX, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Admin() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [suspendingUsers, setSuspendingUsers] = useState<Set<string>>(new Set());
  
  const { user: currentUser } = useAuth();
  const { toast } = useToast();

  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await usersAPI.getAll();
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
          <p className="text-muted">Manage users and monitor platform activity</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
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
        <Alert className="mb-6 border-warning/20 bg-warning/10">
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
                        {user.role !== 'admin' && !user.suspended && (
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleSuspendUser(user.id)}
                            disabled={suspendingUsers.has(user.id)}
                            data-testid={`suspend-user-${user.id}`}
                          >
                            {suspendingUsers.has(user.id) ? "Suspending..." : "Suspend"}
                          </Button>
                        )}
                        {user.id === currentUser?.id && (
                          <Badge variant="muted" className="text-xs">
                            You
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}