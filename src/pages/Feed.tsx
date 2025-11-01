import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { PostCard } from '@/components/feed/PostCard';
import { CreatePostModal } from '@/components/feed/CreatePostModal';
import { QuickActionsModal } from '@/components/feed/QuickActionsModal';
import { StoriesBar } from '@/components/stories/StoriesBar';
import { CreateStoryModal } from '@/components/stories/CreateStoryModal';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import { BottomNav } from '@/components/navigation/BottomNav';
import { LogOut, MessageSquare, Settings as SettingsIcon, RefreshCw, Wallet } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import feedinLogo from '@/assets/feedin-logo.png';

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

const Feed = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading, signOut } = useAuth();
  const { toast } = useToast();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreatePost, setShowCreatePost] = useState(false);
  const [showQuickActions, setShowQuickActions] = useState(false);
  const [showCreateStory, setShowCreateStory] = useState(false);
  const [defaultPostTab, setDefaultPostTab] = useState<'text' | 'image' | 'video'>('text');
  const [activeTab, setActiveTab] = useState('for-you');

  useEffect(() => {
    if (authLoading) return; // Wait for auth to load
    
    if (!user) {
      navigate('/auth');
      return;
    }
    loadPosts();
  }, [user, authLoading, navigate]);

  const loadPosts = async (isRefresh = false, tab = activeTab) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      }

      let query = supabase
        .from('posts')
        .select(`
          *,
          profiles (
            display_name,
            username,
            avatar_url
          )
        `)
        .eq('status', 'active');

      // Filter based on active tab
      if (tab === 'following') {
        // Get users that current user follows
        const { data: followingData } = await supabase
          .from('follows')
          .select('following_id')
          .eq('follower_id', user?.id);

        const followingIds = followingData?.map(f => f.following_id) || [];
        if (followingIds.length > 0) {
          query = query.in('user_id', followingIds);
        } else {
          setPosts([]);
          setLoading(false);
          setRefreshing(false);
          return;
        }
      } else if (tab === 'my-posts') {
        query = query.eq('user_id', user?.id);
      }

      query = query.order('created_at', { ascending: false }).limit(20);

      const { data, error } = await query;

      if (error) throw error;

      // For "For You" tab, add some randomization
      if (tab === 'for-you') {
        const shuffled = (data || []).sort(() => Math.random() - 0.5);
        setPosts(shuffled);
      } else {
        setPosts(data || []);
      }
    } catch (error: any) {
      toast({
        title: 'Error loading posts',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handlePostCreated = () => {
    setShowCreatePost(false);
    loadPosts(false);
  };

  const handleRefresh = () => {
    loadPosts(true, activeTab);
  };

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    loadPosts(false, tab);
  };

  const handleQuickAction = (action: string) => {
    switch (action) {
      case 'thoughts':
        setDefaultPostTab('text');
        setShowCreatePost(true);
        break;
      case 'story':
        setShowCreateStory(true);
        break;
      case 'group':
        navigate('/groups');
        break;
      case 'livestream':
        navigate('/live');
        break;
      case 'wallet':
        navigate('/wallet');
        break;
      case 'p2p':
        navigate('/p2p-marketplace');
        break;
      case 'ai':
        navigate('/ai-copilot');
        break;
      case 'marketplace':
        navigate('/p2p-marketplace');
        break;
      default:
        toast({
          title: 'Coming Soon',
          description: `${action} feature is coming soon!`,
        });
    }
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-black">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-gradient-to-r from-purple-900/80 to-blue-900/80 backdrop-blur-lg border-b border-gray-800">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Button
                onClick={() => navigate('/wallet')}
                variant="ghost"
                size="sm"
                className="text-white hover:bg-white/10"
              >
                <Wallet className="w-4 h-4 mr-2" />
                <div className="text-left">
                  <p className="text-xs text-gray-300">Credits</p>
                  <p className="text-sm font-bold">999,999</p>
                </div>
              </Button>
            </div>

            <Tabs value={activeTab} onValueChange={handleTabChange} className="flex-1 max-w-md mx-4">
              <TabsList className="grid w-full grid-cols-3 bg-transparent">
                <TabsTrigger
                  value="following"
                  className="text-gray-300 data-[state=active]:text-white data-[state=active]:border-b-2 data-[state=active]:border-white rounded-none bg-transparent"
                >
                  Following
                </TabsTrigger>
                <TabsTrigger
                  value="for-you"
                  className="text-gray-300 data-[state=active]:text-white data-[state=active]:border-b-2 data-[state=active]:border-white rounded-none bg-transparent"
                >
                  For You
                </TabsTrigger>
                <TabsTrigger
                  value="my-posts"
                  className="text-gray-300 data-[state=active]:text-white data-[state=active]:border-b-2 data-[state=active]:border-white rounded-none bg-transparent"
                >
                  My Posts
                </TabsTrigger>
              </TabsList>
            </Tabs>

            <div className="flex items-center space-x-2">
              <Button
                onClick={handleRefresh}
                size="sm"
                variant="ghost"
                className="text-white hover:bg-white/10"
                disabled={refreshing}
              >
                <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              </Button>
              <NotificationBell />
              <Button
                onClick={() => navigate(`/profile/${user?.id}`)}
                size="sm"
                variant="ghost"
                className="text-white hover:bg-white/10 p-1"
              >
                <Avatar className="w-8 h-8">
                  <AvatarImage src={user?.user_metadata?.avatar_url || ''} />
                  <AvatarFallback className="bg-gradient-to-br from-pink-500 to-blue-500 text-white text-xs">
                    {user?.user_metadata?.display_name?.[0] || 'U'}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Stories */}
      <div className="border-b border-gray-800">
        <div className="container mx-auto max-w-2xl">
          <StoriesBar />
        </div>
      </div>

      {/* Feed */}
      <main className="container mx-auto px-4 py-6 max-w-2xl pb-24">{/* Added pb-24 for bottom nav space */}
        {loading ? (
          <div className="space-y-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-gray-900 rounded-2xl p-6 space-y-4">
                <div className="flex items-center space-x-3">
                  <Skeleton className="w-12 h-12 rounded-full" />
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                </div>
                <Skeleton className="h-24 w-full" />
                <div className="flex items-center space-x-4">
                  <Skeleton className="h-8 w-20" />
                  <Skeleton className="h-8 w-20" />
                </div>
              </div>
            ))}
          </div>
        ) : posts.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-gray-400 text-lg mb-4">No posts yet</p>
            <Button
              onClick={() => setShowQuickActions(true)}
              className="bg-gradient-to-r from-pink-500 to-blue-500"
            >
              Create the first post
            </Button>
          </div>
        ) : (
          <div className="space-y-6">
            {posts.map((post) => (
              <PostCard key={post.id} post={post} onUpdate={() => loadPosts(false)} />
            ))}
          </div>
        )}
      </main>

      {/* Quick Actions Modal */}
      <QuickActionsModal
        open={showQuickActions}
        onClose={() => setShowQuickActions(false)}
        onActionSelect={handleQuickAction}
      />

      {/* Create Post Modal */}
      <CreatePostModal
        open={showCreatePost}
        onClose={() => setShowCreatePost(false)}
        onSuccess={handlePostCreated}
        defaultTab={defaultPostTab}
      />

      {/* Create Story Modal */}
      <CreateStoryModal
        open={showCreateStory}
        onClose={() => setShowCreateStory(false)}
        onSuccess={() => setShowCreateStory(false)}
      />

      {/* Bottom Navigation */}
      <BottomNav onQuickActionClick={() => setShowQuickActions(prev => !prev)} currentPage="feed" />
    </div>
  );
};

export default Feed;