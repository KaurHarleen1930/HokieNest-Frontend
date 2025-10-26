import { supabase } from '../lib/supabase';

export interface OnlineStatus {
  user_id: number;
  is_online: boolean;
  last_seen: string;
}

/**
 * RealtimeService handles Supabase Realtime broadcasting for:
 * - User notifications (connection requests, messages, etc.)
 * - Typing indicators
 * - Online status changes
 * - New messages in conversations
 */
export class RealtimeService {
  /**
   * Broadcast a notification to a specific user's notification channel
   * CHANGE: Implemented to use Supabase Realtime channels
   * Channel name format: notifications:user:{user_id}
   */
  static async broadcastNotification(notification: any): Promise<void> {
    const channelName = `notifications:user:${notification.user_id}`;
    
    try {
      // Use Supabase Realtime to broadcast the notification
      // The frontend will subscribe to this channel and receive the event
      const channel = supabase.channel(channelName);
      
      await channel.send({
        type: 'broadcast',
        event: 'new_notification',
        payload: notification
      });
      
      console.log(`✅ Notification broadcast to channel: ${channelName}`, {
        id: notification.id,
        type: notification.notification_type,
        user_id: notification.user_id
      });
    } catch (error) {
      console.error(`❌ Failed to broadcast notification to ${channelName}:`, error);
      throw error;
    }
  }
  /**
   * Set user online status
   */
  static async setUserOnline(userId: number): Promise<OnlineStatus> {
    const { data: status, error } = await supabase
      .from('user_online_status')
      .upsert({
        user_id: userId,
        is_online: true,
        last_seen: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to set user online: ${error.message}`);
    }

    return status;
  }

  /**
   * Set user offline status
   */
  static async setUserOffline(userId: number): Promise<OnlineStatus> {
    const { data: status, error } = await supabase
      .from('user_online_status')
      .upsert({
        user_id: userId,
        is_online: false,
        last_seen: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to set user offline: ${error.message}`);
    }

    return status;
  }

  /**
   * Get user's online status
   */
  static async getUserStatus(userId: number): Promise<OnlineStatus | null> {
    const { data: status, error } = await supabase
      .from('user_online_status')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 is "not found"
      throw new Error(`Failed to get user status: ${error.message}`);
    }

    return status;
  }

  /**
   * Get online users
   */
  static async getOnlineUsers(): Promise<OnlineStatus[]> {
    const { data: users, error } = await supabase
      .from('user_online_status')
      .select('*')
      .eq('is_online', true)
      .order('last_seen', { ascending: false });

    if (error) {
      throw new Error(`Failed to get online users: ${error.message}`);
    }

    return users || [];
  }

  /**
   * Broadcast typing indicator to conversation participants
   * CHANGE: Fully implemented with Supabase Realtime
   */
  static async broadcastTypingIndicator(
    conversationId: string,
    userId: number,
    isTyping: boolean
  ): Promise<void> {
    const channelName = `conversation:${conversationId}`;
    
    try {
      const channel = supabase.channel(channelName);
      
      await channel.send({
        type: 'broadcast',
        event: 'typing',
        payload: { user_id: userId, is_typing: isTyping }
      });
      
      console.log(`✅ Typing indicator broadcast: User ${userId} is ${isTyping ? 'typing' : 'not typing'}`);
    } catch (error) {
      console.error(`❌ Failed to broadcast typing indicator:`, error);
      // Don't throw - typing indicators are non-critical
    }
  }

  /**
   * Broadcast new message to conversation participants
   * CHANGE: Fully implemented with Supabase Realtime
   */
  static async broadcastNewMessage(
    conversationId: string,
    message: any
  ): Promise<void> {
    const channelName = `conversation:${conversationId}`;
    
    try {
      const channel = supabase.channel(channelName);
      
      await channel.send({
        type: 'broadcast',
        event: 'new_message',
        payload: message
      });
      
      console.log(`✅ Message broadcast to conversation: ${conversationId}`);
    } catch (error) {
      console.error(`❌ Failed to broadcast message to ${channelName}:`, error);
      throw error;
    }
  }

  /**
   * Broadcast connection request
   */
  static async broadcastConnectionRequest(
    recipientId: number,
    requesterName: string
  ): Promise<void> {
    console.log(`Connection request broadcast: ${requesterName} to user ${recipientId}`);
    
    // In a real implementation, you would broadcast this to the recipient
    // await supabase.channel(`user:${recipientId}`)
    //   .send({
    //     type: 'connection_request',
    //     payload: { requester_name: requesterName }
    //   });
  }

  /**
   * Broadcast connection accepted
   */
  static async broadcastConnectionAccepted(
    requesterId: number,
    acceptorName: string
  ): Promise<void> {
    console.log(`Connection accepted broadcast: ${acceptorName} to user ${requesterId}`);
    
    // In a real implementation, you would broadcast this to the requester
    // await supabase.channel(`user:${requesterId}`)
    //   .send({
    //     type: 'connection_accepted',
    //     payload: { acceptor_name: acceptorName }
    //   });
  }

  /**
   * Broadcast online status change
   */
  static async broadcastOnlineStatusChange(
    userId: number,
    isOnline: boolean
  ): Promise<void> {
    console.log(`Online status broadcast: User ${userId} is now ${isOnline ? 'online' : 'offline'}`);
    
    // In a real implementation, you would broadcast this to all connected users
    // or to specific users who have this user in their conversations
  }

  /**
   * Subscribe to conversation updates
   */
  static subscribeToConversation(
    conversationId: string,
    onMessage: (message: any) => void,
    onTyping: (typing: any) => void
  ) {
    // This would use Supabase Realtime in a real implementation
    console.log(`Subscribing to conversation ${conversationId}`);
    
    // Example of how this would work with Supabase Realtime:
    // const channel = supabase.channel(`conversation:${conversationId}`)
    //   .on('broadcast', { event: 'new_message' }, (payload) => {
    //     onMessage(payload.message);
    //   })
    //   .on('broadcast', { event: 'typing' }, (payload) => {
    //     onTyping(payload.typing);
    //   })
    //   .subscribe();
    
    // return channel;
  }

  /**
   * Unsubscribe from conversation updates
   */
  static unsubscribeFromConversation(channel: any) {
    // if (channel) {
    //   supabase.removeChannel(channel);
    // }
    console.log('Unsubscribed from conversation');
  }

  /**
   * Clean up old online statuses (users who haven't been seen in 30 minutes)
   */
  static async cleanupOldOnlineStatuses(): Promise<void> {
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    
    const { error } = await supabase
      .from('user_online_status')
      .update({ is_online: false })
      .eq('is_online', true)
      .lt('last_seen', thirtyMinutesAgo);

    if (error) {
      throw new Error(`Failed to cleanup old online statuses: ${error.message}`);
    }
  }
}
