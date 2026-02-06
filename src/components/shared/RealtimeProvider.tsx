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

  // Handle app visibility changes for mobile - DISABLED to prevent auto-refresh kicking users off screens
  // Manual refresh via pull-to-refresh is still available
  const handleVisibilityChange = useCallback(() => {
    if (document.visibilityState === 'visible') {
      const timeInBackground = Date.now() - lastVisibleTime.current;
      
      console.log('[RealtimeProvider] App visible, time in background:', timeInBackground, 'ms');
      
      // Only reconnect realtime channels if offline for a long time (5+ minutes)
      // Do NOT invalidate queries - this causes page refreshes that kick users off
      if (timeInBackground > 5 * 60 * 1000) {
        console.log('[RealtimeProvider] Long background period, reconnecting realtime only...');
        
        // Reconnect Supabase realtime channels only
        try {
          supabase.realtime.disconnect();
          setTimeout(() => {
            supabase.realtime.connect();
            console.log('[RealtimeProvider] Realtime reconnected');
          }, 100);
        } catch (e) {
          console.error('[RealtimeProvider] Reconnect error:', e);
        }
      }
      // Do NOT invalidate queries here - this causes the refresh issue
    } else {
      lastVisibleTime.current = Date.now();
    }
  }, []);

  // Handle online/offline transitions - only reconnect realtime, don't refresh queries
  const handleOnline = useCallback(() => {
    console.log('[RealtimeProvider] Network online, reconnecting realtime...');
    
    // Only reconnect Supabase realtime - do NOT invalidate queries
    try {
      supabase.realtime.disconnect();
      setTimeout(() => {
        supabase.realtime.connect();
      }, 100);
    } catch (e) {
      console.error('[RealtimeProvider] Reconnect error:', e);
    }
  }, []);

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
