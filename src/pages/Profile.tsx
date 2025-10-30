import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Slider } from "@/components/ui/slider";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { User, Mail, Shield, Calendar, Edit, Save, X, Trash2, AlertTriangle, Target, DollarSign, MapPin, Shield as ShieldIcon, Users, Settings, BarChart3, Bell, BellOff } from "lucide-react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { notificationsAPI } from "@/lib/api";

interface ProfileData {
  gender: string;
  age: number;
  major: string;
}

interface HousingPriorities {
  budget: number;
  commute: number;
  safety: number;
  roommates: number;
}

const Profile = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [isEditing, setIsEditing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isEditingPriorities, setIsEditingPriorities] = useState(false);
  const [profileData, setProfileData] = useState<ProfileData>({
    gender: '',
    age: 0,
    major: ''
  });
  const [editData, setEditData] = useState<ProfileData>({
    gender: '',
    age: 0,
    major: ''
  });
  const [housingPriorities, setHousingPriorities] = useState<HousingPriorities>({
    budget: 25,
    commute: 25,
    safety: 25,
    roommates: 25
  });
  const [editPriorities, setEditPriorities] = useState<HousingPriorities>({
    budget: 25,
    commute: 25,
    safety: 25,
    roommates: 25
  });
  const [emailNotificationsEnabled, setEmailNotificationsEnabled] = useState(true);
  const [loadingPreferences, setLoadingPreferences] = useState(false);

  useEffect(() => {
    if (user) {
      fetchProfileData();
      fetchHousingPriorities();
      fetchNotificationPreferences();
    }
  }, [user]);

  const fetchProfileData = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch('http://localhost:4000/api/v1/preferences/profile', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setProfileData(data.profile || { gender: '', age: 0, major: '' });
        setEditData(data.profile || { gender: '', age: 0, major: '' });
      }
    } catch (error) {
      console.error('Error fetching profile data:', error);
    }
  };

  const fetchHousingPriorities = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch('http://localhost:4000/api/v1/preferences/housing-priorities', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.priorities) {
          setHousingPriorities(data.priorities);
          setEditPriorities(data.priorities);
        }
      }
    } catch (error) {
      console.error('Error fetching housing priorities:', error);
    }
  };

  const handleEdit = () => {
    setEditData(profileData);
    setIsEditing(true);
  };

  const handleSave = async () => {
    try {
      setIsLoading(true);
      const token = localStorage.getItem('auth_token');
      const response = await fetch('http://localhost:4000/api/v1/preferences/profile', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(editData)
      });

      if (response.ok) {
        setProfileData(editData);
        setIsEditing(false);
        toast.success('Profile updated successfully!');
      } else {
        const error = await response.json();
        toast.error(error.message || 'Failed to update profile');
      }
    } catch (error) {
      toast.error('Failed to update profile');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    setEditData(profileData);
    setIsEditing(false);
  };

  const handleEditPriorities = () => {
    setEditPriorities(housingPriorities);
    setIsEditingPriorities(true);
  };

  const handleSavePriorities = async () => {
    try {
      setIsLoading(true);
      const token = localStorage.getItem('auth_token');
      const response = await fetch('http://localhost:4000/api/v1/preferences/housing-priorities', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(editPriorities)
      });

      if (response.ok) {
        setHousingPriorities(editPriorities);
        setIsEditingPriorities(false);
        toast.success('Housing priorities updated successfully!');
      } else {
        const error = await response.json();
        toast.error(error.message || 'Failed to update housing priorities');
      }
    } catch (error) {
      toast.error('Failed to update housing priorities');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancelPriorities = () => {
    setEditPriorities(housingPriorities);
    setIsEditingPriorities(false);
  };

  const handlePriorityChange = (key: keyof HousingPriorities, value: number[]) => {
    setEditPriorities(prev => ({
      ...prev,
      [key]: value[0]
    }));
  };

  const fetchNotificationPreferences = async () => {
    try {
      const response = await notificationsAPI.getPreferences();
      if (response.success && response.preferences) {
        // Check if all email notifications are disabled
        const allEmailsDisabled = 
          !response.preferences.email_messages &&
          !response.preferences.email_connections &&
          !response.preferences.email_matches;
        setEmailNotificationsEnabled(!allEmailsDisabled);
      }
    } catch (error) {
      console.error('Error fetching notification preferences:', error);
    }
  };

  const handleToggleEmailNotifications = async (enabled: boolean) => {
    try {
      setLoadingPreferences(true);
      
      // Update all email notification preferences at once
      const preferences = {
        email_messages: enabled,
        email_connections: enabled,
        email_matches: enabled,
      };
      
      const response = await notificationsAPI.updatePreferences(preferences);
      
      if (response.success) {
        setEmailNotificationsEnabled(enabled);
        toast.success(
          enabled 
            ? 'Email notifications enabled for all types'
            : 'All email notifications muted'
        );
      } else {
        toast.error('Failed to update notification preferences');
      }
    } catch (error) {
      console.error('Error updating notification preferences:', error);
      toast.error('Failed to update notification preferences');
    } finally {
      setLoadingPreferences(false);
    }
  };

  const getTotalPriorities = () => {
    return editPriorities.budget + editPriorities.commute + editPriorities.safety + editPriorities.roommates;
  };

  const isPrioritiesValid = () => {
    return getTotalPriorities() === 100;
  };

  const handleDelete = async () => {
    try {
      setIsLoading(true);
      const token = localStorage.getItem('auth_token');
      const response = await fetch('http://localhost:4000/api/v1/auth/delete-account', {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        toast.success('Account deleted successfully');
        await logout();
        navigate('/login');
      } else {
        const error = await response.json();
        toast.error(error.message || 'Failed to delete account');
      }
    } catch (error) {
      toast.error('Failed to delete account');
    } finally {
      setIsLoading(false);
      setIsDeleting(false);
    }
  };

  if (!user) {
    return null;
  }

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'admin':
        return 'destructive';
      case 'staff':
        return 'default';
      default:
        return 'secondary';
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-3xl font-bold">My Profile</h1>
            <div className="flex gap-2">
              {!isEditing ? (
                <Button onClick={handleEdit} variant="outline" size="sm">
                  <Edit className="h-4 w-4 mr-2" />
                  Edit
                </Button>
              ) : (
                <div className="flex gap-2">
                  <Button onClick={handleSave} disabled={isLoading} size="sm">
                    <Save className="h-4 w-4 mr-2" />
                    {isLoading ? 'Saving...' : 'Save'}
                  </Button>
                  <Button onClick={handleCancel} variant="outline" size="sm">
                    <X className="h-4 w-4 mr-2" />
                    Cancel
                  </Button>
                </div>
              )}
            </div>
          </div>
          
          <Card>
            <CardHeader>
              <div className="flex items-center gap-4">
                <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <User className="h-8 w-8 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-2xl">{user.name}</CardTitle>
                  <CardDescription className="flex items-center gap-2 mt-1">
                    <Mail className="h-4 w-4" />
                    {user.email}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between py-3 border-b">
                <div className="flex items-center gap-2">
                  <Shield className="h-5 w-5 text-muted-foreground" />
                  <span className="font-medium">Role</span>
                </div>
                <Badge variant={getRoleBadgeVariant(user.role)}>
                  {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                </Badge>
              </div>
              
              <div className="flex items-center justify-between py-3 border-b">
                <div className="flex items-center gap-2">
                  <Mail className="h-5 w-5 text-muted-foreground" />
                  <span className="font-medium">Email Verified</span>
                </div>
                <Badge variant="default">Verified</Badge>
              </div>

              <div className="flex items-center justify-between py-3 border-b">
                <div className="flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-muted-foreground" />
                  <span className="font-medium">Account Type</span>
                </div>
                <span className="text-sm text-muted-foreground">Virginia Tech Student</span>
              </div>

              {/* Profile Details Section */}
              <div className="pt-4 border-t">
                <h3 className="text-lg font-semibold mb-4">Profile Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="gender">Gender</Label>
                    {isEditing ? (
                      <Select value={editData.gender} onValueChange={(value) => setEditData({...editData, gender: value})}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select gender" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="male">Male</SelectItem>
                          <SelectItem value="female">Female</SelectItem>
                          <SelectItem value="nonbinary">Non-binary</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <p className="text-sm text-muted-foreground mt-1">
                        {profileData.gender || 'Not specified'}
                      </p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="age">Age</Label>
                    {isEditing ? (
                      <Input
                        id="age"
                        type="number"
                        value={editData.age || ''}
                        onChange={(e) => setEditData({...editData, age: parseInt(e.target.value) || 0})}
                        min="1"
                        max="120"
                      />
                    ) : (
                      <p className="text-sm text-muted-foreground mt-1">
                        {profileData.age || 'Not specified'}
                      </p>
                    )}
                  </div>

                  <div className="md:col-span-2">
                    <Label htmlFor="major">Major</Label>
                    {isEditing ? (
                      <Input
                        id="major"
                        value={editData.major}
                        onChange={(e) => setEditData({...editData, major: e.target.value})}
                        placeholder="Enter your major"
                      />
                    ) : (
                      <p className="text-sm text-muted-foreground mt-1">
                        {profileData.major || 'Not specified'}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Housing Priorities Section */}
              <div className="pt-4 border-t">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <Target className="h-5 w-5" />
                    Housing Priorities
                  </h3>
                  {!isEditingPriorities ? (
                    <Button onClick={handleEditPriorities} variant="outline" size="sm">
                      <Settings className="h-4 w-4 mr-2" />
                      Edit Priorities
                    </Button>
                  ) : (
                    <div className="flex gap-2">
                      <Button 
                        onClick={handleSavePriorities} 
                        disabled={isLoading || !isPrioritiesValid()} 
                        size="sm"
                      >
                        <Save className="h-4 w-4 mr-2" />
                        {isLoading ? 'Saving...' : 'Save'}
                      </Button>
                      <Button onClick={handleCancelPriorities} variant="outline" size="sm">
                        <X className="h-4 w-4 mr-2" />
                        Cancel
                      </Button>
                    </div>
                  )}
                </div>

                {!isEditingPriorities ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="text-center p-3 bg-green-50 rounded-lg">
                        <DollarSign className="h-6 w-6 text-green-600 mx-auto mb-2" />
                        <div className="text-2xl font-bold text-green-600">{housingPriorities.budget}%</div>
                        <div className="text-sm text-muted-foreground">Budget</div>
                      </div>
                      <div className="text-center p-3 bg-blue-50 rounded-lg">
                        <MapPin className="h-6 w-6 text-blue-600 mx-auto mb-2" />
                        <div className="text-2xl font-bold text-blue-600">{housingPriorities.commute}%</div>
                        <div className="text-sm text-muted-foreground">Commute</div>
                      </div>
                      <div className="text-center p-3 bg-purple-50 rounded-lg">
                        <ShieldIcon className="h-6 w-6 text-purple-600 mx-auto mb-2" />
                        <div className="text-2xl font-bold text-purple-600">{housingPriorities.safety}%</div>
                        <div className="text-sm text-muted-foreground">Safety</div>
                      </div>
                      <div className="text-center p-3 bg-orange-50 rounded-lg">
                        <Users className="h-6 w-6 text-orange-600 mx-auto mb-2" />
                        <div className="text-2xl font-bold text-orange-600">{housingPriorities.roommates}%</div>
                        <div className="text-sm text-muted-foreground">Roommates</div>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Total Priority</span>
                      <Badge variant="default" className="text-sm">
                        {housingPriorities.budget + housingPriorities.commute + housingPriorities.safety + housingPriorities.roommates}%
                      </Badge>
                    </div>
                    
                    <Button 
                      onClick={() => navigate('/housing-priorities-demo')} 
                      variant="outline" 
                      className="w-full"
                    >
                      <BarChart3 className="h-4 w-4 mr-2" />
                      View Priority Demo & Recommendations
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Budget Priority */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <DollarSign className="h-4 w-4 text-green-600" />
                          <span className="font-medium">Budget Affordability</span>
                        </div>
                        <Badge variant="outline">{editPriorities.budget}%</Badge>
                      </div>
                      <Slider
                        value={[editPriorities.budget]}
                        onValueChange={(value) => handlePriorityChange('budget', value)}
                        max={100}
                        step={5}
                        className="w-full"
                      />
                      <p className="text-sm text-muted-foreground">
                        How important is staying within your budget?
                      </p>
                    </div>

                    <Separator />

                    {/* Commute Priority */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-blue-600" />
                          <span className="font-medium">Commute Distance</span>
                        </div>
                        <Badge variant="outline">{editPriorities.commute}%</Badge>
                      </div>
                      <Slider
                        value={[editPriorities.commute]}
                        onValueChange={(value) => handlePriorityChange('commute', value)}
                        max={100}
                        step={5}
                        className="w-full"
                      />
                      <p className="text-sm text-muted-foreground">
                        How important is living close to campus?
                      </p>
                    </div>

                    <Separator />

                    {/* Safety Priority */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <ShieldIcon className="h-4 w-4 text-purple-600" />
                          <span className="font-medium">Safety & Security</span>
                        </div>
                        <Badge variant="outline">{editPriorities.safety}%</Badge>
                      </div>
                      <Slider
                        value={[editPriorities.safety]}
                        onValueChange={(value) => handlePriorityChange('safety', value)}
                        max={100}
                        step={5}
                        className="w-full"
                      />
                      <p className="text-sm text-muted-foreground">
                        How important is neighborhood safety?
                      </p>
                    </div>

                    <Separator />

                    {/* Roommates Priority */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4 text-orange-600" />
                          <span className="font-medium">Roommate Compatibility</span>
                        </div>
                        <Badge variant="outline">{editPriorities.roommates}%</Badge>
                      </div>
                      <Slider
                        value={[editPriorities.roommates]}
                        onValueChange={(value) => handlePriorityChange('roommates', value)}
                        max={100}
                        step={5}
                        className="w-full"
                      />
                      <p className="text-sm text-muted-foreground">
                        How important is finding compatible roommates?
                      </p>
                    </div>

                    {/* Total Validation */}
                    <div className="pt-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium">Total Priority</span>
                        <Badge variant={isPrioritiesValid() ? "default" : "destructive"}>
                          {getTotalPriorities()}%
                        </Badge>
                      </div>
                      <Progress
                        value={getTotalPriorities()}
                        className="h-2"
                      />
                      {!isPrioritiesValid() && (
                        <Alert variant="destructive" className="mt-2">
                          <AlertDescription>
                            Priorities must total exactly 100% to save
                          </AlertDescription>
                        </Alert>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Notification Settings Section */}
              <div className="pt-4 border-t">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                      <Bell className="h-5 w-5" />
                      Notification Settings
                    </h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      Control your email notification preferences
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    {emailNotificationsEnabled ? (
                      <Bell className="h-5 w-5 text-primary" />
                    ) : (
                      <BellOff className="h-5 w-5 text-muted-foreground" />
                    )}
                    <div>
                      <p className="font-medium">Email Notifications</p>
                      <p className="text-sm text-muted-foreground">
                        {emailNotificationsEnabled
                          ? 'You will receive email notifications for messages, connections, and matches'
                          : 'All email notifications are currently muted'}
                      </p>
                    </div>
                  </div>
                  <Switch
                    checked={emailNotificationsEnabled}
                    onCheckedChange={handleToggleEmailNotifications}
                    disabled={loadingPreferences}
                  />
                </div>
              </div>

              {/* Delete Account Section */}
              <div className="pt-4 border-t">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-destructive">Danger Zone</h3>
                    <p className="text-sm text-muted-foreground">Once you delete your account, there is no going back.</p>
                  </div>
                  <Dialog open={isDeleting} onOpenChange={setIsDeleting}>
                    <DialogTrigger asChild>
                      <Button variant="destructive" size="sm">
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete Account
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                          <AlertTriangle className="h-5 w-5 text-destructive" />
                          Delete Account
                        </DialogTitle>
                        <DialogDescription>
                          Are you sure you want to delete your account? This action cannot be undone.
                          All your data, preferences, and account information will be permanently removed.
                        </DialogDescription>
                      </DialogHeader>
                      <Alert variant="destructive">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertDescription>
                          This will permanently delete your account and all associated data.
                        </AlertDescription>
                      </Alert>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setIsDeleting(false)}>
                          Cancel
                        </Button>
                        <Button 
                          variant="destructive" 
                          onClick={handleDelete}
                          disabled={isLoading}
                        >
                          {isLoading ? 'Deleting...' : 'Delete Account'}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Profile;
