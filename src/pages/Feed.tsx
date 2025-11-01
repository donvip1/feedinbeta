import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { PostCard } from '@/components/feed/PostCard';
import { CreatePostModal } from '@/components/feed/CreatePostModal';
import { QuickActionsModal } from '@/components/feed/QuickActionsModal';
import { StoriesBar } from '@/components/stories/StoriesBar';
import { CreateStoryModal } from '@/components/stories/CreateStoryModal';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import { BottomNav } from '@/components/navigation/BottomNav';
import { LogOut, MessageSquare, Settings as SettingsIcon } from 'lucide-react';
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
  const [showCreatePost, setShowCreatePost] = useState(false);
  const [showQuickActions, setShowQuickActions] = useState(false);
  const [showCreateStory, setShowCreateStory] = useState(false);
  const [defaultPostTab, setDefaultPostTab] = useState<'text' | 'image' | 'video'>('text');

  useEffect(() => {
    if (authLoading) return; // Wait for auth to load
    
    if (!user) {
      navigate('/auth');
      return;
    }
    loadPosts();
  }, [user, authLoading, navigate]);

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
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      setPosts(data || []);
    } catch (error: any) {
      toast({
        title: 'Error loading posts',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePostCreated = () => {
    setShowCreatePost(false);
    loadPosts();
  };

  const handleQuickAction = (action: string) => {
    switch (action) {
      case 'thoughts':
        setDefaultPostTab('text');
        setShowCreatePost(true);
        break;
      case 'photo':
        setDefaultPostTab('image');
        setShowCreatePost(true);
        break;
      case 'video':
        setDefaultPostTab('video');
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
      case 'ai':
        navigate('/ai-copilot');
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
      <header className="sticky top-0 z-50 bg-black/80 backdrop-blur-lg border-b border-gray-800">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <img src={feedinLogo} alt="FEEDIN" className="w-10 h-10" />
              <span className="text-xl font-bold bg-gradient-primary bg-clip-text text-transparent">
                FEEDIN
              </span>
            </div>
            <div className="flex items-center space-x-2">
              <NotificationBell />
              <Button
                onClick={() => navigate('/messages')}
                size="sm"
                variant="ghost"
                className="text-gray-400 hover:text-white"
              >
                <MessageSquare className="w-4 h-4" />
              </Button>
              <Button
                onClick={() => navigate(`/profile/${user?.id}`)}
                size="sm"
                variant="ghost"
                className="text-gray-400 hover:text-white"
              >
                <img
                  src={user?.user_metadata?.avatar_url || ''}
                  alt="Profile"
                  className="w-6 h-6 rounded-full"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                    e.currentTarget.nextElementSibling?.classList.remove('hidden');
                  }}
                />
                <div className="w-6 h-6 rounded-full bg-gray-700 hidden flex items-center justify-center text-xs">
                  {user?.user_metadata?.display_name?.[0] || 'U'}
                </div>
              </Button>
              <Button
                onClick={() => navigate('/settings')}
                size="sm"
                variant="ghost"
                className="text-gray-400 hover:text-white"
              >
                <SettingsIcon className="w-4 h-4" />
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
              <PostCard key={post.id} post={post} onUpdate={loadPosts} />
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
      <BottomNav onQuickActionClick={() => setShowQuickActions(true)} currentPage="feed" />
    </div>
  );
};

export default Feed;