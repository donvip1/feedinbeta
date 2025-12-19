import { useState, useEffect, useRef, useCallback, Suspense, lazy } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { BottomNav } from '@/components/navigation/BottomNav';
import { FloatingActionButton } from '@/components/navigation/FloatingActionButton';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import { Search, TrendingUp, Radio } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import TikTokPortraitPostFlow from '@/components/post/TikTokPortraitPostFlow';
import PostCreationSelector from '@/components/post/PostCreationSelector';
import TextPostCreator from '@/components/post/TextPostCreator';
import PostDetails from '@/components/post/PostDetails';
import PostCard from '@/components/feed/PostCard';
import { CreateStoryModal } from '@/components/stories/CreateStoryModal';
import { useViewedPosts } from '@/hooks/useViewedPosts';
import { useScrollPosition } from '@/hooks/useScrollPosition';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { FeedSkeleton, PullToRefreshIndicator } from '@/components/native/NativeLoadingSpinner';
import { feedCache } from '@/lib/feed-cache';

const Feed = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<'following' | 'forYou'>('forYou');
  const { containerRef } = useScrollPosition('feed');
  const [postStep, setPostStep] = useState<'selector' | 'camera' | 'gallery' | 'story' | 'text' | null>(null);
  const [selectedMedia, setSelectedMedia] = useState<{ url: string; type: 'image' | 'video'; file: File }[]>([]);
  const [currentMediaIndex, setCurrentMediaIndex] = useState(0);
  const [isCommentsOpen, setIsCommentsOpen] = useState(false);
  const [isInteracting, setIsInteracting] = useState(false);
  const [showNav, setShowNav] = useState(true);
  const scrollTimeout = useRef<NodeJS.Timeout | null>(null);
  const lastScrollY = useRef(0);
  const { viewedPostIds, markAsViewed } = useViewedPosts();
  const initialViewedRef = useRef<string[]>([]);
  const hasInitializedRef = useRef(false);
  const [displayPosts, setDisplayPosts] = useState<any[]>([]);
  const allLoadedPostsRef = useRef<any[]>([]);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);

  // Capture viewed posts only once when component mounts or tab changes
  useEffect(() => {
    if (!hasInitializedRef.current) {
      initialViewedRef.current = [...viewedPostIds];
      hasInitializedRef.current = true;
    }
  }, []);

  // Reset when tab changes
  useEffect(() => {
    initialViewedRef.current = [...viewedPostIds];
  }, [activeTab]);

  // Fetch posts with cache-first strategy
  const { data: posts, isLoading, refetch } = useQuery({
    queryKey: ['feed-posts', activeTab],
    queryFn: async () => {
      // Try cache first for instant display
      const cached = await feedCache.get(activeTab);
      if (cached && cached.length > 0) {
        setDisplayPosts(cached);
      }
      // Get active promotions first
      const { data: promotions } = await supabase
        .from('post_promotions')
        .select('post_id, boost_level')
        .eq('is_active', true)
        .gt('expires_at', new Date().toISOString());

      const promotedPostIds = new Set(promotions?.map(p => p.post_id) || []);
      const promotionLevels: Record<string, string> = {};
      promotions?.forEach(p => { promotionLevels[p.post_id] = p.boost_level; });

      let query = supabase
        .from('posts')
        .select(`
          *,
          profiles:user_id (
            username,
            display_name,
            avatar_url
          ),
          original_post:original_post_id (
            id,
            user_id,
            content,
            media_url,
            media_type,
            media_urls,
            media_types,
            created_at,
            profiles:user_id (
              username,
              display_name,
              avatar_url
            )
          )
        `)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(100); // Fetch more posts for infinite scroll

      if (activeTab === 'following' && user) {
        const { data: following } = await supabase
          .from('follows')
          .select('following_id')
          .eq('follower_id', user.id);

        const followingIds = following?.map(f => f.following_id) || [];
        if (followingIds.length > 0) {
          query = query.in('user_id', followingIds);
        } else {
          return [];
        }
      }

      const { data, error } = await query;
      if (error) throw error;

      const allPosts = data || [];
      const viewedAtLoad = initialViewedRef.current;
      
      // Separate unviewed and viewed posts based on initial state
      const unviewedPosts = allPosts.filter(p => !viewedAtLoad.includes(p.id));
      const viewedPosts = allPosts.filter(p => viewedAtLoad.includes(p.id));

      // Sort by promotion priority, then by date
      const sortByPriority = (postsToSort: typeof allPosts) => {
        return [...postsToSort].sort((a, b) => {
          const aPriority = promotedPostIds.has(a.id) 
            ? (promotionLevels[a.id] === 'premium' ? 3 : promotionLevels[a.id] === 'standard' ? 2 : 1) 
            : 0;
          const bPriority = promotedPostIds.has(b.id) 
            ? (promotionLevels[b.id] === 'premium' ? 3 : promotionLevels[b.id] === 'standard' ? 2 : 1) 
            : 0;
          
          if (aPriority !== bPriority) return bPriority - aPriority;
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        });
      };

      // Prioritize unviewed posts - NO DUPLICATES
      let finalPosts = sortByPriority(unviewedPosts);
      
      // Store all posts for infinite scroll looping
      allLoadedPostsRef.current = sortByPriority(allPosts);
      // Cache the results
      feedCache.set(activeTab, sortByPriority(allPosts));

      return finalPosts;
    },
    enabled: !!user,
    staleTime: Infinity, // Don't refetch while on the page
    refetchOnWindowFocus: false,
    refetchOnMount: true,
  });

  // Initialize display posts and handle infinite scroll
  useEffect(() => {
    if (posts) {
      setDisplayPosts(posts);
    }
  }, [posts]);

  // Infinite scroll handler
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      const isNearBottom = scrollTop + clientHeight >= scrollHeight - 500;

      if (isNearBottom && allLoadedPostsRef.current.length > 0) {
        // Append posts from the beginning to create infinite loop
        // User won't know they've reached the end
        setDisplayPosts(prev => {
          const currentIds = new Set(prev.map(p => p.id));
          const postsToAdd = allLoadedPostsRef.current.filter(p => !currentIds.has(p.id));
          
          if (postsToAdd.length > 0) {
            return [...prev, ...postsToAdd.slice(0, 10)];
          }
          
          // If all posts are shown, start from beginning with unique keys
          const startIndex = prev.length % allLoadedPostsRef.current.length;
          const cyclePosts = allLoadedPostsRef.current.slice(startIndex, startIndex + 10).map((p, i) => ({
            ...p,
            _cycleKey: `${p.id}-cycle-${Date.now()}-${i}` // Unique key for each cycle
          }));
          return [...prev, ...cyclePosts];
        });
      }
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, []);

  // Pause all videos when notification panel opens
  const handleNotificationPanelOpen = () => {
    setIsNotificationOpen(true);
    // Pause all videos by dispatching a custom event
    document.querySelectorAll('video').forEach((video) => {
      if (!video.paused) {
        video.pause();
      }
    });
  };

  const handleNotificationPanelClose = () => {
    setIsNotificationOpen(false);
  };

  useEffect(() => {
    if (authLoading) return;
    
    if (!user) {
      navigate('/auth');
      return;
    }
    
    localStorage.setItem('currentUserId', user.id);
  }, [user, authLoading, navigate]);

  useEffect(() => {
    const handleScroll = () => {
      // Hide nav when user is interacting or scrolling
      if (isInteracting) {
        setShowNav(false);
        return;
      }

      setShowNav(false);
      
      // Clear existing timeout
      if (scrollTimeout.current) {
        clearTimeout(scrollTimeout.current);
      }

      // Show nav after user stops scrolling
      scrollTimeout.current = setTimeout(() => {
        if (!isInteracting) {
          setShowNav(true);
        }
      }, 150);

      lastScrollY.current = window.scrollY;
    };

    window.addEventListener('scroll', handleScroll);
    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (scrollTimeout.current) {
        clearTimeout(scrollTimeout.current);
      }
    };
  }, [isInteracting]);

  const handleInteractionStart = () => {
    setIsInteracting(true);
    setShowNav(false);
  };

  const handleInteractionEnd = () => {
    setIsInteracting(false);
    setShowNav(true);
  };

  const handleCreatePost = () => {
    setPostStep('selector');
  };

  const handlePostSubmit = () => {
    setPostStep(null);
    refetch();
  };

  const handleGalleryMediaSelect = (files: { url: string; type: 'image' | 'video'; file: File }[]) => {
    setSelectedMedia(files);
    setCurrentMediaIndex(0);
    setPostStep('gallery');
  };

  const handleMediaEdit = (editedMedia: { url: string; type: 'image' | 'video'; file: File }) => {
    // For now, just go to details - can add multi-media editing later
    setPostStep('gallery');
  };

  return (
    <div className="min-h-screen bg-background pb-16 native-feed-container">
      <div className="sticky top-0 z-50 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="flex items-center justify-between px-3 py-2 max-w-2xl mx-auto">
          <NotificationBell 
            onPanelOpen={handleNotificationPanelOpen}
            onPanelClose={handleNotificationPanelClose}
          />
          
          <div className="flex items-center gap-4">
            <button
              onClick={() => setActiveTab('following')}
              className={`text-sm font-semibold transition-all ${
                activeTab === 'following'
                  ? 'text-foreground'
                  : 'text-muted-foreground'
              }`}
            >
              Following
            </button>
            <button
              onClick={() => setActiveTab('forYou')}
              className={`text-sm font-semibold transition-all ${
                activeTab === 'forYou'
                  ? 'text-foreground'
                  : 'text-muted-foreground'
              }`}
            >
              For You
            </button>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/trending')}
            >
              <TrendingUp className="w-5 h-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/search')}
            >
              <Search className="w-5 h-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/live')}
              className="relative"
            >
              <Radio className="w-5 h-5 text-red-500" fill="currentColor" />
            </Button>
          </div>
        </div>
      </div>

      <div
        ref={containerRef}
        className="max-w-2xl mx-auto snap-y snap-mandatory overflow-y-scroll h-[calc(100vh-8rem)] scroll-smooth native-scroll-container"
        data-scrollable="true"
      >
        {isLoading && displayPosts.length === 0 ? (
          <FeedSkeleton />
        ) : displayPosts && displayPosts.length > 0 ? (
          <>
            {displayPosts.map((post) => {
              // Styled text posts and media posts should be full height
              // Plain text posts without background should be compact
              const isStyledText = post.media_type === 'text_styled' && post.media_url && post.content;
              const isMedia = post.media_url && post.media_type !== 'text_styled';
              const isPlainText = !post.media_url && post.content;
              
              const wrapperClass = (isStyledText || isMedia)
                ? "snap-start snap-always h-[calc(100vh-8rem)] flex items-start" 
                : "snap-start mb-4";
              
              // Use _cycleKey if present (for infinite scroll cycles), otherwise use id
              const uniqueKey = post._cycleKey || post.id;
              
              return (
                <div key={uniqueKey} className={wrapperClass}>
                  <PostCard
                    post={post}
                    allPosts={displayPosts}
                    onLikeUpdate={() => refetch()}
                    onCommentsOpenChange={setIsCommentsOpen}
                    onInteractionStart={handleInteractionStart}
                    onInteractionEnd={handleInteractionEnd}
                    onView={() => markAsViewed(post.id)}
                  />
                </div>
              );
            })}
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-[60vh] text-center px-4">
            <p className="text-muted-foreground mb-2">No posts yet</p>
            <p className="text-sm text-muted-foreground">
              {activeTab === 'following' 
                ? 'Follow some users to see their posts here' 
                : 'Be the first to create a post!'}
            </p>
          </div>
        )}
      </div>

      <BottomNav hidden={isCommentsOpen || !showNav || postStep !== null} />
      
      {/* Quick Action Button - positioned below feed cards */}
      <FloatingActionButton 
        onClick={handleCreatePost}
        hidden={isCommentsOpen || !showNav || postStep !== null}
      />

      {postStep === 'selector' && (
        <PostCreationSelector
          onCameraSelect={() => setPostStep('camera')}
          onGallerySelect={() => {
            // Open the media gallery picker as a separate step
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = 'image/*,video/*';
            input.multiple = true;
            input.onchange = (e: Event) => {
              const target = e.target as HTMLInputElement;
              const files = Array.from(target.files || []);
              if (files.length > 0) {
                const mediaFiles = files.map(file => ({
                  url: URL.createObjectURL(file),
                  type: (file.type.startsWith('video/') ? 'video' : 'image') as 'image' | 'video',
                  file,
                }));
                handleGalleryMediaSelect(mediaFiles);
              }
            };
            input.click();
            setPostStep(null);
          }}
          onStorySelect={() => setPostStep('story')}
          onTextSelect={() => setPostStep('text')}
          onClose={() => setPostStep(null)}
        />
      )}

      {postStep === 'camera' && (
        <TikTokPortraitPostFlow
          onClose={() => setPostStep(null)}
          onSubmit={handlePostSubmit}
        />
      )}
      {postStep === 'story' && (
        <CreateStoryModal
          open={true}
          onClose={() => setPostStep(null)}
          onSuccess={() => {
            setPostStep(null);
            toast({
              title: 'Story created!',
              description: 'Your story has been shared.',
            });
          }}
        />
      )}
      {postStep === 'text' && (
        <TextPostCreator
          onClose={() => setPostStep(null)}
          onSubmit={handlePostSubmit}
        />
      )}
      {postStep === 'gallery' && selectedMedia.length > 0 && (
        <PostDetails
          media={selectedMedia}
          onSubmit={handlePostSubmit}
          onClose={() => {
            setPostStep(null);
            setSelectedMedia([]);
            setCurrentMediaIndex(0);
          }}
        />
      )}
    </div>
  );
};

export default Feed;
