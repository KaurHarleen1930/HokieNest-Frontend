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
import { User, Mail, Shield, Calendar, Edit, Save, X, Trash2, AlertTriangle, Target, DollarSign, MapPin, Shield as ShieldIcon, Users, Settings, BarChart3, Bell, BellOff, Sun, Moon, Monitor, Clock } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { toast } from "sonner";
import { HousingStatus, HousingStatusLabels } from "@/types/HousingStatus";
import { Switch } from "@/components/ui/switch";
import { notificationsAPI } from "@/lib/api";
import { useThemePreferences, ThemePreference } from "@/lib/theme";
import { useTheme } from "next-themes";

interface ProfileData {
  gender: string;
  age: number;
  major: string;
  housing_status?: HousingStatus;
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
    gender: "",
    age: 0,
    major: "",
    housing_status: HousingStatus.NOT_SEARCHING,
  });
  const [editData, setEditData] = useState<ProfileData>({
    gender: "",
    age: 0,
    major: "",
    housing_status: HousingStatus.NOT_SEARCHING,
  });
  const [housingPriorities, setHousingPriorities] = useState<HousingPriorities>({
    budget: 25,
    commute: 25,
    safety: 25,
    roommates: 25,
  });
  const [editPriorities, setEditPriorities] = useState<HousingPriorities>({
    budget: 25,
    commute: 25,
    safety: 25,
    roommates: 25,
  });
  const [emailNotificationsEnabled, setEmailNotificationsEnabled] = useState(true);
  const [loadingPreferences, setLoadingPreferences] = useState(false);
  const [enableQuietHours, setEnableQuietHours] = useState(false);
  const [quietHoursStart, setQuietHoursStart] = useState('22:00');
  const [quietHoursEnd, setQuietHoursEnd] = useState('08:00');
  const { preference: themePreference, setPreference: setThemePreference, loading: themeLoading } = useThemePreferences();
  const { resolvedTheme } = useTheme();
  const [themeSaving, setThemeSaving] = useState(false);

  useEffect(() => {
    if (user) {
      fetchProfileData();
      fetchHousingPriorities();
      fetchNotificationPreferences();
    }
  }, [user]);

  const fetchProfileData = async () => {
    try {
      const token = localStorage.getItem("auth_token");
      const API_BASE_URL = `${import.meta.env.VITE_API_URL ?? 'http://localhost:4000'}/api/v1`;
      const response = await fetch(
        
        `${API_BASE_URL}/preferences/profile`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setProfileData(
          data.profile || {
            gender: "",
            age: 0,
            major: "",
            housing_status: HousingStatus.NOT_SEARCHING,
          }
        );
        setEditData(
          data.profile || {
            gender: "",
            age: 0,
            major: "",
            housing_status: HousingStatus.NOT_SEARCHING,
          }
        );
      }
    } catch (error) {
      console.error("Error fetching profile data:", error);
    }
  };

  const fetchHousingPriorities = async () => {
    try {
      const token = localStorage.getItem("auth_token");
      const API_BASE_URL = `${import.meta.env.VITE_API_URL ?? 'http://localhost:4000'}/api/v1`;

      const response = await fetch(
        `${API_BASE_URL}/preferences/housing-priorities`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        if (data.priorities) {
          setHousingPriorities(data.priorities);
          setEditPriorities(data.priorities);
        }
      }
    } catch (error) {
      console.error("Error fetching housing priorities:", error);
    }
  };

  const handleEdit = () => {
    setEditData(profileData);
    setIsEditing(true);
  };

  const handleSave = async () => {
    try {
      setIsLoading(true);
      const token = localStorage.getItem("auth_token");
      const API_BASE_URL = `${import.meta.env.VITE_API_URL ?? 'http://localhost:4000'}/api/v1`;

      const response = await fetch(
        `${API_BASE_URL}/preferences/profile`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(editData),
        }
      );

      if (response.ok) {
        setProfileData(editData);
        setIsEditing(false);
        toast.success("Profile updated successfully!");
      } else {
        const error = await response.json();
        toast.error(error.message || "Failed to update profile");
      }
    } catch {
      toast.error("Failed to update profile");
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
      const token = localStorage.getItem("auth_token");
      const API_BASE_URL = `${import.meta.env.VITE_API_URL ?? 'http://localhost:4000'}/api/v1`;

      const response = await fetch(
        `${API_BASE_URL}/preferences/housing-priorities`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(editPriorities),
        }
      );

      if (response.ok) {
        setHousingPriorities(editPriorities);
        setIsEditingPriorities(false);
        toast.success("Housing priorities updated successfully!");
      } else {
        const error = await response.json();
        toast.error(error.message || "Failed to update housing priorities");
      }
    } catch {
      toast.error("Failed to update housing priorities");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancelPriorities = () => {
    setEditPriorities(housingPriorities);
    setIsEditingPriorities(false);
  };

  const handlePriorityChange = (key: keyof HousingPriorities, value: number[]) =>
    setEditPriorities((prev) => ({ ...prev, [key]: value[0] }));

  const getTotalPriorities = () =>
    editPriorities.budget +
    editPriorities.commute +
    editPriorities.safety +
    editPriorities.roommates;
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

        // Load quiet hours settings
        if (response.preferences.enable_quiet_hours !== undefined) {
          setEnableQuietHours(response.preferences.enable_quiet_hours);
        }
        if (response.preferences.quiet_hours_start) {
          // Convert from HH:MM:SS to HH:MM for input
          setQuietHoursStart(response.preferences.quiet_hours_start.substring(0, 5));
        }
        if (response.preferences.quiet_hours_end) {
          setQuietHoursEnd(response.preferences.quiet_hours_end.substring(0, 5));
        }
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

  const handleToggleQuietHours = async (enabled: boolean) => {
    try {
      setLoadingPreferences(true);

      const preferences = {
        enable_quiet_hours: enabled,
        quiet_hours_start: quietHoursStart + ':00', // Convert HH:MM to HH:MM:SS
        quiet_hours_end: quietHoursEnd + ':00',
      };

      const response = await notificationsAPI.updatePreferences(preferences);

      if (response.success) {
        setEnableQuietHours(enabled);
        toast.success(
          enabled
            ? 'Quiet hours enabled'
            : 'Quiet hours disabled'
        );
      } else {
        toast.error('Failed to update quiet hours settings');
      }
    } catch (error) {
      console.error('Error updating quiet hours:', error);
      toast.error('Failed to update quiet hours settings');
    } finally {
      setLoadingPreferences(false);
    }
  };

  const handleQuietHoursTimeChange = async (type: 'start' | 'end', value: string) => {
    try {
      setLoadingPreferences(true);

      // Update local state
      if (type === 'start') {
        setQuietHoursStart(value);
      } else {
        setQuietHoursEnd(value);
      }

      // Save to backend
      const preferences = {
        enable_quiet_hours: enableQuietHours,
        quiet_hours_start: (type === 'start' ? value : quietHoursStart) + ':00',
        quiet_hours_end: (type === 'end' ? value : quietHoursEnd) + ':00',
      };

      const response = await notificationsAPI.updatePreferences(preferences);

      if (response.success) {
        toast.success('Quiet hours updated');
      } else {
        toast.error('Failed to update quiet hours');
      }
    } catch (error) {
      console.error('Error updating quiet hours time:', error);
      toast.error('Failed to update quiet hours');
    } finally {
      setLoadingPreferences(false);
    }
  };

  const isPrioritiesValid = () => getTotalPriorities() === 100;

  const appearanceOptions: Array<{ value: ThemePreference; label: string; description: string; icon: LucideIcon }> = [
    {
      value: "light",
      label: "Light",
      description: "Bright, high-contrast experience",
      icon: Sun,
    },
    {
      value: "dark",
      label: "Dark",
      description: "Low-light friendly interface",
      icon: Moon,
    },
    {
      value: "system",
      label: "System",
      description: "Match your device settings",
      icon: Monitor,
    },
  ];

  const handleThemePreferenceChange = async (value: ThemePreference) => {
    try {
      setThemeSaving(true);
      await setThemePreference(value);
      const message =
        value === "system"
          ? "Theme now follows your device setting"
          : `Theme updated to ${value.charAt(0).toUpperCase() + value.slice(1)} mode`;
      toast.success(message);
    } catch (error) {
      console.error("Error updating theme preference:", error);
      toast.error("Failed to update theme preference");
    } finally {
      setThemeSaving(false);
    }
  };


  const handleDelete = async () => {
    try {
      setIsLoading(true);
      const token = localStorage.getItem("auth_token");
      const API_BASE_URL = `${import.meta.env.VITE_API_URL ?? 'http://localhost:4000'}/api/v1`;

      const response = await fetch(
        `${API_BASE_URL}/auth/delete-account`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (response.ok) {
        toast.success("Account deleted successfully");
        await logout();
        navigate("/login");
      } else {
        const error = await response.json();
        toast.error(error.message || "Failed to delete account");
      }
    } catch {
      toast.error("Failed to delete account");
    } finally {
      setIsLoading(false);
      setIsDeleting(false);
    }
  };

  if (!user) return null;

  const getRoleBadgeVariant = (role: string) =>
    role === "admin"
      ? "destructive"
      : role === "staff"
      ? "default"
      : "secondary";

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
                <>
                  <Button onClick={handleSave} disabled={isLoading} size="sm">
                    <Save className="h-4 w-4 mr-2" />
                    {isLoading ? "Saving..." : "Save"}
                  </Button>
                  <Button onClick={handleCancel} variant="outline" size="sm">
                    <X className="h-4 w-4 mr-2" />
                    Cancel
                  </Button>
                </>
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
                  <Calendar className="h-5 w-5 text-muted-foreground" />
                  <span className="font-medium">Account Type</span>
                </div>
                <span className="text-sm text-muted-foreground">
                  Virginia Tech Student
                </span>
              </div>

              {/* Profile Details */}
              <div className="pt-4 border-t">
                <h3 className="text-lg font-semibold mb-4">Profile Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Gender */}
                  <div>
                    <Label htmlFor="gender">Gender</Label>
                    {isEditing ? (
                      <Select
                        value={editData.gender}
                        onValueChange={(v) =>
                          setEditData({ ...editData, gender: v })
                        }
                      >
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
                        {profileData.gender || "Not specified"}
                      </p>
                    )}
                  </div>

                  {/* Age */}
                  <div>
                    <Label htmlFor="age">Age</Label>
                    {isEditing ? (
                      <Input
                        id="age"
                        type="number"
                        value={editData.age || ""}
                        onChange={(e) =>
                          setEditData({
                            ...editData,
                            age: parseInt(e.target.value) || 0,
                          })
                        }
                      />
                    ) : (
                      <p className="text-sm text-muted-foreground mt-1">
                        {profileData.age || "Not specified"}
                      </p>
                    )}
                  </div>

                  {/* Major */}
                  <div className="md:col-span-2">
                    <Label htmlFor="major">Major</Label>
                    {isEditing ? (
                      <Input
                        id="major"
                        value={editData.major}
                        onChange={(e) =>
                          setEditData({ ...editData, major: e.target.value })
                        }
                      />
                    ) : (
                      <p className="text-sm text-muted-foreground mt-1">
                        {profileData.major || "Not specified"}
                      </p>
                    )}
                  </div>

                  {/* Housing Status */}
                  <div className="md:col-span-2">
                    <Label htmlFor="housingStatus">Housing Status</Label>
                    {isEditing ? (
                      <Select
                        value={
                          editData.housing_status || HousingStatus.NOT_SEARCHING
                        }
                        onValueChange={(v) =>
                          setEditData({
                            ...editData,
                            housing_status: v as HousingStatus,
                          })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select your housing status" />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.values(HousingStatus).map((status) => (
                            <SelectItem key={status} value={status}>
                              {HousingStatusLabels[status]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <p className="text-sm text-muted-foreground mt-1">
                        {
                          HousingStatusLabels[
                            profileData.housing_status ||
                              HousingStatus.NOT_SEARCHING
                          ]
                        }
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
                    <Button
                      onClick={handleEditPriorities}
                      variant="outline"
                      size="sm"
                    >
                      <Settings className="h-4 w-4 mr-2" />
                      Edit Priorities
                    </Button>
                  ) : (
                    <>
                      <Button
                        onClick={handleSavePriorities}
                        disabled={isLoading || !isPrioritiesValid()}
                        size="sm"
                      >
                        <Save className="h-4 w-4 mr-2" />
                        {isLoading ? "Saving..." : "Save"}
                      </Button>
                      <Button
                        onClick={handleCancelPriorities}
                        variant="outline"
                        size="sm"
                      >
                        <X className="h-4 w-4 mr-2" />
                        Cancel
                      </Button>
                    </>
                  )}
                </div>

                {/* View or Edit Priorities */}
                {!isEditingPriorities ? (
                  <>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                      <div className="text-center p-3 bg-green-50 rounded-lg">
                        <DollarSign className="h-6 w-6 text-green-600 mx-auto mb-2" />
                        <div className="text-2xl font-bold text-green-600">
                          {housingPriorities.budget}%
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Budget
                        </div>
                      </div>
                      <div className="text-center p-3 bg-blue-50 rounded-lg">
                        <MapPin className="h-6 w-6 text-blue-600 mx-auto mb-2" />
                        <div className="text-2xl font-bold text-blue-600">
                          {housingPriorities.commute}%
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Commute
                        </div>
                      </div>
                      <div className="text-center p-3 bg-purple-50 rounded-lg">
                        <ShieldIcon className="h-6 w-6 text-purple-600 mx-auto mb-2" />
                        <div className="text-2xl font-bold text-purple-600">
                          {housingPriorities.safety}%
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Safety
                        </div>
                      </div>
                      <div className="text-center p-3 bg-orange-50 rounded-lg">
                        <Users className="h-6 w-6 text-orange-600 mx-auto mb-2" />
                        <div className="text-2xl font-bold text-orange-600">
                          {housingPriorities.roommates}%
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Roommates
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Total Priority</span>
                      <Badge variant="default" className="text-sm">
                        {housingPriorities.budget +
                          housingPriorities.commute +
                          housingPriorities.safety +
                          housingPriorities.roommates}
                        %
                      </Badge>
                    </div>
                    <Button
                      onClick={() => navigate("/housing-priorities-demo")}
                      variant="outline"
                      className="w-full mt-3"
                    >
                      <BarChart3 className="h-4 w-4 mr-2" />
                      View Priority Demo & Recommendations
                    </Button>
                  </>
                ) : (
                  <div className="space-y-6">
                    {[
                      {
                        key: "budget",
                        label: "Budget Affordability",
                        icon: <DollarSign className="h-4 w-4 text-green-600" />,
                        color: "green",
                      },
                      {
                        key: "commute",
                        label: "Commute Distance",
                        icon: <MapPin className="h-4 w-4 text-blue-600" />,
                        color: "blue",
                      },
                      {
                        key: "safety",
                        label: "Safety & Security",
                        icon: <ShieldIcon className="h-4 w-4 text-purple-600" />,
                        color: "purple",
                      },
                      {
                        key: "roommates",
                        label: "Roommate Compatibility",
                        icon: <Users className="h-4 w-4 text-orange-600" />,
                        color: "orange",
                      },
                    ].map(({ key, label, icon }) => (
                      <div key={key} className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {icon}
                            <span className="font-medium">{label}</span>
                          </div>
                          <Badge variant="outline">
                            {editPriorities[key as keyof HousingPriorities]}%
                          </Badge>
                        </div>
                        <Slider
                          value={[editPriorities[key as keyof HousingPriorities]]}
                          onValueChange={(value) =>
                            handlePriorityChange(
                              key as keyof HousingPriorities,
                              value
                            )
                          }
                          max={100}
                          step={5}
                        />
                      </div>
                    ))}

                    <div className="pt-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium">Total Priority</span>
                        <Badge
                          variant={
                            isPrioritiesValid() ? "default" : "destructive"
                          }
                        >
                          {getTotalPriorities()}%
                        </Badge>
                      </div>
                      <Progress value={getTotalPriorities()} className="h-2" />
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

            </CardContent>
          </Card>

          <div className="mt-6 grid gap-6">
            <Card>
              <CardContent className="space-y-6 p-6">
                {/* Appearance Section */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                      <Sun className="h-5 w-5" />
                      Appearance
                    </h3>
                    <Badge variant="outline" className="uppercase tracking-wide">
                      Active: {resolvedTheme === "dark" ? "Dark" : "Light"}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mb-4">
                    Personalize HokieNest with light or dark mode. Your preference syncs anywhere you sign in.
                  </p>
                  <Select
                    value={themePreference}
                    onValueChange={(value) => handleThemePreferenceChange(value as ThemePreference)}
                    disabled={themeSaving || themeLoading}
                  >
                    <SelectTrigger className="bg-surface-2 border-surface-3">
                      <SelectValue placeholder="Choose a theme" />
                    </SelectTrigger>
                    <SelectContent className="z-[1000]">
                      {appearanceOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          <div className="flex items-start gap-3">
                            <option.icon className="mt-1 h-4 w-4" />
                            <div>
                              <p className="font-medium">{option.label}</p>
                              <p className="text-xs text-muted-foreground">{option.description}</p>
                            </div>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="flex items-center justify-between mt-4">
                    <p className="text-xs text-muted-foreground">
                      {themeLoading
                        ? "Loading your saved preference..."
                        : themeSaving
                          ? "Saving your theme preference..."
                          : "Theme preference updates instantly across devices"}
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleThemePreferenceChange("system")}
                      disabled={themeSaving || themeLoading || themePreference === "system"}
                      className="gap-2"
                    >
                      <Monitor className="h-4 w-4" />
                      Use System Default
                    </Button>
                  </div>
                </div>

                <Separator />

                {/* Notification Settings Section */}
                <div>
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
                  
                  <div className="space-y-4">
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

                    {/* Quiet Hours Settings */}
                    <div className="p-4 border rounded-lg space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Clock className="h-5 w-5 text-primary" />
                          <div>
                            <p className="font-medium">Quiet Hours</p>
                            <p className="text-sm text-muted-foreground">
                              {enableQuietHours
                                ? `No email notifications from ${quietHoursStart} to ${quietHoursEnd}`
                                : 'Set times when you don\'t want to receive email notifications'}
                            </p>
                          </div>
                        </div>
                        <Switch
                          checked={enableQuietHours}
                          onCheckedChange={handleToggleQuietHours}
                          disabled={loadingPreferences || !emailNotificationsEnabled}
                        />
                      </div>

                      {enableQuietHours && (
                        <div className="grid grid-cols-2 gap-4 pt-2">
                          <div>
                            <Label htmlFor="quietHoursStart" className="text-sm">
                              Start Time
                            </Label>
                            <Input
                              id="quietHoursStart"
                              type="time"
                              value={quietHoursStart}
                              onChange={(e) => handleQuietHoursTimeChange('start', e.target.value)}
                              disabled={loadingPreferences}
                              className="mt-1"
                            />
                          </div>
                          <div>
                            <Label htmlFor="quietHoursEnd" className="text-sm">
                              End Time
                            </Label>
                            <Input
                              id="quietHoursEnd"
                              type="time"
                              value={quietHoursEnd}
                              onChange={(e) => handleQuietHoursTimeChange('end', e.target.value)}
                              disabled={loadingPreferences}
                              className="mt-1"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Delete Account Section */}
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-destructive flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5" />
                      Danger Zone
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      Once you delete your account, there is no going back.
                    </p>
                  </div>
                  <Dialog open={isDeleting} onOpenChange={setIsDeleting}>
                    <DialogTrigger asChild>
                      <Button variant="destructive" size="sm" className="gap-2">
                        <Trash2 className="h-4 w-4" />
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
                          Are you sure you want to delete your account? This
                          action cannot be undone.
                        </DialogDescription>
                      </DialogHeader>
                      <Alert variant="destructive">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertDescription>
                          This will permanently delete your account and all data.
                        </AlertDescription>
                      </Alert>
                      <DialogFooter>
                        <Button
                          variant="outline"
                          onClick={() => setIsDeleting(false)}
                        >
                          Cancel
                        </Button>
                        <Button
                          variant="destructive"
                          onClick={handleDelete}
                          disabled={isLoading}
                        >
                          {isLoading ? "Deleting..." : "Delete Account"}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;