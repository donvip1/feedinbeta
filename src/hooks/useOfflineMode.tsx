import { useState, useEffect, useCallback } from 'react';
import { useNetworkStatus } from './useNetworkStatus';
import { feedCache, CachedPost, profileCache, CachedProfile } from '@/lib/feed-cache';

interface OfflineModeState {
  isOffline: boolean;
  cachedPosts: CachedPost[];
  cachedProfile: CachedProfile | null;
  lastSyncTime: Date | null;
  hasCache: boolean;
}

/**
 * Hook for managing offline mode with cached data
 */
export const useOfflineMode = (userId?: string) => {
  const isOnline = useNetworkStatus();
  const [state, setState] = useState<OfflineModeState>({
    isOffline: !navigator.onLine,
    cachedPosts: [],
    cachedProfile: null,
    lastSyncTime: null,
    hasCache: false,
  });

  // Load cached data when offline
  const loadCachedData = useCallback(async () => {
    try {
      // Load cached posts
      const forYouPosts = await feedCache.get('forYou');
      const followingPosts = await feedCache.get('following');
      const allPosts = [...(forYouPosts || []), ...(followingPosts || [])];
      
      // Remove duplicates
      const uniquePosts = allPosts.filter((post, index, self) => 
        index === self.findIndex(p => p.id === post.id)
      );

      // Load cached profile
      let profile: CachedProfile | null = null;
      if (userId) {
        profile = await profileCache.get(userId);
      }

      // Get last sync time from localStorage
      const lastSyncStr = localStorage.getItem('lastFeedSync');
      const lastSync = lastSyncStr ? new Date(lastSyncStr) : null;

      setState({
        isOffline: !isOnline,
        cachedPosts: uniquePosts,
        cachedProfile: profile,
        lastSyncTime: lastSync,
        hasCache: uniquePosts.length > 0 || profile !== null,
      });
    } catch (error) {
      console.error('Error loading cached data:', error);
    }
  }, [userId, isOnline]);

  // Update sync time when online
  const updateSyncTime = useCallback(() => {
    const now = new Date();
    localStorage.setItem('lastFeedSync', now.toISOString());
    setState(prev => ({ ...prev, lastSyncTime: now }));
  }, []);

  // Load cached data on mount and when going offline
  useEffect(() => {
    loadCachedData();
  }, [loadCachedData]);

  // Update sync time when coming back online
  useEffect(() => {
    if (isOnline) {
      updateSyncTime();
    }
    setState(prev => ({ ...prev, isOffline: !isOnline }));
  }, [isOnline, updateSyncTime]);

  return {
    ...state,
    loadCachedData,
    updateSyncTime,
  };
};

export default useOfflineMode;
