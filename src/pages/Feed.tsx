import { useState, useEffect, useRef, useCallback, Fragment } from 'react';
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
import PhotoPlusPostCreator from '@/components/post/PhotoPlusPostCreator';
import PostDetails from '@/components/post/PostDetails';
import ImmersivePostCard from '@/components/feed/ImmersivePostCard';
import { CreateStoryModal } from '@/components/stories/CreateStoryModal';
import { useViewedPosts } from '@/hooks/useViewedPosts';
import { useScrollPosition } from '@/hooks/useScrollPosition';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { FeedSkeleton } from '@/components/native/NativeLoadingSpinner';
import { LiveFeedCard } from '@/components/feed/LiveFeedCard';
import { InlineLiveCard } from '@/components/feed/InlineLiveCard';
import { FullscreenLiveViewer } from '@/components/feed/FullscreenLiveViewer';
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
import { cn } from '@/lib/utils';

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
  const [postStep, setPostStep] = useState<'selector' | 'video' | 'videoGallery' | 'story' | 'photoplus' | null>(null);
  const [selectedMedia, setSelectedMedia] = useState<{ url: string; type: 'image' | 'video'; file: File }[]>([]);
  const [currentMediaIndex, setCurrentMediaIndex] = useState(0);
  const [isCommentsOpen, setIsCommentsOpen] = useState(false);
  const [isInteracting, setIsInteracting] = useState(false);
  const [showNav, setShowNav] = useState(true);
  const [isImmersiveMode, setIsImmersiveMode] = useState(false); // Fullscreen immersive mode
  const [showLiveViewer, setShowLiveViewer] = useState(false); // Fullscreen live content viewer
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
  const [globalMuted, setGlobalMuted] = useState(false); // Default unmuted - user can mute manually
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

  // Helper function to fetch posts for a specific tab using the new rotation system
  const fetchTabPosts = useCallback(async (tab: 'following' | 'forYou', userId: string, sessionKey: number) => {
    try {
      // Use the get_feed_with_rotation function with session-based randomization
      // Each different sessionKey produces a different random order (TikTok/YouTube style)
      // New posts (last 24h) get priority, then unviewed, then viewed posts
      const feedType = tab === 'following' ? 'following' : 'forYou';
      
      // Create a unique session seed from the session key
      // This makes posts appear in different random order each time user returns
      const sessionSeed = `${sessionKey}-${userId.substring(0, 8)}`;
      
      const { data, error } = await supabase.rpc('get_feed_with_rotation', {
        p_user_id: userId,
        p_limit: 100,
        p_offset: 0,
        p_feed_type: feedType,
        p_media_filter: 'all',
        p_session_seed: sessionSeed
      });
      
      if (error) {
        console.error('Feed rotation error:', error);
        // Fall back to old method
        return await fetchFallbackPosts(userId);
      }
      
      if (!data || data.length === 0) {
        return await fetchFallbackPosts(userId);
      }
      
      // Enrich with profile data
      return await enrichPostsWithProfiles(data);
    } catch (err) {
      console.error('Feed RPC error:', err);
      return await fetchFallbackPosts(userId);
    }
  }, []);

  // Helper to enrich posts with profile data
  const enrichPostsWithProfiles = useCallback(async (feedData: any[]) => {
    const postIds = feedData.map(p => p.id);
    
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

    if (postsError || !fullPosts) {
      console.error('Posts fetch error:', postsError);
      return [];
    }

    // Create maps for ordering and metadata
    const postMap = new Map(fullPosts.map(p => [p.id, p]));
    const metaMap = new Map(feedData.map(p => [p.id, { 
      is_promoted: p.is_promoted, 
      is_new_post: p.is_new_post,
      relevance_score: p.relevance_score || 0
    }]));
    
    // Return posts in the order from the feed function
    const orderedPosts = postIds
      .map(id => postMap.get(id))
      .filter(Boolean)
      .map(post => {
        const meta = metaMap.get(post!.id);
        return {
          ...post!,
          _isPromoted: meta?.is_promoted || false,
          _isNewPost: meta?.is_new_post || false,
          _relevanceScore: meta?.relevance_score || 0,
          _boostLevel: null,
          _promoterName: null
        };
      });

    // Cache the results
    feedCache.set('forYou', orderedPosts);

    return orderedPosts;
  }, []);

  // Track if we're navigating back to feed (to force fresh data)
  const [feedSessionKey, setFeedSessionKey] = useState(() => Date.now());
  
  // Force fresh fetch when returning to feed page
  useEffect(() => {
    // On mount or return, clear cache and get fresh data
    feedCache.clear();
    setFeedSessionKey(Date.now());
  }, []);

  // Separate queries for each tab - ALWAYS fetches fresh from rotation system
  // Videos tab - fetches rotated posts then filters to video only
  const { data: videoPosts, isLoading: isLoadingVideos, refetch: refetchVideos } = useQuery({
    queryKey: ['feed-posts-videos', user?.id, feedSessionKey],
    queryFn: async () => {
      if (!user) return [];
      console.log('[Feed] Fetching fresh video posts with session rotation:', feedSessionKey);
      
      // Pass feedSessionKey to get different random order each visit
      const allPosts = await fetchTabPosts('forYou', user.id, feedSessionKey);
      
      // Filter for video posts only
      const videosOnly = allPosts.filter((p: any) => 
        p.media_type === 'video' || 
        (p.original_post?.media_type === 'video')
      );
      
      console.log('[Feed] Got', videosOnly.length, 'video posts (total:', allPosts.length, ')');
      return videosOnly;
    },
    enabled: !!user,
    staleTime: 0, // Always consider stale to trigger refetch on navigation
    gcTime: 0, // Don't cache - always get fresh
    refetchOnWindowFocus: false, // We handle this manually
  });

  // Photos & Text tab - fetches rotated posts then filters to non-video
  const { data: photosTextPosts, isLoading: isLoadingPhotosText, refetch: refetchPhotosText } = useQuery({
    queryKey: ['feed-posts-photos-text', user?.id, feedSessionKey],
    queryFn: async () => {
      if (!user) return [];
      console.log('[Feed] Fetching fresh photo/text posts with session rotation:', feedSessionKey);
      
      // Pass feedSessionKey to get different random order each visit
      const allPosts = await fetchTabPosts('forYou', user.id, feedSessionKey);
      
      // Filter for non-video posts (images, text, styled text)
      const nonVideos = allPosts.filter((p: any) => 
        p.media_type !== 'video' && 
        (!p.original_post || p.original_post.media_type !== 'video')
      );
      
      console.log('[Feed] Got', nonVideos.length, 'photo/text posts (total:', allPosts.length, ')');
      return nonVideos;
    },
    enabled: !!user,
    staleTime: 0, // Always consider stale to trigger refetch on navigation  
    gcTime: 0, // Don't cache - always get fresh
    refetchOnWindowFocus: false, // We handle this manually
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

  // Infinite scroll handler - NO cycling, posts only appear once until database allows reset
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
            
            // No more new posts - don't cycle, just stop loading
            // The database will reset view history when 90%+ posts are viewed
            return prev;
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

  // Refetch feed when user returns to the app/page - forces fresh rotation
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && user) {
        // User returned to the app - trigger new session to get different posts
        console.log('[Feed] User returned - triggering fresh feed rotation');
        feedCache.clear();
        setFeedSessionKey(Date.now()); // This changes the queryKey and forces a fresh fetch
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [user]);

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
    setPostStep('videoGallery');
  };

  const handleMediaEdit = (editedMedia: { url: string; type: 'image' | 'video'; file: File }) => {
    // For now, just go to details - can add multi-media editing later
    setPostStep('videoGallery');
  };

  return (
    <div className="min-h-screen bg-black native-feed-container relative">
      {/* Offline Banner */}
      <OfflineBanner 
        isOffline={isOffline} 
        lastSyncTime={lastSyncTime} 
        onRetry={() => !isOffline && refetch()}
      />
      
      {/* TikTok-style Overlay Navigation - Hidden in immersive mode */}
      {!isImmersiveMode && (
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
                Photo+
              </button>
              {/* Live Indicator - Opens fullscreen live viewer when active */}
              <div 
                className={cn(
                  "transition-all p-1.5 rounded-full flex items-center gap-1.5 drop-shadow-lg",
                  (liveCount || 0) > 0 
                    ? "cursor-pointer bg-destructive/20 hover:bg-destructive/30" 
                    : ""
                )}
                title={`${liveCount || 0} live now`}
                onClick={() => {
                  if ((liveCount || 0) > 0 && liveContent && liveContent.length > 0) {
                    haptic('selection');
                    setShowLiveViewer(true);
                  }
                }}
              >
                {(liveCount || 0) > 0 && (
                  <span className="text-xs font-bold text-destructive">{liveCount}</span>
                )}
                <span className="relative flex h-3 w-3">
                  {(liveCount || 0) > 0 ? (
                    <>
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-destructive"></span>
                    </>
                  ) : (
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-white/40"></span>
                  )}
                </span>
              </div>
              {/* Sliding tab indicator - only for Videos and Photo+ */}
              <div 
                className="absolute -bottom-1 h-0.5 bg-white transition-all duration-200 ease-out"
                style={{ 
                  width: activeTab === 'live' ? '0px' : activeTab === 'videos' ? '50px' : '55px',
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
      )}

      <SwipeableTabs
        activeIndex={activeTabIndex}
        onTabChange={handleTabChange}
        tabCount={tabs.length}
      >
        <div
          ref={containerRef}
          className={cn(
            "w-full mx-auto overflow-y-scroll scroll-smooth native-scroll-container relative",
            // Videos tab uses snap scrolling (TikTok-style), Photo+ uses free-flowing (Facebook-style)
            activeTab === 'videos' && "snap-y snap-mandatory",
            // In immersive mode, container takes full viewport for seamless fullscreen scrolling
            isImmersiveMode ? "h-[100dvh] fixed inset-0 z-50 bg-black" : "h-[calc(100dvh-68px)]"
          )}
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
                    <div className="w-8 h-8 bg-destructive/20 rounded-full animate-ping" />
                  </div>
                </div>
                <h3 className="text-xl font-semibold mb-2">No Live Content</h3>
                <p className="text-muted-foreground mb-6 max-w-xs">
                  Be the first to go live and share your moment with the world!
                </p>
                <Button 
                  className="bg-destructive hover:bg-destructive/90"
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
                <Fragment key={uniqueKey}>
                  <div className={cn(
                    // Videos tab: snap scrolling (TikTok-style)
                    // Photo+ tab: no snap, free-flowing (Facebook-style)
                    activeTab === 'videos' && "snap-start snap-always"
                  )}>
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
                      onImmersiveModeChange={setIsImmersiveMode}
                      isGlobalImmersive={isImmersiveMode}
                    />
                  </div>
                  {showInlineLive && (
                    <div className="snap-start snap-always h-[calc(100dvh-68px)] flex items-center justify-center pt-16">
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
                </Fragment>
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
                    onImmersiveModeChange={setIsImmersiveMode}
                    isGlobalImmersive={isImmersiveMode}
                  />
                </div>
              );
            })}
          </SectionErrorBoundary>
        ) : null}
        </div>
      </SwipeableTabs>

      <BottomNav hidden={isCommentsOpen || !showNav || postStep !== null || isImmersiveMode} />
      
      {/* Quick Action Button - positioned below feed cards */}
      <FloatingActionButton 
        onClick={handleCreatePost}
        hidden={isCommentsOpen || !showNav || postStep !== null || isImmersiveMode}
      />

      {/* Native Creation Sheet */}
      <NativeCreationSheet
        open={postStep === 'selector'}
        onClose={() => setPostStep(null)}
        onVideoSelect={() => setPostStep('video')}
        onPhotoPlusSelect={() => setPostStep('photoplus')}
        onStorySelect={() => setPostStep('story')}
        onLiveSelect={() => {
          setPostStep(null);
          navigate('/live');
        }}
      />

      {/* Native Camera for Video */}
      {postStep === 'video' && (
        <NativeCameraView
          onCapture={(media) => {
            setSelectedMedia([media]);
            setPostStep('videoGallery');
          }}
          onClose={() => setPostStep(null)}
          onGalleryOpen={() => setPostStep('videoGallery')}
        />
      )}

      {/* Native Gallery Picker for Video */}
      {postStep === 'videoGallery' && selectedMedia.length === 0 && (
        <NativeGalleryPicker
          open={true}
          onClose={() => setPostStep(null)}
          onSelect={(items) => {
            setSelectedMedia(items);
          }}
          onCameraOpen={() => setPostStep('video')}
          acceptType="video"
        />
      )}

      {/* Story Creation */}
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

      {/* Photo+ Post Creator */}
      {postStep === 'photoplus' && (
        <PhotoPlusPostCreator
          open={true}
          onClose={() => setPostStep(null)}
          onSuccess={() => {
            refetch();
          }}
        />
      )}

      {/* Video Post Details */}
      {postStep === 'videoGallery' && selectedMedia.length > 0 && (
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

      {/* Fullscreen Live Content Viewer */}
      {showLiveViewer && liveContent && liveContent.length > 0 && (
        <FullscreenLiveViewer
          liveContent={liveContent.map(item => ({
            ...item,
            host: {
              id: (item.host as any)?.id,
              display_name: item.host?.display_name || 'Unknown Host',
              username: item.host?.username || 'unknown',
              avatar_url: item.host?.avatar_url || '',
            }
          }))}
          onClose={() => setShowLiveViewer(false)}
        />
      )}
    </div>
  );
};

export default Feed;
