import { Router, Response } from 'express';
import { ConnectionService } from '../services/connection';
import { NotificationService } from '../services/notification';
import { ChatService } from '../services/chat';
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
 * Send a connection request
 * POST /api/v1/connections/request
 */
router.post('/request', async (req: AuthRequest, res: Response) => {
  try {
    if (!requireAuth(req, res)) return;
    
    const { recipient_id, message } = req.body;
    const requester_id = parseInt(req.user!.id);

    if (!recipient_id) {
      return res.status(400).json({ error: 'Recipient ID is required' });
    }

    if (recipient_id === requester_id) {
      return res.status(400).json({ error: 'Cannot send connection request to yourself' });
    }

    const connection = await ConnectionService.sendConnectionRequest({
      requester_id,
      recipient_id,
      message
    });

    // Get requester's name for notification
    const { data: requester } = await supabase
      .from('users')
      .select('first_name, last_name')
      .eq('user_id', requester_id)
      .single();

    const requesterName = requester ? `${requester.first_name} ${requester.last_name}` : 'Someone';

    // CHANGE: Send notification to recipient with connection ID as related_id
    // This allows the recipient to accept/reject the connection from the notification
    await NotificationService.sendConnectionRequestNotification(
      requester_id,
      recipient_id,
      requesterName,
      undefined,
      connection.id // Pass connection ID
    );

    res.status(201).json({
      success: true,
      connection,
      message: 'Connection request sent successfully'
    });
  } catch (error: any) {
    // CHANGE: Log the error message being sent to frontend for debugging
    console.error('Error sending connection request:', error);
    console.log('📤 Sending error to frontend:', error.message);
    res.status(400).json({ error: error.message });
  }
});

/**
 * Get all connections for the current user
 * GET /api/v1/connections
 */
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    if (!requireAuth(req, res)) return;
    
    const { status } = req.query;
    const userId = parseInt(req.user!.id);

    const connections = await ConnectionService.getUserConnections(
      userId,
      status as string
    );

    res.json({
      success: true,
      connections
    });
  } catch (error: any) {
    console.error('Error fetching connections:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get pending connection requests
 * GET /api/v1/connections/pending
 */
router.get('/pending', async (req: AuthRequest, res: Response) => {
  try {
    if (!requireAuth(req, res)) return;
    
    const userId = parseInt(req.user!.id);

    const pendingRequests = await ConnectionService.getPendingRequests(userId);

    res.json({
      success: true,
      connections: pendingRequests
    });
  } catch (error: any) {
    console.error('Error fetching pending requests:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Accept a connection request
 * PUT /api/v1/connections/:id/accept
 */
router.put('/:id/accept', async (req: AuthRequest, res: Response) => {
  try {
    if (!requireAuth(req, res)) return;
    
    const connectionId = req.params.id;
    const userId = parseInt(req.user!.id);

    const connection = await ConnectionService.acceptConnection(connectionId, userId);

    // Create conversation for the accepted connection
    const conversation = await ChatService.createConversation(connectionId);

    // Get acceptor's name for notification
    const { data: acceptor } = await supabase
      .from('users')
      .select('first_name, last_name')
      .eq('user_id', userId)
      .single();

    const acceptorName = acceptor ? `${acceptor.first_name} ${acceptor.last_name}` : 'Someone';

    // Send notification to requester
    await NotificationService.sendConnectionAcceptedNotification(
      connection.requester_id,
      userId,
      acceptorName
    );

    res.json({
      success: true,
      connection,
      conversation,
      message: 'Connection request accepted'
    });
  } catch (error: any) {
    console.error('Error accepting connection:', error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * Reject a connection request
 * PUT /api/v1/connections/:id/reject
 */
router.put('/:id/reject', async (req: AuthRequest, res: Response) => {
  try {
    if (!requireAuth(req, res)) return;
    
    const connectionId = req.params.id;
    const userId = parseInt(req.user!.id);

    const connection = await ConnectionService.rejectConnection(connectionId, userId);

    res.json({
      success: true,
      connection,
      message: 'Connection request rejected'
    });
  } catch (error: any) {
    console.error('Error rejecting connection:', error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * Remove/block a connection
 * DELETE /api/v1/connections/:id
 */
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    if (!requireAuth(req, res)) return;
    
    const connectionId = req.params.id;
    const userId = parseInt(req.user!.id);

    await ConnectionService.removeConnection(connectionId, userId);

    res.json({
      success: true,
      message: 'Connection removed'
    });
  } catch (error: any) {
    console.error('Error removing connection:', error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * Check if two users are connected
 * GET /api/v1/connections/check/:userId
 */
router.get('/check/:userId', async (req: AuthRequest, res: Response) => {
  try {
    if (!requireAuth(req, res)) return;
    
    const { userId } = req.params;
    const currentUserId = parseInt(req.user!.id);

    const areConnected = await ConnectionService.areUsersConnected(
      currentUserId,
      parseInt(userId)
    );

    res.json({
      success: true,
      areConnected
    });
  } catch (error: any) {
    console.error('Error checking connection:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get connection between two users
 * GET /api/v1/connections/between/:userId
 */
router.get('/between/:userId', async (req: AuthRequest, res: Response) => {
  try {
    if (!requireAuth(req, res)) return;
    
    const { userId } = req.params;
    const currentUserId = parseInt(req.user!.id);

    const connection = await ConnectionService.getConnectionBetweenUsers(
      currentUserId,
      parseInt(userId)
    );

    res.json({
      success: true,
      connection
    });
  } catch (error: any) {
    console.error('Error getting connection:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
