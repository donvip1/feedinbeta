import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface ViewedPostsState {
  viewedPostIds: string[];
  markAsViewed: (postId: string) => void;
  isViewed: (postId: string) => boolean;
  resetViewedPosts: () => void;
  loading: boolean;
  hasViewedAllPosts: boolean;
  canCountView: (postId: string) => boolean;
  flushPendingViews: () => Promise<void>;
}

export function useViewedPosts(): ViewedPostsState {
  const { user } = useAuth();
  const [viewedPostIds, setViewedPostIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasViewedAllPosts, setHasViewedAllPosts] = useState(false);
  const pendingViews = useRef<Set<string>>(new Set());
  const flushTimeout = useRef<NodeJS.Timeout | null>(null);
  const isFlushing = useRef(false);

  // Load today's viewed posts from database on mount
  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const loadViewedPosts = async () => {
      try {
        const { data, error } = await supabase.rpc('get_today_viewed_posts');
        
        if (error) {
          console.error('Error loading viewed posts:', error);
          setViewedPostIds([]);
        } else {
          setViewedPostIds(data?.map((d: { post_id: string }) => d.post_id) || []);
        }

        // Check if all posts have been viewed
        const { data: allViewed } = await supabase.rpc('check_all_posts_viewed');
        setHasViewedAllPosts(allViewed || false);
      } catch (err) {
        console.error('Error loading viewed posts:', err);
        setViewedPostIds([]);
      } finally {
        setLoading(false);
      }
    };

    loadViewedPosts();
  }, [user]);

  // Batch flush pending views to database - IMMEDIATE version
  const flushPendingViews = useCallback(async () => {
    if (!user || pendingViews.current.size === 0 || isFlushing.current) return;

    isFlushing.current = true;
    const viewsToFlush = Array.from(pendingViews.current);
    pendingViews.current.clear();

    // Record views in batch (fire and forget)
    try {
      for (const postId of viewsToFlush) {
        try {
          await supabase.rpc('record_post_view', { p_post_id: postId });
        } catch (err) {
          console.error('Error recording post view:', err);
        }
      }
    } finally {
      isFlushing.current = false;
    }
  }, [user]);

  // Flush immediately when page becomes hidden (user leaves/switches app)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        // Immediately flush pending views when user leaves
        if (flushTimeout.current) {
          clearTimeout(flushTimeout.current);
          flushTimeout.current = null;
        }
        flushPendingViews();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [flushPendingViews]);

  // Flush on unmount or when user changes
  useEffect(() => {
    return () => {
      if (flushTimeout.current) {
        clearTimeout(flushTimeout.current);
      }
      flushPendingViews();
    };
  }, [flushPendingViews]);

  const markAsViewed = useCallback((postId: string) => {
    if (!user) return;
    
    // Optimistically update local state
    setViewedPostIds(prev => {
      if (prev.includes(postId)) return prev;
      return [...prev, postId];
    });

    // Add to pending batch
    pendingViews.current.add(postId);

    // Reduced debounce from 2000ms to 500ms for faster persistence
    if (flushTimeout.current) {
      clearTimeout(flushTimeout.current);
    }
    flushTimeout.current = setTimeout(flushPendingViews, 500);
  }, [user, flushPendingViews]);

  const isViewed = useCallback((postId: string) => {
    return viewedPostIds.includes(postId);
  }, [viewedPostIds]);

  // Check if a view should be counted (not already viewed today)
  const canCountView = useCallback((postId: string) => {
    return !viewedPostIds.includes(postId);
  }, [viewedPostIds]);

  const resetViewedPosts = useCallback(async () => {
    if (!user) return;
    
    setViewedPostIds([]);
    setHasViewedAllPosts(false);
    
    // Clear from database
    try {
      await supabase
        .from('post_view_history')
        .delete()
        .eq('user_id', user.id);
    } catch (err) {
      console.error('Error resetting viewed posts:', err);
    }
  }, [user]);

  return {
    viewedPostIds,
    markAsViewed,
    isViewed,
    resetViewedPosts,
    loading,
    hasViewedAllPosts,
    canCountView,
    flushPendingViews,
  };
}
