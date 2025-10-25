import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { connectionsAPI, chatAPI } from '@/lib/api';
import { Users, Loader2, Search } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Connection {
  id: string;
  requester_id: number;
  recipient_id: number;
  status: string;
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

interface CreateGroupChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGroupCreated?: (conversation: any) => void;
  currentUserId: number;
}

/**
 * Modal for creating a new group chat
 * CHANGE: New component to create group chats with multiple participants
 */
export function CreateGroupChatModal({ 
  isOpen, 
  onClose, 
  onGroupCreated,
  currentUserId 
}: CreateGroupChatModalProps) {
  const { toast } = useToast();
  const [groupName, setGroupName] = useState('');
  const [selectedUserIds, setSelectedUserIds] = useState<number[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [filteredConnections, setFilteredConnections] = useState<Connection[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingConnections, setIsLoadingConnections] = useState(true);

  useEffect(() => {
    if (isOpen) {
      loadConnections();
    } else {
      // Reset state when modal closes
      setGroupName('');
      setSelectedUserIds([]);
      setSearchQuery('');
    }
  }, [isOpen]);

  useEffect(() => {
    // Filter connections based on search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      const filtered = connections.filter(conn => {
        const otherUser = getOtherUser(conn);
        const fullName = `${otherUser.first_name} ${otherUser.last_name}`.toLowerCase();
        return fullName.includes(query);
      });
      setFilteredConnections(filtered);
    } else {
      setFilteredConnections(connections);
    }
  }, [searchQuery, connections]);

  const loadConnections = async () => {
    try {
      setIsLoadingConnections(true);
      const response = await connectionsAPI.getConnections('accepted');
      setConnections(response.connections || []);
      setFilteredConnections(response.connections || []);
    } catch (error) {
      console.error('Failed to load connections:', error);
      toast({
        title: "Failed to load connections",
        description: "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoadingConnections(false);
    }
  };

  const getOtherUser = (connection: Connection) => {
    if (connection.requester_id === currentUserId) {
      return connection.recipient!;
    } else {
      return connection.requester!;
    }
  };

  const toggleUser = (userId: number) => {
    setSelectedUserIds(prev => 
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const handleCreate = async () => {
    if (!groupName.trim()) {
      toast({
        title: "Group name required",
        description: "Please enter a name for your group chat.",
        variant: "destructive",
      });
      return;
    }

    if (selectedUserIds.length < 2) {
      toast({
        title: "Not enough members",
        description: "Please select at least 2 people to create a group chat.",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsLoading(true);
      const response = await chatAPI.createGroupChat(groupName.trim(), selectedUserIds);
      
      toast({
        title: "Group created!",
        description: `${groupName} has been created successfully.`,
      });

      onGroupCreated?.(response.conversation);
      onClose();
    } catch (error: any) {
      console.error('Failed to create group chat:', error);
      toast({
        title: "Failed to create group",
        description: error.message || "Something went wrong. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Create Group Chat
          </DialogTitle>
          <DialogDescription>
            Create a group chat with multiple people from your connections
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Group Name Input */}
          <div className="space-y-2">
            <Label htmlFor="groupName">Group Name *</Label>
            <Input
              id="groupName"
              placeholder="e.g., Roommate Search Squad"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              maxLength={50}
            />
            <p className="text-xs text-muted-foreground">
              {groupName.length}/50 characters
            </p>
          </div>

          {/* Search Input */}
          <div className="space-y-2">
            <Label>Select Members * (at least 2)</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search connections..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          {/* Selected Count Badge */}
          {selectedUserIds.length > 0 && (
            <Badge variant="secondary" className="w-fit">
              {selectedUserIds.length} member{selectedUserIds.length !== 1 ? 's' : ''} selected
            </Badge>
          )}

          {/* Connections List */}
          <ScrollArea className="h-[300px] border rounded-md p-2">
            {isLoadingConnections ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : filteredConnections.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center p-4">
                <p className="text-muted-foreground">
                  {searchQuery ? 'No connections match your search' : 'No connections available'}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredConnections.map((connection) => {
                  const otherUser = getOtherUser(connection);
                  const isSelected = selectedUserIds.includes(otherUser.user_id);
                  
                  return (
                    <div
                      key={connection.id}
                      className="flex items-center space-x-3 p-3 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                      onClick={() => toggleUser(otherUser.user_id)}
                    >
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleUser(otherUser.user_id)}
                        onClick={(e) => e.stopPropagation()}
                      />
                      
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="bg-primary text-primary-foreground text-sm">
                          {otherUser.first_name.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">
                          {otherUser.first_name} {otherUser.last_name}
                        </p>
                        <p className="text-sm text-muted-foreground truncate">
                          {otherUser.email}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isLoading}
            className="w-full sm:w-auto"
          >
            Cancel
          </Button>
          <Button
            onClick={handleCreate}
            disabled={isLoading || !groupName.trim() || selectedUserIds.length < 2}
            className="w-full sm:w-auto gap-2"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <Users className="h-4 w-4" />
                Create Group
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

