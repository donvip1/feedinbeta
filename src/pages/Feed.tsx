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
import NativeCreationSheet from '@/components/post/NativeCreationSheet';
import NativeCameraView from '@/components/post/NativeCameraView';
import NativeGalleryPicker from '@/components/post/NativeGalleryPicker';
import TextPostCreator from '@/components/post/TextPostCreator';
import PostDetails from '@/components/post/PostDetails';
import PostCard from '@/components/feed/PostCard';
import { CreateStoryModal } from '@/components/stories/CreateStoryModal';
import { useViewedPosts } from '@/hooks/useViewedPosts';
import { useScrollPosition } from '@/hooks/useScrollPosition';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { FeedSkeleton, PullToRefreshIndicator } from '@/components/native/NativeLoadingSpinner';
import { feedCache } from '@/lib/feed-cache';
import { usePageRefresh } from '@/context/RefreshContext';
import { SectionErrorBoundary } from '@/components/shared/SectionErrorBoundary';
import { QueryErrorFallback } from '@/components/shared/QueryErrorFallback';
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
  const { viewedPostIds, markAsViewed, hasViewedAllPosts, canCountView } = useViewedPosts();
  const initialViewedRef = useRef<string[]>([]);
  const hasInitializedRef = useRef(false);
  const [displayPosts, setDisplayPosts] = useState<any[]>([]);
  const allLoadedPostsRef = useRef<any[]>([]);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const allVideoPostsRef = useRef<any[]>([]); // Store all video posts for fullscreen navigation

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

  // Helper function to fetch posts directly as fallback
  const fetchFallbackPosts = async (excludeUserId?: string) => {
    const query = supabase
      .from('posts')
      .select(`
        *,
        profiles:user_id (username, display_name, avatar_url),
        original_post:original_post_id (
          id, user_id, content, media_url, media_type, media_urls, media_types, created_at,
          profiles:user_id (username, display_name, avatar_url)
        )
      `)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(50);

    if (excludeUserId) {
      query.neq('user_id', excludeUserId);
    }

    const { data, error } = await query;
    
    if (error) {
      console.error('Fallback posts error:', error);
      return [];
    }
    
    return (data || []).map(post => ({
      ...post,
      _isPromoted: false,
      _boostLevel: null,
      _relevanceScore: 0
    }));
  };

  // Fetch posts using personalized feed algorithms
  const { data: posts, isLoading, error: feedError, refetch } = useQuery({
    queryKey: ['feed-posts', activeTab, user?.id],
    queryFn: async () => {
      if (!user) return [];

      // Try cache first for instant display
      const cached = await feedCache.get(activeTab);
      if (cached && cached.length > 0) {
        setDisplayPosts(cached);
      }

      // Use the appropriate feed function based on tab
      let feedData: { post_id: string; is_promoted: boolean; boost_level: string; relevance_score?: number }[] = [];
      let useFallback = false;
      
      try {
        if (activeTab === 'following') {
          // Following tab: Only posts from people user follows
          const { data, error } = await supabase.rpc('get_following_feed', {
            p_user_id: user.id,
            p_limit: 100,
            p_offset: 0
          });
          
          if (error) {
            console.error('Following feed error:', error);
            useFallback = true;
          } else {
            feedData = data || [];
          }
        } else {
          // For You tab: Personalized feed based on interests, location, engagement
          const { data, error } = await supabase.rpc('get_personalized_for_you_feed', {
            p_user_id: user.id,
            p_limit: 100,
            p_offset: 0
          });
          
          if (error) {
            console.error('For You feed error:', error);
            useFallback = true;
          } else {
            feedData = data || [];
          }
        }
      } catch (err) {
        console.error('Feed RPC error:', err);
        useFallback = true;
      }

      // If RPC failed, use fallback query
      if (useFallback) {
        return await fetchFallbackPosts(user.id);
      }

      // If no posts from algorithm
      if (feedData.length === 0) {
        // For Following tab with no followed users, return empty
        if (activeTab === 'following') {
          return [];
        }
        // For You fallback: get recent posts
        return await fetchFallbackPosts(user.id);
      }

      // Create maps for promotion data
      const promotedMap = new Map(feedData.map(p => [p.post_id, { 
        is_promoted: p.is_promoted, 
        boost_level: p.boost_level,
        relevance_score: (p as any).relevance_score || 0
      }]));

      // Get post IDs to fetch full data
      const postIds = feedData.map(p => p.post_id);

      // Fetch full post data
      const { data: fullPosts, error: postsError } = await supabase
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
        .in('id', postIds);

      if (postsError) {
        console.error('Posts fetch error:', postsError);
        // Fallback if post fetch fails
        return await fetchFallbackPosts(user.id);
      }

      // Sort posts by the order returned from the feed function (preserves ranking)
      const postMap = new Map((fullPosts || []).map(p => [p.id, p]));
      const orderedPosts = postIds
        .map(id => postMap.get(id))
        .filter(Boolean)
        .map(post => {
          const promo = promotedMap.get(post!.id);
          return {
            ...post!,
            _isPromoted: promo?.is_promoted || false,
            _boostLevel: promo?.boost_level || null,
            _relevanceScore: promo?.relevance_score || 0,
            _promoterName: null
          };
        });

      // If no posts after mapping, use fallback
      if (orderedPosts.length === 0) {
        return await fetchFallbackPosts(user.id);
      }

      // Store all video posts for fullscreen navigation
      allVideoPostsRef.current = orderedPosts.filter(p => 
        p.media_type === 'video' || 
        ((p.post_type === 'refeed' || p.post_type === 'quote') && p.original_post?.media_type === 'video')
      );

      // Store all posts for infinite scroll
      allLoadedPostsRef.current = orderedPosts;
      
      // Cache the results
      feedCache.set(activeTab, orderedPosts);

      return orderedPosts;
    },
    enabled: !!user,
    staleTime: 30000,
    refetchOnWindowFocus: false,
    refetchOnMount: true,
  });

  // Subscribe to silent refresh from navigation
  usePageRefresh('feed', useCallback(() => {
    // Silent background refetch - no loading indicators
    refetch();
  }, [refetch]));

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
        {feedError && displayPosts.length === 0 ? (
          <div className="p-4">
            <QueryErrorFallback 
              error={feedError as Error} 
              onRetry={() => refetch()} 
              message="Unable to load your feed. Please try again."
            />
          </div>
        ) : isLoading && displayPosts.length === 0 ? (
          <FeedSkeleton />
        ) : displayPosts && displayPosts.length > 0 ? (
          <SectionErrorBoundary sectionName="Feed Posts" onRetry={() => refetch()}>
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
                    isPromoted={post._isPromoted || false}
                    promoterName={post._promoterName}
                    boostLevel={post._boostLevel}
                    allPosts={displayPosts}
                    allVideoPosts={allVideoPostsRef.current}
                    onLikeUpdate={() => refetch()}
                    onCommentsOpenChange={setIsCommentsOpen}
                    onInteractionStart={handleInteractionStart}
                    onInteractionEnd={handleInteractionEnd}
                    onView={() => markAsViewed(post.id)}
                    onMarkAsViewed={markAsViewed}
                  />
                </div>
              );
            })}
          </SectionErrorBoundary>
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

      {/* Native Creation Sheet */}
      <NativeCreationSheet
        open={postStep === 'selector'}
        onClose={() => setPostStep(null)}
        onCameraSelect={() => setPostStep('camera')}
        onGallerySelect={() => setPostStep('gallery')}
        onStorySelect={() => setPostStep('story')}
        onTextSelect={() => setPostStep('text')}
      />

      {/* Native Camera */}
      {postStep === 'camera' && (
        <NativeCameraView
          onCapture={(media) => {
            setSelectedMedia([media]);
            setPostStep('gallery');
          }}
          onClose={() => setPostStep(null)}
          onGalleryOpen={() => setPostStep('gallery')}
        />
      )}

      {/* Native Gallery Picker */}
      {postStep === 'gallery' && selectedMedia.length === 0 && (
        <NativeGalleryPicker
          open={true}
          onClose={() => setPostStep(null)}
          onSelect={(items) => {
            setSelectedMedia(items);
          }}
          onCameraOpen={() => setPostStep('camera')}
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
