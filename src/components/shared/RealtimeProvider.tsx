import React, { useEffect, useCallback, useRef } from 'react';
import { useRealtimeSubscriptions } from '@/hooks/useRealtimeSubscriptions';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Component that initializes global real-time subscriptions
 * Place this inside AuthProvider and QueryClientProvider
 * 
 * Ensures:
 * - Real-time subscriptions are active
 * - Data refreshes when app comes to foreground
 * - Handles mobile app background/foreground transitions
 */
export const RealtimeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const queryClient = useQueryClient();
  const lastVisibleTime = useRef<number>(Date.now());
  const STALE_THRESHOLD = 30 * 1000; // 30 seconds

  // Initialize all real-time subscriptions
  useRealtimeSubscriptions();

  // Handle app visibility changes for mobile
  const handleVisibilityChange = useCallback(() => {
    if (document.visibilityState === 'visible') {
      const timeInBackground = Date.now() - lastVisibleTime.current;
      
      console.log('[RealtimeProvider] App visible, time in background:', timeInBackground, 'ms');
      
      // If app was in background for more than threshold, refresh all data
      if (timeInBackground > STALE_THRESHOLD) {
        console.log('[RealtimeProvider] Data stale, refreshing all queries...');
        
        // Invalidate all queries to force fresh fetch
        queryClient.invalidateQueries();
        
        // Reconnect Supabase realtime channels
        try {
          supabase.realtime.disconnect();
          setTimeout(() => {
            supabase.realtime.connect();
            console.log('[RealtimeProvider] Realtime reconnected');
          }, 100);
        } catch (e) {
          console.error('[RealtimeProvider] Reconnect error:', e);
        }
      } else {
        // Just refresh critical live data
        queryClient.invalidateQueries({ queryKey: ['live-streams'] });
        queryClient.invalidateQueries({ queryKey: ['live-spaces'] });
      }
    } else {
      lastVisibleTime.current = Date.now();
    }
  }, [queryClient]);

  // Handle online/offline transitions
  const handleOnline = useCallback(() => {
    console.log('[RealtimeProvider] Network online, refreshing data...');
    queryClient.invalidateQueries();
    
    // Reconnect Supabase realtime
    try {
      supabase.realtime.disconnect();
      setTimeout(() => {
        supabase.realtime.connect();
      }, 100);
    } catch (e) {
      console.error('[RealtimeProvider] Reconnect error:', e);
    }
  }, [queryClient]);

  useEffect(() => {
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('online', handleOnline);
    window.addEventListener('focus', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('focus', handleVisibilityChange);
    };
  }, [handleVisibilityChange, handleOnline]);
  
  return <>{children}</>;
};
