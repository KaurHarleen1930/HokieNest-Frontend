import { supabase } from '../lib/supabase';
import { sendVerificationEmail, sendRawEmail } from '../utils/email';
import { RealtimeService } from './realtime';

export interface Notification {
  id: string;
  user_id: number;
  notification_type: string;
  title: string;
  message: string;
  related_id?: string;
  is_read: boolean;
  created_at: string;
  expires_at?: string;
}

export interface NotificationPreferences {
  user_id: number;
  email_messages: boolean;
  email_connections: boolean;
  email_matches: boolean;
  in_app_messages: boolean;
  in_app_connections: boolean;
  in_app_matches: boolean;
}

export class NotificationService {
  /**
   * Helper function to get normalized frontend URL (removes trailing slashes)
   */
  private static getFrontendUrl(): string {
    const url = process.env.FRONTEND_URL || 'http://localhost:8080';
    return url.replace(/\/+$/, ''); // Remove trailing slashes
  }

  /**
   * Create a notification
   * CHANGE: Now broadcasts the notification via RealtimeService after creation
   * CHANGE: Explicitly sets is_read to false to ensure all notifications start unread
   */
  static async createNotification(
    userId: number,
    type: string,
    title: string,
    message: string,
    relatedId?: string,
    expiresAt?: Date
  ): Promise<Notification> {
    const { data: notification, error } = await supabase
      .from('notifications')
      .insert({
        user_id: userId,
        notification_type: type,
        title,
        message,
        related_id: relatedId,
        is_read: false, // CHANGE: Explicitly set to false to ensure notifications start unread
        expires_at: expiresAt?.toISOString()
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create notification: ${error.message}`);
    }

    // CHANGE: Broadcast notification via realtime immediately after creation
    try {
      await RealtimeService.broadcastNotification(notification);
    } catch (broadcastError) {
      console.error('Failed to broadcast notification:', broadcastError);
      // Don't throw here - notification was created successfully, broadcast is a nice-to-have
    }

    return notification;
  }

  /**
   * Get user notifications (paginated)
   */
  static async getUserNotifications(
    userId: number,
    page: number = 1,
    limit: number = 20,
    unreadOnly: boolean = false
  ): Promise<{ notifications: Notification[]; hasMore: boolean; total: number }> {
    const offset = (page - 1) * limit;

    let query = supabase
      .from('notifications')
      .select('*', { count: 'exact' })
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (unreadOnly) {
      query = query.eq('is_read', false);
    }

    const { data: notifications, error, count } = await query
      .range(offset, offset + limit - 1);

    if (error) {
      throw new Error(`Failed to fetch notifications: ${error.message}`);
    }

    const hasMore = (count || 0) > offset + limit;

    return {
      notifications: notifications || [],
      hasMore,
      total: count || 0
    };
  }

  /**
   * Mark notification as read
   */
  static async markAsRead(notificationId: string, userId: number): Promise<void> {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', notificationId)
      .eq('user_id', userId);

    if (error) {
      throw new Error(`Failed to mark notification as read: ${error.message}`);
    }
  }

  /**
   * Mark all notifications as read
   */
  static async markAllAsRead(userId: number): Promise<void> {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', userId)
      .eq('is_read', false);

    if (error) {
      throw new Error(`Failed to mark all notifications as read: ${error.message}`);
    }
  }

  /**
   * Delete a notification from the database
   * CHANGE: This permanently removes the notification row from the notifications table
   * CHANGE: If it's a connection_request notification, also deletes the underlying connection
   */
  static async deleteNotification(notificationId: string, userId: number): Promise<void> {
    console.log(`🗑️  Deleting notification ${notificationId} from database for user ${userId}`);
    
    // CHANGE: First, get the notification details to check if it's a connection_request
    const { data: notification } = await supabase
      .from('notifications')
      .select('notification_type, related_id')
      .eq('id', notificationId)
      .eq('user_id', userId)
      .single();

    // CHANGE: If this is a connection_request notification, delete the underlying connection
    if (notification && notification.notification_type === 'connection_request' && notification.related_id) {
      console.log(`🔗 Notification is a connection_request, also deleting connection ${notification.related_id} from roommate_connections`);
      
      // Delete the connection from roommate_connections table
      const { error: connectionError } = await supabase
        .from('roommate_connections')
        .delete()
        .eq('id', notification.related_id)
        .eq('recipient_id', userId) // Only allow recipient to delete their own pending requests
        .eq('status', 'pending'); // Only delete if still pending

      if (connectionError) {
        console.warn(`⚠️  Failed to delete underlying connection: ${connectionError.message}`);
        // Don't throw - still proceed to delete the notification
      } else {
        console.log(`✅ Connection ${notification.related_id} deleted from roommate_connections table`);
      }
    }
    
    // Delete the notification
    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('id', notificationId)
      .eq('user_id', userId);

    if (error) {
      throw new Error(`Failed to delete notification: ${error.message}`);
    }
    
    console.log(`✅ Notification ${notificationId} successfully deleted from database`);
  }

  /**
   * Delete all notifications for a user from the database
   * CHANGE: This permanently removes ALL notification rows from the notifications table for the user
   * CHANGE: Also deletes any pending connection requests associated with connection_request notifications
   */
  static async deleteAllNotifications(userId: number): Promise<void> {
    console.log(`🗑️  Deleting ALL notifications from database for user ${userId}`);
    
    // CHANGE: First, get all connection_request notifications to clean up underlying connections
    const { data: connectionNotifications } = await supabase
      .from('notifications')
      .select('notification_type, related_id')
      .eq('user_id', userId)
      .eq('notification_type', 'connection_request');

    // CHANGE: Delete all pending connections associated with these notifications
    if (connectionNotifications && connectionNotifications.length > 0) {
      const connectionIds = connectionNotifications
        .filter(n => n.related_id)
        .map(n => n.related_id);

      if (connectionIds.length > 0) {
        console.log(`🔗 Deleting ${connectionIds.length} pending connection(s) from roommate_connections`);
        
        const { error: connectionError } = await supabase
          .from('roommate_connections')
          .delete()
          .in('id', connectionIds)
          .eq('recipient_id', userId)
          .eq('status', 'pending');

        if (connectionError) {
          console.warn(`⚠️  Failed to delete some underlying connections: ${connectionError.message}`);
        } else {
          console.log(`✅ Deleted ${connectionIds.length} connection(s) from roommate_connections table`);
        }
      }
    }
    
    // Delete all notifications
    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('user_id', userId);

    if (error) {
      throw new Error(`Failed to delete all notifications: ${error.message}`);
    }
    
    console.log(`✅ All notifications successfully deleted from database for user ${userId}`);
  }

  /**
   * Get notification preferences for a user
   */
  static async getNotificationPreferences(userId: number): Promise<NotificationPreferences> {
    const { data: preferences, error } = await supabase
      .from('notification_preferences')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 is "not found"
      throw new Error(`Failed to fetch notification preferences: ${error.message}`);
    }

    // Return default preferences if none exist
    if (!preferences) {
      return {
        user_id: userId,
        email_messages: true,
        email_connections: true,
        email_matches: true,
        in_app_messages: true,
        in_app_connections: true,
        in_app_matches: true
      };
    }

    return preferences;
  }

  /**
   * Update notification preferences
   */
  static async updateNotificationPreferences(
    userId: number,
    preferences: Partial<Omit<NotificationPreferences, 'user_id'>>
  ): Promise<NotificationPreferences> {
    const { data: updatedPreferences, error } = await supabase
      .from('notification_preferences')
      .upsert({
        user_id: userId,
        ...preferences
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update notification preferences: ${error.message}`);
    }

    return updatedPreferences;
  }

  /**
   * Send connection request notification
   * CHANGE: Added connectionId parameter to store as related_id for accept/reject actions
   */
  static async sendConnectionRequestNotification(
    requesterId: number,
    recipientId: number,
    requesterName: string,
    compatibilityScore?: number,
    connectionId?: string
  ): Promise<void> {
    // Get recipient's preferences
    const preferences = await this.getNotificationPreferences(recipientId);

    // Create in-app notification
    if (preferences.in_app_connections) {
      // CHANGE: Use connectionId as related_id if provided, otherwise use requesterId
      // This allows the notification to link directly to the connection for accept/reject actions
      await this.createNotification(
        recipientId,
        'connection_request',
        'New Roommate Connection Request',
        `${requesterName} wants to connect with you${compatibilityScore ? ` (${compatibilityScore}% match)` : ''}`,
        connectionId || requesterId.toString()
      );
    }

    // Send email notification
    if (preferences.email_connections) {
      await this.sendConnectionRequestEmail(recipientId, requesterName, compatibilityScore);
    }
  }

  /**
   * Send new message notification
   */
  static async sendMessageNotification(
    senderId: number,
    recipientId: number,
    senderName: string,
    messagePreview: string,
    conversationId: string
  ): Promise<void> {
    // Get recipient's preferences
    const preferences = await this.getNotificationPreferences(recipientId);

    // Create in-app notification
    if (preferences.in_app_messages) {
      await this.createNotification(
        recipientId,
        'message',
        `New message from ${senderName}`,
        messagePreview,
        conversationId
      );
    }

    // Send email notification
    if (preferences.email_messages) {
      await this.sendMessageEmail(recipientId, senderName, messagePreview, conversationId);
    }
  }

  /**
   * Send connection accepted notification
   */
  static async sendConnectionAcceptedNotification(
    requesterId: number,
    acceptorId: number,
    acceptorName: string
  ): Promise<void> {
    // Get requester's preferences
    const preferences = await this.getNotificationPreferences(requesterId);

    // Create in-app notification
    if (preferences.in_app_connections) {
      await this.createNotification(
        requesterId,
        'connection_accepted',
        'Connection Request Accepted',
        `${acceptorName} accepted your connection request. You can now start chatting!`,
        acceptorId.toString()
      );
    }

    // Send email notification
    if (preferences.email_connections) {
      await this.sendConnectionAcceptedEmail(requesterId, acceptorName);
    }
  }

  /**
   * Send match found notification
   */
  static async sendMatchFoundNotification(
    userId: number,
    matchName: string,
    compatibilityScore: number
  ): Promise<void> {
    // Get user's preferences
    const preferences = await this.getNotificationPreferences(userId);

    // Create in-app notification
    if (preferences.in_app_matches) {
      await this.createNotification(
        userId,
        'match_found',
        'New Roommate Match Found',
        `${matchName} is a ${compatibilityScore}% match for you!`,
        userId.toString()
      );
    }

    // Send email notification
    if (preferences.email_matches) {
      await this.sendMatchFoundEmail(userId, matchName, compatibilityScore);
    }
  }

  /**
   * Clean up expired notifications
   */
  static async cleanupExpiredNotifications(): Promise<void> {
    const { error } = await supabase.rpc('cleanup_expired_notifications');

    if (error) {
      throw new Error(`Failed to cleanup expired notifications: ${error.message}`);
    }
  }

  // Private email methods
  private static async sendConnectionRequestEmail(
    recipientId: number,
    requesterName: string,
    compatibilityScore?: number
  ): Promise<void> {
    // Get recipient's email
    const { data: user, error } = await supabase
      .from('users')
      .select('email, first_name')
      .eq('user_id', recipientId)
      .single();

    if (error || !user) {
      throw new Error('Failed to get recipient email');
    }

    const subject = 'New Roommate Connection Request on HokieNest';
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #861F41; color: white; padding: 20px; text-align: center; }
            .content { padding: 30px; background-color: #f9f9f9; }
            .button { 
              display: inline-block; 
              padding: 12px 30px; 
              background-color: #861F41; 
              color: white; 
              text-decoration: none; 
              border-radius: 5px; 
              margin: 20px 0;
            }
            .footer { text-align: center; padding: 20px; font-size: 12px; color: #666; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>New Roommate Connection Request!</h1>
            </div>
            <div class="content">
              <h2>Hi ${user.first_name},</h2>
              <p><strong>${requesterName}</strong> wants to connect with you on HokieNest${compatibilityScore ? ` (${compatibilityScore}% compatibility match)` : ''}!</p>
              <p>Click the button below to view their profile and respond to their request:</p>
              <center>
                <a href="${NotificationService.getFrontendUrl()}/messages" class="button">View Connection Request</a>
              </center>
              <p>Or copy and paste this link into your browser:</p>
              <p style="word-break: break-all; color: #666;">
                ${NotificationService.getFrontendUrl()}/messages
              </p>
            </div>
            <div class="footer">
              <p>This email was sent from HokieNest. If you no longer wish to receive these emails, you can update your notification preferences in your account settings.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    await sendRawEmail(user.email, subject, { html, text: `New connection request from ${requesterName}` });
  }

  private static async sendMessageEmail(
    recipientId: number,
    senderName: string,
    messagePreview: string,
    conversationId: string
  ): Promise<void> {
    // Get recipient's email
    const { data: user, error } = await supabase
      .from('users')
      .select('email, first_name')
      .eq('user_id', recipientId)
      .single();

    if (error || !user) {
      throw new Error('Failed to get recipient email');
    }

    const subject = `New message from ${senderName} on HokieNest`;
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #861F41; color: white; padding: 20px; text-align: center; }
            .content { padding: 30px; background-color: #f9f9f9; }
            .button { 
              display: inline-block; 
              padding: 12px 30px; 
              background-color: #861F41; 
              color: white; 
              text-decoration: none; 
              border-radius: 5px; 
              margin: 20px 0;
            }
            .message-preview { 
              background-color: white; 
              padding: 15px; 
              border-left: 4px solid #861F41; 
              margin: 15px 0;
              font-style: italic;
            }
            .footer { text-align: center; padding: 20px; font-size: 12px; color: #666; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>New Message on HokieNest</h1>
            </div>
            <div class="content">
              <h2>Hi ${user.first_name},</h2>
              <p><strong>${senderName}</strong> sent you a message:</p>
              <div class="message-preview">
                "${messagePreview}"
              </div>
              <p>Click the button below to view the full conversation:</p>
              <center>
                <a href="${NotificationService.getFrontendUrl()}/messages" class="button">View Message</a>
              </center>
            </div>
            <div class="footer">
              <p>This email was sent from HokieNest. If you no longer wish to receive these emails, you can update your notification preferences in your account settings.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    const text = `New message from ${senderName}: ${messagePreview}\n\nOpen: ${NotificationService.getFrontendUrl()}/messages`;
    await sendRawEmail(user.email, subject, { html, text });
  }

  private static async sendConnectionAcceptedEmail(
    requesterId: number,
    acceptorName: string
  ): Promise<void> {
    // Get requester's email
    const { data: user, error } = await supabase
      .from('users')
      .select('email, first_name')
      .eq('user_id', requesterId)
      .single();

    if (error || !user) {
      throw new Error('Failed to get requester email');
    }

    const subject = `${acceptorName} accepted your connection request`;
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #861F41; color: white; padding: 20px; text-align: center; }
            .content { padding: 30px; background-color: #f9f9f9; }
            .button { 
              display: inline-block; 
              padding: 12px 30px; 
              background-color: #861F41; 
              color: white; 
              text-decoration: none; 
              border-radius: 5px; 
              margin: 20px 0;
            }
            .footer { text-align: center; padding: 20px; font-size: 12px; color: #666; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Connection Request Accepted!</h1>
            </div>
            <div class="content">
              <h2>Hi ${user.first_name},</h2>
              <p><strong>${acceptorName}</strong> accepted your connection request!</p>
              <p>You can now start chatting and getting to know each other better.</p>
              <center>
                <a href="${NotificationService.getFrontendUrl()}/messages" class="button">Start Chatting</a>
              </center>
            </div>
            <div class="footer">
              <p>This email was sent from HokieNest. If you no longer wish to receive these emails, you can update your notification preferences in your account settings.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    const text = `${acceptorName} accepted your connection request. Open Messages: ${NotificationService.getFrontendUrl()}/messages`;
    await sendRawEmail(user.email, subject, { html, text });
  }

  private static async sendMatchFoundEmail(
    userId: number,
    matchName: string,
    compatibilityScore: number
  ): Promise<void> {
    // Get user's email
    const { data: user, error } = await supabase
      .from('users')
      .select('email, first_name')
      .eq('user_id', userId)
      .single();

    if (error || !user) {
      throw new Error('Failed to get user email');
    }

    const subject = `New roommate match found: ${matchName}`;
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #861F41; color: white; padding: 20px; text-align: center; }
            .content { padding: 30px; background-color: #f9f9f9; }
            .button { 
              display: inline-block; 
              padding: 12px 30px; 
              background-color: #861F41; 
              color: white; 
              text-decoration: none; 
              border-radius: 5px; 
              margin: 20px 0;
            }
            .score { 
              font-size: 24px; 
              font-weight: bold; 
              color: #861F41; 
            }
            .footer { text-align: center; padding: 20px; font-size: 12px; color: #666; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>New Roommate Match Found!</h1>
            </div>
            <div class="content">
              <h2>Hi ${user.first_name},</h2>
              <p>We found a great roommate match for you!</p>
              <p><strong>${matchName}</strong> is a <span class="score">${compatibilityScore}%</span> compatibility match based on your preferences.</p>
              <p>Click the button below to view their profile and connect:</p>
              <center>
                <a href="${NotificationService.getFrontendUrl()}/roommate-matching" class="button">View Match</a>
              </center>
            </div>
            <div class="footer">
              <p>This email was sent from HokieNest. If you no longer wish to receive these emails, you can update your notification preferences in your account settings.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    const text = `New roommate match found: ${matchName} (${compatibilityScore}%). View: ${NotificationService.getFrontendUrl()}/roommate-matching`;
    await sendRawEmail(user.email, subject, { html, text });
  }
}
