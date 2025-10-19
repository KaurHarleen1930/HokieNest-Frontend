import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ErrorState } from "@/components/ui/error-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usersAPI, roommatesAPI, User } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Shield, Users, UserX, AlertTriangle, Settings, Save, RotateCcw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Admin() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [suspendingUsers, setSuspendingUsers] = useState<Set<string>>(new Set());
  
  // Matching weights state
  const [matchingWeights, setMatchingWeights] = useState<any>({});
  const [weightsLoading, setWeightsLoading] = useState(false);
  const [savingWeights, setSavingWeights] = useState(false);
  
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

  const fetchMatchingWeights = async () => {
    try {
      setWeightsLoading(true);
      const response = await roommatesAPI.getWeights();
      setMatchingWeights(response.weights);
    } catch (err) {
      console.error('Failed to fetch matching weights:', err);
      toast({
        title: "Error",
        description: "Failed to fetch matching weights",
        variant: "destructive",
      });
    } finally {
      setWeightsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
    fetchMatchingWeights();
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

  const handleSaveWeights = async () => {
    try {
      setSavingWeights(true);
      await roommatesAPI.updateWeights(matchingWeights);
      
      toast({
        title: "Weights Updated",
        description: "Roommate matching weights have been updated successfully.",
      });
    } catch (err) {
      toast({
        title: "Update Failed",
        description: err instanceof Error ? err.message : "Failed to update weights",
        variant: "destructive",
      });
    } finally {
      setSavingWeights(false);
    }
  };

  const handleResetWeights = async () => {
    try {
      setSavingWeights(true);
      await roommatesAPI.resetWeights();
      await fetchMatchingWeights(); // Refresh the weights
      
      toast({
        title: "Weights Reset",
        description: "Roommate matching weights have been reset to defaults.",
      });
    } catch (err) {
      toast({
        title: "Reset Failed",
        description: err instanceof Error ? err.message : "Failed to reset weights",
        variant: "destructive",
      });
    } finally {
      setSavingWeights(false);
    }
  };

  const updateWeight = (key: string, value: string) => {
    const numValue = parseInt(value) || 0;
    setMatchingWeights((prev: any) => ({
      ...prev,
      [key]: numValue
    }));
  };

  const getTotalWeight = () => {
    return Object.values(matchingWeights).reduce((sum: number, weight: any) => sum + (weight || 0), 0);
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
            <TabsTrigger value="users">User Management</TabsTrigger>
            <TabsTrigger value="matching">Roommate Matching</TabsTrigger>
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
          </TabsContent>

          <TabsContent value="matching" className="space-y-6">
            <Card className="bg-surface border-surface-3">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  <CardTitle>Roommate Matching Weights</CardTitle>
                </div>
                <CardDescription>
                  Configure how roommate compatibility is calculated. Weights must total 100%.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {weightsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <Label htmlFor="budget">Budget Compatibility</Label>
                          <Input
                            id="budget"
                            type="number"
                            min="0"
                            max="100"
                            value={matchingWeights.budget || 0}
                            onChange={(e) => updateWeight('budget', e.target.value)}
                            className="w-20"
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <Label htmlFor="sleepSchedule">Sleep Schedule</Label>
                          <Input
                            id="sleepSchedule"
                            type="number"
                            min="0"
                            max="100"
                            value={matchingWeights.sleepSchedule || 0}
                            onChange={(e) => updateWeight('sleepSchedule', e.target.value)}
                            className="w-20"
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <Label htmlFor="cleanliness">Cleanliness Level</Label>
                          <Input
                            id="cleanliness"
                            type="number"
                            min="0"
                            max="100"
                            value={matchingWeights.cleanliness || 0}
                            onChange={(e) => updateWeight('cleanliness', e.target.value)}
                            className="w-20"
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <Label htmlFor="socialVibe">Social Vibe</Label>
                          <Input
                            id="socialVibe"
                            type="number"
                            min="0"
                            max="100"
                            value={matchingWeights.socialVibe || 0}
                            onChange={(e) => updateWeight('socialVibe', e.target.value)}
                            className="w-20"
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <Label htmlFor="moveInDate">Move-in Date</Label>
                          <Input
                            id="moveInDate"
                            type="number"
                            min="0"
                            max="100"
                            value={matchingWeights.moveInDate || 0}
                            onChange={(e) => updateWeight('moveInDate', e.target.value)}
                            className="w-20"
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <Label htmlFor="leaseLength">Lease Length</Label>
                          <Input
                            id="leaseLength"
                            type="number"
                            min="0"
                            max="100"
                            value={matchingWeights.leaseLength || 0}
                            onChange={(e) => updateWeight('leaseLength', e.target.value)}
                            className="w-20"
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <Label htmlFor="distance">Distance Preference</Label>
                          <Input
                            id="distance"
                            type="number"
                            min="0"
                            max="100"
                            value={matchingWeights.distance || 0}
                            onChange={(e) => updateWeight('distance', e.target.value)}
                            className="w-20"
                          />
                        </div>
                      </div>
                      
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <Label htmlFor="quietHours">Quiet Hours</Label>
                          <Input
                            id="quietHours"
                            type="number"
                            min="0"
                            max="100"
                            value={matchingWeights.quietHours || 0}
                            onChange={(e) => updateWeight('quietHours', e.target.value)}
                            className="w-20"
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <Label htmlFor="chores">Chores Preference</Label>
                          <Input
                            id="chores"
                            type="number"
                            min="0"
                            max="100"
                            value={matchingWeights.chores || 0}
                            onChange={(e) => updateWeight('chores', e.target.value)}
                            className="w-20"
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <Label htmlFor="guests">Guests Frequency</Label>
                          <Input
                            id="guests"
                            type="number"
                            min="0"
                            max="100"
                            value={matchingWeights.guests || 0}
                            onChange={(e) => updateWeight('guests', e.target.value)}
                            className="w-20"
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <Label htmlFor="workFromHome">Work from Home</Label>
                          <Input
                            id="workFromHome"
                            type="number"
                            min="0"
                            max="100"
                            value={matchingWeights.workFromHome || 0}
                            onChange={(e) => updateWeight('workFromHome', e.target.value)}
                            className="w-20"
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <Label htmlFor="pets">Pet Compatibility</Label>
                          <Input
                            id="pets"
                            type="number"
                            min="0"
                            max="100"
                            value={matchingWeights.pets || 0}
                            onChange={(e) => updateWeight('pets', e.target.value)}
                            className="w-20"
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <Label htmlFor="smoking">Smoking Policy</Label>
                          <Input
                            id="smoking"
                            type="number"
                            min="0"
                            max="100"
                            value={matchingWeights.smoking || 0}
                            onChange={(e) => updateWeight('smoking', e.target.value)}
                            className="w-20"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                      <div>
                        <p className="font-medium">Total Weight</p>
                        <p className="text-sm text-muted-foreground">
                          {getTotalWeight()}% {getTotalWeight() !== 100 ? '(Must equal 100%)' : ''}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          onClick={handleResetWeights}
                          disabled={savingWeights}
                          className="gap-2"
                        >
                          <RotateCcw className="h-4 w-4" />
                          Reset to Default
                        </Button>
                        <Button
                          onClick={handleSaveWeights}
                          disabled={savingWeights || getTotalWeight() !== 100}
                          className="gap-2"
                        >
                          <Save className="h-4 w-4" />
                          {savingWeights ? 'Saving...' : 'Save Changes'}
                        </Button>
                      </div>
                    </div>

                    {getTotalWeight() !== 100 && (
                      <Alert className="border-warning/20 bg-warning/10">
                        <AlertTriangle className="h-4 w-4 text-warning" />
                        <AlertDescription className="text-warning">
                          The total weight must equal 100% before saving. Current total: {getTotalWeight()}%
                        </AlertDescription>
                      </Alert>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}