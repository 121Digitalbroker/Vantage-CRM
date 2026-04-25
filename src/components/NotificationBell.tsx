import { useState, useEffect } from 'react';
import { Bell, X, CheckCircle, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import { notificationService, type Notification } from '@/src/services/notificationService';
import { useRole } from '@/src/contexts/RoleContext';

export default function NotificationBell() {
  const { currentUser } = useRole();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);

  const loadNotifications = () => {
    // Map the capitalized role ('Admin', 'Manager', 'Digital Marketer', 'Telecaller') to notification roles
    let userRole: 'admin' | 'telecaller' = 'telecaller';
    if (currentUser?.role === 'Admin' || currentUser?.role === 'Manager' || currentUser?.role === 'Digital Marketer') {
      userRole = 'admin';
    }

    const userNotifications = notificationService.getNotifications(userRole, currentUser?.id);
    setNotifications(userNotifications);
    setUnreadCount(notificationService.getUnreadCount(userRole, currentUser?.id));
  };

  useEffect(() => {
    loadNotifications();
    const interval = setInterval(loadNotifications, 3000); // Poll every 3 seconds
    return () => clearInterval(interval);
  }, [currentUser]);

  const handleMarkAsRead = (notificationId: string) => {
    notificationService.markAsRead(notificationId);
    loadNotifications();
  };

  const handleDelete = (notificationId: string) => {
    notificationService.deleteNotification(notificationId);
    loadNotifications();
  };

  const handleMarkAllAsRead = () => {
    let userRole: 'admin' | 'telecaller' = 'telecaller';
    if (currentUser?.role === 'Admin' || currentUser?.role === 'Manager' || currentUser?.role === 'Digital Marketer') {
      userRole = 'admin';
    }
    notificationService.markAllAsRead(userRole, currentUser?.id);
    loadNotifications();
  };

  const getNotificationIcon = (type: string) => {
    if (type === 'timer_expired') {
      return <AlertCircle className="w-4 h-4 text-red-500" />;
    }
    return <CheckCircle className="w-4 h-4 text-blue-500" />;
  };

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger className="relative inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-950 disabled:pointer-events-none disabled:opacity-50 hover:bg-slate-100 hover:text-slate-900 h-9 w-9">
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-semibold">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-0">
        <div className="border-b border-slate-200 p-4 flex items-center justify-between">
          <h3 className="font-semibold text-slate-900">Notifications</h3>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-blue-500 hover:text-blue-600"
              onClick={handleMarkAllAsRead}
            >
              Mark all as read
            </Button>
          )}
        </div>

        {notifications.length === 0 ? (
          <div className="p-8 text-center">
            <Bell className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-sm text-slate-500">No notifications yet</p>
          </div>
        ) : (
          <div className="max-h-96 overflow-y-auto">
            {notifications.map(notification => (
              <div
                key={notification.id}
                className={`border-b border-slate-100 p-4 hover:bg-slate-50 transition-colors ${
                  !notification.read ? 'bg-blue-50' : ''
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="mt-1">
                    {getNotificationIcon(notification.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-900 text-sm">{notification.title}</p>
                    <p className="text-xs text-slate-600 mt-1 line-clamp-2">{notification.message}</p>
                    <p className="text-xs text-slate-400 mt-2">
                      {new Date(notification.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    {!notification.read && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-xs"
                        onClick={() => handleMarkAsRead(notification.id)}
                      >
                        Read
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 text-slate-400 hover:text-red-500"
                      onClick={() => handleDelete(notification.id)}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
