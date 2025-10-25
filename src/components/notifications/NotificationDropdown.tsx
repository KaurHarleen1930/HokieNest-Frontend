import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { NotificationItem } from './NotificationItem';
import { notificationsAPI } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import { 
  Bell, 
  Check, 
  Trash2, 
  Settings,
  MessageCircle,
  UserPlus,
  Heart,
  CheckCheck
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';

interface Notification {
  id: string;
  notification_type: string;
  title: string;
  message: string;
  related_id?: string;
  is_read: boolean;
  created_at: string;
}

interface NotificationDropdownProps {
  onNavigate?: (notification: Notification) => void;
  className?: string;
}

/**
 * NotificationDropdown with realtime notification updates
 * CHANGE: Added realtime subscription to receive and display new notifications instantly
 * CHANGE: Fixed navigation to use React Router instead of window.location.href
 */
export function NotificationDropdown({ onNavigate, className }: NotificationDropdownProps) {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    loadNotifications();
    loadUnreadCount();
    
    // CHANGE: Subscribe to realtime notifications
    const setupRealtimeSubscription = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
          return;
        }

        const { data: userData } = await supabase
          .from('users')
          .select('user_id')
          .eq('auth_id', user.id)
          .single();

        if (!userData) {
          return;
        }

        const userId = userData.user_id;
        const channelName = `notifications:user:${userId}`;
        
        console.log(`🔔 NotificationDropdown subscribing to: ${channelName}`);

        const channel = supabase
          .channel(channelName)
          .on('broadcast', { event: 'new_notification' }, (payload) => {
            console.log('📨 New notification in dropdown:', payload);
            
            const newNotification = payload.payload as Notification;
            
            // CHANGE: Prepend new notification to the list
            setNotifications(prev => [newNotification, ...prev]);
            
            // Update unread count
            setUnreadCount(prev => prev + 1);
          })
          .subscribe((status) => {
            console.log(`📡 NotificationDropdown channel status: ${status}`);
          });

        return () => {
          console.log(`🔌 NotificationDropdown unsubscribing`);
          supabase.removeChannel(channel);
        };
      } catch (error) {
        console.error('Failed to set up realtime subscription in dropdown:', error);
      }
    };

    const cleanupPromise = setupRealtimeSubscription();
    
    return () => {
      cleanupPromise.then(cleanup => cleanup && cleanup());
    };
  }, []);

  useEffect(() => {
    if (isOpen) {
      loadNotifications();
    }
  }, [isOpen]);

  const loadNotifications = async () => {
    try {
      setIsLoading(true);
      const response = await notificationsAPI.getNotifications(1, 10, false);
      setNotifications(response.notifications);
    } catch (error) {
      console.error('Failed to load notifications:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadUnreadCount = async () => {
    try {
      const response = await notificationsAPI.getUnreadCount();
      setUnreadCount(response.unreadCount);
    } catch (error) {
      console.error('Failed to load unread count:', error);
    }
  };

  const handleMarkAsRead = async (notificationId: string) => {
    try {
      await notificationsAPI.markAsRead(notificationId);
      setNotifications(prev => 
        prev.map(notif => 
          notif.id === notificationId 
            ? { ...notif, is_read: true }
            : notif
        )
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  };

  const handleDelete = async (notificationId: string) => {
    try {
      await notificationsAPI.deleteNotification(notificationId);
      setNotifications(prev => prev.filter(notif => notif.id !== notificationId));
      const deletedNotification = notifications.find(notif => notif.id === notificationId);
      if (deletedNotification && !deletedNotification.is_read) {
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.error('Failed to delete notification:', error);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await notificationsAPI.markAllAsRead();
      setNotifications(prev => 
        prev.map(notif => ({ ...notif, is_read: true }))
      );
      setUnreadCount(0);
    } catch (error) {
      console.error('Failed to mark all as read:', error);
    }
  };

  /**
   * CHANGE: When clicking a notification, navigate to notifications page
   */
  const handleNotificationClick = (notification: Notification) => {
    // Close the dropdown
    setIsOpen(false);
    
    // Navigate to notifications page
    navigate('/notifications');
    
    // Call onNavigate callback if provided
    if (onNavigate) {
      onNavigate(notification);
    }
  };

  /**
   * CHANGE: Clear all notifications (delete them all)
   */
  const handleClearAll = async () => {
    try {
      // Delete all notifications with single API call
      await notificationsAPI.deleteAllNotifications();
      
      // Clear local state
      setNotifications([]);
      setUnreadCount(0);
    } catch (error) {
      console.error('Failed to clear all notifications:', error);
    }
  };

  const getNotificationTypeIcon = (type: string) => {
    switch (type) {
      case 'connection_request':
        return <UserPlus className="h-4 w-4" />;
      case 'message':
        return <MessageCircle className="h-4 w-4" />;
      case 'match_found':
        return <Heart className="h-4 w-4" />;
      default:
        return <Bell className="h-4 w-4" />;
    }
  };

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        {/* CHANGE: Added relative class to Button so badge positions correctly on the bell icon */}
        <Button variant="ghost" size="sm" className={`relative ${className || ''}`}>
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <Badge 
              variant="destructive" 
              className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs pointer-events-none"
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      
      <DropdownMenuContent align="end" className="w-80">
        <div className="p-3 border-b">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Notifications</h3>
            <div className="flex items-center space-x-1">
              {unreadCount > 0 && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleMarkAllAsRead}
                  className="h-6 px-2 text-xs"
                  title="Mark all as read"
                >
                  <CheckCheck className="h-3 w-3 mr-1" />
                  Mark all
                </Button>
              )}
              {/* CHANGE: Added Clear All button */}
              {notifications.length > 0 && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleClearAll}
                  className="h-6 px-2 text-xs text-destructive hover:text-destructive"
                  title="Clear all notifications"
                >
                  <Trash2 className="h-3 w-3 mr-1" />
                  Clear all
                </Button>
              )}
            </div>
          </div>
        </div>

        <ScrollArea className="max-h-96">
          {isLoading ? (
            <div className="p-4 space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-start space-x-3">
                  <div className="w-4 h-4 bg-muted animate-pulse rounded" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-muted animate-pulse rounded w-3/4" />
                    <div className="h-3 bg-muted animate-pulse rounded w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : notifications.length === 0 ? (
            <div className="p-6 text-center">
              <Bell className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No notifications yet</p>
            </div>
          ) : (
            <div className="p-2">
              {notifications.map((notification) => (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                  onMarkAsRead={handleMarkAsRead}
                  onDelete={handleDelete}
                  onNavigate={handleNotificationClick}
                />
              ))}
            </div>
          )}
        </ScrollArea>

        {notifications.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <div className="p-2">
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-center"
                onClick={() => {
                  // CHANGE: Use React Router navigate instead of window.location.href
                  setIsOpen(false);
                  navigate('/notifications');
                }}
              >
                View all notifications
              </Button>
            </div>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
