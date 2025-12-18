import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'feedin_viewed_posts';
const DATE_KEY = 'feedin_viewed_posts_date';

interface ViewedPostsState {
  viewedPostIds: string[];
  markAsViewed: (postId: string) => void;
  isViewed: (postId: string) => boolean;
  resetViewedPosts: () => void;
}

export function useViewedPosts(): ViewedPostsState {
  const [viewedPostIds, setViewedPostIds] = useState<string[]>([]);

  // Load viewed posts from localStorage on mount
  useEffect(() => {
    const storedDate = localStorage.getItem(DATE_KEY);
    const today = new Date().toDateString();

    // Reset if it's a new day
    if (storedDate !== today) {
      localStorage.setItem(DATE_KEY, today);
      localStorage.setItem(STORAGE_KEY, JSON.stringify([]));
      setViewedPostIds([]);
    } else {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          setViewedPostIds(Array.isArray(parsed) ? parsed : []);
        } catch {
          setViewedPostIds([]);
        }
      }
    }
  }, []);

  const markAsViewed = useCallback((postId: string) => {
    setViewedPostIds(prev => {
      if (prev.includes(postId)) return prev;
      const updated = [...prev, postId];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const isViewed = useCallback((postId: string) => {
    return viewedPostIds.includes(postId);
  }, [viewedPostIds]);

  const resetViewedPosts = useCallback(() => {
    setViewedPostIds([]);
    localStorage.setItem(STORAGE_KEY, JSON.stringify([]));
  }, []);

  return {
    viewedPostIds,
    markAsViewed,
    isViewed,
    resetViewedPosts,
  };
}
