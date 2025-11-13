import { useState, useEffect } from 'react';
import { usersAPI, AdminLog, AdminLogsResponse } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';

const ACTION_LABELS: Record<string, string> = {
  suspend_user: 'Suspended User',
  unsuspend_user: 'Unsuspended User',
  delete_user: 'Deleted User',
  promote_user: 'Promoted User',
  demote_user: 'Demoted User',
  view_users: 'Viewed Users',
  view_logs: 'Viewed Logs',
  update_user: 'Updated User',
};

const ACTION_COLORS: Record<string, 'destructive' | 'default' | 'secondary' | 'outline'> = {
  suspend_user: 'destructive',
  unsuspend_user: 'default',
  delete_user: 'destructive',
  promote_user: 'default',
  demote_user: 'secondary',
  view_users: 'outline',
  view_logs: 'outline',
  update_user: 'secondary',
};

export function AdminLogsTable() {
  const { toast } = useToast();
  const [logs, setLogs] = useState<AdminLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [limit, setLimit] = useState(20);
  const [actionFilter, setActionFilter] = useState<string>('all');

  const loadLogs = async () => {
    try {
      setLoading(true);
      const params: Parameters<typeof usersAPI.getAdminLogs>[0] = {
        page,
        limit,
      };

      if (actionFilter && actionFilter !== 'all') {
        params.action = actionFilter;
      }

      const response: AdminLogsResponse = await usersAPI.getAdminLogs(params);
      setLogs(response.logs);
      setTotal(response.total);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to load admin logs',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, [page, limit, actionFilter]);

  const totalPages = Math.ceil(total / limit);

  const formatAdminName = (log: AdminLog) => {
    if (log.admin) {
      return `${log.admin.first_name || ''} ${log.admin.last_name || ''}`.trim() || log.admin.email;
    }
    return 'Unknown';
  };

  const formatTargetName = (log: AdminLog) => {
    if (log.target_user) {
      return `${log.target_user.first_name || ''} ${log.target_user.last_name || ''}`.trim() || log.target_user.email;
    }
    return log.target_user_id ? `User #${log.target_user_id}` : 'N/A';
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Admin Activity Logs</CardTitle>
            <CardDescription>
              Track and audit all administrative actions ({total} total entries)
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Select value={actionFilter} onValueChange={setActionFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by action" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Actions</SelectItem>
                <SelectItem value="suspend_user">Suspend User</SelectItem>
                <SelectItem value="unsuspend_user">Unsuspend User</SelectItem>
                <SelectItem value="delete_user">Delete User</SelectItem>
                <SelectItem value="view_users">View Users</SelectItem>
                <SelectItem value="view_logs">View Logs</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon" onClick={loadLogs} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading && logs.length === 0 ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            Loading logs...
          </div>
        ) : logs.length === 0 ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            No admin activity logs found.
          </div>
        ) : (
          <>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Timestamp</TableHead>
                    <TableHead>Admin</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Target User</TableHead>
                    <TableHead>IP Address</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="font-mono text-xs">
                        {format(new Date(log.created_at), 'MMM d, yyyy HH:mm:ss')}
                      </TableCell>
                      <TableCell>{formatAdminName(log)}</TableCell>
                      <TableCell>
                        <Badge variant={ACTION_COLORS[log.action] || 'default'}>
                          {ACTION_LABELS[log.action] || log.action}
                        </Badge>
                      </TableCell>
                      <TableCell>{formatTargetName(log)}</TableCell>
                      <TableCell className="font-mono text-xs">
                        {log.ip_address || 'N/A'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between pt-4">
              <div className="text-sm text-muted-foreground">
                Showing {(page - 1) * limit + 1} to {Math.min(page * limit, total)} of {total} entries
              </div>
              <div className="flex items-center gap-2">
                <Select value={limit.toString()} onValueChange={(val) => {
                  setLimit(parseInt(val));
                  setPage(1); // Reset to page 1 when changing limit
                }}>
                  <SelectTrigger className="w-[100px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10 / page</SelectItem>
                    <SelectItem value="20">20 / page</SelectItem>
                    <SelectItem value="50">50 / page</SelectItem>
                    <SelectItem value="100">100 / page</SelectItem>
                  </SelectContent>
                </Select>
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1 || loading}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <div className="px-3 text-sm">
                    Page {page} of {totalPages}
                  </div>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages || loading}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
