import { supabase } from '../lib/supabase';
import { RealtimeService } from './realtime';

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: number;
  message_text?: string;
  message_type: 'text' | 'file' | 'image' | 'document';
  file_url?: string;
  file_name?: string;
  file_size?: number;
  created_at: string;
  updated_at: string;
  is_deleted: boolean;
  sender?: {
    user_id: number;
    first_name: string;
    last_name: string;
    email: string;
  };
  read_receipts?: Array<{
    user_id: number;
    read_at: string;
  }>;
}

export interface Conversation {
  id: string;
  connection_id: string;
  is_group: boolean;
  group_name?: string;
  created_at: string;
  updated_at: string;
  last_message_at?: string;
  participants?: Array<{
    user_id: number;
    first_name: string;
    last_name: string;
    email: string;
    joined_at: string;
  }>;
  last_message?: Message;
  unread_count?: number;
}

export interface TypingIndicator {
  conversation_id: string;
  user_id: number;
  started_at: string;
  user?: {
    first_name: string;
    last_name: string;
  };
}

export class ChatService {
  /**
   * Create a conversation for an accepted connection
   */
  static async createConversation(connectionId: string): Promise<Conversation> {
    const { data: conversation, error } = await supabase
      .from('chat_conversations')
      .insert({
        connection_id: connectionId,
        is_group: false
      })
      .select(`
        *,
        connection:connection_id(
          requester_id,
          recipient_id,
          requester:requester_id(first_name, last_name, email),
          recipient:recipient_id(first_name, last_name, email)
        )
      `)
      .single();

    if (error) {
      throw new Error(`Failed to create conversation: ${error.message}`);
    }

    // Add participants to the conversation
    const connection = conversation.connection;
    await supabase.from('conversation_participants').insert([
      { conversation_id: conversation.id, user_id: connection.requester_id },
      { conversation_id: conversation.id, user_id: connection.recipient_id }
    ]);

    return conversation;
  }

  /**
   * Create a group conversation with multiple participants
   * CHANGE: New method to create group chats
   */
  static async createGroupConversation(
    creatorId: number,
    groupName: string,
    participantIds: number[]
  ): Promise<Conversation> {
    // Create the group conversation
    const { data: conversation, error } = await supabase
      .from('chat_conversations')
      .insert({
        is_group: true,
        group_name: groupName,
        connection_id: null // Group chats don't have a connection_id
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create group conversation: ${error.message}`);
    }

    console.log(`👥 Creating group chat "${groupName}" with ${participantIds.length + 1} participants`);

    // Add all participants (including creator)
    const allParticipantIds = [creatorId, ...participantIds];
    const participantInserts = allParticipantIds.map(userId => ({
      conversation_id: conversation.id,
      user_id: userId
    }));

    const { error: participantError } = await supabase
      .from('conversation_participants')
      .insert(participantInserts);

    if (participantError) {
      // Rollback: delete the conversation if participant insertion fails
      await supabase
        .from('chat_conversations')
        .delete()
        .eq('id', conversation.id);
      throw new Error(`Failed to add participants: ${participantError.message}`);
    }

    // Fetch the complete conversation with participants
    const { data: fullConversation } = await supabase
      .from('chat_conversations')
      .select(`
        *,
        participants:conversation_participants!inner(
          user_id,
          joined_at,
          user:user_id(first_name, last_name, email, user_id)
        )
      `)
      .eq('id', conversation.id)
      .single();

    console.log(`✅ Group chat "${groupName}" created successfully`);

    return fullConversation || conversation;
  }

  /**
   * Get all conversations for a user
   * CHANGE: Fetch ALL participants, then filter to show only OTHER users
   */
  static async getUserConversations(userId: number): Promise<Conversation[]> {
    // Step 1: Get conversation IDs where user is a participant
    const { data: userParticipations, error: participationError } = await supabase
      .from('conversation_participants')
      .select('conversation_id')
      .eq('user_id', userId)
      .is('left_at', null);

    if (participationError) {
      throw new Error(`Failed to fetch user participations: ${participationError.message}`);
    }

    if (!userParticipations || userParticipations.length === 0) {
      return [];
    }

    const conversationIds = userParticipations.map(p => p.conversation_id);

    // Step 2: Get full conversation details with ALL participants
    const { data: conversations, error } = await supabase
      .from('chat_conversations')
      .select(`
        *,
        connection:connection_id(
          requester_id,
          recipient_id,
          requester:requester_id(first_name, last_name, email, user_id),
          recipient:recipient_id(first_name, last_name, email, user_id)
        )
      `)
      .in('id', conversationIds)
      .order('last_message_at', { ascending: false, nullsFirst: false });

    if (error) {
      throw new Error(`Failed to fetch conversations: ${error.message}`);
    }

    // Step 3: For each conversation, get ALL participants and filter
    const conversationsWithDetails = await Promise.all(
      (conversations || []).map(async (conv) => {
        // Get ALL participants for this conversation
        const { data: allParticipants } = await supabase
          .from('conversation_participants')
          .select(`
            user_id,
            joined_at,
            user:user_id(first_name, last_name, email, user_id)
          `)
          .eq('conversation_id', conv.id)
          .is('left_at', null);

        // Get unread count
        const { count: unreadCount } = await supabase
          .from('chat_messages')
          .select('*', { count: 'exact', head: true })
          .eq('conversation_id', conv.id)
          .neq('sender_id', userId)
          .not('id', 'in', `(SELECT message_id FROM message_read_receipts WHERE user_id = ${userId})`);

        // CHANGE: Filter to show only OTHER participants (exclude current user)
        const otherParticipants = (allParticipants || [])
          .map((p: any) => ({
            user_id: p.user?.user_id || p.user_id,
            first_name: p.user?.first_name,
            last_name: p.user?.last_name,
            email: p.user?.email,
            joined_at: p.joined_at
          }))
          .filter((p: any) => p.user_id !== userId);

        return {
          ...conv,
          participants: otherParticipants,
          unread_count: unreadCount || 0
        };
      })
    );

    return conversationsWithDetails;
  }

  /**
   * Get messages for a conversation (paginated)
   */
  static async getConversationMessages(
    conversationId: string,
    userId: number,
    page: number = 1,
    limit: number = 20
  ): Promise<{ messages: Message[]; hasMore: boolean }> {
    const offset = (page - 1) * limit;

    const { data: messages, error } = await supabase
      .from('chat_messages')
      .select(`
        *,
        sender:sender_id(first_name, last_name, email),
        read_receipts:message_read_receipts(
          user_id,
          read_at
        )
      `)
      .eq('conversation_id', conversationId)
      .eq('is_deleted', false)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      throw new Error(`Failed to fetch messages: ${error.message}`);
    }

    // Check if there are more messages
    const { count: totalCount } = await supabase
      .from('chat_messages')
      .select('*', { count: 'exact', head: true })
      .eq('conversation_id', conversationId)
      .eq('is_deleted', false);

    const hasMore = (totalCount || 0) > offset + limit;

    return {
      messages: (messages || []).reverse(), // Reverse to show oldest first
      hasMore
    };
  }

  /**
   * Send a message
   * CHANGE: Now broadcasts the message via RealtimeService after creation
   */
  static async sendMessage(
    conversationId: string,
    senderId: number,
    messageText: string,
    messageType: 'text' | 'file' | 'image' | 'document' = 'text',
    fileUrl?: string,
    fileName?: string,
    fileSize?: number
  ): Promise<Message> {
    const { data: message, error } = await supabase
      .from('chat_messages')
      .insert({
        conversation_id: conversationId,
        sender_id: senderId,
        message_text: messageText,
        message_type: messageType,
        file_url: fileUrl,
        file_name: fileName,
        file_size: fileSize
      })
      .select(`
        *,
        sender:sender_id(first_name, last_name, email)
      `)
      .single();

    if (error) {
      throw new Error(`Failed to send message: ${error.message}`);
    }

    // Update conversation's last_message_at
    await supabase
      .from('chat_conversations')
      .update({ last_message_at: new Date().toISOString() })
      .eq('id', conversationId);

    // CHANGE: Broadcast message via realtime to all conversation participants
    try {
      await RealtimeService.broadcastNewMessage(conversationId, message);
    } catch (broadcastError) {
      console.error('Failed to broadcast message:', broadcastError);
      // Don't throw - message was saved successfully
    }

    return message;
  }

  /**
   * Edit a message
   */
  static async editMessage(messageId: string, senderId: number, newText: string): Promise<Message> {
    const { data: message, error } = await supabase
      .from('chat_messages')
      .update({ message_text: newText })
      .eq('id', messageId)
      .eq('sender_id', senderId)
      .select(`
        *,
        sender:sender_id(first_name, last_name, email)
      `)
      .single();

    if (error) {
      throw new Error(`Failed to edit message: ${error.message}`);
    }

    return message;
  }

  /**
   * Delete a message (soft delete)
   */
  static async deleteMessage(messageId: string, senderId: number): Promise<void> {
    const { error } = await supabase
      .from('chat_messages')
      .update({ is_deleted: true })
      .eq('id', messageId)
      .eq('sender_id', senderId);

    if (error) {
      throw new Error(`Failed to delete message: ${error.message}`);
    }
  }

  /**
   * Mark message as read
   */
  static async markMessageAsRead(messageId: string, userId: number): Promise<void> {
    const { error } = await supabase
      .from('message_read_receipts')
      .upsert({
        message_id: messageId,
        user_id: userId,
        read_at: new Date().toISOString()
      });

    if (error) {
      throw new Error(`Failed to mark message as read: ${error.message}`);
    }
  }

  /**
   * Mark all messages in conversation as read
   */
  static async markConversationAsRead(conversationId: string, userId: number): Promise<void> {
    // Get all unread messages in the conversation
    const { data: unreadMessages } = await supabase
      .from('chat_messages')
      .select('id')
      .eq('conversation_id', conversationId)
      .neq('sender_id', userId)
      .not('id', 'in', `(SELECT message_id FROM message_read_receipts WHERE user_id = ${userId})`);

    if (unreadMessages && unreadMessages.length > 0) {
      const readReceipts = unreadMessages.map(msg => ({
        message_id: msg.id,
        user_id: userId,
        read_at: new Date().toISOString()
      }));

      const { error } = await supabase
        .from('message_read_receipts')
        .upsert(readReceipts);

      if (error) {
        throw new Error(`Failed to mark conversation as read: ${error.message}`);
      }
    }
  }

  /**
   * Update typing indicator
   */
  static async updateTypingIndicator(conversationId: string, userId: number, isTyping: boolean): Promise<void> {
    if (isTyping) {
      const { error } = await supabase
        .from('typing_indicators')
        .upsert({
          conversation_id: conversationId,
          user_id: userId,
          started_at: new Date().toISOString()
        });

      if (error) {
        throw new Error(`Failed to update typing indicator: ${error.message}`);
      }
    } else {
      const { error } = await supabase
        .from('typing_indicators')
        .delete()
        .eq('conversation_id', conversationId)
        .eq('user_id', userId);

      if (error) {
        throw new Error(`Failed to clear typing indicator: ${error.message}`);
      }
    }
  }

  /**
   * Get typing indicators for a conversation
   */
  static async getTypingIndicators(conversationId: string, excludeUserId?: number): Promise<TypingIndicator[]> {
    let query = supabase
      .from('typing_indicators')
      .select(`
        *,
        user:user_id(first_name, last_name)
      `)
      .eq('conversation_id', conversationId);

    if (excludeUserId) {
      query = query.neq('user_id', excludeUserId);
    }

    const { data: indicators, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch typing indicators: ${error.message}`);
    }

    return indicators || [];
  }

  /**
   * Clean up old typing indicators (older than 5 minutes)
   */
  static async cleanupTypingIndicators(): Promise<void> {
    const { error } = await supabase.rpc('cleanup_old_typing_indicators');

    if (error) {
      throw new Error(`Failed to cleanup typing indicators: ${error.message}`);
    }
  }

  /**
   * Upload file to Supabase Storage
   */
  static async uploadFile(
    file: Buffer,
    fileName: string,
    contentType: string,
    userId: number
  ): Promise<{ url: string; size: number }> {
    const filePath = `chat-files/${userId}/${Date.now()}-${fileName}`;

    const { data, error } = await supabase.storage
      .from('chat-files')
      .upload(filePath, file, {
        contentType,
        upsert: false
      });

    if (error) {
      throw new Error(`Failed to upload file: ${error.message}`);
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('chat-files')
      .getPublicUrl(filePath);

    return {
      url: urlData.publicUrl,
      size: file.length
    };
  }
}
