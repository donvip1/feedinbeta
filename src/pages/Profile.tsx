import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PostCard } from '@/components/feed/PostCard';
import { ArrowLeft, UserPlus, MessageCircle } from 'lucide-react';

interface Profile {
  id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
  bio: string | null;
  followers_count: number;
  following_count: number;
}

interface Post {
  id: string;
  feed_id: string;
  user_id: string;
  content: string | null;
  media_url: string | null;
  media_type: string | null;
  likes_count: number;
  comments_count: number;
  views_count: number;
  created_at: string;
  profiles: {
    display_name: string | null;
    username: string | null;
    avatar_url: string | null;
  };
}

const Profile = () => {
  const { userId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFollowing, setIsFollowing] = useState(false);
  const [hasPendingRequest, setHasPendingRequest] = useState(false);

  const isOwnProfile = user?.id === userId;

  useEffect(() => {
    if (userId) {
      loadProfile();
      loadPosts();
      checkFollowStatus();
      checkFriendRequestStatus();
      
      // Deduct credits for profile view if not own profile
      if (!isOwnProfile && user) {
        deductProfileViewCredits();
      }
    }
  }, [userId]);

  const deductProfileViewCredits = async () => {
    try {
      await supabase.functions.invoke('credit-deduction', {
        body: {
          action: 'profile_view',
          userId: user?.id,
          targetUserId: userId,
          metadata: { username: profile?.username },
        },
      });
    } catch (error) {
      // Silent fail - don't block profile viewing
      console.error('Credit deduction error:', error);
    }
  };

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
      toast({
        title: 'Error loading profile',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const loadPosts = async () => {
    try {
      const { data, error } = await supabase
        .from('posts')
        .select(`
          *,
          profiles (
            display_name,
            username,
            avatar_url
          )
        `)
        .eq('user_id', userId)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      setPosts(data || []);
    } catch (error: any) {
      console.error('Error loading posts:', error);
    }
  };

  const checkFollowStatus = async () => {
    if (!user || isOwnProfile) return;

    try {
      const { data, error } = await supabase
        .from('follows')
        .select('id')
        .eq('follower_id', user.id)
        .eq('following_id', userId)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      setIsFollowing(!!data);
    } catch (error: any) {
      console.error('Error checking follow status:', error);
    }
  };

  const checkFriendRequestStatus = async () => {
    if (!user || isOwnProfile) return;

    try {
      const { data, error } = await supabase
        .from('friend_requests')
        .select('id')
        .eq('sender_id', user.id)
        .eq('receiver_id', userId)
        .eq('status', 'pending')
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      setHasPendingRequest(!!data);
    } catch (error: any) {
      console.error('Error checking friend request status:', error);
    }
  };

  const toggleFollow = async () => {
    if (!user) return;

    try {
      if (isFollowing) {
        await supabase
          .from('follows')
          .delete()
          .eq('follower_id', user.id)
          .eq('following_id', userId);
        setIsFollowing(false);
      } else {
        await supabase.from('follows').insert({
          follower_id: user.id,
          following_id: userId,
        });
        setIsFollowing(true);
      }
      loadProfile();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const sendFriendRequest = async () => {
    if (!user) return;

    try {
      // Deduct credits first (5 credits)
      const { error: creditError } = await supabase.functions.invoke('credit-deduction', {
        body: {
          action: 'friend_request',
          userId: user.id,
          targetUserId: userId,
        },
      });

      if (creditError) {
        toast({
          title: 'Insufficient credits',
          description: 'You need 5 credits to send a friend request',
          variant: 'destructive',
        });
        return;
      }

      await supabase.from('friend_requests').insert({
        sender_id: user.id,
        receiver_id: userId,
      });
      setHasPendingRequest(true);
      toast({
        title: 'Friend request sent',
        description: '5 credits deducted',
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const startConversation = async () => {
    if (!user || !userId) return;

    try {
      // Check if conversation already exists
      const { data: existingConv } = await supabase
        .from('conversation_participants')
        .select('conversation_id')
        .eq('user_id', user.id);

      if (existingConv) {
        for (const conv of existingConv) {
          const { data: otherParticipant } = await supabase
            .from('conversation_participants')
            .select('user_id')
            .eq('conversation_id', conv.conversation_id)
            .eq('user_id', userId)
            .single();

          if (otherParticipant) {
            navigate(`/messages?conversation=${conv.conversation_id}`);
            return;
          }
        }
      }

      // Use secure function to create conversation
      const { data: conversationId, error } = await supabase.rpc('create_conversation', {
        other_user_id: userId
      });

      if (error) throw error;

      navigate(`/messages?conversation=${conversationId}`);
    } catch (error: any) {
      toast({
        title: 'Unable to start conversation',
        description: 'Please try again later.',
        variant: 'destructive',
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-black">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-black">
        <p className="text-gray-400">Profile not found</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-black/80 backdrop-blur-lg border-b border-gray-800">
        <div className="container mx-auto px-4 py-3">
          <Button
            onClick={() => navigate(-1)}
            variant="ghost"
            size="icon"
            className="text-gray-400 hover:text-white"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </div>
      </header>

      {/* Profile Header */}
      <div className="container mx-auto px-4 py-6 max-w-2xl">
        <div className="flex items-start space-x-4 mb-6">
          <Avatar className="w-24 h-24">
            <AvatarImage src={profile.avatar_url || ''} />
            <AvatarFallback className="text-2xl">
              {profile.display_name?.[0] || 'U'}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <h1 className="text-2xl font-bold">{profile.display_name || 'Unknown'}</h1>
            <p className="text-gray-400">@{profile.username || 'user'}</p>
            {profile.bio && <p className="mt-2 text-gray-300">{profile.bio}</p>}

            <div className="flex space-x-6 mt-4 text-sm">
              <div>
                <span className="font-bold text-white">{profile.followers_count}</span>{' '}
                <span className="text-gray-400">Followers</span>
              </div>
              <div>
                <span className="font-bold text-white">{profile.following_count}</span>{' '}
                <span className="text-gray-400">Following</span>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        {!isOwnProfile && (
          <div className="flex space-x-2 mb-6">
            <Button
              onClick={toggleFollow}
              className={
                isFollowing
                  ? 'flex-1 bg-gray-800 hover:bg-gray-700'
                  : 'flex-1 bg-primary hover:bg-primary/90'
              }
            >
              {isFollowing ? 'Following' : 'Follow'}
            </Button>
            <Button
              onClick={hasPendingRequest ? undefined : sendFriendRequest}
              disabled={hasPendingRequest}
              variant="outline"
              className="flex-1 border-gray-700"
            >
              <UserPlus className="w-4 h-4 mr-2" />
              {hasPendingRequest ? 'Request Sent' : 'Add Friend'}
            </Button>
            <Button
              onClick={startConversation}
              variant="outline"
              className="border-gray-700"
            >
              <MessageCircle className="w-4 h-4" />
            </Button>
          </div>
        )}

        {/* Posts Tabs */}
        <Tabs defaultValue="posts" className="w-full">
          <TabsList className="w-full bg-gray-900">
            <TabsTrigger value="posts" className="flex-1">
              Posts
            </TabsTrigger>
            <TabsTrigger value="media" className="flex-1">
              Media
            </TabsTrigger>
          </TabsList>

          <TabsContent value="posts" className="mt-6 space-y-6">
            {posts.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-400">No posts yet</p>
              </div>
            ) : (
              posts.map((post) => (
                <PostCard key={post.id} post={post} onUpdate={loadPosts} />
              ))
            )}
          </TabsContent>

          <TabsContent value="media" className="mt-6">
            <div className="grid grid-cols-3 gap-2">
              {posts
                .filter((post) => post.media_url)
                .map((post) => (
                  <div
                    key={post.id}
                    className="aspect-square rounded-lg overflow-hidden cursor-pointer hover:opacity-80"
                  >
                    {post.media_type === 'image' ? (
                      <img
                        src={post.media_url || ''}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <video
                        src={post.media_url || ''}
                        className="w-full h-full object-cover"
                      />
                    )}
                  </div>
                ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Profile;
