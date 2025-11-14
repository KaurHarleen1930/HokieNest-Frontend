import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { reportsAPI, Report, ReportStats, FlaggedPost } from '@/lib/api';
import { AlertTriangle, CheckCircle, XCircle, MessageSquare, Ban, Trash2, Flag } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { ErrorState } from '@/components/ui/error-state';

export function ReportsManagement() {
  const [reports, setReports] = useState<Report[]>([]);
  const [flaggedPosts, setFlaggedPosts] = useState<FlaggedPost[]>([]);
  const [stats, setStats] = useState<ReportStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [flaggedPostsLoading, setFlaggedPostsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('pending');
  const [flaggedFilter, setFlaggedFilter] = useState<boolean>(false);
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [selectedFlaggedPost, setSelectedFlaggedPost] = useState<FlaggedPost | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [isResolving, setIsResolving] = useState(false);

  const { toast } = useToast();

  useEffect(() => {
    fetchReports();
    fetchStats();
  }, [statusFilter]);

  useEffect(() => {
    fetchFlaggedPosts();
  }, [flaggedFilter]);

  const fetchReports = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await reportsAPI.getAll({ status: statusFilter, limit: 50 });
      setReports(data.reports);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load reports');
    } finally {
      setLoading(false);
    }
  };

  const fetchFlaggedPosts = async () => {
    try {
      setFlaggedPostsLoading(true);
      const data = await reportsAPI.getFlaggedPosts({ resolved: flaggedFilter, limit: 50 });

      // Aggregate posts by post_id to avoid duplicates
      const aggregatedPosts = data.reduce((acc: FlaggedPost[], current: FlaggedPost) => {
        const existing = acc.find(item => item.post_id === current.post_id);
        if (existing) {
          // Increment report count
          existing.report_count = (existing.report_count || 1) + 1;
        } else {
          // Add new post with initial count of 1
          acc.push({ ...current, report_count: 1 });
        }
        return acc;
      }, []);

      setFlaggedPosts(aggregatedPosts);
    } catch (err) {
      console.error('Failed to load flagged posts:', err);
    } finally {
      setFlaggedPostsLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const data = await reportsAPI.getStats();
      setStats(data);
    } catch (err) {
      console.error('Failed to load stats:', err);
    }
  };

  const handleResolve = async (action?: 'suspend_user' | 'delete_content') => {
    if (!selectedReport) return;

    try {
      setIsResolving(true);
      await reportsAPI.resolve(selectedReport.id, {
        resolution_notes: resolutionNotes,
        action,
      });

      toast({
        title: 'Report resolved',
        description: 'The report has been successfully resolved.',
      });

      setSelectedReport(null);
      setResolutionNotes('');
      fetchReports();
      fetchStats();
    } catch (err) {
      toast({
        title: 'Resolution failed',
        description: err instanceof Error ? err.message : 'Failed to resolve report',
        variant: 'destructive',
      });
    } finally {
      setIsResolving(false);
    }
  };

  const handleDismiss = async () => {
    if (!selectedReport) return;

    try {
      setIsResolving(true);
      await reportsAPI.dismiss(selectedReport.id, resolutionNotes);

      toast({
        title: 'Report dismissed',
        description: 'The report has been dismissed.',
      });

      setSelectedReport(null);
      setResolutionNotes('');
      fetchReports();
      fetchStats();
    } catch (err) {
      toast({
        title: 'Dismissal failed',
        description: err instanceof Error ? err.message : 'Failed to dismiss report',
        variant: 'destructive',
      });
    } finally {
      setIsResolving(false);
    }
  };

  const handleResolveFlaggedPost = async (action?: 'delete_post') => {
    if (!selectedFlaggedPost) return;

    try {
      setIsResolving(true);
      await reportsAPI.resolveFlaggedPost(selectedFlaggedPost.id, action);

      toast({
        title: action === 'delete_post' ? 'Post deleted' : 'Flag dismissed',
        description: action === 'delete_post'
          ? 'The flagged post has been deleted.'
          : 'The flag has been dismissed and the post kept.',
      });

      setSelectedFlaggedPost(null);
      fetchFlaggedPosts();
      fetchStats();
    } catch (err) {
      toast({
        title: 'Action failed',
        description: err instanceof Error ? err.message : 'Failed to process flagged post',
        variant: 'destructive',
      });
    } finally {
      setIsResolving(false);
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'pending':
        return 'warning' as const;
      case 'resolved':
        return 'success' as const;
      case 'dismissed':
        return 'secondary' as const;
      default:
        return 'default' as const;
    }
  };

  if (loading && !reports.length) {
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
        title="Failed to load reports"
        description={error}
        onRetry={fetchReports}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-surface border-surface-3">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted text-sm">Pending Reports</p>
                  <p className="text-2xl font-bold text-warning">{stats.reports.pending}</p>
                </div>
                <AlertTriangle className="h-8 w-8 text-warning" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-surface border-surface-3">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted text-sm">Resolved Reports</p>
                  <p className="text-2xl font-bold text-success">{stats.reports.resolved}</p>
                </div>
                <CheckCircle className="h-8 w-8 text-success" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-surface border-surface-3">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted text-sm">Unique Flagged Posts</p>
                  <p className="text-2xl font-bold text-error">
                    {flaggedPosts.filter(p => !p.resolved).length}
                  </p>
                </div>
                <Flag className="h-8 w-8 text-error" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Reports Table */}
      <Card className="bg-surface border-surface-3">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>User Reports</CardTitle>
              <CardDescription>Review and resolve user-submitted reports</CardDescription>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
                <SelectItem value="dismissed">Dismissed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {reports.length === 0 ? (
            <div className="text-center py-12">
              <MessageSquare className="h-12 w-12 text-muted mx-auto mb-4" />
              <p className="text-muted">No {statusFilter} reports</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Reporter</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reports.map((report) => (
                    <TableRow key={report.id}>
                      <TableCell>
                        <Badge variant="outline">{report.report_type}</Badge>
                      </TableCell>
                      <TableCell className="max-w-md truncate">{report.description}</TableCell>
                      <TableCell className="text-muted">#{report.reporter_id}</TableCell>
                      <TableCell>
                        <Badge variant={getStatusBadgeVariant(report.status)}>
                          {report.status.charAt(0).toUpperCase() + report.status.slice(1)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted">
                        {new Date(report.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => setSelectedReport(report)}
                        >
                          Review
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Flagged Posts Table */}
      <Card className="bg-surface border-surface-3">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Flagged Posts</CardTitle>
              <CardDescription>Review and manage flagged community posts</CardDescription>
            </div>
            <Select value={flaggedFilter ? 'resolved' : 'pending'} onValueChange={(v) => setFlaggedFilter(v === 'resolved')}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {flaggedPostsLoading ? (
            <div className="text-center py-12">
              <div className="animate-pulse space-y-4">
                <div className="h-12 bg-surface-2 rounded"></div>
                <div className="h-12 bg-surface-2 rounded"></div>
                <div className="h-12 bg-surface-2 rounded"></div>
              </div>
            </div>
          ) : flaggedPosts.length === 0 ? (
            <div className="text-center py-12">
              <Flag className="h-12 w-12 text-muted mx-auto mb-4" />
              <p className="text-muted">No {flaggedFilter ? 'resolved' : 'pending'} flagged posts</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Post Content</TableHead>
                    <TableHead>Report Count</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {flaggedPosts
                    .sort((a, b) => {
                      const countA = a.report_count || 1;
                      const countB = b.report_count || 1;
                      return countB - countA;
                    })
                    .map((flaggedPost) => (
                    <TableRow key={flaggedPost.id}>
                      <TableCell className="max-w-md">
                        <div className="truncate text-foreground">
                          {flaggedPost.post?.content || flaggedPost.post?.title || 'Post content not available'}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="destructive">
                          {flaggedPost.report_count || 1}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={flaggedPost.resolved ? 'success' : 'warning'}>
                          {flaggedPost.resolved ? 'Resolved' : 'Pending'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {!flaggedPost.resolved && (
                          <Button
                            variant="default"
                            size="sm"
                            onClick={() => setSelectedFlaggedPost(flaggedPost)}
                          >
                            Review
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Report Review Dialog */}
      <Dialog open={!!selectedReport} onOpenChange={() => setSelectedReport(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Review Report</DialogTitle>
            <DialogDescription>
              Take action on this report or dismiss it if not actionable.
            </DialogDescription>
          </DialogHeader>

          {selectedReport && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-muted">Report Type</p>
                  <p className="text-foreground">{selectedReport.report_type}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted">Date</p>
                  <p className="text-foreground">
                    {new Date(selectedReport.created_at).toLocaleString()}
                  </p>
                </div>
              </div>

              <div>
                <p className="text-sm font-medium text-muted mb-2">Description</p>
                <p className="text-foreground bg-surface-2 p-3 rounded border border-surface-3">
                  {selectedReport.description}
                </p>
              </div>

              <div>
                <p className="text-sm font-medium text-muted mb-2">Resolution Notes</p>
                <Textarea
                  placeholder="Add notes about your decision..."
                  value={resolutionNotes}
                  onChange={(e) => setResolutionNotes(e.target.value)}
                  rows={4}
                />
              </div>
            </div>
          )}

          <DialogFooter className="flex gap-2">
            <Button
              variant="outline"
              onClick={handleDismiss}
              disabled={isResolving}
            >
              <XCircle className="h-4 w-4 mr-2" />
              Dismiss
            </Button>
            {selectedReport?.reported_user_id && (
              <Button
                variant="destructive"
                onClick={() => handleResolve('suspend_user')}
                disabled={isResolving}
              >
                <Ban className="h-4 w-4 mr-2" />
                Suspend User
              </Button>
            )}
            {(selectedReport?.reported_review_id || selectedReport?.reported_property_id) && (
              <Button
                variant="destructive"
                onClick={() => handleResolve('delete_content')}
                disabled={isResolving}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Content
              </Button>
            )}
            <Button
              variant="default"
              onClick={() => handleResolve()}
              disabled={isResolving}
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              Resolve
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Flagged Post Review Dialog */}
      <Dialog open={!!selectedFlaggedPost} onOpenChange={() => setSelectedFlaggedPost(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Review Flagged Post</DialogTitle>
            <DialogDescription>
              Review the flagged post and decide whether to delete it or keep it.
            </DialogDescription>
          </DialogHeader>

          {selectedFlaggedPost && (
            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium text-muted mb-2">Report Count</p>
                <Badge variant="destructive" className="text-base">
                  {selectedFlaggedPost.report_count || 1} {(selectedFlaggedPost.report_count || 1) === 1 ? 'report' : 'reports'}
                </Badge>
              </div>

              <div>
                <p className="text-sm font-medium text-muted mb-2">Post Content</p>
                <div className="text-foreground bg-surface-2 p-4 rounded border border-surface-3 max-h-64 overflow-y-auto">
                  {selectedFlaggedPost.post?.content || selectedFlaggedPost.post?.title || 'Post content not available'}
                </div>
              </div>

              {selectedFlaggedPost.post?.user && (
                <div>
                  <p className="text-sm font-medium text-muted mb-2">Posted By</p>
                  <p className="text-foreground">
                    {selectedFlaggedPost.post.user.name || 'Unknown User'} (#{selectedFlaggedPost.post.user.id})
                  </p>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => handleResolveFlaggedPost()}
              disabled={isResolving}
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              Keep Post
            </Button>
            <Button
              variant="destructive"
              onClick={() => handleResolveFlaggedPost('delete_post')}
              disabled={isResolving}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete Post
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
