import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { profileCache, CachedProfile } from '@/lib/feed-cache';
import { memoryCache } from '@/lib/memory-cache';

interface FullProfile extends Omit<CachedProfile, 'posts_count'> {
  posts_count?: number;
  purpose?: string[] | null;
  linkedin_url?: string;
  twitter_url?: string;
  website_url?: string;
  location?: string;
  is_premium?: boolean;
  status?: string;
  status_visibility?: string;
  about?: string;
}

interface UseProfileResult {
  profile: FullProfile | null;
  isLoading: boolean;
  isFreshLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export const useProfileWithCache = (identifier: string | undefined): UseProfileResult => {
  // INSTANT: Check memory cache synchronously FIRST
  const memoryCached = identifier ? memoryCache.get<FullProfile>(`profile:${identifier}`) : null;
  
  const [profile, setProfile] = useState<FullProfile | null>(memoryCached);
  const [isLoading, setIsLoading] = useState(!memoryCached); // Only load if no memory cache
  const [isFreshLoading, setIsFreshLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [cacheChecked, setCacheChecked] = useState(!!memoryCached);

  // Check IndexedDB cache if memory cache miss
  useEffect(() => {
    if (!identifier || cacheChecked) return;
    
    profileCache.get(identifier).then(cached => {
      setCacheChecked(true);
      if (cached) {
        setProfile(cached as FullProfile);
        setIsLoading(false);
        // Save to memory cache for future instant access
        memoryCache.set(`profile:${identifier}`, cached, 30 * 60 * 1000);
      } else if (!memoryCached) {
        setIsLoading(true);
      }
    });
  }, [identifier, cacheChecked, memoryCached]);

  const fetchProfile = useCallback(async (showLoading = true) => {
    if (!identifier) {
      setIsLoading(false);
      return;
    }

    try {
      // If we already have cached data, just refresh in background
      if (profile) {
        setIsFreshLoading(true);
      } else if (showLoading) {
        setIsLoading(true);
      }

      // Determine if identifier is UUID or username
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(identifier);

      let query = supabase
        .from('profiles')
        .select(`
          id, username, display_name, avatar_url, cover_url, bio,
          followers_count, following_count,
          purpose, linkedin_url, twitter_url, website_url,
          location, is_premium, status, status_visibility, about
        `);

      if (isUUID) {
        query = query.eq('id', identifier);
      } else {
        query = query.eq('username', identifier);
      }

      const { data, error: fetchError } = await query.single();

      if (fetchError) {
        throw fetchError;
      }

      if (data) {
        // Get posts count separately
        const { count: postsCount } = await supabase
          .from('posts')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', data.id);

        const profileData: FullProfile = {
          id: data.id,
          username: data.username,
          display_name: data.display_name,
          avatar_url: data.avatar_url,
          cover_url: data.cover_url,
          bio: data.bio,
          followers_count: data.followers_count || 0,
          following_count: data.following_count || 0,
          posts_count: postsCount || 0,
          purpose: data.purpose,
          linkedin_url: data.linkedin_url,
          twitter_url: data.twitter_url,
          website_url: data.website_url,
          location: Array.isArray(data.location) ? data.location[0] : data.location,
          is_premium: data.is_premium,
          status: data.status,
          status_visibility: data.status_visibility,
          about: data.about,
        };

        setProfile(profileData);
        
        // Cache to memory (instant) and IndexedDB (persistent)
        memoryCache.set(`profile:${identifier}`, profileData, 30 * 60 * 1000);
        await profileCache.set(identifier, {
          ...profileData,
          posts_count: profileData.posts_count || 0,
        });
        
        // Also cache by ID if we fetched by username
        if (!isUUID && data.id !== identifier) {
          memoryCache.set(`profile:${data.id}`, profileData, 30 * 60 * 1000);
          await profileCache.set(data.id, {
            ...profileData,
            posts_count: profileData.posts_count || 0,
          });
        }
      }

      setError(null);
    } catch (err) {
      console.error('[useProfileWithCache] Error:', err);
      setError(err as Error);
    } finally {
      setIsLoading(false);
      setIsFreshLoading(false);
    }
  }, [identifier]);

  // Fetch fresh data in background after cache check
  useEffect(() => {
    if (cacheChecked) {
      fetchProfile(false); // Always background fetch, never show loading if we checked cache
    }
  }, [cacheChecked, fetchProfile]);

  return {
    profile,
    isLoading,
    isFreshLoading,
    error,
    refetch: () => fetchProfile(false),
  };
};

// Hook to prefetch a profile (e.g., on hover)
export const usePrefetchProfile = () => {
  const prefetch = useCallback(async (identifier: string) => {
    // Check if already cached
    const cached = await profileCache.get(identifier);
    if (cached) return;

    // Fetch and cache
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(identifier);

    let query = supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url, cover_url, bio, followers_count, following_count');

    if (isUUID) {
      query = query.eq('id', identifier);
    } else {
      query = query.eq('username', identifier);
    }

    const { data } = await query.single();

    if (data) {
      const profileData: CachedProfile = {
        id: data.id,
        username: data.username,
        display_name: data.display_name,
        avatar_url: data.avatar_url,
        cover_url: data.cover_url,
        bio: data.bio,
        followers_count: data.followers_count || 0,
        following_count: data.following_count || 0,
        posts_count: 0, // Will be fetched when full profile loads
      };

      await profileCache.set(identifier, profileData);
    }
  }, []);

  return { prefetch };
};

export default useProfileWithCache;
