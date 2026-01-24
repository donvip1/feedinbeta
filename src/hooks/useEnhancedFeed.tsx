import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useCallback, useEffect, useRef, useState } from 'react';

export type FeedType = 'forYou' | 'following' | 'explore';
export type MediaFilter = 'all' | 'video' | 'photo';

interface FeedPost {
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
  is_promoted?: boolean;
  is_ad?: boolean;
  is_new_post?: boolean;
  profiles?: {
    username: string | null;
    display_name: string | null;
    avatar_url: string | null;
  };
  // Ad-specific fields
  title?: string;
  description?: string;
  click_url?: string;
  advertiser_name?: string;
}

interface FeedResponse {
  posts: FeedPost[];
  feedType: FeedType;
  mediaFilter: MediaFilter;
  hasMore: boolean;
  cycleReset: boolean;
  sessionId?: string;
}

interface UseEnhancedFeedOptions {
  feedType: FeedType;
  mediaFilter: MediaFilter;
  enabled?: boolean;
  includeAds?: boolean;
  adFrequency?: number;
}

/**
 * Generate a unique session ID for feed rotation
 * Different session ID = different starting position in feed
 */
const generateSessionId = (): string => {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

export const useEnhancedFeed = ({
  feedType,
  mediaFilter,
  enabled = true,
  includeAds = true,
  adFrequency = 5,
}: UseEnhancedFeedOptions) => {
  const { user, session } = useAuth();
  const queryClient = useQueryClient();
  
  // Session ID for feed rotation - new session when user returns
  const [sessionId] = useState(() => generateSessionId());
  const isNewSessionRef = useRef(true);

  // Track when user leaves and returns to trigger rotation
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // User returned - mark as new session for rotation
        isNewSessionRef.current = true;
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  const fetchFeed = async ({ pageParam = 0 }): Promise<FeedResponse & { nextOffset: number }> => {
    if (!user || !session) {
      throw new Error('User not authenticated');
    }

    // Determine if this is a new session (for rotation)
    const isNewSession = isNewSessionRef.current && pageParam === 0;
    if (isNewSession) {
      isNewSessionRef.current = false; // Reset after first fetch
    }

    try {
      // Use the enhanced personalized-feed-v2 edge function
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/personalized-feed-v2`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            feedType,
            mediaFilter,
            limit: 20,
            offset: pageParam,
            includeAds,
            adFrequency,
            sessionId,
            isNewSession, // Tell backend to rotate starting position
          }),
        }
      );

      if (response.ok) {
        const data: FeedResponse = await response.json();
        return {
          ...data,
          nextOffset: pageParam + 20,
        };
      }

      // If edge function fails, fall back to direct queries
      console.log('Edge function failed, falling back to direct queries');
    } catch (error) {
      console.error('Edge function error:', error);
    }

    // Fallback implementation
    return await fetchFallbackFeed(feedType, mediaFilter, pageParam, user.id);
  };

  const query = useInfiniteQuery({
    queryKey: ['enhanced-feed', feedType, mediaFilter, user?.id],
    initialPageParam: 0,
    queryFn: fetchFeed,
    getNextPageParam: (lastPage) => lastPage.hasMore ? lastPage.nextOffset : undefined,
    enabled: enabled && !!user && !!session,
    staleTime: 1000 * 60 * 2, // 2 minutes
    gcTime: 1000 * 60 * 10, // 10 minutes
  });

  // Flatten all pages into a single array
  const posts = query.data?.pages.flatMap(page => page.posts) ?? [];

  // Check if any page triggered a cycle reset
  const cycleWasReset = query.data?.pages.some(page => page.cycleReset) ?? false;

  return {
    ...query,
    posts,
    cycleWasReset,
    sessionId,
  };
};

/**
 * Fallback feed fetching when edge function is unavailable
 */
async function fetchFallbackFeed(
  feedType: FeedType,
  mediaFilter: MediaFilter,
  offset: number,
  userId: string
): Promise<FeedResponse & { nextOffset: number }> {
  let posts: FeedPost[] = [];

  if (feedType === 'following') {
    // Get following IDs
    const { data: following } = await supabase
      .from('follows')
      .select('following_id')
      .eq('follower_id', userId);

    const followingIds = following?.map(f => f.following_id) || [];

    if (followingIds.length > 0) {
      const { data } = await supabase
        .from('posts')
        .select(`
          *,
          profiles:user_id (
            username,
            display_name,
            avatar_url
          )
        `)
        .in('user_id', followingIds)
        .order('created_at', { ascending: false })
        .range(offset, offset + 19);

      posts = data || [];
    }
  } else {
    // For You or Explore - use RPC if available, else basic query
    try {
      const rpcName = feedType === 'forYou' 
        ? 'get_personalized_for_you_feed' 
        : 'get_explore_feed';

      const { data } = await supabase.rpc(rpcName as any, {
        p_user_id: userId,
        p_limit: 20,
        p_offset: offset,
      });

      if (data) {
        // Fetch profiles for posts
        const userIds = data.map((p: any) => p.user_id);
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, username, display_name, avatar_url')
          .in('id', userIds);

        const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

        posts = data.map((p: any) => ({
          id: p.post_id || p.id,
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
          is_promoted: p.is_promoted || false,
          profiles: profileMap.get(p.user_id),
        }));
      }
    } catch (error) {
      console.error('RPC fallback failed:', error);
      
      // Ultimate fallback - basic posts query
      const { data } = await supabase
        .from('posts')
        .select(`
          *,
          profiles:user_id (
            username,
            display_name,
            avatar_url
          )
        `)
        .neq('user_id', userId)
        .order('created_at', { ascending: false })
        .range(offset, offset + 19);

      posts = data || [];
    }
  }

  // Apply media filter
  if (mediaFilter === 'video') {
    posts = posts.filter(p => 
      p.media_type?.startsWith('video') || 
      p.media_types?.some(t => t?.startsWith('video'))
    );
  } else if (mediaFilter === 'photo') {
    posts = posts.filter(p => 
      (p.media_type?.startsWith('image') || p.post_type === 'text') ||
      p.media_types?.some(t => t?.startsWith('image'))
    );
  }

  return {
    posts,
    feedType,
    mediaFilter,
    hasMore: posts.length === 20,
    cycleReset: false,
    nextOffset: offset + 20,
  };
}

/**
 * Hook to track user engagement and update interests
 * Also tracks media preferences (video vs photo)
 */
export const useEngagementTracker = () => {
  const { user, session } = useAuth();

  const trackEngagement = useCallback(async (
    postId: string,
    engagementType: 'like' | 'comment' | 'share' | 'refeed' | 'save' | 'watch',
    watchDuration?: number,
    mediaType?: string
  ) => {
    if (!user || !session) return;

    try {
      // Call the RPC to update user interests
      await supabase.rpc('update_user_interests_from_engagement' as any, {
        p_user_id: user.id,
        p_post_id: postId,
        p_engagement_type: engagementType,
        p_watch_duration: watchDuration || null,
      });

      // Track media preference if media type is provided
      if (mediaType) {
        await supabase.rpc('track_media_preference' as any, {
          p_user_id: user.id,
          p_media_type: mediaType,
          p_watch_duration: watchDuration || null,
          p_completed: engagementType === 'watch' && (watchDuration || 0) > 30,
        });
      }
    } catch (error) {
      console.error('Failed to track engagement for interests:', error);
    }
  }, [user, session]);

  /**
   * Track media view/watch for preference learning
   */
  const trackMediaView = useCallback(async (
    mediaType: 'video' | 'image' | 'photo' | 'text',
    watchDuration?: number,
    completed?: boolean
  ) => {
    if (!user) return;

    try {
      await supabase.rpc('track_media_preference' as any, {
        p_user_id: user.id,
        p_media_type: mediaType,
        p_watch_duration: watchDuration || null,
        p_completed: completed || false,
      });
    } catch (error) {
      console.error('Failed to track media preference:', error);
    }
  }, [user]);

  return { trackEngagement, trackMediaView };
};

/**
 * Hook to manually trigger feed cycle reset check
 */
export const useFeedCycleReset = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const checkAndReset = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase.rpc('reset_viewed_posts_cycle' as any, {
        p_user_id: user.id,
      });

      if (error) throw error;
      return data?.[0];
    },
    onSuccess: (data) => {
      if (data?.was_reset) {
        // Invalidate feed queries to refetch fresh content
        queryClient.invalidateQueries({ queryKey: ['enhanced-feed'] });
        queryClient.invalidateQueries({ queryKey: ['personalized-feed'] });
      }
    },
  });

  return checkAndReset;
};

/**
 * Hook to get user's media preferences
 */
export const useMediaPreferences = () => {
  const { user } = useAuth();

  const { data: preferences } = useInfiniteQuery({
    queryKey: ['media-preferences', user?.id],
    initialPageParam: 0,
    queryFn: async () => {
      if (!user) return null;
      
      const { data } = await supabase
        .from('user_media_preferences')
        .select('*')
        .eq('user_id', user.id)
        .single();
      
      return data;
    },
    getNextPageParam: () => undefined,
    enabled: !!user,
    staleTime: 1000 * 60 * 5,
  });

  return {
    preferredMediaType: preferences?.pages?.[0]?.preferred_media_type || 'all',
    videoWatchSeconds: preferences?.pages?.[0]?.video_watch_seconds || 0,
    photoViewCount: preferences?.pages?.[0]?.photo_view_count || 0,
  };
};
