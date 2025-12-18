import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface User {
  id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
  bio: string | null;
}

interface FollowersModalProps {
  open: boolean;
  onClose: () => void;
  userId: string;
  defaultTab?: 'followers' | 'following';
}

export const FollowersModal = ({ open, onClose, userId, defaultTab = 'followers' }: FollowersModalProps) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [followers, setFollowers] = useState<User[]>([]);
  const [following, setFollowing] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (open) {
      loadData();
    }
  }, [open, userId]);

  const loadData = async () => {
    setLoading(true);
    try {
      // Load followers
      const { data: followersData, error: followersError } = await supabase
        .from('follows')
        .select('follower_id')
        .eq('following_id', userId);

      if (followersError) throw followersError;

      const followerIds = followersData?.map(f => f.follower_id) || [];
      
      if (followerIds.length > 0) {
        const { data: followersProfiles } = await supabase
          .from('public_profiles')
          .select('id, display_name, username, avatar_url, bio')
          .in('id', followerIds);
        
        setFollowers(followersProfiles || []);
      } else {
        setFollowers([]);
      }

      // Load following
      const { data: followingData, error: followingError } = await supabase
        .from('follows')
        .select('following_id')
        .eq('follower_id', userId);

      if (followingError) throw followingError;

      const followingIds = followingData?.map(f => f.following_id) || [];
      
      if (followingIds.length > 0) {
        const { data: followingProfiles } = await supabase
          .from('public_profiles')
          .select('id, display_name, username, avatar_url, bio')
          .in('id', followingIds);
        
        setFollowing(followingProfiles || []);
      } else {
        setFollowing([]);
      }

      // Load current user's following list
      if (user) {
        const { data: currentUserFollowing } = await supabase
          .from('follows')
          .select('following_id')
          .eq('follower_id', user.id);
        
        setFollowingIds(new Set(currentUserFollowing?.map(f => f.following_id) || []));
      }
    } catch (error: any) {
      toast({
        title: 'Error loading data',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleFollow = async (targetUserId: string) => {
    if (!user) return;

    try {
      const isFollowing = followingIds.has(targetUserId);
      
      if (isFollowing) {
        await supabase
          .from('follows')
          .delete()
          .eq('follower_id', user.id)
          .eq('following_id', targetUserId);
        
        setFollowingIds(prev => {
          const newSet = new Set(prev);
          newSet.delete(targetUserId);
          return newSet;
        });
      } else {
        await supabase
          .from('follows')
          .insert({
            follower_id: user.id,
            following_id: targetUserId,
          });
        
        setFollowingIds(prev => new Set([...prev, targetUserId]));
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const UserItem = ({ user: userData }: { user: User }) => {
    const isFollowing = followingIds.has(userData.id);
    const isOwnProfile = user?.id === userData.id;

    return (
      <div className="flex items-center justify-between p-3 hover:bg-accent/50 rounded-lg transition">
        <div 
          className="flex items-center gap-3 flex-1 cursor-pointer"
          onClick={() => {
            navigate(`/profile/${userData.username || userData.id}`);
            onClose();
          }}
        >
          <Avatar className="w-12 h-12">
            <AvatarImage src={userData.avatar_url || ''} />
            <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-primary-foreground">
              {userData.display_name?.[0] || 'U'}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-foreground truncate">
              {userData.display_name || 'Unknown'}
            </p>
            <p className="text-sm text-muted-foreground truncate">
              @{userData.username || 'user'}
            </p>
            {userData.bio && (
              <p className="text-xs text-muted-foreground truncate mt-1">
                {userData.bio}
              </p>
            )}
          </div>
        </div>
        {!isOwnProfile && (
          <Button
            onClick={(e) => {
              e.stopPropagation();
              handleFollow(userData.id);
            }}
            variant={isFollowing ? 'outline' : 'default'}
            size="sm"
            className={isFollowing ? '' : 'bg-gradient-to-r from-primary to-accent'}
          >
            {isFollowing ? 'Following' : 'Follow'}
          </Button>
        )}
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Connections</DialogTitle>
        </DialogHeader>
        
        <Tabs defaultValue={defaultTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="followers">
              Followers ({followers.length})
            </TabsTrigger>
            <TabsTrigger value="following">
              Following ({following.length})
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="followers">
            <ScrollArea className="h-[400px] pr-4">
              {loading ? (
                <div className="flex items-center justify-center h-32">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : followers.length > 0 ? (
                <div className="space-y-2">
                  {followers.map((follower) => (
                    <UserItem key={follower.id} user={follower} />
                  ))}
                </div>
              ) : (
                <div className="flex items-center justify-center h-32">
                  <p className="text-muted-foreground">No followers yet</p>
                </div>
              )}
            </ScrollArea>
          </TabsContent>
          
          <TabsContent value="following">
            <ScrollArea className="h-[400px] pr-4">
              {loading ? (
                <div className="flex items-center justify-center h-32">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : following.length > 0 ? (
                <div className="space-y-2">
                  {following.map((followedUser) => (
                    <UserItem key={followedUser.id} user={followedUser} />
                  ))}
                </div>
              ) : (
                <div className="flex items-center justify-center h-32">
                  <p className="text-muted-foreground">Not following anyone yet</p>
                </div>
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
