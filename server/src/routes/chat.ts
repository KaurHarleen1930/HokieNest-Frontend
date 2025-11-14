import { Router, Response } from 'express';
import { ChatService } from '../services/chat';
import { NotificationService } from '../services/notification';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { supabase } from '../lib/supabase';

const router = Router();

// Apply authentication middleware to all routes
router.use(authenticateToken);

// Helper function to check authentication
const requireAuth = (req: AuthRequest, res: any) => {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required' });
    return false;
  }
  return true;
};

/**
 * Get all conversations for the current user
 * GET /api/v1/chat/conversations
 */
router.get('/conversations', async (req: AuthRequest, res: Response) => {
  try {
    if (!requireAuth(req, res)) return;
    
    const userId = parseInt(req.user!.id);

    const conversations = await ChatService.getUserConversations(userId);

    res.json({
      success: true,
      conversations
    });
  } catch (error: any) {
    console.error('Error fetching conversations:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Create a group chat
 * POST /api/v1/chat/conversations/group
 * CHANGE: New endpoint to create group chats with multiple participants
 */
router.post('/conversations/group', async (req: AuthRequest, res: Response) => {
  try {
    if (!requireAuth(req, res)) return;
    
    const userId = parseInt(req.user!.id);
    const { group_name, participant_ids } = req.body;

    if (!group_name || !group_name.trim()) {
      return res.status(400).json({ error: 'Group name is required' });
    }

    if (!participant_ids || !Array.isArray(participant_ids) || participant_ids.length < 2) {
      return res.status(400).json({ error: 'At least 2 participants are required for a group chat' });
    }

    // Validate that all participants are connected with the creator
    const { data: connections } = await supabase
      .from('roommate_connections')
      .select('requester_id, recipient_id')
      .eq('status', 'accepted')
      .or(`requester_id.eq.${userId},recipient_id.eq.${userId}`);

    if (!connections) {
      return res.status(403).json({ error: 'Failed to verify connections' });
    }

    // Get list of connected user IDs
    const connectedUserIds = connections.map(conn => 
      conn.requester_id === userId ? conn.recipient_id : conn.requester_id
    );

    // Verify all participants are connected
    const invalidParticipants = participant_ids.filter(id => !connectedUserIds.includes(id));
    if (invalidParticipants.length > 0) {
      return res.status(403).json({ 
        error: 'You can only add users you are connected with to the group' 
      });
    }

    // Create the group conversation
    const conversation = await ChatService.createGroupConversation(
      userId,
      group_name.trim(),
      participant_ids
    );

    res.status(201).json({
      success: true,
      conversation,
      message: 'Group chat created successfully'
    });
  } catch (error: any) {
    console.error('Error creating group chat:', error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * Create a conversation for property inquiry
 * POST /api/v1/chat/property-inquiry
 */
router.post('/property-inquiry', async (req: AuthRequest, res: Response) => {
  try {
    if (!requireAuth(req, res)) return;
    
    const userId = parseInt(req.user!.id);
    const { property_owner_id, property_id, property_name } = req.body;

    if (!property_owner_id || !property_id || !property_name) {
      return res.status(400).json({ error: 'Property owner ID, property ID, and property name are required' });
    }

    if (userId === parseInt(property_owner_id)) {
      return res.status(400).json({ error: 'Cannot message yourself' });
    }

    const conversation = await ChatService.createPropertyInquiryConversation(
      userId,
      parseInt(property_owner_id),
      property_id,
      property_name
    );

    res.status(201).json({
      success: true,
      conversation,
      message: 'Conversation created successfully'
    });
  } catch (error: any) {
    console.error('Error creating property inquiry conversation:', error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * Get messages for a conversation (paginated)
 * GET /api/v1/chat/conversations/:id/messages
 */
router.get('/conversations/:id/messages', async (req: AuthRequest, res: Response) => {
  try {
    if (!requireAuth(req, res)) return;
    
    const conversationId = req.params.id;
    const userId = parseInt(req.user!.id);
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;

    // Verify user has access to this conversation
    const { data: participant } = await supabase
      .from('conversation_participants')
      .select('user_id')
      .eq('conversation_id', conversationId)
      .eq('user_id', userId)
      .is('left_at', null)
      .single();

    if (!participant) {
      return res.status(403).json({ error: 'Access denied to this conversation' });
    }

    const result = await ChatService.getConversationMessages(
      conversationId,
      userId,
      page,
      limit
    );

    res.json({
      success: true,
      ...result
    });
  } catch (error: any) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Send a message
 * POST /api/v1/chat/conversations/:id/messages
 */
router.post('/conversations/:id/messages', async (req: AuthRequest, res: Response) => {
  try {
    if (!requireAuth(req, res)) return;
    
    const conversationId = req.params.id;
    const userId = parseInt(req.user!.id);
    const { message_text, message_type = 'text', file_url, file_name, file_size } = req.body;

    if (!message_text && !file_url) {
      return res.status(400).json({ error: 'Message text or file is required' });
    }

    // Verify user has access to this conversation
    const { data: participant } = await supabase
      .from('conversation_participants')
      .select('user_id')
      .eq('conversation_id', conversationId)
      .eq('user_id', userId)
      .is('left_at', null)
      .single();

    if (!participant) {
      return res.status(403).json({ error: 'Access denied to this conversation' });
    }

    const message = await ChatService.sendMessage(
      conversationId,
      userId,
      message_text,
      message_type,
      file_url,
      file_name,
      file_size
    );

    // Get other participants to send notifications
    const { data: participants } = await supabase
      .from('conversation_participants')
      .select(`
        user_id,
        user:user_id(first_name, last_name)
      `)
      .eq('conversation_id', conversationId)
      .neq('user_id', userId)
      .is('left_at', null);

    // Send notifications to other participants
    if (participants && participants.length > 0) {
      const senderName = req.user.name;
      const messagePreview = message_text || `Sent a ${message_type}`;

      for (const participant of participants) {
        await NotificationService.sendMessageNotification(
          userId,
          participant.user_id,
          senderName,
          messagePreview,
          conversationId
        );
      }
    }

    res.status(201).json({
      success: true,
      message
    });
  } catch (error: any) {
    console.error('Error sending message:', error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * Edit a message
 * PUT /api/v1/chat/messages/:id
 */
router.put('/messages/:id', async (req: AuthRequest, res: Response) => {
  try {
    if (!requireAuth(req, res)) return;
    
    const messageId = req.params.id;
    const userId = parseInt(req.user!.id);
    const { message_text } = req.body;

    if (!message_text) {
      return res.status(400).json({ error: 'Message text is required' });
    }

    const message = await ChatService.editMessage(messageId, userId, message_text);

    res.json({
      success: true,
      message
    });
  } catch (error: any) {
    console.error('Error editing message:', error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * Delete a message
 * DELETE /api/v1/chat/messages/:id
 */
router.delete('/messages/:id', async (req: AuthRequest, res: Response) => {
  try {
    if (!requireAuth(req, res)) return;
    
    const messageId = req.params.id;
    const userId = parseInt(req.user!.id);

    await ChatService.deleteMessage(messageId, userId);

    res.json({
      success: true,
      message: 'Message deleted'
    });
  } catch (error: any) {
    console.error('Error deleting message:', error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * Mark message as read
 * POST /api/v1/chat/messages/:id/read
 */
router.post('/messages/:id/read', async (req: AuthRequest, res: Response) => {
  try {
    if (!requireAuth(req, res)) return;
    
    const messageId = req.params.id;
    const userId = parseInt(req.user!.id);

    await ChatService.markMessageAsRead(messageId, userId);

    res.json({
      success: true,
      message: 'Message marked as read'
    });
  } catch (error: any) {
    console.error('Error marking message as read:', error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * Mark conversation as read
 * POST /api/v1/chat/conversations/:id/read
 */
router.post('/conversations/:id/read', async (req: AuthRequest, res: Response) => {
  try {
    if (!requireAuth(req, res)) return;
    
    const conversationId = req.params.id;
    const userId = parseInt(req.user!.id);

    // Verify user has access to this conversation
    const { data: participant } = await supabase
      .from('conversation_participants')
      .select('user_id')
      .eq('conversation_id', conversationId)
      .eq('user_id', userId)
      .is('left_at', null)
      .single();

    if (!participant) {
      return res.status(403).json({ error: 'Access denied to this conversation' });
    }

    await ChatService.markConversationAsRead(conversationId, userId);

    res.json({
      success: true,
      message: 'Conversation marked as read'
    });
  } catch (error: any) {
    console.error('Error marking conversation as read:', error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * Update typing indicator
 * POST /api/v1/chat/conversations/:id/typing
 */
router.post('/conversations/:id/typing', async (req: AuthRequest, res: Response) => {
  try {
    if (!requireAuth(req, res)) return;
    
    const conversationId = req.params.id;
    const userId = parseInt(req.user!.id);
    const { is_typing } = req.body;

    // Verify user has access to this conversation
    const { data: participant } = await supabase
      .from('conversation_participants')
      .select('user_id')
      .eq('conversation_id', conversationId)
      .eq('user_id', userId)
      .is('left_at', null)
      .single();

    if (!participant) {
      return res.status(403).json({ error: 'Access denied to this conversation' });
    }

    await ChatService.updateTypingIndicator(conversationId, userId, is_typing);

    res.json({
      success: true,
      message: `Typing indicator ${is_typing ? 'started' : 'stopped'}`
    });
  } catch (error: any) {
    console.error('Error updating typing indicator:', error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * Get typing indicators for a conversation
 * GET /api/v1/chat/conversations/:id/typing
 */
router.get('/conversations/:id/typing', async (req: AuthRequest, res: Response) => {
  try {
    if (!requireAuth(req, res)) return;
    
    const conversationId = req.params.id;
    const userId = parseInt(req.user!.id);

    // Verify user has access to this conversation
    const { data: participant } = await supabase
      .from('conversation_participants')
      .select('user_id')
      .eq('conversation_id', conversationId)
      .eq('user_id', userId)
      .is('left_at', null)
      .single();

    if (!participant) {
      return res.status(403).json({ error: 'Access denied to this conversation' });
    }

    const indicators = await ChatService.getTypingIndicators(conversationId, userId);

    res.json({
      success: true,
      indicators
    });
  } catch (error: any) {
    console.error('Error fetching typing indicators:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Upload file
 * POST /api/v1/chat/upload
 * CHANGE: Implemented basic file upload using base64 data URLs
 * For production, consider using Supabase Storage or S3
 */
router.post('/upload', async (req: AuthRequest, res: Response) => {
  try {
    if (!requireAuth(req, res)) return;
    
    const userId = parseInt(req.user!.id);
    const { fileData, fileName, fileType, fileSize } = req.body;
    
    if (!fileData || !fileName) {
      return res.status(400).json({ error: 'File data and name are required' });
    }

    // Validate file size (50MB limit)
    if (fileSize && fileSize > 50 * 1024 * 1024) {
      return res.status(400).json({ error: 'File size exceeds 50MB limit' });
    }

    console.log(`📁 File upload from user ${userId}: ${fileName} (${fileType}, ${fileSize} bytes)`);

    // For now, we're using base64 data URLs
    // In production, you'd want to upload to Supabase Storage or S3
    const dataUrl = `data:${fileType};base64,${fileData}`;
    
    res.json({
      success: true,
      url: dataUrl,
      size: fileSize,
      message: 'File uploaded successfully'
    });
  } catch (error: any) {
    console.error('Error uploading file:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
