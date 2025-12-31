import { useEffect, useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

/**
 * Global real-time subscriptions for FeedIn
 * Ensures all data updates are instant across the app
 */
export const useRealtimeSubscriptions = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const channelsRef = useRef<ReturnType<typeof supabase.channel>[]>([]);

  const invalidateQueries = useCallback((keys: string[]) => {
    keys.forEach(key => {
      queryClient.invalidateQueries({ queryKey: [key] });
    });
  }, [queryClient]);

  useEffect(() => {
    if (!user) return;

    // Clean up existing channels
    channelsRef.current.forEach(ch => supabase.removeChannel(ch));
    channelsRef.current = [];

    // 1. Credits & Wallet real-time
    const walletChannel = supabase
      .channel('realtime-wallet')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'user_credits',
        filter: `user_id=eq.${user.id}`,
      }, () => {
        invalidateQueries(['user-credits', 'wallet-balance']);
      })
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'credit_transactions',
        filter: `user_id=eq.${user.id}`,
      }, () => {
        invalidateQueries(['credit-transactions', 'user-credits', 'wallet-balance']);
      })
      .subscribe();
    channelsRef.current.push(walletChannel);

    // 2. Gifts real-time (received gifts)
    const giftsChannel = supabase
      .channel('realtime-gifts')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'gift_analytics',
        filter: `receiver_id=eq.${user.id}`,
      }, () => {
        invalidateQueries(['received-gifts', 'gift-stats', 'user-credits']);
      })
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'post_gifts',
      }, () => {
        invalidateQueries(['post-gifts', 'gift-stats']);
      })
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'live_stream_gifts',
      }, () => {
        invalidateQueries(['live-stream-gifts', 'gift-stats']);
      })
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'live_space_gifts',
      }, () => {
        invalidateQueries(['live-space-gifts', 'gift-stats']);
      })
      .subscribe();
    channelsRef.current.push(giftsChannel);

    // 3. Notifications real-time
    const notificationsChannel = supabase
      .channel('realtime-notifications')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${user.id}`,
      }, () => {
        invalidateQueries(['notifications', 'unread-notifications']);
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${user.id}`,
      }, () => {
        invalidateQueries(['notifications', 'unread-notifications']);
      })
      .subscribe();
    channelsRef.current.push(notificationsChannel);

    // 4. Messages real-time
    const messagesChannel = supabase
      .channel('realtime-messages')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'messages',
      }, () => {
        invalidateQueries(['messages', 'conversations', 'unread-messages']);
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'message_reactions',
      }, () => {
        invalidateQueries(['message-reactions', 'messages']);
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'conversations',
      }, () => {
        invalidateQueries(['conversations']);
      })
      .subscribe();
    channelsRef.current.push(messagesChannel);

    // 5. Posts & Feed real-time
    const feedChannel = supabase
      .channel('realtime-feed')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'posts',
      }, () => {
        invalidateQueries(['feed-posts', 'posts', 'user-posts']);
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'post_likes',
      }, () => {
        invalidateQueries(['post-likes', 'posts']);
      })
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'post_comments',
      }, () => {
        invalidateQueries(['post-comments', 'posts']);
      })
      .subscribe();
    channelsRef.current.push(feedChannel);

    // 6. Follows & Friends real-time
    const socialChannel = supabase
      .channel('realtime-social')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'follows',
      }, () => {
        invalidateQueries(['followers', 'following', 'follow-status']);
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'friend_requests',
        filter: `receiver_id=eq.${user.id}`,
      }, () => {
        invalidateQueries(['friend-requests', 'friends']);
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'friend_requests',
        filter: `sender_id=eq.${user.id}`,
      }, () => {
        invalidateQueries(['friend-requests', 'friends']);
      })
      .subscribe();
    channelsRef.current.push(socialChannel);

    // 7. Stories real-time
    const storiesChannel = supabase
      .channel('realtime-stories')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'stories',
      }, () => {
        invalidateQueries(['stories', 'user-stories']);
      })
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'story_views',
      }, () => {
        invalidateQueries(['story-views']);
      })
      .subscribe();
    channelsRef.current.push(storiesChannel);

    // 8. Live Streams & Spaces real-time
    const liveChannel = supabase
      .channel('realtime-live')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'live_streams',
      }, () => {
        invalidateQueries(['live-streams', 'active-streams']);
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'live_spaces',
      }, () => {
        invalidateQueries(['live-spaces', 'active-spaces']);
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'live_space_speakers',
      }, () => {
        invalidateQueries(['space-speakers']);
      })
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'live_space_messages',
      }, () => {
        invalidateQueries(['space-messages']);
      })
      .subscribe();
    channelsRef.current.push(liveChannel);

    // 9. Calls real-time
    const callsChannel = supabase
      .channel('realtime-calls')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'call_logs',
      }, () => {
        invalidateQueries(['call-logs', 'call-history']);
      })
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'call_signals',
      }, () => {
        invalidateQueries(['call-signals']);
      })
      .subscribe();
    channelsRef.current.push(callsChannel);

    // 10. Profile updates real-time
    const profileChannel = supabase
      .channel('realtime-profiles')
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'profiles',
        filter: `id=eq.${user.id}`,
      }, () => {
        invalidateQueries(['profile', 'user-profile']);
      })
      .subscribe();
    channelsRef.current.push(profileChannel);

    // Cleanup on unmount
    return () => {
      channelsRef.current.forEach(ch => supabase.removeChannel(ch));
      channelsRef.current = [];
    };
  }, [user, invalidateQueries]);
};

/**
 * Hook for specific table real-time updates
 */
export const useTableRealtime = (
  tableName: string,
  queryKeys: string[],
  filter?: string
) => {
  const queryClient = useQueryClient();

  useEffect(() => {
    const channelConfig: any = {
      event: '*',
      schema: 'public',
      table: tableName,
    };

    if (filter) {
      channelConfig.filter = filter;
    }

    const channel = supabase
      .channel(`realtime-${tableName}-${filter || 'all'}`)
      .on('postgres_changes', channelConfig, () => {
        queryKeys.forEach(key => {
          queryClient.invalidateQueries({ queryKey: [key] });
        });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tableName, queryKeys, filter, queryClient]);
};
