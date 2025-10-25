import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { notificationsAPI, connectionsAPI } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import {
  Bell,
  Check,
  CheckCheck,
  Trash2,
  UserPlus,
  MessageCircle,
  Heart,
  X,
  Loader2,
  Settings
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface Notification {
  id: string;
  notification_type: string;
  title: string;
  message: string;
  related_id?: string;
  is_read: boolean;
  created_at: string;
}

/**
 * Full-page notifications view
 * CHANGE: New page component to display all user notifications with actions
 */
export default function NotificationsPage() {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [allNotifications, setAllNotifications] = useState<Notification[]>([]); // CHANGE: Store all notifications for accurate counts
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'unread' | 'connection_requests'>('all');
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());
  const filterRef = useRef(filter); // CHANGE: Use ref to avoid stale closure in realtime callback

  // CHANGE: Update filterRef when filter changes
  useEffect(() => {
    filterRef.current = filter;
  }, [filter]);

  // CHANGE: Load notifications when filter changes
  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }

    loadNotifications();
  }, [isAuthenticated, filter]);

  // CHANGE: Set up realtime subscription once on mount
  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    const cleanup = setupRealtimeSubscription();
    return () => {
      cleanup.then(fn => fn && fn());
    };
  }, [isAuthenticated]);

  /**
   * CHANGE: Subscribe to realtime notifications to update the list instantly
   */
  const setupRealtimeSubscription = async () => {
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) return;

      const { data: userData } = await supabase
        .from('users')
        .select('user_id')
        .eq('auth_id', authUser.id)
        .single();

      if (!userData) return;

      const userId = userData.user_id;
      const channelName = `notifications:user:${userId}`;

      const channel = supabase
        .channel(channelName)
        .on('broadcast', { event: 'new_notification' }, (payload) => {
          const newNotification = payload.payload as Notification;
          
          // CHANGE: Always add to allNotifications
          setAllNotifications(prev => [newNotification, ...prev]);
          
          // CHANGE: Only add to filtered notifications if it matches the current filter
          // Use filterRef.current to avoid stale closure
          const currentFilter = filterRef.current;
          if (currentFilter === 'all' || 
              (currentFilter === 'unread' && !newNotification.is_read) ||
              (currentFilter === 'connection_requests' && newNotification.notification_type === 'connection_request')) {
            setNotifications(prev => [newNotification, ...prev]);
          }
        })
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    } catch (error) {
      console.error('Failed to set up realtime subscription:', error);
    }
  };

  const loadNotifications = async () => {
    try {
      setIsLoading(true);
      const response = await notificationsAPI.getNotifications(
        1,
        50,
        false // Always get all notifications for accurate counts
      );
      
      // CHANGE: Store all notifications for accurate counts
      setAllNotifications(response.notifications);
      
      // CHANGE: Filter notifications based on selected filter
      let filteredNotifications = response.notifications;
      if (filter === 'unread') {
        filteredNotifications = response.notifications.filter(n => !n.is_read);
      } else if (filter === 'connection_requests') {
        filteredNotifications = response.notifications.filter(
          n => n.notification_type === 'connection_request'
        );
      }
      
      setNotifications(filteredNotifications);
    } catch (error) {
      console.error('Failed to load notifications:', error);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * CHANGE: Handle accepting a connection request from notification
   * CHANGE: Now PERMANENTLY DELETES the notification from the database after accepting
   */
  const handleAcceptConnection = async (notificationId: string, connectionId: string) => {
    try {
      setProcessingIds(prev => new Set(prev).add(notificationId));
      
      // Accept the connection
      await connectionsAPI.acceptConnection(connectionId);
      
      // CHANGE: DELETE the notification from the database (not just mark as read)
      // This permanently removes the row from the notifications table
      console.log(`🗑️ Deleting notification ${notificationId} from database after accepting connection`);
      await notificationsAPI.deleteNotification(notificationId);
      
      // CHANGE: Update both filtered and all notifications
      setNotifications(prev => prev.filter(n => n.id !== notificationId));
      setAllNotifications(prev => prev.filter(n => n.id !== notificationId));
      
      // Show success message
      console.log('✅ Connection accepted and notification deleted from database');
    } catch (error) {
      console.error('Failed to accept connection:', error);
      alert('Failed to accept connection request');
    } finally {
      setProcessingIds(prev => {
        const next = new Set(prev);
        next.delete(notificationId);
        return next;
      });
    }
  };

  /**
   * CHANGE: Handle rejecting a connection request from notification
   * CHANGE: Now PERMANENTLY DELETES BOTH the notification AND the underlying connection from database
   * When rejecting:
   * 1. Connection is DELETED from roommate_connections table (backend)
   * 2. Notification is DELETED from notifications table
   */
  const handleRejectConnection = async (notificationId: string, connectionId: string) => {
    try {
      setProcessingIds(prev => new Set(prev).add(notificationId));
      
      // CHANGE: Reject the connection - this now DELETES it from roommate_connections table
      console.log(`🗑️ Rejecting connection ${connectionId} - will be deleted from roommate_connections`);
      await connectionsAPI.rejectConnection(connectionId);
      
      // CHANGE: DELETE the notification from the database (not just mark as read)
      // This permanently removes the row from the notifications table
      console.log(`🗑️ Deleting notification ${notificationId} from database after rejecting connection`);
      await notificationsAPI.deleteNotification(notificationId);
      
      // CHANGE: Update both filtered and all notifications
      setNotifications(prev => prev.filter(n => n.id !== notificationId));
      setAllNotifications(prev => prev.filter(n => n.id !== notificationId));
      
      console.log('✅ Connection rejected and deleted from roommate_connections, notification deleted from database');
    } catch (error) {
      console.error('Failed to reject connection:', error);
      alert('Failed to reject connection request');
    } finally {
      setProcessingIds(prev => {
        const next = new Set(prev);
        next.delete(notificationId);
        return next;
      });
    }
  };

  const handleMarkAsRead = async (notificationId: string) => {
    try {
      await notificationsAPI.markAsRead(notificationId);
      // CHANGE: Update both filtered and all notifications
      setNotifications(prev =>
        prev.map(n =>
          n.id === notificationId ? { ...n, is_read: true } : n
        )
      );
      setAllNotifications(prev =>
        prev.map(n =>
          n.id === notificationId ? { ...n, is_read: true } : n
        )
      );
    } catch (error) {
      console.error('Failed to mark as read:', error);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await notificationsAPI.markAllAsRead();
      // CHANGE: Update both filtered and all notifications
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setAllNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    } catch (error) {
      console.error('Failed to mark all as read:', error);
    }
  };

  /**
   * Delete individual notification - PERMANENTLY removes from database
   * CHANGE: If it's a connection_request notification, also DELETES the underlying connection from roommate_connections
   */
  const handleDelete = async (notificationId: string) => {
    try {
      console.log(`🗑️ Deleting notification ${notificationId} from database`);
      // This permanently removes the row from the notifications table
      // If it's a connection_request, backend also deletes from roommate_connections
      await notificationsAPI.deleteNotification(notificationId);
      
      // Update both filtered and all notifications
      setNotifications(prev => prev.filter(n => n.id !== notificationId));
      setAllNotifications(prev => prev.filter(n => n.id !== notificationId));
      
      console.log('✅ Notification deleted from database (and connection if it was a connection_request)');
    } catch (error) {
      console.error('Failed to delete notification:', error);
    }
  };

  /**
   * Clear all notifications - PERMANENTLY removes ALL from database
   * CHANGE: This deletes all notification rows from the notifications table
   * CHANGE: Also DELETES any pending connection_request connections from roommate_connections table
   */
  const handleClearAll = async () => {
    try {
      console.log('🗑️ Deleting ALL notifications from database');
      // This permanently removes ALL notification rows from the notifications table
      // Backend also deletes all pending connections associated with connection_request notifications
      await notificationsAPI.deleteAllNotifications();
      
      // Clear both filtered and all notifications from local state
      setNotifications([]);
      setAllNotifications([]);
      
      console.log('✅ All notifications deleted from database (and any pending connection_request connections)');
    } catch (error) {
      console.error('Failed to clear all notifications:', error);
      alert('Failed to clear all notifications');
    }
  };

  /**
   * CHANGE: View button now redirects to notifications page (stays on same page)
   * Just marks the notification as read
   */
  const handleView = (notification: Notification) => {
    // Mark as read when viewing
    if (!notification.is_read) {
      handleMarkAsRead(notification.id);
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'connection_request':
        return <UserPlus className="h-5 w-5 text-blue-500" />;
      case 'connection_accepted':
        return <CheckCheck className="h-5 w-5 text-green-500" />;
      case 'message':
        return <MessageCircle className="h-5 w-5 text-purple-500" />;
      case 'match_found':
        return <Heart className="h-5 w-5 text-pink-500" />;
      default:
        return <Bell className="h-5 w-5 text-gray-500" />;
    }
  };

  // CHANGE: Calculate unread count from all notifications (not just filtered)
  const unreadCount = allNotifications.filter(n => !n.is_read).length;
  // CHANGE: Calculate connection requests count from all notifications
  const connectionRequestsCount = allNotifications.filter(n => n.notification_type === 'connection_request').length;

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-background sticky top-0 z-10">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Notifications</h1>
              <p className="text-muted-foreground mt-1">
                {unreadCount > 0
                  ? `You have ${unreadCount} unread notification${unreadCount === 1 ? '' : 's'}`
                  : 'All caught up!'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <Button onClick={handleMarkAllAsRead} variant="outline" size="sm">
                  <CheckCheck className="h-4 w-4 mr-2" />
                  Mark all as read
                </Button>
              )}
              {/* CHANGE: Added Clear All button to main page header */}
              {notifications.length > 0 && (
                <Button 
                  onClick={handleClearAll} 
                  variant="outline" 
                  size="sm"
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Clear all
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={() => navigate('/settings')}>
                <Settings className="h-4 w-4 mr-2" />
                Settings
              </Button>
            </div>
          </div>

          {/* Filter Tabs */}
          {/* CHANGE: Added Connection Requests filter tab */}
          <div className="flex items-center gap-4 mt-4">
            <Button
              variant={filter === 'all' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setFilter('all')}
            >
              All
            </Button>
            <Button
              variant={filter === 'unread' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setFilter('unread')}
            >
              Unread
              {unreadCount > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {unreadCount}
                </Badge>
              )}
            </Button>
            <Button
              variant={filter === 'connection_requests' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setFilter('connection_requests')}
            >
              <UserPlus className="h-4 w-4 mr-2" />
              Connection Requests
              {/* CHANGE: Use connectionRequestsCount from all notifications */}
              {connectionRequestsCount > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {connectionRequestsCount}
                </Badge>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Notifications List */}
      <div className="container mx-auto px-4 py-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : notifications.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Bell className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No notifications</h3>
              <p className="text-sm text-muted-foreground">
                {filter === 'unread'
                  ? "You don't have any unread notifications"
                  : "You don't have any notifications yet"}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {notifications.map((notification) => {
              const isProcessing = processingIds.has(notification.id);
              const isConnectionRequest = notification.notification_type === 'connection_request';

              return (
                <Card
                  key={notification.id}
                  className={`transition-all ${
                    notification.is_read ? 'opacity-60' : 'border-primary/20'
                  }`}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start gap-4">
                      {/* Icon */}
                      <div className="flex-shrink-0 mt-1">
                        {getNotificationIcon(notification.notification_type)}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <h3 className="font-semibold text-sm mb-1">
                              {notification.title}
                              {!notification.is_read && (
                                <Badge variant="default" className="ml-2 text-xs">
                                  New
                                </Badge>
                              )}
                            </h3>
                            <p className="text-sm text-muted-foreground mb-2">
                              {notification.message}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {formatDistanceToNow(new Date(notification.created_at), {
                                addSuffix: true,
                              })}
                            </p>
                          </div>

                          {/* Actions */}
                          {/* CHANGE: Removed "Mark as read" button per user request */}
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(notification.id)}
                              title="Delete"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>

                        {/* CHANGE: Connection Request Actions */}
                        {isConnectionRequest && notification.related_id && (
                          <div className="flex items-center gap-2 mt-3">
                            <Button
                              size="sm"
                              onClick={() =>
                                handleAcceptConnection(notification.id, notification.related_id!)
                              }
                              disabled={isProcessing}
                            >
                              {isProcessing ? (
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              ) : (
                                <Check className="h-4 w-4 mr-2" />
                              )}
                              Accept
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                handleRejectConnection(notification.id, notification.related_id!)
                              }
                              disabled={isProcessing}
                            >
                              {isProcessing ? (
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              ) : (
                                <X className="h-4 w-4 mr-2" />
                              )}
                              Reject
                            </Button>
                          </div>
                        )}

                        {/* CHANGE: View button stays on notifications page, just marks as read */}
                        {!isConnectionRequest &&
                          !notification.is_read &&
                          (notification.notification_type === 'message' ||
                            notification.notification_type === 'connection_accepted' ||
                            notification.notification_type === 'match_found') && (
                            <div className="mt-3">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleView(notification)}
                              >
                                Mark as Read
                              </Button>
                            </div>
                          )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

