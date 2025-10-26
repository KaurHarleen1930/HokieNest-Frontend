import { supabase } from '../lib/supabase';

export interface ConnectionRequest {
  requester_id: number;
  recipient_id: number;
  message?: string;
}

export interface Connection {
  id: string;
  requester_id: number;
  recipient_id: number;
  status: 'pending' | 'accepted' | 'rejected' | 'blocked';
  created_at: string;
  updated_at: string;
  requester?: {
    user_id: number;
    first_name: string;
    last_name: string;
    email: string;
  };
  recipient?: {
    user_id: number;
    first_name: string;
    last_name: string;
    email: string;
  };
}

export class ConnectionService {
  /**
   * Send a connection request to another user
   * CHANGE: Now returns specific error messages based on existing connection status
   * Error format: "ERROR_TYPE: Human readable message"
   * - PENDING_REQUEST: A connection request is already pending
   * - ALREADY_CONNECTED: Users are already matched/chatting
   * - REQUEST_REJECTED: Previous request was rejected
   * - CONNECTION_BLOCKED: Connection is blocked
   */
  static async sendConnectionRequest(request: ConnectionRequest): Promise<Connection> {
    const { requester_id, recipient_id, message } = request;

    // CHANGE: Check if connection already exists and provide specific error messages
    const { data: existingConnection } = await supabase
      .from('roommate_connections')
      .select('*')
      .or(`and(requester_id.eq.${requester_id},recipient_id.eq.${recipient_id}),and(requester_id.eq.${recipient_id},recipient_id.eq.${requester_id})`)
      .single();

    if (existingConnection) {
      // CHANGE: Provide specific error messages based on connection status
      // Frontend parses these error types to show user-friendly messages
      switch (existingConnection.status) {
        case 'pending':
          throw new Error('PENDING_REQUEST: A connection request is already pending with this user');
        case 'accepted':
          throw new Error('ALREADY_CONNECTED: You are already matched and chatting with this user');
        case 'rejected':
          throw new Error('REQUEST_REJECTED: Your previous connection request was rejected');
        case 'blocked':
          throw new Error('CONNECTION_BLOCKED: Connection with this user is blocked');
        default:
          throw new Error('Connection already exists between these users');
      }
    }

    // Create new connection request
    const { data: connection, error } = await supabase
      .from('roommate_connections')
      .insert({
        requester_id,
        recipient_id,
        status: 'pending'
      })
      .select(`
        *,
        requester:requester_id(first_name, last_name, email),
        recipient:recipient_id(first_name, last_name, email)
      `)
      .single();

    if (error) {
      throw new Error(`Failed to create connection request: ${error.message}`);
    }

    return connection;
  }

  /**
   * Get all connections for a user
   */
  static async getUserConnections(userId: number, status?: string): Promise<Connection[]> {
    let query = supabase
      .from('roommate_connections')
      .select(`
        *,
        requester:requester_id(first_name, last_name, email),
        recipient:recipient_id(first_name, last_name, email)
      `)
      .or(`requester_id.eq.${userId},recipient_id.eq.${userId}`);

    if (status) {
      query = query.eq('status', status);
    }

    const { data: connections, error } = await query.order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch connections: ${error.message}`);
    }

    return connections || [];
  }

  /**
   * Get pending connection requests for a user
   */
  static async getPendingRequests(userId: number): Promise<Connection[]> {
    const { data: connections, error } = await supabase
      .from('roommate_connections')
      .select(`
        *,
        requester:requester_id(first_name, last_name, email),
        recipient:recipient_id(first_name, last_name, email)
      `)
      .eq('recipient_id', userId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch pending requests: ${error.message}`);
    }

    return connections || [];
  }

  /**
   * Accept a connection request
   */
  static async acceptConnection(connectionId: string, userId: number): Promise<Connection> {
    // First verify the user is the recipient
    const { data: connection, error: fetchError } = await supabase
      .from('roommate_connections')
      .select('*')
      .eq('id', connectionId)
      .eq('recipient_id', userId)
      .eq('status', 'pending')
      .single();

    if (fetchError || !connection) {
      throw new Error('Connection request not found or already processed');
    }

    // Update connection status
    const { data: updatedConnection, error } = await supabase
      .from('roommate_connections')
      .update({ status: 'accepted' })
      .eq('id', connectionId)
      .select(`
        *,
        requester:requester_id(first_name, last_name, email),
        recipient:recipient_id(first_name, last_name, email)
      `)
      .single();

    if (error) {
      throw new Error(`Failed to accept connection: ${error.message}`);
    }

    return updatedConnection;
  }

  /**
   * Reject a connection request
   * CHANGE: Now DELETES the connection from the database instead of updating status
   */
  static async rejectConnection(connectionId: string, userId: number): Promise<Connection> {
    // First verify the user is the recipient and get connection details
    const { data: connection, error: fetchError } = await supabase
      .from('roommate_connections')
      .select(`
        *,
        requester:requester_id(first_name, last_name, email, user_id),
        recipient:recipient_id(first_name, last_name, email, user_id)
      `)
      .eq('id', connectionId)
      .eq('recipient_id', userId)
      .eq('status', 'pending')
      .single();

    if (fetchError || !connection) {
      throw new Error('Connection request not found or already processed');
    }

    // CHANGE: DELETE the connection from the database instead of updating status to 'rejected'
    console.log(`🗑️  Deleting connection ${connectionId} from roommate_connections table (rejected)`);
    const { error } = await supabase
      .from('roommate_connections')
      .delete()
      .eq('id', connectionId);

    if (error) {
      throw new Error(`Failed to reject connection: ${error.message}`);
    }

    console.log(`✅ Connection ${connectionId} deleted from roommate_connections table`);
    return connection;
  }

  /**
   * Remove/block a connection
   */
  static async removeConnection(connectionId: string, userId: number): Promise<void> {
    // Verify the user is part of this connection
    const { data: connection, error: fetchError } = await supabase
      .from('roommate_connections')
      .select('*')
      .eq('id', connectionId)
      .or(`requester_id.eq.${userId},recipient_id.eq.${userId}`)
      .single();

    if (fetchError || !connection) {
      throw new Error('Connection not found or access denied');
    }

    // Delete the connection
    const { error } = await supabase
      .from('roommate_connections')
      .delete()
      .eq('id', connectionId);

    if (error) {
      throw new Error(`Failed to remove connection: ${error.message}`);
    }
  }

  /**
   * Check if two users are connected
   */
  static async areUsersConnected(userId1: number, userId2: number): Promise<boolean> {
    const { data: connection, error } = await supabase
      .from('roommate_connections')
      .select('id')
      .or(`and(requester_id.eq.${userId1},recipient_id.eq.${userId2}),and(requester_id.eq.${userId2},recipient_id.eq.${userId1})`)
      .eq('status', 'accepted')
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 is "not found"
      throw new Error(`Failed to check connection: ${error.message}`);
    }

    return !!connection;
  }

  /**
   * Get connection between two users
   */
  static async getConnectionBetweenUsers(userId1: number, userId2: number): Promise<Connection | null> {
    const { data: connection, error } = await supabase
      .from('roommate_connections')
      .select(`
        *,
        requester:requester_id(first_name, last_name, email),
        recipient:recipient_id(first_name, last_name, email)
      `)
      .or(`and(requester_id.eq.${userId1},recipient_id.eq.${userId2}),and(requester_id.eq.${userId2},recipient_id.eq.${userId1})`)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 is "not found"
      throw new Error(`Failed to get connection: ${error.message}`);
    }

    return connection;
  }
}
