import { useState, useEffect, useRef, useCallback } from 'react';
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
import { FeedSkeleton } from '@/components/native/NativeLoadingSpinner';
import { LiveFeedCard } from '@/components/feed/LiveFeedCard';
import { feedCache } from '@/lib/feed-cache';
import { usePageRefresh } from '@/context/RefreshContext';
import { SectionErrorBoundary } from '@/components/shared/SectionErrorBoundary';
import { QueryErrorFallback } from '@/components/shared/QueryErrorFallback';
import { useOfflineMode } from '@/hooks/useOfflineMode';
import { OfflineBanner } from '@/components/shared/OfflineBanner';
import { InfiniteScrollSkeleton } from '@/components/feed/InfiniteScrollSkeleton';
import { PullToRefresh } from '@/components/feed/PullToRefresh';
import { SwipeableTabs } from '@/components/feed/SwipeableTabs';
import { useNativeFeatures } from '@/hooks/useNativeFeatures';

const Feed = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const { haptic } = useNativeFeatures();
  const [activeTab, setActiveTab] = useState<'following' | 'forYou' | 'live'>('forYou');
  
  // Tab configuration for swipe gestures
  const tabs: ('following' | 'forYou' | 'live')[] = ['following', 'forYou', 'live'];
  const activeTabIndex = tabs.indexOf(activeTab);
  
  const handleTabChange = useCallback((index: number) => {
    setActiveTab(tabs[index]);
  }, []);
  const { containerRef: scrollContainerRef } = useScrollPosition('feed');
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
  const allVideoPostsRef = useRef<any[]>([]);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // Fetch live content count for indicator (always enabled)
  const { data: liveCount, refetch: refetchLiveCount } = useQuery({
    queryKey: ['feed-live-count'],
    queryFn: async () => {
      const [{ count: streamsCount }, { count: spacesCount }] = await Promise.all([
        supabase.from('live_streams').select('*', { count: 'exact', head: true }).eq('status', 'live'),
        supabase.from('live_spaces').select('*', { count: 'exact', head: true }).eq('status', 'live'),
      ]);
      return (streamsCount || 0) + (spacesCount || 0);
    },
    refetchInterval: 10000, // Refresh every 10 seconds to catch new live content
  });

  // Fetch live content for the Live tab
  const { data: liveContent, refetch: refetchLive } = useQuery({
    queryKey: ['feed-live-content'],
    queryFn: async () => {
      console.log('[Feed] Fetching live content...');
      // Fetch live streams
      const { data: streams, error: streamsError } = await supabase
        .from('live_streams')
        .select('id, title, status, viewer_count, thumbnail_url, user_id')
        .eq('status', 'live')
        .order('viewer_count', { ascending: false })
        .limit(20);

      if (streamsError) console.error('[Feed] Error fetching streams:', streamsError);
      console.log('[Feed] Live streams found:', streams?.length || 0);

      // Fetch live spaces
      const { data: spaces, error: spacesError } = await supabase
        .from('live_spaces')
        .select('id, title, status, viewer_count, topic_category, share_link, user_id')
        .eq('status', 'live')
        .order('viewer_count', { ascending: false })
        .limit(20);

      if (spacesError) console.error('[Feed] Error fetching spaces:', spacesError);
      console.log('[Feed] Live spaces found:', spaces?.length || 0);

      const allUserIds = [
        ...(streams || []).map(s => s.user_id),
        ...(spaces || []).map(s => s.user_id)
      ];

      if (allUserIds.length === 0) {
        console.log('[Feed] No live content found');
        return [];
      }

      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, display_name, username, avatar_url')
        .in('id', allUserIds);

      const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

      const liveItems = [
        ...(streams || []).map(s => ({
          ...s,
          type: 'video' as const,
          host: profileMap.get(s.user_id) || { display_name: 'Unknown', username: 'unknown', avatar_url: '' }
        })),
        ...(spaces || []).map(s => ({
          ...s,
          type: 'space' as const,
          host: profileMap.get(s.user_id) || { display_name: 'Unknown', username: 'unknown', avatar_url: '' }
        }))
      ];

      console.log('[Feed] Total live items:', liveItems.length);

      // Sort by viewer count
      return liveItems.sort((a, b) => (b.viewer_count || 0) - (a.viewer_count || 0));
    },
    enabled: activeTab === 'live',
    refetchInterval: 15000, // Refresh every 15 seconds when on live tab
    staleTime: 5000,
  });

  // Subscribe to live content changes for real-time updates
  useEffect(() => {
    const channel = supabase
      .channel('feed-live-updates')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'live_streams',
      }, () => {
        console.log('[Feed] Live streams updated');
        refetchLiveCount();
        if (activeTab === 'live') refetchLive();
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'live_spaces',
      }, () => {
        console.log('[Feed] Live spaces updated');
        refetchLiveCount();
        if (activeTab === 'live') refetchLive();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeTab, refetchLive, refetchLiveCount]);
  
  // Offline mode support
  const { isOffline, cachedPosts, lastSyncTime, updateSyncTime } = useOfflineMode(user?.id);

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

      // Try cache first for instant display (don't wait for network)
      const cacheKey = activeTab === 'live' ? 'forYou' : activeTab;
      const cached = await feedCache.get(cacheKey as 'following' | 'forYou');
      if (cached && cached.length > 0) {
        // Set display posts immediately from cache
        setDisplayPosts(cached);
        allLoadedPostsRef.current = cached;
        allVideoPostsRef.current = cached.filter((p: any) => 
          p.media_type === 'video' || 
          ((p.post_type === 'refeed' || p.post_type === 'quote') && p.original_post?.media_type === 'video')
        );
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

      // If no posts from algorithm, always use fallback (never show empty)
      if (feedData.length === 0) {
        // Both tabs should fall back to trending/recent posts - never empty
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
      const cacheKeySet = activeTab === 'live' ? 'forYou' : activeTab;
      feedCache.set(cacheKeySet as 'following' | 'forYou', orderedPosts);

      return orderedPosts;
    },
    enabled: !!user,
    staleTime: 30000,
    refetchOnWindowFocus: false,
    refetchOnMount: true,
  });

  // Pull-to-refresh with haptic feedback - defined after refetch is available
  const handleRefresh = useCallback(async () => {
    if (isOffline) {
      toast({
        title: "You're offline",
        description: 'Connect to the internet to refresh.',
        variant: 'destructive',
      });
      return;
    }
    await refetch();
    updateSyncTime();
    toast({
      title: 'Feed refreshed',
      description: 'You\'re up to date!',
    });
  }, [isOffline, refetch, updateSyncTime, toast]);

  const { 
    containerRef, 
    isPulling, 
    pullDistance, 
    pullProgress, 
    isRefreshing 
  } = usePullToRefresh({
    onRefresh: handleRefresh,
    threshold: 80,
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

  // Infinite scroll handler with skeleton loading
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let debounceTimer: NodeJS.Timeout | null = null;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      const isNearBottom = scrollTop + clientHeight >= scrollHeight - 500;

      if (isNearBottom && allLoadedPostsRef.current.length > 0 && !isLoadingMore) {
        // Show skeleton loading
        setIsLoadingMore(true);
        
        // Debounce loading more posts
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
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
              _cycleKey: `${p.id}-cycle-${Date.now()}-${i}`
            }));
            return [...prev, ...cyclePosts];
          });
          setIsLoadingMore(false);
        }, 300);
      }
    };

    container.addEventListener('scroll', handleScroll);
    return () => {
      container.removeEventListener('scroll', handleScroll);
      if (debounceTimer) clearTimeout(debounceTimer);
    };
  }, [isLoadingMore]);
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

  // Enhanced post submit with optimistic update
  const handlePostSubmit = async () => {
    setPostStep(null);
    setSelectedMedia([]);
    setCurrentMediaIndex(0);
    
    // Immediately refetch to get the new post
    await refetch();
    
    // Show success feedback
    toast({
      title: 'Post created!',
      description: 'Your post is now live.',
    });
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
      {/* Offline Banner */}
      <OfflineBanner 
        isOffline={isOffline} 
        lastSyncTime={lastSyncTime} 
        onRetry={() => !isOffline && refetch()}
      />
      
      <div className="sticky top-0 z-50 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="flex items-center justify-between px-3 py-2 max-w-2xl mx-auto">
          <NotificationBell 
            onPanelOpen={handleNotificationPanelOpen}
            onPanelClose={handleNotificationPanelClose}
          />
          
          <div className="flex items-center gap-3 relative">
            <button
              onClick={() => {
                haptic('selection');
                setActiveTab('following');
              }}
              className={`text-sm font-semibold transition-all ${
                activeTab === 'following'
                  ? 'text-foreground'
                  : 'text-muted-foreground'
              }`}
            >
              Following
            </button>
            <button
              onClick={() => {
                haptic('selection');
                setActiveTab('forYou');
              }}
              className={`text-sm font-semibold transition-all ${
                activeTab === 'forYou'
                  ? 'text-foreground'
                  : 'text-muted-foreground'
              }`}
            >
              For You
            </button>
            <button
              onClick={() => {
                haptic('selection');
                setActiveTab('live');
              }}
              className={`transition-all p-1 rounded-full flex items-center gap-1.5 ${
                activeTab === 'live'
                  ? 'bg-red-500/20'
                  : ''
              }`}
              title="Live"
            >
              {(liveCount || 0) > 0 && (
                <span className="text-xs font-bold text-red-500">{liveCount}</span>
              )}
              <span className="relative flex h-3 w-3">
                {(liveCount || 0) > 0 ? (
                  <>
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                  </>
                ) : (
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-muted-foreground/50"></span>
                )}
              </span>
            </button>
            {/* Sliding tab indicator */}
            <div 
              className="absolute -bottom-2 h-0.5 bg-primary transition-all duration-200 ease-out"
              style={{ 
                width: activeTab === 'live' ? '12px' : '50px',
                left: activeTab === 'following' ? '0' : activeTab === 'forYou' ? '70px' : '140px'
              }}
            />
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/feed/trending')}
            >
              <TrendingUp className="w-5 h-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/feed/search')}
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

      <SwipeableTabs
        activeIndex={activeTabIndex}
        onTabChange={handleTabChange}
        tabCount={tabs.length}
      >
        <div
          ref={containerRef}
          className="max-w-2xl mx-auto snap-y snap-mandatory overflow-y-scroll h-[calc(100vh-8rem)] scroll-smooth native-scroll-container relative"
          data-scrollable="true"
        >
          {/* Pull to Refresh Indicator */}
          <PullToRefresh 
            pullDistance={pullDistance}
            pullProgress={pullProgress}
            isRefreshing={isRefreshing}
          />
        
        {activeTab === 'live' ? (
          // Live content tab
          <div className="p-4 space-y-4">
            {liveContent && liveContent.length > 0 ? (
              liveContent.map((item) => (
                <LiveFeedCard
                  key={item.id}
                  item={{
                    ...item,
                    status: item.status as 'live' | 'ended',
                    type: item.type as 'video' | 'space'
                  }}
                  onClick={() => {
                    if (item.type === 'video') {
                      navigate(`/live/stream/${item.id}`);
                    } else {
                      navigate(`/live/space/${item.id}`);
                    }
                  }}
                />
              ))
            ) : (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="relative w-24 h-24 mb-6">
                  <Radio className="w-24 h-24 text-muted-foreground/30" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-8 h-8 bg-red-500/20 rounded-full animate-ping" />
                  </div>
                </div>
                <h3 className="text-xl font-semibold mb-2">No Live Content</h3>
                <p className="text-muted-foreground mb-6 max-w-xs">
                  Be the first to go live and share your moment with the world!
                </p>
                <Button 
                  className="bg-red-600 hover:bg-red-700"
                  onClick={() => navigate('/live')}
                >
                  <Radio className="w-4 h-4 mr-2" />
                  Start Streaming
                </Button>
              </div>
            )}
          </div>
        ) : feedError && displayPosts.length === 0 ? (
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
              const isStyledText = post.media_type === 'text_styled' && post.media_url && post.content;
              const isMedia = post.media_url && post.media_type !== 'text_styled';
              
              const wrapperClass = (isStyledText || isMedia)
                ? "snap-start snap-always h-[calc(100vh-8rem)] flex items-start" 
                : "snap-start mb-4";
              
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
            
            {isLoadingMore && <InfiniteScrollSkeleton count={2} />}
          </SectionErrorBoundary>
        ) : isOffline && cachedPosts.length > 0 ? (
          <SectionErrorBoundary sectionName="Cached Posts" onRetry={() => {}}>
            {cachedPosts.map((post) => {
              const uniqueKey = (post as any)._cycleKey || post.id;
              return (
                <div key={uniqueKey} className="snap-start mb-4">
                  <PostCard
                    post={post as any}
                    isPromoted={false}
                    allPosts={cachedPosts as any}
                    allVideoPosts={[]}
                    onLikeUpdate={() => {}}
                    onCommentsOpenChange={setIsCommentsOpen}
                    onInteractionStart={handleInteractionStart}
                    onInteractionEnd={handleInteractionEnd}
                    onView={() => {}}
                    onMarkAsViewed={() => {}}
                  />
                </div>
              );
            })}
          </SectionErrorBoundary>
        ) : null}
        </div>
      </SwipeableTabs>

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
