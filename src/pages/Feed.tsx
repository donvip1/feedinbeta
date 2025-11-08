import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useFeed } from '@/hooks/useFeed';


import { PostCard } from '@/components/feed/PostCard';
import { PostSkeleton } from '@/components/shared/SkeletonLoader';
import { EnhancedCreatePostModal } from '@/components/feed/EnhancedCreatePostModal';
import { QuickActionsModal } from '@/components/feed/QuickActionsModal';
import { BottomNav } from '@/components/navigation/BottomNav';
import { NotificationBadge } from '@/components/notifications/NotificationBadge';
import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';

interface Post {
  id: string;
  feed_id: string;
  user_id: string;
  content: string | null;
  media_url: string | null;
  media_type: string | null;
  aspect_ratio?: string;
  has_blur_background?: boolean;
  moderation_status?: string;
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
  const location = useLocation();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [showCreatePost, setShowCreatePost] = useState(false);
  const [showQuickActions, setShowQuickActions] = useState(false);
  const [defaultPostTab, setDefaultPostTab] = useState<'text' | 'image' | 'video'>('text');
  const [activeTab, setActiveTab] = useState<'following' | 'forYou' | 'myPosts'>('forYou');
  const [sharedImageUrl, setSharedImageUrl] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [isCreatingContent, setIsCreatingContent] = useState(false);

  const { posts, loading, hasMore, loadMore, refreshPosts } = useFeed({
    userId: user?.id,
    activeTab,
    searchQuery,
  });

  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = loadMoreRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting && hasMore && !loading) {
          loadMore();
        }
      },
      { threshold: 0.1, rootMargin: '100px' }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, loading, loadMore]);

  useEffect(() => {
    if (authLoading) return;
    
    if (!user) {
      navigate('/auth');
      return;
    }
    
    // Store user ID for profile navigation
    localStorage.setItem('currentUserId', user.id);
    
    // Check if there's a shared image in location state
    const state = location.state as { sharedImage?: string } | null;
    if (state?.sharedImage) {
      setSharedImageUrl(state.sharedImage);
      setDefaultPostTab('image');
      setShowCreatePost(true);
      // Clear the state
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [user, authLoading, navigate]);

  const handlePostCreated = () => {
    setShowCreatePost(false);
    setIsCreatingContent(false);
    refreshPosts();
  };

  const handleQuickAction = (action: string) => {
    setIsCreatingContent(true);
    switch (action) {
      case 'thoughts':
        setDefaultPostTab('text');
        setShowCreatePost(true);
        break;
      case 'story':
        navigate('/messages');
        setIsCreatingContent(false);
        break;
      case 'group':
        navigate('/groups');
        setIsCreatingContent(false);
        break;
      case 'livestream':
        navigate('/live');
        setIsCreatingContent(false);
        break;
      case 'wallet':
        navigate('/wallet');
        setIsCreatingContent(false);
        break;
      case 'p2p':
        navigate('/p2p-marketplace');
        setIsCreatingContent(false);
        break;
      case 'ai':
        navigate('/ai-copilot');
        setIsCreatingContent(false);
        break;
      case 'marketplace':
        navigate('/p2p-marketplace');
        setIsCreatingContent(false);
        break;
      default:
        toast({
          title: 'Coming Soon',
          description: `${action} feature is coming soon!`,
        });
        setIsCreatingContent(false);
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
      {/* TikTok-style Header with Tabs */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-black/80 backdrop-blur-lg">
        <div className="flex items-center justify-between px-4 py-3">
          <NotificationBadge />
          
          {/* Simple Tabs (no Radix) */}
          <div className="flex-1 flex items-center justify-center space-x-6">
            {([
              { key: 'following', label: 'Following' },
              { key: 'forYou', label: 'For You' },
              { key: 'myPosts', label: 'My Posts' },
            ] as const).map(t => (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key)}
                className={`text-base font-semibold pb-1 border-b-2 transition-colors ${
                  activeTab === t.key ? 'text-white border-white' : 'text-gray-400 border-transparent'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <button 
            onClick={() => setShowSearch(!showSearch)}
            className="w-10 h-10 flex items-center justify-center"
          >
            {showSearch ? <X className="w-6 h-6 text-white" /> : <Search className="w-6 h-6 text-white" />}
          </button>
        </div>
        
        {showSearch && (
          <div className="px-4 pb-3">
            <Input
              placeholder="Search posts, users, hashtags..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-gray-900 border-gray-800 text-white placeholder:text-gray-500"
            />
          </div>
        )}
      </header>

      {/* Full-screen TikTok-style Feed */}
      <main className="fixed inset-0 top-14 bottom-16 overflow-y-auto snap-y snap-mandatory scroll-smooth">
        {posts.length === 0 && !loading ? (
          <div className="flex items-center justify-center h-full px-4">
            <div className="text-center">
              <p className="text-gray-400 text-lg mb-4">
                {activeTab === 'following' ? 'Follow users to see their posts' : 
                 activeTab === 'myPosts' ? 'Create your first post' : 
                 'No posts yet'}
              </p>
            </div>
          </div>
        ) : (
          <>
            {posts.map((post) => (
              <div 
                key={post.id} 
                className="snap-start snap-always h-full w-full flex items-center justify-center px-4 py-2"
              >
                <div className="w-full h-full max-w-2xl">
                  <PostCard post={post} onUpdate={refreshPosts} />
                </div>
              </div>
            ))}
            
            {/* Infinite scroll trigger */}
            <div ref={loadMoreRef} className="h-20 flex items-center justify-center">
              {loading && (
                <div className="space-y-6 p-4 w-full max-w-2xl">
                  <PostSkeleton />
                </div>
              )}
            </div>
          </>
        )}
      </main>

      {/* Quick Actions Modal */}
      <QuickActionsModal
        open={showQuickActions}
        onClose={() => setShowQuickActions(false)}
        onActionSelect={handleQuickAction}
      />

      {/* Create Post Modal */}
      <EnhancedCreatePostModal
        open={showCreatePost}
        onClose={() => {
          setShowCreatePost(false);
          setSharedImageUrl(null);
          setIsCreatingContent(false);
        }}
        onSuccess={handlePostCreated}
        defaultTab={defaultPostTab}
        initialImageUrl={sharedImageUrl}
      />

      {/* Bottom Navigation */}
      <BottomNav 
        onQuickActionClick={() => setShowQuickActions(prev => !prev)} 
        currentPage="feed"
        minimized={showQuickActions || isCreatingContent}
      />
    </div>
  );
};

export default Feed;
