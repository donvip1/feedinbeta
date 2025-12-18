import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface ViewedPostsState {
  viewedPostIds: string[];
  markAsViewed: (postId: string) => void;
  isViewed: (postId: string) => boolean;
  resetViewedPosts: () => void;
  loading: boolean;
}

export function useViewedPosts(): ViewedPostsState {
  const { user } = useAuth();
  const [viewedPostIds, setViewedPostIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

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
      } catch (err) {
        console.error('Error loading viewed posts:', err);
        setViewedPostIds([]);
      } finally {
        setLoading(false);
      }
    };

    loadViewedPosts();
  }, [user]);

  const markAsViewed = useCallback(async (postId: string) => {
    if (!user) return;
    
    // Optimistically update local state
    setViewedPostIds(prev => {
      if (prev.includes(postId)) return prev;
      return [...prev, postId];
    });

    // Record in database (fire and forget for performance)
    try {
      await supabase.rpc('record_post_view', { p_post_id: postId });
    } catch (err) {
      console.error('Error recording post view:', err);
    }
  }, [user]);

  const isViewed = useCallback((postId: string) => {
    return viewedPostIds.includes(postId);
  }, [viewedPostIds]);

  const resetViewedPosts = useCallback(async () => {
    if (!user) return;
    
    setViewedPostIds([]);
    
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
  };
}
