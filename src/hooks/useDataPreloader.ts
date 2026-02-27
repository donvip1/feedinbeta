import { useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { appShellPreloader } from '@/lib/app-shell-preloader';
import { backgroundSync } from '@/lib/background-sync';
import { navigationPrefetcher } from '@/lib/navigation-prefetcher';
import { feedCache } from '@/lib/feed-cache';
import { supabase } from '@/integrations/supabase/client';
import { memoryCache } from '@/lib/memory-cache';
import { preloadBadgeData } from '@/components/profile/VerifiedBadge';

/**
 * Hook to initialize data preloading and background sync on app start
 * Should be used once in the App or main layout component
 */
export function useDataPreloader(): void {
  const { user } = useAuth();
  const initialized = useRef(false);

  useEffect(() => {
    if (user?.id && !initialized.current) {
      initialized.current = true;

      // Background sync initialization
      backgroundSync.initialize(user.id);
      
      // Set user for navigation prefetcher
      navigationPrefetcher.setUserId(user.id);
      
      // Preload user profile immediately for instant access
      preloadUserProfile(user.id);
      
      // Preload badge data for the current user
      preloadBadgeData(user.id);
      
      // Preload feed data in background
      preloadFeedData(user.id);
    }

    // Cleanup on user change or unmount
    return () => {
      if (!user) {
        initialized.current = false;
        backgroundSync.stop();
        appShellPreloader.reset();
        navigationPrefetcher.reset();
      }
    };
  }, [user?.id]);
}

/**
 * Preload user profile data for instant display
 */
async function preloadUserProfile(userId: string) {
  try {
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    
    if (profile) {
      // Cache in memory for instant access
      memoryCache.set(`profile:${userId}`, profile, 10 * 60 * 1000);
      
      // Also cache by username if available
      if (profile.username) {
        memoryCache.set(`profile:${profile.username}`, profile, 10 * 60 * 1000);
      }
      
      // Store user ID in localStorage for quick access
      localStorage.setItem('currentUserId', userId);
    }
  } catch (error) {
    console.error('Error preloading profile:', error);
  }
}

/**
 * Preload feed data for instant feed loading
 */
async function preloadFeedData(userId: string) {
  try {
    // Check if we already have cached feed data
    const cachedForYou = await feedCache.get('forYou');
    const cachedFollowing = await feedCache.get('following');
    
    // If no cache, fetch and cache feed data
    if (!cachedForYou || cachedForYou.length === 0) {
      const { data: posts } = await supabase
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
      
      if (posts && posts.length > 0) {
        const enrichedPosts = posts.map(post => ({
          ...post,
          _isPromoted: false,
          _boostLevel: null,
          _relevanceScore: 0
        }));
        await feedCache.set('forYou', enrichedPosts);
      }
    }
    
    // Preload following feed if not cached
    if (!cachedFollowing || cachedFollowing.length === 0) {
      // Get followed users
      const { data: follows } = await supabase
        .from('follows')
        .select('following_id')
        .eq('follower_id', userId);
      
      if (follows && follows.length > 0) {
        const followedIds = follows.map(f => f.following_id);
        
        const { data: posts } = await supabase
          .from('posts')
          .select(`
            *,
            profiles:user_id (username, display_name, avatar_url),
            original_post:original_post_id (
              id, user_id, content, media_url, media_type, media_urls, media_types, created_at,
              profiles:user_id (username, display_name, avatar_url)
            )
          `)
          .in('user_id', followedIds)
          .eq('status', 'active')
          .order('created_at', { ascending: false })
          .limit(50);
        
        if (posts && posts.length > 0) {
          const enrichedPosts = posts.map(post => ({
            ...post,
            _isPromoted: false,
            _boostLevel: null,
            _relevanceScore: 0
          }));
          await feedCache.set('following', enrichedPosts);
        }
      }
    }
  } catch (error) {
    console.error('Error preloading feed:', error);
  }
}

/**
 * Hook to listen for background sync updates
 */
export function useBackgroundSyncListener(callback: () => void): void {
  useEffect(() => {
    return backgroundSync.onSync(callback);
  }, [callback]);
}

export default useDataPreloader;
