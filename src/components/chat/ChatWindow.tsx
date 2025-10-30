import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { MessageBubble } from './MessageBubble';
import { FileUpload } from './FileUpload';
import { TypingIndicator } from './TypingIndicator';
import { cn } from '@/lib/utils';
import { chatAPI, connectionsAPI } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { 
  Send, 
  Paperclip, 
  MoreVertical,
  Info,
  Trash2,
  UserX,
  Bell,
  BellOff
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
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

interface Message {
  id: string;
  sender_id: number;
  message_text?: string;
  message_type: 'text' | 'file' | 'image' | 'document';
  file_url?: string;
  file_name?: string;
  file_size?: number;
  created_at: string;
  sender?: {
    first_name: string;
    last_name: string;
  };
  read_receipts?: Array<{
    user_id: number;
    read_at: string;
  }>;
}

interface Conversation {
  id: string;
  connection_id: string;
  is_group: boolean;
  group_name?: string;
  participants?: Array<{
    user_id: number;
    first_name: string;
    last_name: string;
    email: string;
  }>;
}

interface ChatWindowProps {
  conversation: Conversation | null;
  currentUserId: number;
  onBack?: () => void;
}

export function ChatWindow({ conversation, currentUserId, onBack }: ChatWindowProps) {
  const { toast } = useToast();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(1);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  // CHANGE: Added state for delete confirmation dialogs
  const [showDeleteConversationDialog, setShowDeleteConversationDialog] = useState(false);
  const [messageToDelete, setMessageToDelete] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout>();

  // Load messages when conversation changes
  useEffect(() => {
    if (conversation) {
      loadMessages();
      loadMuteStatus();
    } else {
      setMessages([]);
      setPage(1);
      setHasMore(true);
      setIsMuted(false);
    }
  }, [conversation?.id]);

  const loadMuteStatus = async () => {
    if (!conversation) return;
    try {
      // Check if conversation is muted (this would come from backend)
      // For now, we'll use localStorage to persist mute status
      const mutedKey = `conversation_muted_${conversation.id}`;
      const muted = localStorage.getItem(mutedKey) === 'true';
      setIsMuted(muted);
    } catch (error) {
      console.error('Failed to load mute status:', error);
    }
  };

  const handleToggleMute = async () => {
    if (!conversation) return;
    try {
      const newMutedStatus = !isMuted;
      setIsMuted(newMutedStatus);
      
      // Store in localStorage for now (backend can be added later)
      const mutedKey = `conversation_muted_${conversation.id}`;
      if (newMutedStatus) {
        localStorage.setItem(mutedKey, 'true');
      } else {
        localStorage.removeItem(mutedKey);
      }
      
      // TODO: Add backend API call here when endpoint is ready
      // await chatAPI.toggleMuteConversation(conversation.id, newMutedStatus);
      
      toast({
        title: newMutedStatus ? "Conversation muted" : "Conversation unmuted",
        description: newMutedStatus 
          ? "You won't receive notifications for this conversation"
          : "You will receive notifications for this conversation",
      });
    } catch (error) {
      console.error('Failed to toggle mute:', error);
      toast({
        title: "Failed to update mute status",
        description: "Something went wrong. Please try again.",
        variant: "destructive",
      });
      // Revert on error
      setIsMuted(!isMuted);
    }
  };

  // CHANGE: Subscribe to realtime messages and typing indicators for this conversation
  useEffect(() => {
    if (!conversation) return;

    const channelName = `conversation:${conversation.id}`;
    console.log(`💬 Subscribing to conversation channel: ${channelName}`);

    const channel = supabase
      .channel(channelName)
      .on('broadcast', { event: 'new_message' }, (payload) => {
        console.log('📨 New message received via realtime:', payload);
        const newMessage = payload.payload as Message;
        
        // Only add the message if it's not from the current user (already added optimistically)
        // and if it's not already in the messages list
        setMessages(prev => {
          const messageExists = prev.some(msg => msg.id === newMessage.id);
          if (!messageExists && newMessage.sender_id !== currentUserId) {
            return [...prev, newMessage];
          }
          return prev;
        });
      })
      .on('broadcast', { event: 'typing' }, (payload) => {
        console.log('⌨️ Typing indicator received:', payload);
        const { user_id, is_typing } = payload.payload;
        
        if (user_id !== currentUserId) {
          const participant = conversation.participants?.find(p => p.user_id === user_id);
          if (participant && is_typing) {
            const userName = `${participant.first_name} ${participant.last_name}`;
            setTypingUsers(prev => {
              if (!prev.includes(userName)) {
                return [...prev, userName];
              }
              return prev;
            });
          } else if (participant && !is_typing) {
            const userName = `${participant.first_name} ${participant.last_name}`;
            setTypingUsers(prev => prev.filter(name => name !== userName));
          }
        }
      })
      .subscribe((status) => {
        console.log(`📡 Conversation channel status: ${status}`);
      });

    return () => {
      console.log(`🔌 Unsubscribing from ${channelName}`);
      supabase.removeChannel(channel);
    };
  }, [conversation?.id, currentUserId]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Handle typing indicators
  useEffect(() => {
    if (isTyping && conversation) {
      chatAPI.updateTyping(conversation.id, true);
    } else if (conversation) {
      chatAPI.updateTyping(conversation.id, false);
    }
  }, [isTyping, conversation?.id]);

  const loadMessages = async (pageNum: number = 1) => {
    if (!conversation) return;

    try {
      setIsLoading(true);
      const response = await chatAPI.getMessages(conversation.id, pageNum, 20);
      
      if (pageNum === 1) {
        setMessages(response.messages);
      } else {
        setMessages(prev => [...response.messages, ...prev]);
      }
      
      setHasMore(response.hasMore);
      setPage(pageNum);
    } catch (error) {
      console.error('Failed to load messages:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadMoreMessages = () => {
    if (hasMore && !isLoading) {
      loadMessages(page + 1);
    }
  };

  const sendMessage = async () => {
    if (!conversation || !newMessage.trim() || isSending) return;

    const messageText = newMessage.trim();
    setNewMessage('');
    setIsSending(true);

    try {
      const response = await chatAPI.sendMessage(conversation.id, messageText);
      setMessages(prev => [...prev, response.message]);
      
      // Mark conversation as read
      await chatAPI.markConversationAsRead(conversation.id);
    } catch (error) {
      console.error('Failed to send message:', error);
      setNewMessage(messageText); // Restore message on error
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleTyping = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setNewMessage(e.target.value);
    
    // Handle typing indicator
    if (!isTyping && e.target.value.trim()) {
      setIsTyping(true);
    }

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Set new timeout to stop typing indicator
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
    }, 1000);
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  /**
   * CHANGE: Handle deleting a message with confirmation
   */
  const handleDeleteMessage = async (messageId: string) => {
    try {
      await chatAPI.deleteMessage(messageId);
      setMessages(prev => prev.filter(msg => msg.id !== messageId));
      setMessageToDelete(null);
      toast({
        title: "Message deleted",
        description: "The message has been removed.",
      });
    } catch (error) {
      console.error('Failed to delete message:', error);
      toast({
        title: "Failed to delete message",
        description: "Something went wrong. Please try again.",
        variant: "destructive",
      });
    }
  };

  /**
   * CHANGE: Handle deleting entire conversation and connection
   */
  const handleDeleteConversation = async () => {
    if (!conversation) return;

    try {
      // Delete the connection (which should cascade to conversation)
      await connectionsAPI.removeConnection(conversation.connection_id);
      
      toast({
        title: "Conversation deleted",
        description: "You have unmatched with this user.",
      });
      
      // Navigate back to messages list
      if (onBack) {
        onBack();
      }
    } catch (error) {
      console.error('Failed to delete conversation:', error);
      toast({
        title: "Failed to delete conversation",
        description: "Something went wrong. Please try again.",
        variant: "destructive",
      });
    } finally {
      setShowDeleteConversationDialog(false);
    }
  };

  const getConversationName = () => {
    if (!conversation) return '';
    
    if (conversation.is_group && conversation.group_name) {
      return conversation.group_name;
    }
    
    // CHANGE: Added null checks for participant data
    if (conversation.participants && conversation.participants.length > 0) {
      const otherParticipant = conversation.participants[0];
      if (otherParticipant && otherParticipant.first_name && otherParticipant.last_name) {
        return `${otherParticipant.first_name} ${otherParticipant.last_name}`;
      }
    }
    
    return 'Unknown';
  };

  const getConversationAvatar = () => {
    if (!conversation) return '?';
    
    // CHANGE: Added null checks to prevent crashes
    if (conversation.participants && conversation.participants.length > 0) {
      const otherParticipant = conversation.participants[0];
      if (otherParticipant && otherParticipant.first_name) {
        return otherParticipant.first_name.charAt(0).toUpperCase();
      }
    }
    
    return '?';
  };

  if (!conversation) {
    return (
      <div className="flex-1 flex items-center justify-center bg-muted/30">
        <div className="text-center">
          <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl">💬</span>
          </div>
          <h3 className="text-lg font-medium mb-2">Select a conversation</h3>
          <p className="text-sm text-muted-foreground">
            Choose a conversation from the sidebar to start chatting
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b bg-background">
        <div className="flex items-center space-x-3">
          {onBack && (
            <Button variant="ghost" size="sm" onClick={onBack} className="md:hidden">
              ←
            </Button>
          )}
          <Avatar className="h-10 w-10">
            <AvatarFallback className="bg-primary text-primary-foreground">
              {getConversationAvatar()}
            </AvatarFallback>
          </Avatar>
          <div>
            <h3 className="font-medium">{getConversationName()}</h3>
            <p className="text-sm text-muted-foreground">
              {conversation.is_group ? 'Group chat' : 'Direct message'}
            </p>
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          {/* CHANGE: Removed call and video call buttons per user request */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem>
                <Info className="h-4 w-4 mr-2" />
                View Info
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleToggleMute}>
                {isMuted ? (
                  <>
                    <Bell className="h-4 w-4 mr-2" />
                    Unmute Conversation
                  </>
                ) : (
                  <>
                    <BellOff className="h-4 w-4 mr-2" />
                    Mute Conversation
                  </>
                )}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {/* CHANGE: Added delete conversation option */}
              <DropdownMenuItem
                onClick={() => setShowDeleteConversationDialog(true)}
                className="text-destructive focus:text-destructive"
              >
                <UserX className="h-4 w-4 mr-2" />
                Delete Conversation
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
          {hasMore && (
            <div className="text-center">
              <Button
                variant="ghost"
                size="sm"
                onClick={loadMoreMessages}
                disabled={isLoading}
              >
                {isLoading ? 'Loading...' : 'Load more messages'}
              </Button>
            </div>
          )}
          
          {messages.map((message, index) => {
            const isOwn = message.sender_id === currentUserId;
            const showAvatar = index === 0 || messages[index - 1].sender_id !== message.sender_id;
            
            return (
              <MessageBubble
                key={message.id}
                message={message}
                isOwn={isOwn}
                showAvatar={showAvatar}
                onEdit={async (messageId, newText) => {
                  try {
                    await chatAPI.editMessage(messageId, newText);
                    setMessages(prev => prev.map(msg => 
                      msg.id === messageId 
                        ? { ...msg, message_text: newText }
                        : msg
                    ));
                    toast({
                      title: "Message updated",
                      description: "Your message has been edited.",
                    });
                  } catch (error) {
                    console.error('Failed to edit message:', error);
                    toast({
                      title: "Failed to edit message",
                      description: "Something went wrong. Please try again.",
                      variant: "destructive",
                    });
                  }
                }}
                onDelete={(messageId) => {
                  // CHANGE: Show confirmation dialog before deleting
                  setMessageToDelete(messageId);
                }}
                onDownload={(fileUrl, fileName) => {
                  const link = document.createElement('a');
                  link.href = fileUrl;
                  link.download = fileName;
                  link.click();
                }}
              />
            );
          })}
          
          {/* Typing Indicator */}
          {typingUsers.length > 0 && (
            <TypingIndicator users={typingUsers} />
          )}
          
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* Message Input */}
      <div className="p-4 border-t bg-background">
        <div className="flex items-end space-x-2">
          <FileUpload
            onFileSelect={async (file) => {
              try {
                // CHANGE: Show loading state while uploading
                setIsSending(true);
                
                // Upload the file
                const uploadResponse = await chatAPI.uploadFile(file);
                console.log('📎 File uploaded:', uploadResponse);
                
                // Send the message with file attachment
                const messageResponse = await chatAPI.sendMessage(
                  conversation.id,
                  '',
                  file.type.startsWith('image/') ? 'image' : 'file',
                  uploadResponse.url,
                  file.name,
                  uploadResponse.size
                );
                
                // CHANGE: Add the message to local state so it appears immediately
                console.log('📨 File message sent:', messageResponse);
                setMessages(prev => [...prev, messageResponse.message]);
                
                // Mark conversation as read
                await chatAPI.markConversationAsRead(conversation.id);
              } catch (error) {
                console.error('Failed to upload file:', error);
                alert('Failed to send file. Please try again.');
              } finally {
                setIsSending(false);
              }
            }}
          >
            <Button variant="ghost" size="sm">
              <Paperclip className="h-4 w-4" />
            </Button>
          </FileUpload>
          
          <div className="flex-1 relative">
            <Textarea
              ref={textareaRef}
              value={newMessage}
              onChange={handleTyping}
              onKeyDown={handleKeyPress}
              placeholder="Type a message..."
              className="min-h-[40px] max-h-[120px] resize-none"
              rows={1}
            />
            {/* CHANGE: Removed emoji button per user request */}
          </div>
          
          <Button
            onClick={sendMessage}
            disabled={!newMessage.trim() || isSending}
            size="sm"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* CHANGE: Confirmation dialog for deleting a message */}
      <AlertDialog open={!!messageToDelete} onOpenChange={(open) => !open && setMessageToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Message</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this message? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => messageToDelete && handleDeleteMessage(messageToDelete)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* CHANGE: Confirmation dialog for deleting conversation */}
      <AlertDialog open={showDeleteConversationDialog} onOpenChange={setShowDeleteConversationDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Conversation</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this conversation and unmatch with {getConversationName()}? 
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
