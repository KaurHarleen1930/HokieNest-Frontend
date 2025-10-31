import { useAuth } from "@/lib/auth";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Heart, Home, Settings, Shield, Star, BookmarkPlus, HeartOff } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { favoritesAPI, Listing } from "@/lib/api";
import { PropertyCard } from "@/components/PropertyCard";

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [saved, setSaved] = useState<Listing[] | null>(null);
  const [loadingSaved, setLoadingSaved] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  if (!user) return null;
  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        setLoadingSaved(true);
        const res = await favoritesAPI.getAll();
        if (mounted) setSaved(res.favorites || []);
      } catch (e) {
        if (mounted) setSaved([]);
      } finally {
        if (mounted) setLoadingSaved(false);
      }
    };
    load();
    return () => { mounted = false; };
  }, []);

  const handleRemove = async (id: string) => {
    try {
      setRemovingId(id);
      await favoritesAPI.remove(id);
      setSaved((prev) => (prev ? prev.filter((l) => l.id !== id) : prev));
    } finally {
      setRemovingId(null);
    }
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'admin': return 'destructive';
      case 'staff': return 'accent';
      default: return 'secondary';
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground">
                Welcome back, {user.name}!
              </h1>
              <div className="flex items-center gap-2 mt-2">
                <Badge variant={getRoleBadgeVariant(user.role)}>
                  {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                </Badge>
                <span className="text-muted text-sm">{user.email}</span>
              </div>
            </div>

            <Button variant="outline" className="gap-2">
              <Settings className="h-4 w-4" />
              Settings
            </Button>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Card className="bg-surface border-surface-3 hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate('/properties')}>
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-accent/20">
                  <Home className="h-6 w-6 text-accent" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">Browse Properties</h3>
                  <p className="text-sm text-muted">Find your perfect home</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-surface border-surface-3 hover:shadow-md transition-shadow cursor-pointer">
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-success/20">
                  <BookmarkPlus className="h-6 w-6 text-success" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">Saved Properties</h3>
                  <p className="text-sm text-muted">Your favorites</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {user.role === 'admin' && (
            <Card className="bg-surface border-surface-3 hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate('/admin')}>
              <CardContent className="p-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-error/20">
                    <Shield className="h-6 w-6 text-error" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">Admin Panel</h3>
                    <p className="text-sm text-muted">Manage users</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Main Content */}
        <Tabs defaultValue="saved" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 lg:w-[400px] bg-surface-2">
            <TabsTrigger value="saved">Saved Properties</TabsTrigger>
            <TabsTrigger value="matches">Matches</TabsTrigger>
          </TabsList>

          <TabsContent value="saved" className="space-y-4">
            <Card className="bg-surface border-surface-3">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Heart className="h-5 w-5 text-accent" />
                  Saved Properties
                </CardTitle>
                <CardDescription>
                  Properties you've saved for later viewing
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loadingSaved ? (
                  <div className="text-center py-12 text-muted">Loading...</div>
                ) : (saved && saved.length > 0) ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {saved.map((l) => (
                      <div key={l.id} className="relative">
                        <PropertyCard listing={{ ...l, isSaved: true }} />
                        <div className="mt-2 flex justify-end">
                          <Button
                            variant="outline"
                            onClick={() => handleRemove(l.id)}
                            disabled={removingId === l.id}
                            className="gap-2"
                          >
                            <HeartOff className="h-4 w-4" />
                            {removingId === l.id ? 'Removing...' : 'Remove from favorites'}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <Heart className="h-12 w-12 text-muted mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-foreground mb-2">No saved properties yet</h3>
                    <p className="text-muted mb-6">
                      Start browsing properties and save your favorites to see them here.
                    </p>
                    <Button variant="accent" onClick={() => navigate('/properties')}>
                      Browse Properties
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="matches" className="space-y-4">
            <Card className="bg-surface border-surface-3">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Star className="h-5 w-5 text-accent" />
                  Recommended Matches
                </CardTitle>
                <CardDescription>
                  Properties that match your preferences and search history
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-12">
                  <Star className="h-12 w-12 text-muted mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-foreground mb-2">No matches yet</h3>
                  <p className="text-muted mb-6">
                    Browse properties to help us understand your preferences and get personalized recommendations.
                  </p>
                  <Button variant="accent" onClick={() => navigate('/properties')}>
                    Start Browsing
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}