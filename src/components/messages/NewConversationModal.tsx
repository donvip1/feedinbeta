import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface User {
  id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
}

interface NewConversationModalProps {
  open: boolean;
  onClose: () => void;
  onSelectUser: (userId: string) => void;
  initialImageUrl?: string | null;
}

export const NewConversationModal = ({ open, onClose, onSelectUser, initialImageUrl }: NewConversationModalProps) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [friends, setFriends] = useState<User[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      loadFriends();
    }
  }, [open]);

  const loadFriends = async () => {
    if (!user) return;

    setLoading(true);
    try {
      // Get accepted friend requests where user is either sender or receiver
      const { data: acceptedRequests, error: requestsError } = await supabase
        .from('friend_requests')
        .select('sender_id, receiver_id')
        .eq('status', 'accepted')
        .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`);

      if (requestsError) throw requestsError;

      // Extract friend IDs
      const friendIds = acceptedRequests?.map((req) =>
        req.sender_id === user.id ? req.receiver_id : req.sender_id
      ) || [];

      if (friendIds.length === 0) {
        setFriends([]);
        return;
      }

      // Fetch friend profiles
      const { data: profiles, error: profilesError } = await supabase
        .from('public_profiles')
        .select('id, display_name, username, avatar_url')
        .in('id', friendIds);

      if (profilesError) throw profilesError;
      setFriends(profiles || []);
    } catch (error: any) {
      console.error('Error loading friends:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredFriends = friends.filter(
    u =>
      u.display_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.username?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSelectUser = (userId: string) => {
    onSelectUser(userId);
    setSearchQuery('');
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-background border-border max-w-md">
        <DialogHeader>
          <DialogTitle>{initialImageUrl ? 'Share Image With...' : 'New Conversation'}</DialogTitle>
        </DialogHeader>

        {initialImageUrl && (
          <div className="mb-4 p-2 bg-muted rounded-lg">
            <p className="text-sm text-muted-foreground mb-2">Sharing image:</p>
            <img src={initialImageUrl} alt="Shared" className="w-full max-h-32 object-contain rounded" />
          </div>
        )}

        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search friends..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        <ScrollArea className="h-[400px]">
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : filteredFriends.length === 0 ? (
            <div className="text-center py-8 space-y-4">
              <Users className="w-12 h-12 mx-auto text-muted-foreground" />
              <div className="text-muted-foreground">
                {friends.length === 0 ? (
                  <>
                    <p className="font-medium">No friends yet</p>
                    <p className="text-sm mt-1">Add friends to start chatting with them</p>
                    <button
                      onClick={() => {
                        onClose();
                        navigate('/friends');
                      }}
                      className="mt-3 text-primary hover:underline text-sm"
                    >
                      Find Friends
                    </button>
                  </>
                ) : (
                  <p>No friends found matching "{searchQuery}"</p>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredFriends.map((u) => (
                <button
                  key={u.id}
                  onClick={() => handleSelectUser(u.id)}
                  className="w-full p-3 flex items-center gap-3 hover:bg-accent rounded-lg transition-colors"
                >
                  <Avatar>
                    <AvatarImage src={u.avatar_url || ''} />
                    <AvatarFallback>{u.display_name?.[0] || 'U'}</AvatarFallback>
                  </Avatar>
                  <div className="text-left">
                    <p className="font-semibold">{u.display_name || 'Unknown User'}</p>
                    {u.username && (
                      <p className="text-sm text-muted-foreground">@{u.username}</p>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};