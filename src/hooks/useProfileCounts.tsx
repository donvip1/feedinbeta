import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { memoryCache } from '@/lib/memory-cache';

interface ProfileCounts {
  postsCount: number;
  likesCount: number;
  viewsCount: number;
  friendsCount: number;
  followersCount: number;
  followingCount: number;
}

interface UseProfileCountsResult {
  counts: ProfileCounts;
  isLoading: boolean;
  refetch: () => Promise<void>;
}

const CACHE_TTL = 30 * 60 * 1000; // 30 minutes
const DEFAULT_COUNTS: ProfileCounts = {
  postsCount: 0,
  likesCount: 0,
  viewsCount: 0,
  friendsCount: 0,
  followersCount: 0,
  followingCount: 0,
};

// Global prefetch tracking to avoid duplicate requests
const prefetchingUsers = new Set<string>();
const prefetchedUsers = new Set<string>();

/**
 * Get cached counts synchronously - INSTANT
 */
export const getCachedCounts = (userId: string): ProfileCounts | null => {
  return memoryCache.get<ProfileCounts>(`profile-counts:${userId}`);
};

/**
 * Fetch all counts in parallel using efficient queries
 */
const fetchAllCounts = async (userId: string): Promise<ProfileCounts> => {
  // Run ALL count queries in parallel for maximum speed
  const [postsResult, likesResult, viewsResult, friendsResult, followersResult, followingResult] = await Promise.all([
    // Posts count
    supabase
      .from('posts')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .neq('status', 'deleted'),
    
    // Likes received on user's posts
    supabase.rpc('get_user_total_likes', { user_uuid: userId }),
    
    // Total views on user's posts
    supabase
      .from('posts')
      .select('views_count')
      .eq('user_id', userId)
      .neq('status', 'deleted'),
    
    // Friends count (accepted friend requests)
    supabase
      .from('friend_requests')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'accepted')
      .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`),
    
    // Followers count
    supabase
      .from('follows')
      .select('id', { count: 'exact', head: true })
      .eq('following_id', userId),
    
    // Following count
    supabase
      .from('follows')
      .select('id', { count: 'exact', head: true })
      .eq('follower_id', userId),
  ]);

  // Sum up all views from posts
  const totalViews = (viewsResult.data || []).reduce((sum: number, post: any) => sum + (post.views_count || 0), 0);

  return {
    postsCount: postsResult.count || 0,
    likesCount: likesResult.data || 0,
    viewsCount: totalViews,
    friendsCount: friendsResult.count || 0,
    followersCount: followersResult.count || 0,
    followingCount: followingResult.count || 0,
  };
};

/**
 * Hook for profile counts with aggressive caching and prefetching
 */
export const useProfileCounts = (userId: string | null | undefined): UseProfileCountsResult => {
  const cacheKey = userId ? `profile-counts:${userId}` : null;
  const hasInitialized = useRef(false);
  const fetchInProgress = useRef(false);
  
  // INSTANT: Get from memory cache synchronously
  const cachedCounts = useMemo(() => {
    if (!cacheKey) return null;
    return memoryCache.get<ProfileCounts>(cacheKey);
  }, [cacheKey]);
  
  const [counts, setCounts] = useState<ProfileCounts>(cachedCounts || DEFAULT_COUNTS);
  const [isLoading, setIsLoading] = useState(!cachedCounts);

  const fetchCounts = useCallback(async (showLoading = true) => {
    if (!userId || fetchInProgress.current) return;
    
    fetchInProgress.current = true;
    
    if (showLoading && !cachedCounts) {
      setIsLoading(true);
    }

    try {
      const newCounts = await fetchAllCounts(userId);

      setCounts(newCounts);
      
      if (cacheKey) {
        memoryCache.set(cacheKey, newCounts, CACHE_TTL);
        prefetchedUsers.add(userId);
      }
    } catch (error) {
      console.error('[useProfileCounts] Error:', error);
    } finally {
      setIsLoading(false);
      fetchInProgress.current = false;
    }
  }, [userId, cacheKey, cachedCounts]);

  // Initial fetch - only once, and only if not already cached
  useEffect(() => {
    if (!userId || hasInitialized.current) return;
    hasInitialized.current = true;
    
    if (cachedCounts) {
      setCounts(cachedCounts);
      setIsLoading(false);
      // Silent background refresh
      fetchCounts(false);
    } else {
      // No cache, fetch with loading
      fetchCounts(true);
    }
  }, [userId, cachedCounts, fetchCounts]);

  // Real-time: Subscribe to changes that affect counts
  useEffect(() => {
    if (!userId) return;

    // Subscribe to posts, likes, friends, follows changes
    const channel = supabase
      .channel(`profile-counts-realtime-${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'posts',
          filter: `user_id=eq.${userId}`,
        },
        () => fetchCounts(false)
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'post_likes',
        },
        () => fetchCounts(false)
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'friend_requests',
        },
        () => fetchCounts(false)
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'follows',
        },
        () => fetchCounts(false)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, fetchCounts]);

  return {
    counts,
    isLoading,
    refetch: () => fetchCounts(false),
  };
};

/**
 * Prefetch profile counts - call this EARLY (on app load for current user, on hover for others)
 */
export const prefetchProfileCounts = async (userId: string): Promise<void> => {
  const cacheKey = `profile-counts:${userId}`;
  
  // Skip if already cached or currently prefetching
  if (memoryCache.has(cacheKey) || prefetchingUsers.has(userId)) return;
  
  prefetchingUsers.add(userId);

  try {
    const counts = await fetchAllCounts(userId);
    memoryCache.set(cacheKey, counts, CACHE_TTL);
    prefetchedUsers.add(userId);
  } catch (error) {
    console.error('[prefetchProfileCounts] Error:', error);
  } finally {
    prefetchingUsers.delete(userId);
  }
};

/**
 * Prefetch current user's counts on app initialization
 */
export const initializeCurrentUserCounts = async (userId: string): Promise<void> => {
  if (prefetchedUsers.has(userId)) return;
  await prefetchProfileCounts(userId);
};

/**
 * Batch prefetch multiple users' counts at once - call on feed load
 */
export const batchPrefetchCounts = async (userIds: string[]): Promise<void> => {
  const uniqueIds = [...new Set(userIds)].filter(id => !memoryCache.has(`profile-counts:${id}`));
  
  // Prefetch in parallel, max 5 at a time
  const batchSize = 5;
  for (let i = 0; i < uniqueIds.length; i += batchSize) {
    const batch = uniqueIds.slice(i, i + batchSize);
    await Promise.all(batch.map(id => prefetchProfileCounts(id)));
  }
};

export default useProfileCounts;
