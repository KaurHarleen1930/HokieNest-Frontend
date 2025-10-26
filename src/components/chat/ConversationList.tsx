import { useState, useEffect } from 'react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { chatAPI, connectionsAPI } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { MessageCircle, Search, Users, Clock, MoreVertical, Trash2 } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

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

interface ConversationListProps {
  conversations: Conversation[];
  selectedConversationId?: string;
  onSelectConversation: (conversationId: string) => void;
  onNewConversation?: () => void;
  onDeleteConversation?: (conversationId: string) => void;
  loading?: boolean;
}

export function ConversationList({
  conversations,
  selectedConversationId,
  onSelectConversation,
  onNewConversation,
  onDeleteConversation,
  loading = false
}: ConversationListProps) {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredConversations, setFilteredConversations] = useState<Conversation[]>([]);
  // CHANGE: Added state for delete confirmation
  const [conversationToDelete, setConversationToDelete] = useState<Conversation | null>(null);

  useEffect(() => {
    if (searchQuery.trim()) {
      const filtered = conversations.filter(conv => {
        const searchLower = searchQuery.toLowerCase();
        return (
          conv.group_name?.toLowerCase().includes(searchLower) ||
          conv.participants?.some(p => 
            `${p.first_name} ${p.last_name}`.toLowerCase().includes(searchLower)
          ) ||
          conv.last_message?.message_text?.toLowerCase().includes(searchLower)
        );
      });
      setFilteredConversations(filtered);
    } else {
      setFilteredConversations(conversations);
    }
  }, [conversations, searchQuery]);

  const formatTime = (dateString?: string) => {
    if (!dateString) return '';
    
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);
    
    if (diffInHours < 24) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffInHours < 168) { // 7 days
      return date.toLocaleDateString([], { weekday: 'short' });
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  };

  const getConversationName = (conversation: Conversation) => {
    if (conversation.is_group && conversation.group_name) {
      return conversation.group_name;
    }
    
    // CHANGE: Added null checks for participant data
    // For direct messages, show the other participant's name
    if (conversation.participants && conversation.participants.length > 0) {
      const otherParticipant = conversation.participants[0];
      if (otherParticipant && otherParticipant.first_name && otherParticipant.last_name) {
        return `${otherParticipant.first_name} ${otherParticipant.last_name}`;
      }
    }
    
    return 'Unknown';
  };

  const getConversationAvatar = (conversation: Conversation) => {
    if (conversation.is_group) {
      return <Users className="h-4 w-4" />;
    }
    
    // CHANGE: Added null checks to prevent "Cannot read properties of undefined" error
    if (conversation.participants && conversation.participants.length > 0) {
      const otherParticipant = conversation.participants[0];
      if (otherParticipant && otherParticipant.first_name) {
        return otherParticipant.first_name.charAt(0).toUpperCase();
      }
    }
    
    return '?';
  };

  /**
   * CHANGE: Handle deleting a conversation
   */
  const handleDeleteConversation = async () => {
    if (!conversationToDelete) return;

    try {
      // Delete the connection
      await connectionsAPI.removeConnection(conversationToDelete.connection_id);
      
      toast({
        title: "Conversation deleted",
        description: "You have unmatched with this user.",
      });
      
      // Call parent callback if provided
      if (onDeleteConversation) {
        onDeleteConversation(conversationToDelete.id);
      }
    } catch (error) {
      console.error('Failed to delete conversation:', error);
      toast({
        title: "Failed to delete conversation",
        description: "Something went wrong. Please try again.",
        variant: "destructive",
      });
    } finally {
      setConversationToDelete(null);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col h-full">
        <div className="p-4 border-b">
          <div className="h-10 bg-muted animate-pulse rounded" />
        </div>
        <div className="flex-1 p-4 space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center space-x-3">
              <div className="h-10 w-10 bg-muted animate-pulse rounded-full" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-muted animate-pulse rounded w-3/4" />
                <div className="h-3 bg-muted animate-pulse rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-background border-r">
      {/* Header */}
      <div className="p-4 border-b">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Messages</h2>
          {onNewConversation && (
            <Button
              size="sm"
              onClick={onNewConversation}
              className="gap-2"
            >
              <MessageCircle className="h-4 w-4" />
              New Chat
            </Button>
          )}
        </div>
        
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Conversations List */}
      <ScrollArea className="flex-1">
        <div className="p-2">
          {filteredConversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <MessageCircle className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No conversations yet</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Start a conversation by connecting with a roommate
              </p>
              {onNewConversation && (
                <Button onClick={onNewConversation} size="sm">
                  Start Chatting
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-1">
              {filteredConversations.map((conversation) => (
                <div
                  key={conversation.id}
                  className={cn(
                    "flex items-center space-x-3 p-3 rounded-lg transition-colors hover:bg-muted/50 group",
                    selectedConversationId === conversation.id && "bg-muted"
                  )}
                >
                  <Avatar 
                    className="h-10 w-10 cursor-pointer" 
                    onClick={() => onSelectConversation(conversation.id)}
                  >
                    <AvatarFallback className="bg-primary text-primary-foreground">
                      {getConversationAvatar(conversation)}
                    </AvatarFallback>
                  </Avatar>
                  
                  <div 
                    className="flex-1 min-w-0 cursor-pointer"
                    onClick={() => onSelectConversation(conversation.id)}
                  >
                    <div className="flex items-center justify-between">
                      <h3 className="font-medium truncate">
                        {getConversationName(conversation)}
                      </h3>
                      <div className="flex items-center space-x-2">
                        
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatTime(conversation.last_message_at)}
                        </span>
                      </div>
                    </div>
                    
                    {conversation.last_message && (
                      <p className="text-sm text-muted-foreground truncate">
                        {conversation.last_message.sender && (
                          <span className="font-medium">
                            {conversation.last_message.sender.first_name}: 
                          </span>
                        )}
                        {/* CHANGE: Fixed to properly handle empty/falsy message_text without rendering "0" */}
                        {conversation.last_message.message_text ? 
                          conversation.last_message.message_text : 
                         (conversation.last_message.message_type === 'file' ? '📎 File' : 
                          conversation.last_message.message_type === 'image' ? '🖼️ Image' : 
                          'Message')}
                      </p>
                    )}
                  </div>

                  {/* CHANGE: Added delete conversation button */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8 p-0"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation();
                          setConversationToDelete(conversation);
                        }}
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete Conversation
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ))}
            </div>
          )}
        </div>
      </ScrollArea>

      {/* CHANGE: Confirmation dialog for deleting conversation */}
      <AlertDialog open={!!conversationToDelete} onOpenChange={(open) => !open && setConversationToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Conversation</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this conversation and unmatch with{' '}
              {conversationToDelete ? getConversationName(conversationToDelete) : 'this user'}? 
              All messages will be permanently deleted and this action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConversation}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete & Unmatch
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
