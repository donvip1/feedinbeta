import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { BottomNav } from '@/components/navigation/BottomNav';
import { FloatingActionButton } from '@/components/navigation/FloatingActionButton';
import { Search, Radio, Bell } from 'lucide-react';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import NativeCreationSheet from '@/components/post/NativeCreationSheet';
import NativeCameraView from '@/components/post/NativeCameraView';
import NativeGalleryPicker from '@/components/post/NativeGalleryPicker';
import TextPostCreator from '@/components/post/TextPostCreator';
import PlainTextPostCreator from '@/components/post/PlainTextPostCreator';
import PostDetails from '@/components/post/PostDetails';
import ImmersivePostCard from '@/components/feed/ImmersivePostCard';
import { CreateStoryModal } from '@/components/stories/CreateStoryModal';
import { useViewedPosts } from '@/hooks/useViewedPosts';
import { useScrollPosition } from '@/hooks/useScrollPosition';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { FeedSkeleton } from '@/components/native/NativeLoadingSpinner';
import { LiveFeedCard } from '@/components/feed/LiveFeedCard';
import { InlineLiveCard } from '@/components/feed/InlineLiveCard';
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
import { useFeedPreloader } from '@/hooks/useFeedPreloader';
import { batchPrefetchCounts } from '@/hooks/useProfileCounts';

const Feed = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const { haptic } = useNativeFeatures();
  const [activeTab, setActiveTab] = useState<'videos' | 'photosText' | 'live'>('videos');
  
  // Tab configuration for swipe gestures - Videos, Photos & Text, Live indicator
  const tabs: ('videos' | 'photosText' | 'live')[] = ['videos', 'photosText', 'live'];
  const activeTabIndex = tabs.indexOf(activeTab);
  
  const handleTabChange = useCallback((index: number) => {
    setActiveTab(tabs[index]);
  }, []);
  const { containerRef: scrollContainerRef } = useScrollPosition('feed');
  const [postStep, setPostStep] = useState<'selector' | 'camera' | 'gallery' | 'story' | 'text' | 'plaintext' | null>(null);
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
  
  const allVideoPostsRef = useRef<any[]>([]);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  
  // Global mute state - persists across all feed videos
  const [globalMuted, setGlobalMuted] = useState(true); // Default muted for autoplay policy
  const toggleGlobalMute = useCallback(() => {
    setGlobalMuted(prev => !prev);
  }, []);

  // Fetch live content count for indicator (always enabled) - real-time with fast refetch
  const { data: liveCount, refetch: refetchLiveCount } = useQuery({
    queryKey: ['feed-live-count'],
    queryFn: async () => {
      const [{ count: streamsCount }, { count: spacesCount }] = await Promise.all([
        supabase.from('live_streams').select('*', { count: 'exact', head: true }).eq('status', 'live'),
        supabase.from('live_spaces').select('*', { count: 'exact', head: true }).eq('status', 'live'),
      ]);
      return (streamsCount || 0) + (spacesCount || 0);
    },
    refetchInterval: 30000, // Refresh every 30 seconds for stability
    staleTime: Infinity, // Never auto-refetch to prevent scroll resets
  });

  // Fetch live content for the Live tab - optimized for real-time
  const { data: liveContent, refetch: refetchLive, isLoading: isLoadingLive } = useQuery({
    queryKey: ['feed-live-content'],
    queryFn: async () => {
      console.log('[Feed] Fetching live content...');
      
      // Fetch live streams - use case-insensitive check
      const { data: streams, error: streamsError } = await supabase
        .from('live_streams')
        .select('id, title, status, viewer_count, thumbnail_url, user_id')
        .ilike('status', 'live')
        .order('viewer_count', { ascending: false })
        .limit(20);

      if (streamsError) {
        console.error('[Feed] Error fetching streams:', streamsError);
      } else {
        console.log('[Feed] Live streams found:', streams?.length || 0);
      }

      // Fetch live spaces - use case-insensitive check
      const { data: spaces, error: spacesError } = await supabase
        .from('live_spaces')
        .select('id, title, status, viewer_count, topic_category, share_link, user_id')
        .ilike('status', 'live')
        .order('viewer_count', { ascending: false })
        .limit(20);

      if (spacesError) {
        console.error('[Feed] Error fetching spaces:', spacesError);
      } else {
        console.log('[Feed] Live spaces found:', spaces?.length || 0);
      }

      const allUserIds = [
        ...(streams || []).map(s => s.user_id),
        ...(spaces || []).map(s => s.user_id)
      ].filter(Boolean);

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
          host: profileMap.get(s.user_id) || { display_name: 'Unknown Host', username: 'unknown', avatar_url: '' }
        })),
        ...(spaces || []).map(s => ({
          ...s,
          type: 'space' as const,
          host: profileMap.get(s.user_id) || { display_name: 'Unknown Host', username: 'unknown', avatar_url: '' }
        }))
      ];

      console.log('[Feed] Total live items:', liveItems.length);

      // Sort by viewer count
      return liveItems.sort((a, b) => (b.viewer_count || 0) - (a.viewer_count || 0));
    },
    // Always fetch live content, not just when on live tab - for inline display
    refetchInterval: 3000, // Refresh every 3 seconds for instant updates
    staleTime: 0, // Always consider stale
  });

  // Fetch inline live content for For You feed (separate query for inline cards)
  const { data: inlineLiveContent } = useQuery({
    queryKey: ['feed-inline-live'],
    queryFn: async () => {
      // Get top 3 live content to show inline in feed
      const [{ data: streams }, { data: spaces }] = await Promise.all([
        supabase
          .from('live_streams')
          .select('id, title, status, viewer_count, thumbnail_url, user_id')
          .eq('status', 'live')
          .order('viewer_count', { ascending: false })
          .limit(2),
        supabase
          .from('live_spaces')
          .select('id, title, status, viewer_count, topic_category, user_id')
          .eq('status', 'live')
          .order('viewer_count', { ascending: false })
          .limit(2),
      ]);

      const allUserIds = [
        ...(streams || []).map(s => s.user_id),
        ...(spaces || []).map(s => s.user_id)
      ].filter(Boolean);

      if (allUserIds.length === 0) return [];

      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, display_name, username, avatar_url')
        .in('id', allUserIds);

      const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

      return [
        ...(streams || []).map(s => ({
          ...s,
          type: 'video' as const,
          host: profileMap.get(s.user_id) || { display_name: 'Unknown Host', username: 'unknown', avatar_url: '' }
        })),
        ...(spaces || []).map(s => ({
          ...s,
          type: 'space' as const,
          host: profileMap.get(s.user_id) || { display_name: 'Unknown Host', username: 'unknown', avatar_url: '' }
        }))
      ].slice(0, 3); // Max 3 inline items
    },
    enabled: activeTab !== 'live', // Only when not on live tab
    refetchInterval: 5000,
    staleTime: 0,
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

  // Helper function to fetch posts for a specific tab
  const fetchTabPosts = useCallback(async (tab: 'following' | 'forYou', userId: string) => {
    let feedData: { post_id: string; is_promoted: boolean; boost_level: string; relevance_score?: number }[] = [];
    let useFallback = false;
    
    try {
      if (tab === 'following') {
        const { data, error } = await supabase.rpc('get_following_feed', {
          p_user_id: userId,
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
        const { data, error } = await supabase.rpc('get_personalized_for_you_feed', {
          p_user_id: userId,
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

    if (useFallback || feedData.length === 0) {
      return await fetchFallbackPosts(userId);
    }

    const promotedMap = new Map(feedData.map(p => [p.post_id, { 
      is_promoted: p.is_promoted, 
      boost_level: p.boost_level,
      relevance_score: (p as any).relevance_score || 0
    }]));

    const postIds = feedData.map(p => p.post_id);

    const { data: fullPosts, error: postsError } = await supabase
      .from('posts')
      .select(`
        *,
        profiles:user_id (username, display_name, avatar_url),
        original_post:original_post_id (
          id, user_id, content, media_url, media_type, media_urls, media_types, created_at,
          profiles:user_id (username, display_name, avatar_url)
        )
      `)
      .in('id', postIds);

    if (postsError) {
      console.error('Posts fetch error:', postsError);
      return await fetchFallbackPosts(userId);
    }

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

    if (orderedPosts.length === 0) {
      return await fetchFallbackPosts(userId);
    }

    // Cache the results
    feedCache.set(tab, orderedPosts);

    return orderedPosts;
  }, []);

  // Separate queries for each tab - enables instant tab switching
  // Videos tab - fetches all posts then filters to video only
  const { data: videoPosts, isLoading: isLoadingVideos, refetch: refetchVideos } = useQuery({
    queryKey: ['feed-posts-videos', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const cached = await feedCache.get('forYou');
      if (cached && cached.length > 0) {
        setTimeout(() => fetchTabPosts('forYou', user.id), 100);
        // Filter for video posts only
        return cached.filter((p: any) => 
          p.media_type === 'video' || 
          (p.original_post?.media_type === 'video')
        );
      }
      const allPosts = await fetchTabPosts('forYou', user.id);
      return allPosts.filter((p: any) => 
        p.media_type === 'video' || 
        (p.original_post?.media_type === 'video')
      );
    },
    enabled: !!user,
    staleTime: 60000,
    gcTime: 300000,
    refetchOnWindowFocus: false,
  });

  // Photos & Text tab - fetches all posts then filters to non-video
  const { data: photosTextPosts, isLoading: isLoadingPhotosText, refetch: refetchPhotosText } = useQuery({
    queryKey: ['feed-posts-photos-text', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const cached = await feedCache.get('following');
      if (cached && cached.length > 0) {
        setTimeout(() => fetchTabPosts('following', user.id), 100);
        // Filter for non-video posts (images, text, styled text)
        return cached.filter((p: any) => 
          p.media_type !== 'video' && 
          (!p.original_post || p.original_post.media_type !== 'video')
        );
      }
      const allPosts = await fetchTabPosts('following', user.id);
      return allPosts.filter((p: any) => 
        p.media_type !== 'video' && 
        (!p.original_post || p.original_post.media_type !== 'video')
      );
    },
    enabled: !!user,
    staleTime: 60000,
    gcTime: 300000,
    refetchOnWindowFocus: false,
  });

  // Derive current posts based on active tab
  const posts = activeTab === 'videos' ? videoPosts : photosTextPosts;
  const isLoading = activeTab === 'videos' ? isLoadingVideos : isLoadingPhotosText;
  const refetch = activeTab === 'videos' ? refetchVideos : refetchPhotosText;

  // Update refs when posts change and prefetch profile counts for INSTANT display
  useEffect(() => {
    if (posts && posts.length > 0) {
      allLoadedPostsRef.current = posts;
      allVideoPostsRef.current = posts.filter((p: any) => 
        p.media_type === 'video' || 
        ((p.post_type === 'refeed' || p.post_type === 'quote') && p.original_post?.media_type === 'video')
      );
      
      // INSTANT: Batch prefetch all post authors' profile counts
      const userIds = posts.map((p: any) => p.user_id).filter(Boolean);
      if (userIds.length > 0) {
        batchPrefetchCounts(userIds);
      }
    }
  }, [posts]);

  // Aggressive media preloading for app-like speed
  useFeedPreloader(posts || [], !!posts && posts.length > 0);

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
    <div className="min-h-screen bg-black native-feed-container relative">
      {/* Offline Banner */}
      <OfflineBanner 
        isOffline={isOffline} 
        lastSyncTime={lastSyncTime} 
        onRetry={() => !isOffline && refetch()}
      />
      
      {/* TikTok-style Overlay Navigation - Transparent over content */}
      <div className="fixed top-0 left-0 right-0 z-40 pt-safe-area pointer-events-none">
        <div className="flex items-center justify-between px-4 py-3 pointer-events-auto">
          {/* Left - Notification Bell */}
          <div className="w-16 flex justify-start">
            <NotificationBell />
          </div>
          
          {/* Centered Tabs with transparent styling */}
          <div className="flex items-center gap-4 relative">
            <button
              onClick={() => {
                haptic('selection');
                setActiveTab('videos');
              }}
              className={`text-sm font-semibold transition-all drop-shadow-lg ${
                activeTab === 'videos'
                  ? 'text-white'
                  : 'text-white/60'
              }`}
            >
              Videos
            </button>
            <button
              onClick={() => {
                haptic('selection');
                setActiveTab('photosText');
              }}
              className={`text-sm font-semibold transition-all drop-shadow-lg ${
                activeTab === 'photosText'
                  ? 'text-white'
                  : 'text-white/60'
              }`}
            >
              Photos & Text
            </button>
            {/* Live Indicator - Not a button, just visual indicator */}
            <div 
              className={`transition-all p-1 rounded-full flex items-center gap-1.5 drop-shadow-lg ${
                (liveCount || 0) > 0 ? 'cursor-pointer' : ''
              }`}
              title={`${liveCount || 0} live now`}
              onClick={() => {
                if ((liveCount || 0) > 0) {
                  haptic('selection');
                  setActiveTab('live');
                }
              }}
            >
              {(liveCount || 0) > 0 && (
                <span className="text-xs font-bold text-red-400">{liveCount}</span>
              )}
              <span className="relative flex h-3 w-3">
                {(liveCount || 0) > 0 ? (
                  <>
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                  </>
                ) : (
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-white/40"></span>
                )}
              </span>
            </div>
            {/* Sliding tab indicator - only for Videos and Photos & Text */}
            <div 
              className="absolute -bottom-1 h-0.5 bg-white transition-all duration-200 ease-out"
              style={{ 
                width: activeTab === 'live' ? '0px' : activeTab === 'videos' ? '50px' : '90px',
                left: activeTab === 'videos' ? '0' : activeTab === 'photosText' ? '60px' : '0',
                opacity: activeTab === 'live' ? 0 : 1
              }}
            />
          </div>

          {/* Right icon - Search only (Trending moved inside Search) */}
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/feed/search')}
              className="text-white/80 hover:text-white hover:bg-white/10"
            >
              <Search className="w-5 h-5 drop-shadow-lg" />
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
          className="w-full mx-auto snap-y snap-mandatory overflow-y-scroll h-[calc(100dvh-68px)] scroll-smooth native-scroll-container relative"
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
        ) : isLoading && displayPosts.length === 0 ? (
          <FeedSkeleton />
        ) : displayPosts && displayPosts.length > 0 ? (
          <SectionErrorBoundary sectionName="Feed Posts" onRetry={() => refetch()}>
            {/* Show inline live content at the top if available (only on following/forYou tabs) */}
            {inlineLiveContent && inlineLiveContent.length > 0 && (
              <div className="snap-start snap-always h-[calc(100dvh-68px)] flex items-center justify-center pt-16">
                <InlineLiveCard
                  item={{
                    ...inlineLiveContent[0],
                    status: inlineLiveContent[0].status as string,
                    type: inlineLiveContent[0].type
                  }}
                  onClick={() => {
                    if (inlineLiveContent[0].type === 'video') {
                      navigate(`/live/stream/${inlineLiveContent[0].id}`);
                    } else {
                      navigate(`/live/space/${inlineLiveContent[0].id}`);
                    }
                  }}
                />
              </div>
            )}

            {displayPosts.map((post, index) => {
              const uniqueKey = post._cycleKey || post.id;
              
              // Insert another live card after every 5 posts if we have more live content
              const showInlineLive = inlineLiveContent && 
                inlineLiveContent.length > 1 && 
                (index === 4 || index === 9) &&
                inlineLiveContent[index === 4 ? 1 : (inlineLiveContent[2] ? 2 : 1)];

              return (
                <>
                  <div key={uniqueKey} className="snap-start snap-always">
                    <ImmersivePostCard
                      post={post}
                      isPromoted={post._isPromoted || false}
                      promoterName={post._promoterName}
                      boostLevel={post._boostLevel}
                      onCommentsOpenChange={setIsCommentsOpen}
                      onInteractionStart={handleInteractionStart}
                      onInteractionEnd={handleInteractionEnd}
                      onView={() => markAsViewed(post.id)}
                      allPosts={displayPosts}
                      allVideoPosts={allVideoPostsRef.current}
                      onMarkAsViewed={markAsViewed}
                      layoutType={activeTab === 'videos' ? 'video' : 'photo-text'}
                      globalMuted={globalMuted}
                      onGlobalMuteToggle={toggleGlobalMute}
                    />
                  </div>
                  {showInlineLive && (
                    <div key={`live-${index}`} className="snap-start snap-always h-[calc(100dvh-68px)] flex items-center justify-center pt-16">
                      <InlineLiveCard
                        item={{
                          ...inlineLiveContent[index === 4 ? 1 : 2],
                          status: inlineLiveContent[index === 4 ? 1 : 2].status as string,
                          type: inlineLiveContent[index === 4 ? 1 : 2].type
                        }}
                        onClick={() => {
                          const liveItem = inlineLiveContent[index === 4 ? 1 : 2];
                          if (liveItem.type === 'video') {
                            navigate(`/live/stream/${liveItem.id}`);
                          } else {
                            navigate(`/live/space/${liveItem.id}`);
                          }
                        }}
                      />
                    </div>
                  )}
                </>
              );
            })}
            
            {isLoadingMore && <InfiniteScrollSkeleton count={2} />}
          </SectionErrorBoundary>
        ) : isOffline && cachedPosts.length > 0 ? (
          <SectionErrorBoundary sectionName="Cached Posts" onRetry={() => {}}>
            {cachedPosts.map((post) => {
              const uniqueKey = (post as any)._cycleKey || post.id;
              return (
                <div key={uniqueKey} className="snap-start snap-always">
                  <ImmersivePostCard
                    post={post as any}
                    isPromoted={false}
                    onCommentsOpenChange={setIsCommentsOpen}
                    onInteractionStart={handleInteractionStart}
                    onInteractionEnd={handleInteractionEnd}
                    onView={() => {}}
                    allPosts={cachedPosts as any[]}
                    onMarkAsViewed={() => {}}
                    globalMuted={globalMuted}
                    onGlobalMuteToggle={toggleGlobalMute}
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
        onPlainTextSelect={() => setPostStep('plaintext')}
        onLiveSelect={() => {
          setPostStep(null);
          navigate('/live');
        }}
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
      {postStep === 'plaintext' && (
        <PlainTextPostCreator
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
