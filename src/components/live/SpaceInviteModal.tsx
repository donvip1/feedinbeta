import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Search, UserPlus, X, Check, Clock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { getErrorMessage } from '@/lib/error-messages';

interface SpaceInviteModalProps {
  isOpen: boolean;
  onClose: () => void;
  spaceId: string;
}

interface SearchUser {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string;
}

interface PendingInvite {
  id: string;
  invited_user_id: string;
  status: string;
  user?: SearchUser;
}

export const SpaceInviteModal = ({ isOpen, onClose, spaceId }: SpaceInviteModalProps) => {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchUser[]>([]);
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([]);
  const [searching, setSearching] = useState(false);
  const [inviting, setInviting] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetchPendingInvites();
    }
  }, [isOpen, spaceId]);

  const fetchPendingInvites = async () => {
    const { data } = await supabase
      .from('live_space_invitations')
      .select('*')
      .eq('space_id', spaceId)
      .eq('status', 'pending');

    if (data && data.length > 0) {
      const userIds = data.map(i => i.invited_user_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, username, display_name, avatar_url')
        .in('id', userIds);

      const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

      setPendingInvites(data.map(i => ({
        ...i,
        user: profileMap.get(i.invited_user_id),
      })));
    } else {
      setPendingInvites([]);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    setSearching(true);
    try {
      const { data } = await supabase
        .from('profiles')
        .select('id, username, display_name, avatar_url')
        .or(`username.ilike.%${searchQuery}%,display_name.ilike.%${searchQuery}%`)
        .neq('id', user?.id)
        .limit(10);

      setSearchResults(data || []);
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setSearching(false);
    }
  };

  const handleInvite = async (inviteeId: string) => {
    if (!user) return;

    setInviting(inviteeId);
    try {
      const { error } = await supabase.from('live_space_invitations').insert({
        space_id: spaceId,
        inviter_id: user.id,
        invited_user_id: inviteeId,
      });

      if (error) {
        if (error.code === '23505') {
          toast.error('User already invited');
        } else {
          throw error;
        }
      } else {
        // Create a notification for the invitee (ignore errors if table doesn't exist)
        try {
          await supabase.from('notifications').insert({
            user_id: inviteeId,
            type: 'space_invite',
            title: 'Speaker Invitation',
            message: `You've been invited to speak in a live space`,
            related_id: spaceId,
            related_type: 'space',
            is_read: false,
          });
        } catch {
          // Ignore if notifications table doesn't exist
        }
        
        // Also broadcast to the invitee for instant delivery
        const broadcastChannel = supabase.channel(`space-invite-broadcast-${inviteeId}`);
        await broadcastChannel.send({
          type: 'broadcast',
          event: 'space-invite',
          payload: { 
            space_id: spaceId, 
            inviter_id: user.id,
            invitee_id: inviteeId,
          },
        });
        supabase.removeChannel(broadcastChannel);

        toast.success('Invitation sent!');
        fetchPendingInvites();
        setSearchResults(prev => prev.filter(u => u.id !== inviteeId));
      }
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, 'Failed to send invitation'));
    } finally {
      setInviting(null);
    }
  };

  const cancelInvite = async (inviteId: string) => {
    await supabase.from('live_space_invitations').delete().eq('id', inviteId);
    toast.success('Invitation cancelled');
    fetchPendingInvites();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-primary" />
            Invite Speakers
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Search */}
          <div className="flex gap-2">
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search users..."
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            />
            <Button onClick={handleSearch} disabled={searching}>
              <Search className="w-4 h-4" />
            </Button>
          </div>

          {/* Search Results */}
          {searchResults.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">Search Results</p>
              {searchResults.map((searchUser) => (
                <div key={searchUser.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-2">
                    <Avatar className="w-8 h-8">
                      <AvatarImage src={searchUser.avatar_url} />
                      <AvatarFallback>{searchUser.display_name?.[0]}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-medium">{searchUser.display_name}</p>
                      <p className="text-xs text-muted-foreground">@{searchUser.username}</p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => handleInvite(searchUser.id)}
                    disabled={inviting === searchUser.id}
                  >
                    {inviting === searchUser.id ? 'Inviting...' : 'Invite'}
                  </Button>
                </div>
              ))}
            </div>
          )}

          {/* Pending Invites */}
          {pendingInvites.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">Pending Invitations</p>
              {pendingInvites.map((invite) => (
                <div key={invite.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-2">
                    <Avatar className="w-8 h-8">
                      <AvatarImage src={invite.user?.avatar_url} />
                      <AvatarFallback>{invite.user?.display_name?.[0]}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-medium">{invite.user?.display_name}</p>
                      <p className="text-xs text-muted-foreground">@{invite.user?.username}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="gap-1">
                      <Clock className="w-3 h-3" />
                      Pending
                    </Badge>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      onClick={() => cancelInvite(invite.id)}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
