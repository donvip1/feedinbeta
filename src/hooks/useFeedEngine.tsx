/**
 * ============================================================================
 * FEED ENGINE HOOK
 * React hook for fetching personalized feed with rotation, ads, and tracking
 * ============================================================================
 * 
 * This hook provides:
 * - Infinite scroll pagination
 * - Automatic session management
 * - Post view tracking
 * - Media preference tracking
 * - Cache management for fresh content on return
 */

import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useCallback, useEffect, useRef, useState } from 'react';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface FeedPost {
  id: string;
  user_id: string;
  content: string | null;
  media_url: string | null;
  media_type: string | null;
  media_urls: string[] | null;
  media_types: string[] | null;
  created_at: string;
  likes_count: number;
  comments_count: number;
  views_count: number;
  refeeds_count: number;
  location: string | null;
  post_type: string | null;
  original_post_id: string | null;
  relevance_score?: number;
  is_new_post?: boolean;
  is_promoted?: boolean;
  is_trending?: boolean;
  profiles?: {
    id?: string;
    username: string | null;
    display_name: string | null;
    avatar_url: string | null;
  };
  original_post?: FeedPost | null;
}

export interface FeedAd {
  ad_id: string;
  title: string;
  description: string | null;
  media_url: string;
  media_type: string;
  click_url: string | null;
  advertiser_name: string | null;
  is_ad: true;
}

export type FeedItem = FeedPost | FeedAd;

interface FeedResponse {
  posts: FeedItem[];
  hasMore: boolean;
  totalAvailable: number;
  viewedToday: number;
  cycleProgress: number;
  cycleReset: boolean;
  sessionId: string;
}

interface UseFeedEngineOptions {
  mediaFilter?: 'all' | 'video' | 'photo';
  includeAds?: boolean;
  adFrequency?: number;
  enabled?: boolean;
}

// ============================================================================
// HELPER: Check if item is an ad
// ============================================================================
export function isAd(item: FeedItem): item is FeedAd {
  return 'is_ad' in item && item.is_ad === true;
}

// ============================================================================
// MAIN HOOK: useFeedEngine
// ============================================================================
export function useFeedEngine(options: UseFeedEngineOptions = {}) {
  const { user, session } = useAuth();
  const queryClient = useQueryClient();
  
  const {
    mediaFilter = 'all',
    includeAds = true,
    adFrequency = 5,
    enabled = true,
  } = options;

  // Session management - generate new session ID on mount or visibility change
  const [sessionId] = useState(() => crypto.randomUUID());
  const [isNewSession, setIsNewSession] = useState(true);
  const hasInitialized = useRef(false);

  // Track initialization only - NO visibility change refresh
  // Feed should NEVER auto-refresh while user is browsing
  useEffect(() => {
    hasInitialized.current = true;
  }, []);

  // Main feed query
  const feedQuery = useInfiniteQuery({
    queryKey: ['feed-engine', user?.id, mediaFilter, sessionId],
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      if (!user || !session) {
        throw new Error('User not authenticated');
      }

      console.log('[useFeedEngine] Fetching page:', pageParam, 'isNewSession:', isNewSession);

      try {
        // Call the feed-engine edge function
        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/feed-engine`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({
              limit: 20,
              offset: pageParam as number,
              mediaFilter,
              includeAds,
              adFrequency,
              sessionId,
              isNewSession: isNewSession && pageParam === 0,
            }),
          }
        );

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || `HTTP ${response.status}`);
        }

        const data: FeedResponse = await response.json();
        
        // Clear new session flag after first fetch
        if (isNewSession) {
          setIsNewSession(false);
        }

        // Fetch original posts for refeeds
        const refeedIds = data.posts
          .filter((p): p is FeedPost => !isAd(p) && !!p.original_post_id)
          .map(p => p.original_post_id)
          .filter((id): id is string => id !== null);

        if (refeedIds.length > 0) {
          const { data: originalPosts } = await supabase
            .from('posts')
            .select(`
              id, user_id, content, media_url, media_type, media_urls, media_types, created_at,
              profiles:user_id (username, display_name, avatar_url)
            `)
            .in('id', refeedIds);

          const originalMap = new Map(originalPosts?.map(p => [p.id, p]) || []);

          data.posts = data.posts.map(item => {
            if (!isAd(item) && item.original_post_id) {
              const original = originalMap.get(item.original_post_id);
              return { 
                ...item, 
                original_post: original ? {
                  ...original,
                  likes_count: 0,
                  comments_count: 0,
                  views_count: 0,
                  refeeds_count: 0,
                  location: null,
                  post_type: null,
                  original_post_id: null,
                  relevance_score: 0,
                  is_new_post: false,
                  is_promoted: false,
                } as FeedPost : null 
              };
            }
            return item;
          }) as FeedItem[];
        }

        return {
          posts: data.posts as FeedItem[],
          nextOffset: (pageParam as number) + 20,
          hasMore: data.hasMore,
          cycleProgress: data.cycleProgress,
          cycleReset: data.cycleReset,
        };

      } catch (error) {
        console.error('[useFeedEngine] Error:', error);
        
        // Fallback to direct database query
        return await fetchFallbackFeed(user.id, pageParam as number, mediaFilter);
      }
    },
    getNextPageParam: (lastPage) => lastPage.hasMore ? lastPage.nextOffset : undefined,
    enabled: enabled && !!user,
    staleTime: 0, // Always fetch fresh
    gcTime: 0,    // Don't cache
  });

  // Flatten pages into single posts array
  const posts = feedQuery.data?.pages.flatMap(page => page.posts) || [];

  return {
    posts,
    isLoading: feedQuery.isLoading,
    isFetching: feedQuery.isFetching,
    isFetchingNextPage: feedQuery.isFetchingNextPage,
    hasNextPage: feedQuery.hasNextPage,
    fetchNextPage: feedQuery.fetchNextPage,
    refetch: feedQuery.refetch,
    error: feedQuery.error,
    cycleProgress: feedQuery.data?.pages[0]?.cycleProgress || 0,
    cycleReset: feedQuery.data?.pages[0]?.cycleReset || false,
  };
}

// ============================================================================
// FALLBACK: Direct database query when edge function fails
// ============================================================================
async function fetchFallbackFeed(
  userId: string,
  offset: number,
  mediaFilter: 'all' | 'video' | 'photo'
): Promise<{ posts: FeedItem[]; nextOffset: number; hasMore: boolean; cycleProgress: number; cycleReset: boolean }> {
  console.log('[useFeedEngine] Using fallback feed');

  // Simple posts query as fallback
  let query = supabase
    .from('posts')
    .select(`
      id, user_id, content, media_url, media_type, media_urls, media_types, created_at,
      likes_count, comments_count, views_count, refeeds_count, location, post_type, original_post_id,
      profiles:user_id (username, display_name, avatar_url)
    `)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .range(offset, offset + 19);

  if (mediaFilter === 'video') {
    query = query.eq('media_type', 'video');
  } else if (mediaFilter === 'photo') {
    query = query.in('media_type', ['image', 'photo', 'styled_text', 'text']);
  }

  const { data: posts } = await query;

  const mappedPosts: FeedPost[] = (posts || []).map((p: any) => ({
    id: p.id,
    user_id: p.user_id,
    content: p.content,
    media_url: p.media_url,
    media_type: p.media_type,
    media_urls: p.media_urls,
    media_types: p.media_types,
    created_at: p.created_at,
    likes_count: p.likes_count || 0,
    comments_count: p.comments_count || 0,
    views_count: p.views_count || 0,
    refeeds_count: p.refeeds_count || 0,
    location: p.location,
    post_type: p.post_type,
    original_post_id: p.original_post_id,
    is_new_post: new Date(p.created_at) > new Date(Date.now() - 24 * 60 * 60 * 1000),
    is_promoted: false,
    relevance_score: 0,
    profiles: p.profiles,
  }));

  return {
    posts: mappedPosts,
    nextOffset: offset + 20,
    hasMore: (posts?.length || 0) === 20,
    cycleProgress: 0,
    cycleReset: false,
  };
}


// ============================================================================
// HOOK: usePostViewTracker
// Records when user views a post for non-repetition tracking
// ============================================================================
export function usePostViewTracker() {
  const { user } = useAuth();
  const pendingViews = useRef<Map<string, { mediaType: string; watchTime: number }>>(new Map());
  const flushTimeout = useRef<ReturnType<typeof setTimeout>>();

  const flushViews = useCallback(async () => {
    if (!user || pendingViews.current.size === 0) return;

    const views = Array.from(pendingViews.current.entries());
    pendingViews.current.clear();

    console.log(`[PostViewTracker] Flushing ${views.length} views`);

    // Record views in parallel
    await Promise.allSettled(
      views.map(([postId, { mediaType, watchTime }]) =>
        supabase.rpc('record_post_view', {
          p_user_id: user.id,
          p_post_id: postId,
          p_media_type: mediaType,
          p_watch_time: watchTime,
        })
      )
    );
  }, [user]);

  // Flush on visibility change or unmount
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        flushViews();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      flushViews();
    };
  }, [flushViews]);

  const recordView = useCallback((postId: string, mediaType: string, watchTime: number = 0) => {
    if (!user) return;

    // Accumulate watch time for videos
    const existing = pendingViews.current.get(postId);
    if (existing) {
      existing.watchTime += watchTime;
    } else {
      pendingViews.current.set(postId, { mediaType, watchTime });
    }

    // Debounce flush
    if (flushTimeout.current) {
      clearTimeout(flushTimeout.current);
    }
    flushTimeout.current = setTimeout(flushViews, 3000);
  }, [user, flushViews]);

  return { recordView };
}

// ============================================================================
// HOOK: useAdClickTracker
// Records when user clicks an ad
// ============================================================================
export function useAdClickTracker() {
  const { user } = useAuth();

  const recordClick = useCallback(async (adId: string) => {
    if (!user) return;

    await supabase.rpc('record_ad_impression', {
      p_user_id: user.id,
      p_ad_id: adId,
      p_clicked: true,
    });
  }, [user]);

  return { recordClick };
}

// ============================================================================
// HOOK: useFeedCycleStatus
// Returns current feed cycle status
// ============================================================================
export function useFeedCycleStatus() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useInfiniteQuery({
    queryKey: ['feed-cycle-status', user?.id],
    initialPageParam: 0,
    queryFn: async () => {
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase.rpc('get_feed_status', {
        p_user_id: user.id,
      });

      if (error) throw error;
      return data?.[0] || null;
    },
    getNextPageParam: () => undefined,
    enabled: !!user,
    staleTime: 60000, // 1 minute
  });

  const resetCycle = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('Not authenticated');

      // Delete today's view history to reset cycle
      await supabase
        .from('user_seen_posts')
        .delete()
        .eq('user_id', user.id)
        .eq('seen_date', new Date().toISOString().split('T')[0]);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feed-engine'] });
      queryClient.invalidateQueries({ queryKey: ['feed-cycle-status'] });
    },
  });

  return {
    status: query.data?.pages[0],
    isLoading: query.isLoading,
    resetCycle: resetCycle.mutate,
    isResetting: resetCycle.isPending,
  };
}
