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
import { reportsAPI, Report, ReportStats } from '@/lib/api';
import { AlertTriangle, CheckCircle, XCircle, MessageSquare, Ban, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { ErrorState } from '@/components/ui/error-state';

export function ReportsManagement() {
  const [reports, setReports] = useState<Report[]>([]);
  const [stats, setStats] = useState<ReportStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('pending');
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [isResolving, setIsResolving] = useState(false);

  const { toast } = useToast();

  useEffect(() => {
    fetchReports();
    fetchStats();
  }, [statusFilter]);

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
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-surface border-surface-3">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted text-sm">Total Reports</p>
                  <p className="text-2xl font-bold text-foreground">{stats.reports.total}</p>
                </div>
                <MessageSquare className="h-8 w-8 text-accent" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-surface border-surface-3">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted text-sm">Pending</p>
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
                  <p className="text-muted text-sm">Resolved</p>
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
                  <p className="text-muted text-sm">Flagged Posts</p>
                  <p className="text-2xl font-bold text-error">{stats.flaggedPosts.pending}</p>
                </div>
                <XCircle className="h-8 w-8 text-error" />
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
    </div>
  );
}
