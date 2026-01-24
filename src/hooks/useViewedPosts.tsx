import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface ViewedPostsState {
  viewedPostIds: string[];
  markAsViewed: (postId: string, mediaType?: string) => void;
  isViewed: (postId: string) => boolean;
  resetViewedPosts: () => void;
  loading: boolean;
  hasViewedAllPosts: boolean;
  canCountView: (postId: string) => boolean;
  sessionId: string;
}

/**
 * Generate a unique session ID for tracking views within a session
 */
const generateSessionId = (): string => {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

export function useViewedPosts(): ViewedPostsState {
  const { user } = useAuth();
  const [viewedPostIds, setViewedPostIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasViewedAllPosts, setHasViewedAllPosts] = useState(false);
  const [sessionId] = useState(() => generateSessionId());
  const pendingViews = useRef<Map<string, string | undefined>>(new Map()); // postId -> mediaType
  const flushTimeout = useRef<NodeJS.Timeout | null>(null);

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

  // Batch flush pending views to database
  const flushPendingViews = useCallback(async () => {
    if (!user || pendingViews.current.size === 0) return;

    const viewsToFlush = Array.from(pendingViews.current.entries());
    pendingViews.current.clear();

    // Record views in batch (fire and forget)
    for (const [postId, mediaType] of viewsToFlush) {
      try {
        await supabase.rpc('record_post_view', { p_post_id: postId });
        
        // Also track media preference if media type is provided
        if (mediaType) {
          await supabase.rpc('track_media_preference' as any, {
            p_user_id: user.id,
            p_media_type: mediaType,
            p_watch_duration: null,
            p_completed: false,
          });
        }
      } catch (err) {
        console.error('Error recording post view:', err);
      }
    }
  }, [user]);

  // Flush on unmount, visibility change, or when user changes
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        // Flush immediately when user leaves
        flushPendingViews();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (flushTimeout.current) {
        clearTimeout(flushTimeout.current);
      }
      flushPendingViews();
    };
  }, [flushPendingViews]);

  /**
   * Mark a post as viewed
   * @param postId - The post ID to mark as viewed
   * @param mediaType - Optional media type for preference tracking (video, image, text)
   */
  const markAsViewed = useCallback((postId: string, mediaType?: string) => {
    if (!user) return;
    
    // Optimistically update local state
    setViewedPostIds(prev => {
      if (prev.includes(postId)) return prev;
      return [...prev, postId];
    });

    // Add to pending batch with media type
    pendingViews.current.set(postId, mediaType);

    // Debounce the flush (2 seconds)
    if (flushTimeout.current) {
      clearTimeout(flushTimeout.current);
    }
    flushTimeout.current = setTimeout(flushPendingViews, 2000);
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
    sessionId,
  };
}
