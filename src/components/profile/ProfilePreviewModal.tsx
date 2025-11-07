import { useState, useEffect } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { UserPlus, MessageCircle, Users, Heart, Eye, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface ProfilePreviewModalProps {
  open: boolean;
  onClose: () => void;
  userId: string;
}

export const ProfilePreviewModal = ({ open, onClose, userId }: ProfilePreviewModalProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<any>(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [friendRequestStatus, setFriendRequestStatus] = useState<'none' | 'pending' | 'accepted'>('none');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (open && userId) {
      loadProfile();
      checkFollowStatus();
      checkFriendStatus();
    }
  }, [open, userId]);

  const loadProfile = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) throw error;
      setProfile(data);
    } catch (error: any) {
      console.error('Error loading profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const checkFollowStatus = async () => {
    if (!user) return;
    try {
      const { data } = await supabase
        .from('follows')
        .select('id')
        .eq('follower_id', user.id)
        .eq('following_id', userId)
        .single();

      setIsFollowing(!!data);
    } catch (error) {
      // Not following
    }
  };

  const checkFriendStatus = async () => {
    if (!user) return;
    try {
      const { data } = await supabase
        .from('friend_requests')
        .select('status')
        .or(`and(sender_id.eq.${user.id},receiver_id.eq.${userId}),and(sender_id.eq.${userId},receiver_id.eq.${user.id})`)
        .single();

      if (data && (data.status === 'pending' || data.status === 'accepted')) {
        setFriendRequestStatus(data.status as 'pending' | 'accepted');
      }
    } catch (error) {
      // No friend request
    }
  };

  const handleFollow = async () => {
    if (!user) return;

    try {
      if (isFollowing) {
        await supabase
          .from('follows')
          .delete()
          .eq('follower_id', user.id)
          .eq('following_id', userId);
        setIsFollowing(false);
        toast({ title: 'Unfollowed successfully' });
      } else {
        await supabase
          .from('follows')
          .insert({ follower_id: user.id, following_id: userId });
        setIsFollowing(true);
        toast({ title: 'Following successfully' });
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleAddFriend = async () => {
    if (!user) return;

    try {
      if (friendRequestStatus === 'pending') {
        toast({ title: 'Message request already sent' });
        return;
      }

      const { error } = await supabase
        .from('friend_requests')
        .insert({
          sender_id: user.id,
          receiver_id: userId,
        });

      if (error) throw error;

      setFriendRequestStatus('pending');
      toast({ title: 'Message request sent' });
    } catch (error: any) {
      toast({
        title: 'Error sending message request',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleMessage = async () => {
    if (friendRequestStatus !== 'accepted') {
      toast({
        title: 'Not connected',
        description: "This person isn't on your message list. Send a message request to chat.",
        variant: 'destructive',
      });
      return;
    }

    try {
      // Create or get existing conversation
      const { data: existingConv } = await supabase
        .from('conversation_participants')
        .select('conversation_id')
        .eq('user_id', user?.id);

      if (existingConv) {
        const { data: otherParticipant } = await supabase
          .from('conversation_participants')
          .select('conversation_id')
          .eq('user_id', userId)
          .in('conversation_id', existingConv.map(c => c.conversation_id));

        if (otherParticipant && otherParticipant.length > 0) {
          navigate(`/messages?conversation=${otherParticipant[0].conversation_id}`);
          onClose();
          return;
        }
      }

      // Create new conversation
      const { data: newConv, error } = await supabase.rpc('create_conversation', {
        other_user_id: userId,
      });

      if (error) throw error;
      navigate(`/messages?conversation=${newConv}`);
      onClose();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  if (loading || !profile) {
    return (
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="bg-gray-900 border-gray-800 max-w-md">
          <div className="flex items-center justify-center p-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const displayName = profile.display_name || profile.username || 'Anonymous';
  const username = profile.username ? `@@${profile.username}` : '@@anonymous';

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-gray-900 border-gray-800 max-w-md p-0">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 z-10 rounded-full bg-gray-800/80 p-2 text-gray-400 hover:text-white"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="p-6 space-y-6">
          {/* Profile Header */}
          <div className="flex flex-col items-center text-center space-y-3">
            <Avatar className="w-24 h-24 border-4 border-primary">
              <AvatarImage src={profile.avatar_url || ''} />
              <AvatarFallback className="bg-gradient-to-br from-pink-500 to-blue-500 text-white text-2xl">
                {displayName.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>

            <div>
              <h2 className="text-2xl font-bold text-white">{displayName}</h2>
              <p className="text-sm text-gray-400">{username}</p>
            </div>

            {profile.bio && (
              <p className="text-gray-300 text-sm">{profile.bio}</p>
            )}
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-gray-800 rounded-xl p-4 text-center">
              <Users className="w-6 h-6 mx-auto mb-2 text-purple-500" />
              <p className="text-2xl font-bold text-white">{profile.followers_count || 0}</p>
              <p className="text-xs text-gray-400">Followers</p>
            </div>
            <div className="bg-gray-800 rounded-xl p-4 text-center">
              <Heart className="w-6 h-6 mx-auto mb-2 text-pink-500" />
              <p className="text-2xl font-bold text-white">
                {/* Calculate total likes from posts */}
                0
              </p>
              <p className="text-xs text-gray-400">Likes</p>
            </div>
            <div className="bg-gray-800 rounded-xl p-4 text-center">
              <Eye className="w-6 h-6 mx-auto mb-2 text-blue-500" />
              <p className="text-2xl font-bold text-white">
                {/* Calculate total views from posts */}
                0
              </p>
              <p className="text-xs text-gray-400">Views</p>
            </div>
          </div>

          {/* Action Buttons */}
          {user?.id !== userId && (
            <div className="grid grid-cols-1 gap-3">
              <Button
                onClick={handleFollow}
                className={`w-full ${
                  isFollowing
                    ? 'bg-gray-700 hover:bg-gray-600'
                    : 'bg-gradient-to-r from-pink-500 to-blue-500 hover:from-pink-600 hover:to-blue-600'
                }`}
              >
                <Users className="w-4 h-4 mr-2" />
                {isFollowing ? 'Following' : 'Follow'}
              </Button>

              <Button
                onClick={handleAddFriend}
                variant="outline"
                className="w-full border-gray-700 hover:bg-gray-800"
                disabled={friendRequestStatus === 'pending' || friendRequestStatus === 'accepted'}
              >
                <UserPlus className="w-4 h-4 mr-2" />
                {friendRequestStatus === 'accepted'
                  ? 'Connected'
                  : friendRequestStatus === 'pending'
                  ? 'Request Sent'
                  : 'Add to Messages'}
              </Button>

              <Button
                onClick={handleMessage}
                variant="outline"
                className="w-full border-gray-700 hover:bg-gray-800"
              >
                <MessageCircle className="w-4 h-4 mr-2" />
                Message
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
