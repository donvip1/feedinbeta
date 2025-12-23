import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

export const useWalletNotifications = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [unreadGiftCount, setUnreadGiftCount] = useState(0);
  const [lastViewedAt, setLastViewedAt] = useState<string | null>(null);

  // Load last viewed timestamp
  const loadLastViewed = useCallback(async () => {
    if (!user) return;
    
    try {
      const { data } = await supabase
        .from('user_wallet_notifications')
        .select('last_viewed_at')
        .eq('user_id', user.id)
        .maybeSingle();

      if (data) {
        setLastViewedAt(data.last_viewed_at);
      }
    } catch (error) {
      console.error('Error loading wallet notification settings:', error);
    }
  }, [user]);

  // Count unread gifts
  const countUnreadGifts = useCallback(async () => {
    if (!user) return;

    try {
      let query = supabase
        .from('gift_analytics')
        .select('id', { count: 'exact' })
        .eq('receiver_id', user.id);

      if (lastViewedAt) {
        query = query.gt('created_at', lastViewedAt);
      }

      const { count, error } = await query;

      if (error) throw error;
      setUnreadGiftCount(count || 0);
    } catch (error) {
      console.error('Error counting unread gifts:', error);
    }
  }, [user, lastViewedAt]);

  // Mark wallet as viewed
  const markWalletViewed = useCallback(async () => {
    if (!user) return;

    try {
      const now = new Date().toISOString();
      
      const { error } = await supabase
        .from('user_wallet_notifications')
        .upsert({
          user_id: user.id,
          last_viewed_at: now,
        }, {
          onConflict: 'user_id'
        });

      if (error) throw error;
      
      setLastViewedAt(now);
      setUnreadGiftCount(0);
    } catch (error) {
      console.error('Error marking wallet as viewed:', error);
    }
  }, [user]);

  // Initial load
  useEffect(() => {
    loadLastViewed();
  }, [loadLastViewed]);

  // Count unread after getting last viewed
  useEffect(() => {
    if (user) {
      countUnreadGifts();
    }
  }, [user, lastViewedAt, countUnreadGifts]);

  // Subscribe to real-time gift updates
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('gift-notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'gift_analytics',
          filter: `receiver_id=eq.${user.id}`,
        },
        (payload) => {
          console.log('New gift received:', payload);
          
          // Increment unread count
          setUnreadGiftCount((prev) => prev + 1);
          
          // Invalidate wallet queries for immediate updates
          queryClient.invalidateQueries({ queryKey: ['user-credits'] });
          queryClient.invalidateQueries({ queryKey: ['received-gifts'] });
          queryClient.invalidateQueries({ queryKey: ['gift-stats'] });
          
          // Show toast notification
          const newGift = payload.new as any;
          toast.success('Gift received!', {
            description: `You received a ${newGift.gift_type} gift worth ${newGift.credit_value - (newGift.platform_fee || 0)} credits`,
          });
        }
      )
      .subscribe();

    // Also listen for gifts we send to update our balance
    const senderChannel = supabase
      .channel('gift-sent-updates')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'gift_analytics',
          filter: `sender_id=eq.${user.id}`,
        },
        () => {
          // Invalidate our credit balance after sending a gift
          queryClient.invalidateQueries({ queryKey: ['user-credits'] });
          queryClient.invalidateQueries({ queryKey: ['sent-gifts'] });
          queryClient.invalidateQueries({ queryKey: ['gift-stats'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(senderChannel);
    };
  }, [user, queryClient]);

  return {
    unreadGiftCount,
    markWalletViewed,
    refreshNotifications: countUnreadGifts,
  };
};
