import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface DistributedCounts {
  feed: number;    // like, comment, reply, mention, refeed, quote, follow, story_reply, story_reaction
  messages: number; // message, friend_request, friend_request_accepted, call_missed
  wallet: number;   // gift, gift_received, live_gift, space_gift, credit_received, credit_transfer
}

const FEED_NOTIFICATION_TYPES = [
  'like', 'comment', 'reply', 'mention', 'refeed', 'quote', 
  'follow', 'story_reply', 'story_reaction', 'post_promoted',
  'role_promotion', 'plan_upgrade'
];

const MESSAGE_NOTIFICATION_TYPES = [
  'message', 'friend_request', 'friend_request_accepted', 'friend_accepted',
  'call_missed', 'group_invite', 'group_message'
];

const WALLET_NOTIFICATION_TYPES = [
  'gift', 'gift_received', 'live_gift', 'space_gift', 
  'credit_received', 'credit_transfer', 'subscription', 'payout'
];

export const useDistributedNotifications = () => {
  const { user } = useAuth();
  const [counts, setCounts] = useState<DistributedCounts>({ feed: 0, messages: 0, wallet: 0 });
  const [loading, setLoading] = useState(true);

  const categorizeType = useCallback((type: string): keyof DistributedCounts | null => {
    if (FEED_NOTIFICATION_TYPES.includes(type)) return 'feed';
    if (MESSAGE_NOTIFICATION_TYPES.includes(type)) return 'messages';
    if (WALLET_NOTIFICATION_TYPES.includes(type)) return 'wallet';
    return null;
  }, []);

  const loadCounts = useCallback(async () => {
    if (!user) {
      setCounts({ feed: 0, messages: 0, wallet: 0 });
      setLoading(false);
      return;
    }

    try {
      // Fetch all unread notifications in one query
      const { data, error } = await supabase
        .from('notifications')
        .select('type')
        .eq('user_id', user.id)
        .eq('is_read', false);

      if (error) throw error;

      // Categorize and count
      const newCounts: DistributedCounts = { feed: 0, messages: 0, wallet: 0 };
      
      (data || []).forEach(notification => {
        const category = categorizeType(notification.type);
        if (category) {
          newCounts[category]++;
        }
      });

      setCounts(newCounts);
    } catch (error) {
      console.error('Error loading distributed notification counts:', error);
    } finally {
      setLoading(false);
    }
  }, [user, categorizeType]);

  // Mark notifications as read by category
  const markCategoryAsRead = useCallback(async (category: keyof DistributedCounts) => {
    if (!user) return;

    let types: string[] = [];
    switch (category) {
      case 'feed':
        types = FEED_NOTIFICATION_TYPES;
        break;
      case 'messages':
        types = MESSAGE_NOTIFICATION_TYPES;
        break;
      case 'wallet':
        types = WALLET_NOTIFICATION_TYPES;
        break;
    }

    try {
      await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', user.id)
        .eq('is_read', false)
        .in('type', types);

      // Update local state immediately
      setCounts(prev => ({ ...prev, [category]: 0 }));
    } catch (error) {
      console.error('Error marking category as read:', error);
    }
  }, [user]);

  useEffect(() => {
    loadCounts();

    if (!user) return;

    // Subscribe to real-time notification changes
    const channel = supabase
      .channel(`distributed-notifications:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        (payload: any) => {
          const category = categorizeType(payload.new?.type);
          if (category) {
            setCounts(prev => ({ ...prev, [category]: prev[category] + 1 }));
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        (payload: any) => {
          // If marked as read, decrement the appropriate counter
          if (payload.new?.is_read && !payload.old?.is_read) {
            const category = categorizeType(payload.new?.type);
            if (category) {
              setCounts(prev => ({ ...prev, [category]: Math.max(0, prev[category] - 1) }));
            }
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          // On delete, just reload all counts
          loadCounts();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, loadCounts, categorizeType]);

  return {
    counts,
    loading,
    markCategoryAsRead,
    refetch: loadCounts,
  };
};
