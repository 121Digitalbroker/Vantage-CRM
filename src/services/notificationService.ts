export interface Notification {
  id: string;
  type: 'lead_assigned' | 'timer_expired' | 'lead_completed';
  title: string;
  message: string;
  leadId?: string;
  leadName?: string;
  teleCallerId?: string;
  teleCallerName?: string;
  recipientRole: 'admin' | 'telecaller';
  recipientId?: string;
  read: boolean;
  createdAt: string;
  actionUrl?: string;
}

const NOTIFICATIONS_KEY = 'crm_notifications';

export const notificationService = {
  loadNotifications(): Notification[] {
    const saved = localStorage.getItem(NOTIFICATIONS_KEY);
    return saved ? JSON.parse(saved) : [];
  },

  saveNotifications(notifications: Notification[]): void {
    localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(notifications));
  },

  createNotification(notification: Omit<Notification, 'id' | 'createdAt'>): Notification {
    const newNotification: Notification = {
      ...notification,
      id: Date.now().toString(),
      createdAt: new Date().toISOString(),
    };
    const notifications = this.loadNotifications();
    notifications.push(newNotification);
    this.saveNotifications(notifications);
    return newNotification;
  },

  // Notify telecaller when lead is assigned
  notifyLeadAssignment(leadId: string, leadName: string, teleCallerId: string, teleCallerName: string): void {
    this.createNotification({
      type: 'lead_assigned',
      title: 'New Lead Assigned',
      message: `You have been assigned lead: ${leadName}`,
      leadId,
      leadName,
      teleCallerId,
      teleCallerName,
      recipientRole: 'telecaller',
      recipientId: teleCallerId,
      read: false,
      actionUrl: `/lead/${leadId}`,
    });
  },

  // Notify admin when assignment timer expires
  notifyTimerExpired(leadId: string, leadName: string, teleCallerName: string): void {
    this.createNotification({
      type: 'timer_expired',
      title: 'Lead Assignment Expired',
      message: `Lead "${leadName}" assigned to ${teleCallerName} has expired and needs reassignment`,
      leadId,
      leadName,
      teleCallerName,
      recipientRole: 'admin',
      read: false,
      actionUrl: `/lead/${leadId}`,
    });
  },

  getNotifications(role?: 'admin' | 'telecaller', userId?: string): Notification[] {
    const notifications = this.loadNotifications();
    let filtered = notifications;

    if (role) {
      filtered = filtered.filter(n => n.recipientRole === role);
    }

    if (userId && role === 'telecaller') {
      filtered = filtered.filter(n => n.recipientId === userId);
    }

    return filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  },

  getUnreadCount(role?: 'admin' | 'telecaller', userId?: string): number {
    return this.getNotifications(role, userId).filter(n => !n.read).length;
  },

  markAsRead(notificationId: string): void {
    const notifications = this.loadNotifications();
    const notification = notifications.find(n => n.id === notificationId);
    if (notification) {
      notification.read = true;
      this.saveNotifications(notifications);
    }
  },

  markAllAsRead(role?: 'admin' | 'telecaller', userId?: string): void {
    const notifications = this.loadNotifications();
    const toUpdate = this.getNotifications(role, userId);
    toUpdate.forEach(n => {
      const notification = notifications.find(notif => notif.id === n.id);
      if (notification) {
        notification.read = true;
      }
    });
    this.saveNotifications(notifications);
  },

  deleteNotification(notificationId: string): void {
    const notifications = this.loadNotifications();
    const filtered = notifications.filter(n => n.id !== notificationId);
    this.saveNotifications(filtered);
  },

  clearOldNotifications(daysToKeep: number = 30): void {
    const notifications = this.loadNotifications();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const filtered = notifications.filter(n => new Date(n.createdAt) > cutoffDate);
    this.saveNotifications(filtered);
  },
};
