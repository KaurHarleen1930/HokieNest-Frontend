import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { analyticsAPI, AnalyticsOverview } from '@/lib/api';
import { Users, Home, MessageSquare, TrendingUp, Star, UserPlus } from 'lucide-react';
import { ErrorState } from '@/components/ui/error-state';

export function AnalyticsDashboard() {
  const [overview, setOverview] = useState<AnalyticsOverview | null>(null);
  const [period, setPeriod] = useState<'7d' | '30d' | '90d'>('30d');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchOverview();
  }, []);

  const fetchOverview = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await analyticsAPI.getOverview();
      setOverview(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  };

  if (loading && !overview) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-32 bg-surface-2 rounded"></div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <ErrorState
        title="Failed to load analytics"
        description={error}
        onRetry={fetchOverview}
      />
    );
  }

  if (!overview) return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Analytics Dashboard</h2>
          <p className="text-muted">Platform usage and engagement metrics</p>
        </div>
        <Select value={period} onValueChange={(v) => setPeriod(v as typeof period)}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7d">Last 7 days</SelectItem>
            <SelectItem value="30d">Last 30 days</SelectItem>
            <SelectItem value="90d">Last 90 days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* User Metrics */}
      <div>
        <h3 className="text-lg font-semibold text-foreground mb-4">User Metrics</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="bg-surface border-surface-3">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted text-sm">Total Users</p>
                  <p className="text-3xl font-bold text-foreground">{overview.users.total}</p>
                  <p className="text-success text-sm mt-1">
                    +{overview.users.new} new this period
                  </p>
                </div>
                <Users className="h-12 w-12 text-accent" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-surface border-surface-3">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted text-sm">New Signups</p>
                  <p className="text-3xl font-bold text-success">{overview.users.new}</p>
                  <p className="text-muted text-sm mt-1">This period</p>
                </div>
                <UserPlus className="h-12 w-12 text-success" />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Listing Metrics */}
      <div>
        <h3 className="text-lg font-semibold text-foreground mb-4">Listing Metrics</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="bg-surface border-surface-3">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted text-sm">Total Listings</p>
                  <p className="text-3xl font-bold text-foreground">{overview.listings.total}</p>
                </div>
                <Home className="h-12 w-12 text-accent" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-surface border-surface-3">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted text-sm">Property Listings</p>
                  <p className="text-3xl font-bold text-foreground">{overview.listings.properties}</p>
                </div>
                <Home className="h-12 w-12 text-blue-500" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-surface border-surface-3">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted text-sm">Room Listings</p>
                  <p className="text-3xl font-bold text-foreground">{overview.listings.rooms}</p>
                </div>
                <Home className="h-12 w-12 text-purple-500" />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Engagement Metrics */}
      <div>
        <h3 className="text-lg font-semibold text-foreground mb-4">Engagement Metrics</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card className="bg-surface border-surface-3">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted text-sm">Messages</p>
                  <p className="text-3xl font-bold text-foreground">
                    {overview.engagement.messages.toLocaleString()}
                  </p>
                </div>
                <MessageSquare className="h-12 w-12 text-blue-500" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-surface border-surface-3">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted text-sm">Connections</p>
                  <p className="text-3xl font-bold text-foreground">
                    {overview.engagement.connections.toLocaleString()}
                  </p>
                </div>
                <TrendingUp className="h-12 w-12 text-success" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-surface border-surface-3">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted text-sm">Reviews</p>
                  <p className="text-3xl font-bold text-foreground">
                    {overview.engagement.reviews.toLocaleString()}
                  </p>
                </div>
                <Star className="h-12 w-12 text-yellow-500" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-surface border-surface-3">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted text-sm">Favorites</p>
                  <p className="text-3xl font-bold text-foreground">
                    {overview.engagement.favorites.toLocaleString()}
                  </p>
                </div>
                <Star className="h-12 w-12 text-red-500" />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Summary Card */}
      <Card className="bg-gradient-to-br from-accent/10 to-accent/5 border-accent/20">
        <CardHeader>
          <CardTitle>Platform Health</CardTitle>
          <CardDescription>Overall platform activity summary</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <p className="text-sm text-muted mb-2">Avg. Messages per User</p>
              <p className="text-2xl font-bold text-foreground">
                {overview.users.total > 0
                  ? Math.round(overview.engagement.messages / overview.users.total)
                  : 0}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted mb-2">Avg. Connections per User</p>
              <p className="text-2xl font-bold text-foreground">
                {overview.users.total > 0
                  ? (overview.engagement.connections / overview.users.total).toFixed(1)
                  : 0}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted mb-2">Listings per Active User</p>
              <p className="text-2xl font-bold text-foreground">
                {overview.users.total > 0
                  ? (overview.listings.total / overview.users.total).toFixed(2)
                  : 0}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
