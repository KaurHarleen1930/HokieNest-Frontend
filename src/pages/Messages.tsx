import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { chatAPI } from '@/lib/api';
import { ConversationList } from '@/components/chat/ConversationList';
import { ChatWindow } from '@/components/chat/ChatWindow';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { MessageCircle, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

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

export default function Messages() {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }

    loadConversations();
    checkMobileView();
    
    // Set up polling for new conversations
    const interval = setInterval(loadConversations, 30000); // Check every 30 seconds
    
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
          <div className="flex h-full">
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
  );
}
