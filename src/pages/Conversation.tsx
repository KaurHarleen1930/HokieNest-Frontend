import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { chatAPI } from '@/lib/api';
import { ChatWindow } from '@/components/chat/ChatWindow';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { MessageCircle, ArrowLeft, Loader2 } from 'lucide-react';

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
}

export default function Conversation() {
  const { conversationId } = useParams<{ conversationId: string }>();
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }

    if (conversationId) {
      loadConversation();
    }
  }, [isAuthenticated, conversationId, navigate]);

  const loadConversation = async () => {
    if (!conversationId) return;

    try {
      setIsLoading(true);
      setError(null);
      
      // Get all conversations to find the specific one
      const response = await chatAPI.getConversations();
      const foundConversation = response.conversations.find(
        (conv: Conversation) => conv.id === conversationId
      );

      if (foundConversation) {
        setConversation(foundConversation);
      } else {
        setError('Conversation not found');
      }
    } catch (error: any) {
      console.error('Failed to load conversation:', error);
      setError(error.message || 'Failed to load conversation');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBack = () => {
    navigate('/messages');
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <EmptyState
          icon={<MessageCircle className="h-12 w-12" />}
          title="Authentication Required"
          description="Please log in to access this conversation"
          action={{
            label: "Log In",
            onClick: () => navigate('/login')
          }}
        />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading conversation...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <EmptyState
          icon={<MessageCircle className="h-12 w-12" />}
          title="Error Loading Conversation"
          description={error}
          action={{
            label: "Back to Messages",
            onClick: handleBack
          }}
        />
      </div>
    );
  }

  if (!conversation) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <EmptyState
          icon={<MessageCircle className="h-12 w-12" />}
          title="Conversation Not Found"
          description="This conversation may have been deleted or you don't have access to it"
          action={{
            label: "Back to Messages",
            onClick: handleBack
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
          <div className="flex items-center space-x-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleBack}
              className="gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Messages
            </Button>
            <div>
              <h1 className="text-2xl font-bold">Conversation</h1>
              <p className="text-sm text-muted-foreground">
                {conversation.is_group ? 'Group chat' : 'Direct message'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Chat Window */}
      <div className="container mx-auto px-4 py-6">
        <div className="h-[calc(100vh-200px)] rounded-lg border bg-background overflow-hidden">
          <ChatWindow
            conversation={conversation}
            currentUserId={user?.id ? parseInt(user.id) : 0}
            onBack={handleBack}
          />
        </div>
      </div>
    </div>
  );
}
