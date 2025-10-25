import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { connectionsAPI } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Send, UserPlus } from 'lucide-react';

interface ConnectionRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  roommate: {
    id: string;
    name: string;
    email: string;
    compatibilityScore: number;
  };
}

export function ConnectionRequestModal({
  isOpen,
  onClose,
  roommate
}: ConnectionRequestModalProps) {
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleSendRequest = async () => {
    try {
      setIsLoading(true);
      
      await connectionsAPI.sendRequest(
        parseInt(roommate.id),
        message.trim() || undefined
      );

      toast({
        title: "Connection request sent!",
        description: `Your request has been sent to ${roommate.name}.`,
      });

      onClose();
      setMessage('');
    } catch (error: any) {
      console.error('Failed to send connection request:', error);
      console.log('🔍 Error message received:', error.message); // CHANGE: Debug log
      
      // CHANGE: Parse specific error messages from backend based on connection status
      // Backend sends errors in format "ERROR_TYPE: Message"
      // We parse these to provide user-friendly, context-specific feedback
      let errorTitle = "Failed to send request";
      let errorDescription = error.message || "Something went wrong. Please try again.";
      
      const errorMsg = error.message || '';
      console.log('🔍 Parsing error message:', errorMsg); // CHANGE: Debug log
      
      // Parse backend error types (from ConnectionService.sendConnectionRequest)
      if (errorMsg.includes('PENDING_REQUEST:')) {
        errorTitle = "Connection Request Pending";
        errorDescription = `A connection request is already pending with ${roommate.name}. Please wait for them to respond, or check your sent requests.`;
      } else if (errorMsg.includes('ALREADY_CONNECTED:')) {
        errorTitle = "Already Connected";
        errorDescription = `You are already matched and chatting with ${roommate.name}! Check your Messages page to continue your conversation.`;
      } else if (errorMsg.includes('REQUEST_REJECTED:')) {
        errorTitle = "Previous Request Rejected";
        errorDescription = `Your previous connection request to ${roommate.name} was rejected. Consider reaching out in a different way or respecting their decision.`;
      } else if (errorMsg.includes('CONNECTION_BLOCKED:')) {
        errorTitle = "Connection Blocked";
        errorDescription = `You cannot send a connection request to ${roommate.name} at this time.`;
      } else if (errorMsg.toLowerCase().includes('connection already exists')) {
        errorTitle = "Connection Already Exists";
        errorDescription = `You already have a connection with ${roommate.name}. Check your Messages page to see your existing conversations.`;
      } else if (errorMsg.toLowerCase().includes('pending')) {
        errorTitle = "Request Already Pending";
        errorDescription = `You already have a pending connection request with ${roommate.name}.`;
      } else if (errorMsg) {
        // CHANGE: If we have an error message but it didn't match any pattern, show it
        errorDescription = errorMsg;
      }
      
      console.log('💬 Showing error toast:', errorTitle, errorDescription); // CHANGE: Debug log
      
      toast({
        title: errorTitle,
        description: errorDescription,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    if (!isLoading) {
      onClose();
      setMessage('');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Send Connection Request
          </DialogTitle>
          <DialogDescription>
            Send a connection request to <strong>{roommate.name}</strong> to start chatting.
            {roommate.compatibilityScore > 0 && (
              <span className="block mt-1 text-sm text-muted-foreground">
                Compatibility: {roommate.compatibilityScore}%
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="message">Optional message</Label>
            <Textarea
              id="message"
              placeholder="Hi! I'd love to connect and chat about finding a place together..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="min-h-[100px] resize-none"
              maxLength={500}
            />
            <div className="text-xs text-muted-foreground text-right">
              {message.length}/500 characters
            </div>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={isLoading}
            className="w-full sm:w-auto"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSendRequest}
            disabled={isLoading}
            className="w-full sm:w-auto gap-2"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Send className="h-4 w-4" />
                Send Request
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
