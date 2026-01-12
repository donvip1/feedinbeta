import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { memoryCache } from '@/lib/memory-cache';

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

const CACHE_TTL = 30 * 60 * 1000; // 30 minutes
const DEFAULT_COUNTS: ProfileCounts = {
  postsCount: 0,
  likesCount: 0,
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
 * Hook for INSTANT profile counts - reads directly from profiles table
 * All counts are denormalized and updated via database triggers
 */
export const useProfileCounts = (userId: string | null | undefined): UseProfileCountsResult => {
  const cacheKey = userId ? `profile-counts:${userId}` : null;
  const hasInitialized = useRef(false);
  
  // INSTANT: Get from memory cache synchronously
  const cachedCounts = useMemo(() => {
    if (!cacheKey) return null;
    return memoryCache.get<ProfileCounts>(cacheKey);
  }, [cacheKey]);
  
  const [counts, setCounts] = useState<ProfileCounts>(cachedCounts || DEFAULT_COUNTS);
  const [isLoading, setIsLoading] = useState(!cachedCounts);

  const fetchCounts = useCallback(async (showLoading = true) => {
    if (!userId) return;
    
    if (showLoading && !cachedCounts) {
      setIsLoading(true);
    }

    try {
      // SINGLE QUERY - all counts from profiles table (instant!)
      const { data, error } = await supabase
        .from('profiles')
        .select('posts_count, likes_count, friends_count, followers_count, following_count')
        .eq('id', userId)
        .single();

      if (error) throw error;

      // Cast to any to handle new columns before types regenerate
      const profileData = data as any;
      const newCounts: ProfileCounts = {
        postsCount: profileData?.posts_count || 0,
        likesCount: profileData?.likes_count || 0,
        friendsCount: profileData?.friends_count || 0,
        followersCount: profileData?.followers_count || 0,
        followingCount: profileData?.following_count || 0,
      };

      setCounts(newCounts);
      
      if (cacheKey) {
        memoryCache.set(cacheKey, newCounts, CACHE_TTL);
        prefetchedUsers.add(userId);
      }
    } catch (error) {
      console.error('[useProfileCounts] Error:', error);
    } finally {
      setIsLoading(false);
    }
  }, [userId, cacheKey, cachedCounts]);

  // Initial fetch - only once, and only if not already cached
  useEffect(() => {
    if (!userId || hasInitialized.current) return;
    hasInitialized.current = true;
    
    if (cachedCounts) {
      // Already have cached data, just do a silent background refresh
      fetchCounts(false);
    } else {
      // No cache, fetch with loading
      fetchCounts(true);
    }
  }, [userId]);

  // Real-time: Subscribe to profile changes only (triggers update counts automatically)
  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`profile-counts-${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${userId}`,
        },
        (payload) => {
          // INSTANT update from realtime payload - no refetch needed!
          const newData = payload.new as any;
          const newCounts: ProfileCounts = {
            postsCount: newData.posts_count || 0,
            likesCount: newData.likes_count || 0,
            friendsCount: newData.friends_count || 0,
            followersCount: newData.followers_count || 0,
            followingCount: newData.following_count || 0,
          };
          setCounts(newCounts);
          
          if (cacheKey) {
            memoryCache.set(cacheKey, newCounts, CACHE_TTL);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, cacheKey]);

  return {
    counts,
    isLoading,
    refetch: () => fetchCounts(false),
  };
};

/**
 * Prefetch profile counts - call this EARLY (on app load for current user, on hover for others)
 * This is the key to instant counts - prefetch before user navigates to profile
 */
export const prefetchProfileCounts = async (userId: string): Promise<void> => {
  const cacheKey = `profile-counts:${userId}`;
  
  // Skip if already cached or currently prefetching
  if (memoryCache.has(cacheKey) || prefetchingUsers.has(userId)) return;
  
  prefetchingUsers.add(userId);

  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('posts_count, likes_count, friends_count, followers_count, following_count')
      .eq('id', userId)
      .single();

    if (error) throw error;

    // Cast to any to handle new columns before types regenerate
    const profileData = data as any;
    const counts: ProfileCounts = {
      postsCount: profileData?.posts_count || 0,
      likesCount: profileData?.likes_count || 0,
      friendsCount: profileData?.friends_count || 0,
      followersCount: profileData?.followers_count || 0,
      followingCount: profileData?.following_count || 0,
    };

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
 * Call this from AuthContext or App component
 */
export const initializeCurrentUserCounts = async (userId: string): Promise<void> => {
  // Don't re-initialize if already done
  if (prefetchedUsers.has(userId)) return;
  
  await prefetchProfileCounts(userId);
};

export default useProfileCounts;