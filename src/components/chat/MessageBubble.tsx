import { useState } from 'react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { 
  Check, 
  CheckCheck, 
  MoreVertical, 
  Edit, 
  Trash2, 
  Download,
  Image as ImageIcon,
  FileText
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

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

interface MessageBubbleProps {
  message: Message;
  isOwn: boolean;
  showAvatar?: boolean;
  onEdit?: (messageId: string, newText: string) => void;
  onDelete?: (messageId: string) => void;
  onDownload?: (fileUrl: string, fileName: string) => void;
}

export function MessageBubble({
  message,
  isOwn,
  showAvatar = true,
  onEdit,
  onDelete,
  onDownload
}: MessageBubbleProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(message.message_text || '');

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const getReadStatus = () => {
    if (!message.read_receipts || message.read_receipts.length === 0) {
      return <Check className="h-3 w-3 text-muted-foreground" />;
    }
    return <CheckCheck className="h-3 w-3 text-blue-500" />;
  };

  const handleEdit = () => {
    if (editText.trim() && editText !== message.message_text) {
      onEdit?.(message.id, editText);
    }
    setIsEditing(false);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleEdit();
    } else if (e.key === 'Escape') {
      setIsEditing(false);
      setEditText(message.message_text || '');
    }
  };

  const renderMessageContent = () => {
    if (message.message_type === 'text') {
      if (isEditing) {
        return (
          <div className="space-y-2">
            <textarea
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              onKeyDown={handleKeyPress}
              className="w-full p-2 border rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-primary"
              rows={2}
              autoFocus
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={handleEdit}>
                Save
              </Button>
              <Button 
                size="sm" 
                variant="outline" 
                onClick={() => {
                  setIsEditing(false);
                  setEditText(message.message_text || '');
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        );
      }

      return (
        <p className="whitespace-pre-wrap break-words">
          {message.message_text}
        </p>
      );
    }

    if (message.message_type === 'file' || message.message_type === 'document') {
      return (
        <div className="flex items-center space-x-2 p-2 bg-muted/50 rounded-lg">
          <FileText className="h-4 w-4 text-muted-foreground" />
          <div className="flex-1 min-w-0">
            <p className="font-medium truncate">{message.file_name}</p>
            {message.file_size && (
              <p className="text-xs text-muted-foreground">
                {(message.file_size / 1024).toFixed(1)} KB
              </p>
            )}
          </div>
          {onDownload && message.file_url && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onDownload(message.file_url!, message.file_name || 'file')}
            >
              <Download className="h-4 w-4" />
            </Button>
          )}
        </div>
      );
    }

    if (message.message_type === 'image') {
      return (
        <div className="space-y-2">
          {message.file_url && (
            <img
              src={message.file_url}
              alt={message.file_name || 'Image'}
              className="max-w-xs rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
              onClick={() => window.open(message.file_url, '_blank')}
            />
          )}
          {message.file_name && (
            <p className="text-sm text-muted-foreground">{message.file_name}</p>
          )}
        </div>
      );
    }

    return <p>Unsupported message type</p>;
  };

  return (
    <div className={cn(
      "flex gap-3 group",
      isOwn ? "flex-row-reverse" : "flex-row"
    )}>
      {/* Avatar */}
      {showAvatar && !isOwn && (
        <Avatar className="h-8 w-8 flex-shrink-0">
          <AvatarFallback className="bg-primary text-primary-foreground text-sm">
            {message.sender?.first_name?.charAt(0) || '?'}
          </AvatarFallback>
        </Avatar>
      )}

      {/* Message Content */}
      <div className={cn(
        "flex flex-col max-w-[70%]",
        isOwn ? "items-end" : "items-start"
      )}>
        {/* Sender Name */}
        {!isOwn && message.sender && (
          <p className="text-xs text-muted-foreground mb-1 px-1">
            {message.sender.first_name} {message.sender.last_name}
          </p>
        )}

        {/* Message Bubble */}
        <div className={cn(
          "relative px-4 py-2 rounded-2xl",
          isOwn 
            ? "bg-primary text-primary-foreground rounded-br-md" 
            : "bg-muted text-foreground rounded-bl-md"
        )}>
          {renderMessageContent()}

          {/* Message Actions */}
          {isOwn && (onEdit || onDelete) && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  size="sm"
                  variant="ghost"
                  className="absolute -right-8 top-1/2 transform -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6 p-0"
                >
                  <MoreVertical className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {onEdit && message.message_type === 'text' && (
                  <DropdownMenuItem onClick={() => setIsEditing(true)}>
                    <Edit className="h-4 w-4 mr-2" />
                    Edit
                  </DropdownMenuItem>
                )}
                {onDelete && (
                  <DropdownMenuItem 
                    onClick={() => onDelete(message.id)}
                    className="text-destructive"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        {/* Timestamp and Read Status */}
        <div className={cn(
          "flex items-center gap-1 mt-1 px-1",
          isOwn ? "flex-row-reverse" : "flex-row"
        )}>
          <span className="text-xs text-muted-foreground">
            {formatTime(message.created_at)}
          </span>
          {isOwn && getReadStatus()}
        </div>
      </div>

      {/* Spacer for alignment */}
      {showAvatar && isOwn && <div className="w-8" />}
    </div>
  );
}
