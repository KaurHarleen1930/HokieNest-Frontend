import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { 
  MessageCircle, 
  UserPlus, 
  Heart, 
  Home, 
  X, 
  Check,
  Clock,
  ExternalLink
} from 'lucide-react';

interface Notification {
  id: string;
  notification_type: string;
  title: string;
  message: string;
  related_id?: string;
  is_read: boolean;
  created_at: string;
}

interface NotificationItemProps {
  notification: Notification;
  onMarkAsRead?: (notificationId: string) => void;
  onDelete?: (notificationId: string) => void;
  onNavigate?: (notification: Notification) => void;
  className?: string;
}

export function NotificationItem({
  notification,
  onMarkAsRead,
  onDelete,
  onNavigate,
  className
}: NotificationItemProps) {
  const [isHovered, setIsHovered] = useState(false);

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'connection_request':
        return <UserPlus className="h-4 w-4 text-blue-500" />;
      case 'connection_accepted':
        return <Check className="h-4 w-4 text-green-500" />;
      case 'message':
        return <MessageCircle className="h-4 w-4 text-purple-500" />;
      case 'match_found':
        return <Heart className="h-4 w-4 text-red-500" />;
      case 'housing_update':
        return <Home className="h-4 w-4 text-orange-500" />;
      default:
        return <MessageCircle className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getNotificationColor = (type: string) => {
    switch (type) {
      case 'connection_request':
        return 'border-l-blue-500';
      case 'connection_accepted':
        return 'border-l-green-500';
      case 'message':
        return 'border-l-purple-500';
      case 'match_found':
        return 'border-l-red-500';
      case 'housing_update':
        return 'border-l-orange-500';
      default:
        return 'border-l-muted-foreground';
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMinutes = (now.getTime() - date.getTime()) / (1000 * 60);
    
    if (diffInMinutes < 1) {
      return 'Just now';
    } else if (diffInMinutes < 60) {
      return `${Math.floor(diffInMinutes)}m ago`;
    } else if (diffInMinutes < 1440) { // 24 hours
      return `${Math.floor(diffInMinutes / 60)}h ago`;
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  };

  /**
   * CHANGE: Only navigate, don't mark as read automatically
   * User must explicitly mark as read from the notifications page
   */
  const handleClick = () => {
    if (onNavigate) {
      onNavigate(notification);
    }
  };

  const handleMarkAsRead = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onMarkAsRead) {
      onMarkAsRead(notification.id);
    }
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onDelete) {
      onDelete(notification.id);
    }
  };

  return (
    <div
      className={cn(
        "flex items-start space-x-3 p-3 rounded-lg cursor-pointer transition-colors hover:bg-muted/50 border-l-4",
        getNotificationColor(notification.notification_type),
        !notification.is_read && "bg-muted/30",
        className
      )}
      onClick={handleClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Icon */}
      <div className="flex-shrink-0 mt-0.5">
        {getNotificationIcon(notification.notification_type)}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <h4 className={cn(
              "font-medium text-sm",
              !notification.is_read && "font-semibold"
            )}>
              {notification.title}
            </h4>
            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
              {notification.message}
            </p>
          </div>
          
          <div className="flex items-center space-x-2 ml-2">
            {!notification.is_read && (
              <div className="w-2 h-2 bg-primary rounded-full flex-shrink-0" />
            )}
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatTime(notification.created_at)}
            </span>
          </div>
        </div>

        {/* Actions */}
        {/* CHANGE: Removed "Mark as read" button per user request */}
        {isHovered && (
          <div className="flex items-center space-x-2 mt-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={handleDelete}
              className="h-6 px-2 text-xs text-destructive hover:text-destructive"
            >
              <X className="h-3 w-3 mr-1" />
              Delete
            </Button>
            {onNavigate && (
              <Button
                size="sm"
                variant="ghost"
                onClick={(e) => {
                  e.stopPropagation();
                  onNavigate(notification);
                }}
                className="h-6 px-2 text-xs"
              >
                <ExternalLink className="h-3 w-3 mr-1" />
                View
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
