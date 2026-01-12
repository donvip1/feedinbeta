import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { MessageCircle, User, MoreVertical } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface Friend {
  id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
  bio: string | null;
}

interface FriendsModalProps {
  open: boolean;
  onClose: () => void;
  userId: string;
  friendsCount: number;
}

export const FriendsModal = ({ open, onClose, userId, friendsCount }: FriendsModalProps) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (open) {
      loadFriends();
    }
  }, [open, userId]);

  const loadFriends = async () => {
    setLoading(true);
    try {
      // Get all accepted friend requests where user is either sender or receiver
      const { data: friendRequests, error } = await supabase
        .from('friend_requests')
        .select('sender_id, receiver_id')
        .eq('status', 'accepted')
        .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`);

      if (error) throw error;

      // Extract friend IDs (the other person in each relationship)
      const friendIds = friendRequests?.map(fr => 
        fr.sender_id === userId ? fr.receiver_id : fr.sender_id
      ) || [];

      if (friendIds.length > 0) {
        const { data: friendProfiles, error: profilesError } = await supabase
          .from('public_profiles')
          .select('id, display_name, username, avatar_url, bio')
          .in('id', friendIds);

        if (profilesError) throw profilesError;
        setFriends(friendProfiles || []);
      } else {
        setFriends([]);
      }
    } catch (error: any) {
      toast({
        title: 'Error loading friends',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleChat = async (friendId: string) => {
    if (!user) return;

    try {
      // Check for existing conversation
      const { data: existingConvo } = await supabase
        .from('conversation_participants')
        .select('conversation_id')
        .eq('user_id', user.id);

      if (existingConvo && existingConvo.length > 0) {
        const convoIds = existingConvo.map(c => c.conversation_id);
        
        const { data: sharedConvo } = await supabase
          .from('conversation_participants')
          .select('conversation_id')
          .eq('user_id', friendId)
          .in('conversation_id', convoIds);

        if (sharedConvo && sharedConvo.length > 0) {
          // Navigate to existing conversation
          navigate(`/messages?conversation=${sharedConvo[0].conversation_id}`);
          onClose();
          return;
        }
      }

      // Create new conversation
      const { data: newConvo, error: convoError } = await supabase
        .from('conversations')
        .insert({})
        .select()
        .single();

      if (convoError) throw convoError;

      // Add both participants
      await supabase.from('conversation_participants').insert([
        { conversation_id: newConvo.id, user_id: user.id },
        { conversation_id: newConvo.id, user_id: friendId }
      ]);

      navigate(`/messages?conversation=${newConvo.id}`);
      onClose();
    } catch (error: any) {
      toast({
        title: 'Error starting chat',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleViewProfile = (friend: Friend) => {
    navigate(`/profile/${friend.username || friend.id}`);
    onClose();
  };

  const FriendItem = ({ friend }: { friend: Friend }) => {
    const isOwnProfile = user?.id === friend.id;

    return (
      <div className="flex items-center justify-between p-3 hover:bg-accent/50 rounded-lg transition">
        <div 
          className="flex items-center gap-3 flex-1 cursor-pointer"
          onClick={() => handleViewProfile(friend)}
        >
          <Avatar className="w-12 h-12">
            <AvatarImage src={friend.avatar_url || ''} />
            <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-primary-foreground">
              {friend.display_name?.[0] || 'U'}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-foreground truncate">
              {friend.display_name || 'Unknown'}
            </p>
            <p className="text-sm text-muted-foreground truncate">
              @{friend.username || 'user'}
            </p>
            {friend.bio && (
              <p className="text-xs text-muted-foreground truncate mt-1">
                {friend.bio}
              </p>
            )}
          </div>
        </div>
        
        {!isOwnProfile && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-9 w-9">
                <MoreVertical className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-background border-border">
              <DropdownMenuItem 
                onClick={() => handleChat(friend.id)}
                className="cursor-pointer"
              >
                <MessageCircle className="w-4 h-4 mr-2" />
                Chat
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => handleViewProfile(friend)}
                className="cursor-pointer"
              >
                <User className="w-4 h-4 mr-2" />
                View Profile
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Friends ({friendsCount})</DialogTitle>
        </DialogHeader>
        
        <ScrollArea className="h-[400px] pr-4">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : friends.length > 0 ? (
            <div className="space-y-2">
              {friends.map((friend) => (
                <FriendItem key={friend.id} friend={friend} />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-32 text-center">
              <p className="text-muted-foreground">No friends yet</p>
              <p className="text-xs text-muted-foreground mt-1">
                Send friend requests to connect with others
              </p>
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};
