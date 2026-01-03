/**
 * Supabase Presence Hook for Live Streaming
 * Provides accurate real-time viewer counts using Supabase Realtime Presence
 * This tracks live browser sessions in memory - when a user closes the tab,
 * the count drops instantly (unlike database rows that can "stick")
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { RealtimeChannel } from '@supabase/supabase-js';

interface PresenceState {
  user_id: string;
  username?: string;
  avatar_url?: string;
  joined_at: string;
  is_host?: boolean;
}

interface UseLivePresenceOptions {
  streamId: string;
  userId?: string;
  username?: string;
  avatarUrl?: string;
  isHost?: boolean;
}

interface UseLivePresenceReturn {
  viewerCount: number;
  viewers: PresenceState[];
  isConnected: boolean;
}

export function useLivePresence({
  streamId,
  userId,
  username,
  avatarUrl,
  isHost = false,
}: UseLivePresenceOptions): UseLivePresenceReturn {
  const [viewerCount, setViewerCount] = useState(0);
  const [viewers, setViewers] = useState<PresenceState[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const channelRef = useRef<RealtimeChannel | null>(null);

  const updateViewers = useCallback((presenceState: Record<string, PresenceState[]>) => {
    // Flatten presence state - each user can have multiple sessions
    const allViewers: PresenceState[] = [];
    const seenUsers = new Set<string>();

    Object.values(presenceState).forEach((presences) => {
      presences.forEach((presence) => {
        // Only count each user once
        if (!seenUsers.has(presence.user_id)) {
          seenUsers.add(presence.user_id);
          allViewers.push(presence);
        }
      });
    });

    setViewers(allViewers);
    setViewerCount(allViewers.length);
  }, []);

  useEffect(() => {
    if (!streamId) return;

    const channelName = `live-presence-${streamId}`;
    console.log('[Presence] Joining channel:', channelName);

    const channel = supabase.channel(channelName, {
      config: {
        presence: { key: userId || `anon-${Date.now()}` },
      },
    });

    channelRef.current = channel;

    // Track presence changes
    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState<PresenceState>();
        console.log('[Presence] Sync - viewers:', Object.keys(state).length);
        updateViewers(state);
      })
      .on('presence', { event: 'join' }, ({ key, newPresences }) => {
        console.log('[Presence] User joined:', key, newPresences);
      })
      .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
        console.log('[Presence] User left:', key, leftPresences);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          console.log('[Presence] Subscribed, tracking presence...');
          setIsConnected(true);

          // Track this user's presence
          const presenceData: PresenceState = {
            user_id: userId || `anon-${Date.now()}`,
            username: username || 'Viewer',
            avatar_url: avatarUrl,
            joined_at: new Date().toISOString(),
            is_host: isHost,
          };

          await channel.track(presenceData);
          console.log('[Presence] Tracked:', presenceData);
        } else if (status === 'CHANNEL_ERROR') {
          console.error('[Presence] Channel error');
          setIsConnected(false);
        }
      });

    return () => {
      console.log('[Presence] Leaving channel:', channelName);
      channel.unsubscribe();
      channelRef.current = null;
      setIsConnected(false);
    };
  }, [streamId, userId, username, avatarUrl, isHost, updateViewers]);

  // Update viewer count in database periodically (for offline display)
  useEffect(() => {
    if (!streamId || !isHost || viewerCount === 0) return;

    const updateDbCount = async () => {
      await supabase
        .from('live_streams')
        .update({ 
          viewer_count: viewerCount,
          peak_viewers: viewerCount, // Will be handled by trigger to only update if higher
        })
        .eq('id', streamId);
    };

    // Debounce updates
    const timeout = setTimeout(updateDbCount, 2000);
    return () => clearTimeout(timeout);
  }, [streamId, isHost, viewerCount]);

  return { viewerCount, viewers, isConnected };
}

export default useLivePresence;
