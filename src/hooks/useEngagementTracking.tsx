import { useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export const useEngagementTracking = () => {
  const { user } = useAuth();
  const watchStartTimes = useRef<Map<string, number>>(new Map());

  const startWatching = useCallback((postId: string) => {
    watchStartTimes.current.set(postId, Date.now());
  }, []);

  const stopWatching = useCallback(async (postId: string, fullWatch: boolean = false) => {
    if (!user) return;
    
    const startTime = watchStartTimes.current.get(postId);
    if (!startTime) return;
    
    const watchDuration = (Date.now() - startTime) / 1000;
    watchStartTimes.current.delete(postId);
    
    if (watchDuration < 1) return;

    try {
      // Track engagement signal
      await supabase.from('user_engagement_signals' as any).insert({
        user_id: user.id,
        post_id: postId,
        watch_duration_seconds: watchDuration,
        full_watch: fullWatch,
        engagement_type: 'watch',
      });
    } catch (error) {
      console.error('Failed to track engagement:', error);
    }
  }, [user]);

  const trackEngagement = useCallback(async (
    postId: string, 
    engagementType: 'like' | 'comment' | 'share' | 'save' | 'skip'
  ) => {
    if (!user) return;

    try {
      await supabase.from('user_engagement_signals' as any).insert({
        user_id: user.id,
        post_id: postId,
        engagement_type: engagementType,
      });
    } catch (error) {
      console.error('Failed to track engagement:', error);
    }
  }, [user]);

  return {
    startWatching,
    stopWatching,
    trackEngagement,
  };
};
