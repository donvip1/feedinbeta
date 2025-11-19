import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PostCard } from '@/components/feed/PostCard';
import { InstagramStylePostCreator } from '@/components/feed/InstagramStylePostCreator';
import { QuickActionsModal } from '@/components/feed/QuickActionsModal';
import { BottomNav } from '@/components/navigation/BottomNav';
import { FloatingActionButton } from '@/components/navigation/FloatingActionButton';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

interface Post {
  id: string;
  feed_id: string;
  user_id: string;
  content: string | null;
  media_url: string | null;
  media_type: string | null;
  music_url: string | null;
  music_title: string | null;
  music_artist: string | null;
  likes_count: number;
  comments_count: number;
  views_count: number;
  refeeds_count: number;
  created_at: string;
  allow_refeed?: boolean | null;
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
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreatePost, setShowCreatePost] = useState(false);
  const [showQuickActions, setShowQuickActions] = useState(false);
  const [defaultPostTab, setDefaultPostTab] = useState<'text' | 'image' | 'video'>('text');
  const [activeTab, setActiveTab] = useState<'following' | 'forYou' | 'myPosts'>('forYou');
  const [sharedImageUrl, setSharedImageUrl] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [isCreatingContent, setIsCreatingContent] = useState(false);
  const [isCommenting, setIsCommenting] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [pullStartY, setPullStartY] = useState(0);
  const [isPulling, setIsPulling] = useState(false);
  const [highlightedPostId, setHighlightedPostId] = useState<string | null>(null);
  const [highlightedCommentId, setHighlightedCommentId] = useState<string | null>(null);

  // Initial load and visibility-based refresh
  useEffect(() => {
    if (authLoading) return;
    
    if (!user) {
      navigate('/auth');
      return;
    }
    
    // Store user ID for profile navigation
    localStorage.setItem('currentUserId', user.id);
    
    // Check if there's a shared image in location state
    const state = location.state as { sharedImage?: string; postId?: string; commentId?: string } | null;
    if (state?.sharedImage) {
      setSharedImageUrl(state.sharedImage);
      setDefaultPostTab('image');
      setShowCreatePost(true);
      // Clear the state
      navigate(location.pathname, { replace: true, state: {} });
    }
    
    // Initial load
    loadPosts();

    // Refresh when user returns to the page
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        loadPosts();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [user, authLoading, navigate]);

  // Handle notification navigation to specific post and comment
  useEffect(() => {
    const state = location.state as { postId?: string; commentId?: string } | null;
    if (state?.postId && posts.length > 0) {
      setHighlightedPostId(state.postId);
      setHighlightedCommentId(state.commentId || null);
      
      // Find the post and scroll to it
      setTimeout(() => {
        const postElement = document.getElementById(`post-${state.postId}`);
        if (postElement) {
          postElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 500);
      
      // Clear the state after handling
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [posts, location.state]);

  // Handle tab changes
  useEffect(() => {
    if (user && !authLoading) {
      loadPosts();
    }
  }, [activeTab]);

  const loadPosts = async () => {
    try {
      setLoading(true);
      
      // Get regular posts
      let query = supabase
        .from('posts')
        .select(`
          *,
          refeeds_count,
          profiles (
            display_name,
            username,
            avatar_url
          )
        `)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(20);

      // No search filter in regular query - search is handled separately
      if (!searchQuery) {
        // Filter based on active tab only when not searching
        if (activeTab === 'myPosts' && user) {
          query = query.eq('user_id', user.id);
        } else if (activeTab === 'following' && user) {
          // Get posts from users the current user follows
          const { data: following } = await supabase
            .from('follows')
            .select('following_id')
            .eq('follower_id', user.id);
          
          const followingIds = following?.map(f => f.following_id) || [];
          if (followingIds.length > 0) {
            query = query.in('user_id', followingIds);
          } else {
            setPosts([]);
            setLoading(false);
            return;
          }
        }
      }

      const { data, error } = await query;

      if (error) throw error;

      // Get refed posts for myPosts tab
      let refedPosts: Post[] = [];
      if (activeTab === 'myPosts' && user) {
        const { data: refeeds } = await supabase
          .from('refeeds')
          .select(`
            created_at,
            posts!inner (
              *,
              profiles (
                display_name,
                username,
                avatar_url
              )
            )
          `)
          .eq('refed_by_user_id', user.id)
          .order('created_at', { ascending: false });
        
        if (refeeds) {
          refedPosts = refeeds.map((r: any) => ({
            ...r.posts,
            is_refeed: true,
            refeed_date: r.created_at
          }));
        }
      }

      // Combine and sort posts
      const allPosts = [...(data || []), ...refedPosts];
      
      // Randomize for "For You" tab, otherwise sort by date
      const processed = activeTab === 'forYou' 
        ? allPosts.sort(() => Math.random() - 0.5)
        : allPosts.sort((a, b) => {
            const dateA = (a as any).refeed_date || a.created_at;
            const dateB = (b as any).refeed_date || b.created_at;
            return new Date(dateB).getTime() - new Date(dateA).getTime();
          });
      
      setPosts(processed);
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
    setIsCreatingContent(false);
    loadPosts();
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      loadPosts();
      return;
    }

    try {
      setIsSearching(true);
      setLoading(true);

      // Search for posts by content
      const { data: postData, error: postError } = await supabase
        .from('posts')
        .select(`
          *,
          refeeds_count,
          profiles (
            display_name,
            username,
            avatar_url
          )
        `)
        .eq('status', 'active')
        .or(`content.ilike.%${searchQuery}%`)
        .order('created_at', { ascending: false })
        .limit(20);

      if (postError) throw postError;

      // Search for posts by username or display name
      const { data: userData, error: userError } = await supabase
        .from('profiles')
        .select('id')
        .or(`display_name.ilike.%${searchQuery}%,username.ilike.%${searchQuery}%`)
        .limit(10);

      if (!userError && userData && userData.length > 0) {
        const userIds = userData.map(u => u.id);
        const { data: userPosts } = await supabase
          .from('posts')
          .select(`
            *,
            refeeds_count,
            profiles (
              display_name,
              username,
              avatar_url
            )
          `)
          .eq('status', 'active')
          .in('user_id', userIds)
          .order('created_at', { ascending: false })
          .limit(20);

        if (userPosts) {
          // Combine and deduplicate posts
          const allPosts = [...(postData || []), ...(userPosts || [])];
          const uniquePosts = Array.from(
            new Map(allPosts.map(post => [post.id, post])).values()
          );
          setPosts(uniquePosts as Post[]);
        } else {
          setPosts(postData || []);
        }
      } else {
        setPosts(postData || []);
      }

      if ((postData?.length || 0) === 0) {
        toast({
          title: 'No results found',
          description: 'Try different keywords',
        });
      }
    } catch (error: any) {
      toast({
        title: 'Search failed',
        description: error.message,
        variant: 'destructive',
      });
      // Fallback to regular posts
      loadPosts();
    } finally {
      setIsSearching(false);
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    if (searchQuery) {
      setSearchQuery('');
    }
    loadPosts();
  };

  // Pull-to-refresh handler
  const handleTouchStart = (e: React.TouchEvent) => {
    const scrollTop = (e.currentTarget as HTMLElement).scrollTop;
    if (scrollTop === 0) {
      setPullStartY(e.touches[0].clientY);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const scrollTop = (e.currentTarget as HTMLElement).scrollTop;
    if (scrollTop === 0 && pullStartY > 0) {
      const pullDistance = e.touches[0].clientY - pullStartY;
      if (pullDistance > 100) {
        setIsPulling(true);
      }
    }
  };

  const handleTouchEnd = () => {
    if (isPulling) {
      handleRefresh();
      setIsPulling(false);
    }
    setPullStartY(0);
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
      case 'learn-tech':
        navigate('/learn-tech');
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
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header with Tabs */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-lg border-b border-border">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="w-10"></div>
          
          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="flex-1">
            <TabsList className="bg-transparent border-0 h-auto p-0 flex justify-center items-center space-x-4">
              <TabsTrigger 
                value="following" 
                className="bg-transparent data-[state=active]:bg-transparent data-[state=active]:shadow-none border-0 text-muted-foreground data-[state=active]:text-foreground text-[9px] font-medium pb-1 px-2 data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none"
              >
                Following
              </TabsTrigger>
              <TabsTrigger 
                value="forYou" 
                className="bg-transparent data-[state=active]:bg-transparent data-[state=active]:shadow-none border-0 text-muted-foreground data-[state=active]:text-foreground text-[9px] font-medium pb-1 px-2 data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none"
              >
                For You
              </TabsTrigger>
              <TabsTrigger 
                value="myPosts" 
                className="bg-transparent data-[state=active]:bg-transparent data-[state=active]:shadow-none border-0 text-muted-foreground data-[state=active]:text-foreground text-[9px] font-medium pb-1 px-2 data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none"
              >
                My Posts
              </TabsTrigger>
              <button
                onClick={() => navigate('/live')}
                className="flex items-center gap-1 px-2 py-1 rounded-full bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-colors border border-red-500/20"
              >
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                </span>
                <span className="text-[9px] font-semibold">LIVE</span>
              </button>
            </TabsList>
          </Tabs>

          <div className="flex items-center space-x-2">
            <NotificationBell />
            <button 
              onClick={() => setShowSearch(!showSearch)}
              className="w-10 h-10 flex items-center justify-center"
            >
              {showSearch ? <X className="w-6 h-6 text-foreground" /> : <Search className="w-6 h-6 text-foreground" />}
            </button>
          </div>
        </div>
        
        {showSearch && (
          <div className="px-4 pb-3 flex gap-2">
            <Input
              placeholder="Search posts, users, hashtags..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="bg-card border-border text-foreground placeholder:text-muted-foreground flex-1"
            />
            <Button
              onClick={handleSearch}
              disabled={isSearching}
              size="sm"
              className="shrink-0"
            >
              {isSearching ? 'Searching...' : 'Search'}
            </Button>
          </div>
        )}
      </header>

      {/* Full-screen TikTok-style Feed */}
      <main 
        className="fixed inset-0 top-14 bottom-16 overflow-y-auto snap-y snap-mandatory scroll-smooth"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {isPulling && (
          <div className="absolute top-0 left-0 right-0 flex items-center justify-center py-2 bg-primary/10 text-primary z-50">
            <span className="text-sm font-medium">Release to refresh...</span>
          </div>
        )}
        <div className="max-w-md mx-auto">
          {loading ? (
            <div className="space-y-6 p-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-card rounded-2xl p-6 space-y-4">
                  <div className="flex items-center space-x-3">
                    <Skeleton className="w-12 h-12 rounded-full" />
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                  </div>
                  <Skeleton className="h-96 w-full" />
                </div>
              ))}
            </div>
          ) : posts.length === 0 ? (
            <div className="flex items-center justify-center h-full px-4">
              <div className="text-center">
                <p className="text-muted-foreground text-lg mb-4">
                  {activeTab === 'following' ? 'Follow users to see their posts' : 
                   activeTab === 'myPosts' ? 'Create your first post' : 
                   'No posts yet'}
                </p>
              </div>
            </div>
          ) : (
            <>
              {posts.map((post, index) => (
                <div 
                  key={post.id}
                  id={`post-${post.id}`}
                  className="snap-start snap-always min-h-screen flex items-start justify-center pt-4"
                  style={{ paddingBottom: index === posts.length - 1 ? '0' : '2vh' }}
                >
                  <PostCard 
                    post={post} 
                    onUpdate={loadPosts}
                    onCommentStateChange={setIsCommenting}
                    highlightCommentId={post.id === highlightedPostId ? highlightedCommentId || undefined : undefined}
                  />
                </div>
              ))}
            </>
          )}
        </div>
      </main>

      {/* Quick Actions Modal */}
      <QuickActionsModal
        open={showQuickActions}
        onClose={() => setShowQuickActions(false)}
        onActionSelect={handleQuickAction}
      />

      {/* Create Post Modal */}
      <InstagramStylePostCreator
        open={showCreatePost}
        onClose={() => {
          setShowCreatePost(false);
          setSharedImageUrl(null);
          setIsCreatingContent(false);
        }}
        onSuccess={handlePostCreated}
        defaultTab={defaultPostTab === 'text' ? 'text' : defaultPostTab === 'image' ? 'gallery' : 'camera'}
        initialImageUrl={sharedImageUrl || undefined}
      />

      {/* Floating Action Button */}
      <FloatingActionButton 
        onClick={() => setShowQuickActions(prev => !prev)}
        hidden={isCommenting || isCreatingContent}
      />

      {/* Bottom Navigation */}
      <BottomNav 
        currentPage="feed"
        hidden={isCommenting || isCreatingContent}
      />
    </div>
  );
};

export default Feed;