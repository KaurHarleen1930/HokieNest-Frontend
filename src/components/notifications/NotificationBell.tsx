import { NotificationDropdown } from './NotificationDropdown';

interface NotificationBellProps {
  onNavigate?: (notification: any) => void;
  className?: string;
}

/**
 * NotificationBell component - simplified wrapper around NotificationDropdown
 * CHANGE: Simplified to just pass through to NotificationDropdown which handles all logic
 */
export function NotificationBell({ onNavigate, className }: NotificationBellProps) {
  return (
    <NotificationDropdown onNavigate={onNavigate} className={className} />
  );
}
