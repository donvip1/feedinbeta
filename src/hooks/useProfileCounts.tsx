import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { memoryCache } from '@/lib/memory-cache';
import { useQueryClient } from '@tanstack/react-query';

interface ProfileCounts {
  postsCount: number;
  likesCount: number;
  friendsCount: number;
  followersCount: number;
  followingCount: number;
}

interface UseProfileCountsResult {
  counts: ProfileCounts;
  isLoading: boolean;
  refetch: () => Promise<void>;
}

const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

/**
 * Hook for instant profile counts with memory caching
 * Loads from cache synchronously, then updates in background
 */
export const useProfileCounts = (userId: string | null | undefined): UseProfileCountsResult => {
  const queryClient = useQueryClient();
  
  // Get cache key
  const cacheKey = userId ? `profile-counts:${userId}` : null;
  
  // INSTANT: Get from memory cache synchronously
  const cachedCounts = useMemo(() => {
    if (!cacheKey) return null;
    return memoryCache.get<ProfileCounts>(cacheKey);
  }, [cacheKey]);
  
  const [counts, setCounts] = useState<ProfileCounts>(
    cachedCounts || {
      postsCount: 0,
      likesCount: 0,
      friendsCount: 0,
      followersCount: 0,
      followingCount: 0,
    }
  );
  
  const [isLoading, setIsLoading] = useState(!cachedCounts);

  const fetchCounts = useCallback(async (showLoading = true) => {
    if (!userId) return;
    
    // Don't show loading if we have cached data
    if (showLoading && !cachedCounts) {
      setIsLoading(true);
    }

    try {
      // Fetch all counts in parallel for maximum speed
      const [postsResult, likesResult, friendsResult, profileResult] = await Promise.all([
        supabase.rpc('get_user_post_count', { user_uuid: userId }),
        supabase.rpc('get_user_total_likes', { user_uuid: userId }),
        supabase
          .from('friend_requests')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'accepted')
          .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`),
        supabase
          .from('profiles')
          .select('followers_count, following_count')
          .eq('id', userId)
          .single(),
      ]);

      const newCounts: ProfileCounts = {
        postsCount: postsResult.data || 0,
        likesCount: likesResult.data || 0,
        friendsCount: friendsResult.count || 0,
        followersCount: profileResult.data?.followers_count || 0,
        followingCount: profileResult.data?.following_count || 0,
      };

      setCounts(newCounts);
      
      // Cache for instant access next time
      if (cacheKey) {
        memoryCache.set(cacheKey, newCounts, CACHE_TTL);
      }
    } catch (error) {
      console.error('[useProfileCounts] Error fetching counts:', error);
    } finally {
      setIsLoading(false);
    }
  }, [userId, cacheKey, cachedCounts]);

  // Initial fetch - background if cached, with loading if not
  useEffect(() => {
    if (userId) {
      fetchCounts(!cachedCounts);
    }
  }, [userId, fetchCounts, cachedCounts]);

  // Real-time subscription for instant count updates
  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`profile-counts-${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'posts',
          filter: `user_id=eq.${userId}`,
        },
        () => {
          // Refetch counts when posts change
          fetchCounts(false);
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'post_likes',
        },
        () => {
          // Refetch counts when likes change
          fetchCounts(false);
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'friend_requests',
          filter: `sender_id=eq.${userId}`,
        },
        () => {
          // Refetch counts when friend requests change
          fetchCounts(false);
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'friend_requests',
          filter: `receiver_id=eq.${userId}`,
        },
        () => {
          // Refetch counts when friend requests change
          fetchCounts(false);
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'follows',
        },
        () => {
          // Refetch counts when follows change
          fetchCounts(false);
        }
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
 * Prefetch profile counts (call on hover, etc.)
 */
export const prefetchProfileCounts = async (userId: string): Promise<void> => {
  const cacheKey = `profile-counts:${userId}`;
  
  // Skip if already cached
  if (memoryCache.has(cacheKey)) return;

  try {
    const [postsResult, likesResult, friendsResult, profileResult] = await Promise.all([
      supabase.rpc('get_user_post_count', { user_uuid: userId }),
      supabase.rpc('get_user_total_likes', { user_uuid: userId }),
      supabase
        .from('friend_requests')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'accepted')
        .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`),
      supabase
        .from('profiles')
        .select('followers_count, following_count')
        .eq('id', userId)
        .single(),
    ]);

    const counts: ProfileCounts = {
      postsCount: postsResult.data || 0,
      likesCount: likesResult.data || 0,
      friendsCount: friendsResult.count || 0,
      followersCount: profileResult.data?.followers_count || 0,
      followingCount: profileResult.data?.following_count || 0,
    };

    memoryCache.set(cacheKey, counts, CACHE_TTL);
  } catch (error) {
    console.error('[prefetchProfileCounts] Error:', error);
  }
};

export default useProfileCounts;
