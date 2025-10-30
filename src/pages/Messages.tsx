import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { chatAPI, notificationsAPI, connectionsAPI } from '@/lib/api';
import { ConversationList } from '@/components/chat/ConversationList';
import { ChatWindow } from '@/components/chat/ChatWindow';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MessageCircle, ArrowLeft, UserPlus, Check, X, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { useToast } from '@/hooks/use-toast';

interface Conversation {
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
  last_message?: {
    id: string;
    sender_id: number;
    message_text?: string;
    message_type: string;
    created_at: string;
    sender?: {
      first_name: string;
      last_name: string;
    };
  };
  unread_count?: number;
}

interface ConnectionRequest {
  id: string;
  notification_type: string;
  title: string;
  message: string;
  related_id?: string;
  is_read: boolean;
  created_at: string;
}

export default function Messages() {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [connectionRequests, setConnectionRequests] = useState<ConnectionRequest[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }

    loadConversations();
    loadConnectionRequests();
    checkMobileView();
    
    // Set up polling for new conversations and connection requests
    const interval = setInterval(() => {
      loadConversations();
      loadConnectionRequests();
    }, 30000); // Check every 30 seconds
    
    return () => clearInterval(interval);
  }, [isAuthenticated, navigate]);

  useEffect(() => {
    const handleResize = () => checkMobileView();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const checkMobileView = () => {
    setIsMobile(window.innerWidth < 768);
  };

  const loadConversations = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await chatAPI.getConversations();
      setConversations(response.conversations);
    } catch (error: any) {
      console.error('Failed to load conversations:', error);
      setError(error.message || 'Failed to load conversations');
    } finally {
      setIsLoading(false);
    }
  };

  const loadConnectionRequests = async () => {
    try {
      setLoadingRequests(true);
      const response = await notificationsAPI.getNotifications(1, 50, false);
      // Filter to only show connection requests
      let requests = response.notifications.filter(
        (n: ConnectionRequest) => n.notification_type === 'connection_request' && n.related_id
      );
      
      // Validate each request against actual connection status
      // Only show notifications for connections that are still pending
      // Load all connections to validate against
      let allConnections: any[] = [];
      try {
        const connectionsResponse = await connectionsAPI.getConnections();
        if (connectionsResponse.success && connectionsResponse.connections) {
          allConnections = connectionsResponse.connections;
        }
      } catch (e) {
        console.error('Failed to load connections for validation:', e);
      }
      
      const validatedRequests = [];
      for (const request of requests) {
        try {
          if (!request.related_id) {
            // No connection ID, skip it
            continue;
          }
          
          // Find the connection by ID in the allConnections list
          const connection = allConnections.find(c => c.id === request.related_id);
          
          if (!connection) {
            // Connection doesn't exist (was deleted/rejected), delete the stale notification
            try {
              await notificationsAPI.deleteNotification(request.id);
              console.log(`🗑️ Deleted stale notification ${request.id} for non-existent connection ${request.related_id}`);
            } catch (e) {
              console.error('Failed to delete stale notification:', e);
            }
            continue;
          }
          
          // Only include if connection is still pending
          if (connection.status === 'pending') {
            validatedRequests.push(request);
          } else {
            // Connection already processed (accepted/rejected), delete the stale notification
            try {
              await notificationsAPI.deleteNotification(request.id);
              console.log(`🗑️ Deleted stale notification ${request.id} for already-processed connection ${request.related_id} (status: ${connection.status})`);
            } catch (e) {
              console.error('Failed to delete stale notification:', e);
            }
          }
        } catch (error: any) {
          // If we can't verify the connection, delete the notification to be safe
          console.error('Error validating connection request:', error);
          try {
            await notificationsAPI.deleteNotification(request.id);
            console.log(`🗑️ Deleted notification ${request.id} due to validation error`);
          } catch (e) {
            console.error('Failed to delete notification:', e);
          }
        }
      }
      
      setConnectionRequests(validatedRequests);
    } catch (error: any) {
      console.error('Failed to load connection requests:', error);
    } finally {
      setLoadingRequests(false);
    }
  };

  const handleAcceptConnection = async (notificationId: string, connectionId: string) => {
    try {
      setProcessingIds(prev => new Set(prev).add(notificationId));
      
      // Accept the connection
      await connectionsAPI.acceptConnection(connectionId);
      
      // Delete the notification (always try to delete even if connection accept had issues)
      try {
        await notificationsAPI.deleteNotification(notificationId);
      } catch (e) {
        console.error('Failed to delete notification after accepting:', e);
      }
      
      // Remove from local state
      setConnectionRequests(prev => prev.filter(r => r.id !== notificationId));
      
      // Reload conversations to show the new one
      await loadConversations();
      
      toast({
        title: "Connection accepted",
        description: "You can now start chatting with this person.",
      });
    } catch (error: any) {
      console.error('Failed to accept connection:', error);
      
      // If connection already processed, delete the notification anyway
      if (error.message?.includes('already processed') || error.message?.includes('not found')) {
        try {
          await notificationsAPI.deleteNotification(notificationId);
          setConnectionRequests(prev => prev.filter(r => r.id !== notificationId));
          toast({
            title: "Connection already processed",
            description: "This connection request was already handled.",
          });
        } catch (e) {
          console.error('Failed to delete stale notification:', e);
        }
      } else {
        toast({
          title: "Failed to accept connection",
          description: error.message || "Something went wrong. Please try again.",
          variant: "destructive",
        });
      }
    } finally {
      setProcessingIds(prev => {
        const next = new Set(prev);
        next.delete(notificationId);
        return next;
      });
    }
  };

  const handleRejectConnection = async (notificationId: string, connectionId: string) => {
    try {
      setProcessingIds(prev => new Set(prev).add(notificationId));
      
      // Reject the connection (this deletes it)
      await connectionsAPI.rejectConnection(connectionId);
      
      // Delete the notification (always try to delete even if connection reject had issues)
      try {
        await notificationsAPI.deleteNotification(notificationId);
      } catch (e) {
        console.error('Failed to delete notification after rejecting:', e);
      }
      
      // Remove from local state
      setConnectionRequests(prev => prev.filter(r => r.id !== notificationId));
      
      toast({
        title: "Connection rejected",
        description: "The connection request has been removed.",
      });
    } catch (error: any) {
      console.error('Failed to reject connection:', error);
      
      // If connection already processed, delete the notification anyway
      if (error.message?.includes('already processed') || error.message?.includes('not found')) {
        try {
          await notificationsAPI.deleteNotification(notificationId);
          setConnectionRequests(prev => prev.filter(r => r.id !== notificationId));
          toast({
            title: "Connection already processed",
            description: "This connection request was already handled.",
          });
        } catch (e) {
          console.error('Failed to delete stale notification:', e);
        }
      } else {
        toast({
          title: "Failed to reject connection",
          description: error.message || "Something went wrong. Please try again.",
          variant: "destructive",
        });
      }
    } finally {
      setProcessingIds(prev => {
        const next = new Set(prev);
        next.delete(notificationId);
        return next;
      });
    }
  };

  const handleSelectConversation = (conversationId: string) => {
    const conversation = conversations.find(c => c.id === conversationId);
    if (conversation) {
      setSelectedConversation(conversation);
    }
  };

  const handleBackToConversations = () => {
    setSelectedConversation(null);
  };

  const handleNewConversation = () => {
    // Navigate to roommate matching to find new connections
    navigate('/roommate-matching');
  };

  /**
   * CHANGE: Handle conversation deletion callback
   */
  const handleDeleteConversation = (conversationId: string) => {
    // Remove from list
    setConversations(prev => prev.filter(c => c.id !== conversationId));
    
    // Deselect if it was selected
    if (selectedConversation?.id === conversationId) {
      setSelectedConversation(null);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <EmptyState
          icon={<MessageCircle className="h-12 w-12" />}
          title="Authentication Required"
          description="Please log in to access your messages"
          action={{
            label: "Log In",
            onClick: () => navigate('/login')
          }}
        />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <EmptyState
          icon={<MessageCircle className="h-12 w-12" />}
          title="Error Loading Messages"
          description={error}
          action={{
            label: "Try Again",
            onClick: loadConversations
          }}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-background">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/dashboard')}
                className="gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Dashboard
              </Button>
              <div>
                <h1 className="text-2xl font-bold">Messages</h1>
                <p className="text-sm text-muted-foreground">
                  Chat with your roommate connections
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-6">
        <div className="h-[calc(100vh-200px)] rounded-lg border bg-background overflow-hidden">
          <div className="flex h-full flex-col">
            {/* Connection Requests Section */}
            {connectionRequests.length > 0 && (
              <div className="border-b bg-muted/30 p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <UserPlus className="h-5 w-5 text-primary" />
                    <h2 className="text-lg font-semibold">Connection Requests</h2>
                    <Badge variant="secondary">{connectionRequests.length}</Badge>
                  </div>
                </div>
                <div className="space-y-2 max-h-32 overflow-y-auto">
                  {connectionRequests.map((request) => {
                    const isProcessing = processingIds.has(request.id);
                    return (
                      <Card key={request.id} className="p-3">
                        <div className="flex items-center justify-between">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{request.title}</p>
                            <p className="text-xs text-muted-foreground truncate">{request.message}</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {formatDistanceToNow(new Date(request.created_at), { addSuffix: true })}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 ml-4">
                            <Button
                              size="sm"
                              onClick={() => request.related_id && handleAcceptConnection(request.id, request.related_id)}
                              disabled={isProcessing || !request.related_id}
                            >
                              {isProcessing ? (
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              ) : (
                                <Check className="h-4 w-4 mr-2" />
                              )}
                              Accept
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => request.related_id && handleRejectConnection(request.id, request.related_id)}
                              disabled={isProcessing || !request.related_id}
                            >
                              {isProcessing ? (
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              ) : (
                                <X className="h-4 w-4 mr-2" />
                              )}
                              Reject
                            </Button>
                          </div>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Messages Layout */}
            <div className="flex h-full flex-1">
              {/* Desktop Layout */}
              {!isMobile && (
                <>
                  {/* Conversation List */}
                  <div className="w-1/3 border-r">
                    <ConversationList
                      conversations={conversations}
                      selectedConversationId={selectedConversation?.id}
                      onSelectConversation={handleSelectConversation}
                      onNewConversation={handleNewConversation}
                      onDeleteConversation={handleDeleteConversation}
                      loading={isLoading}
                    />
                  </div>

                {/* Chat Window */}
                <div className="flex-1">
                  <ChatWindow
                    conversation={selectedConversation}
                    currentUserId={user?.id ? parseInt(user.id) : 0}
                  />
                </div>
              </>
            )}

              {/* Mobile Layout */}
              {isMobile && (
                <>
                  {!selectedConversation ? (
                    <div className="w-full">
                      <ConversationList
                        conversations={conversations}
                        selectedConversationId={selectedConversation?.id}
                        onSelectConversation={handleSelectConversation}
                        onNewConversation={handleNewConversation}
                        onDeleteConversation={handleDeleteConversation}
                        loading={isLoading}
                      />
                    </div>
                  ) : (
                    <div className="w-full">
                      <ChatWindow
                        conversation={selectedConversation}
                        currentUserId={user?.id ? parseInt(user.id) : 0}
                        onBack={handleBackToConversations}
                      />
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
