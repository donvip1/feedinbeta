import React, { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { format } from 'date-fns';

const giftEmojis: Record<string, string> = {
  heart: '❤️', star: '⭐', fire: '🔥', clap: '👏', rocket: '🚀',
  diamond: '💎', crown: '👑', rose: '🌹', gift: '🎁', money: '💰',
  coffee: '☕', flower: '🌸', sun: '☀️', music: '🎵', pizza: '🍕',
  icecream: '🍦', moon: '🌙', lightning: '⚡', trophy: '🏆',
  party: '🎉', cake: '🎂', rainbow: '🌈', universe: '🌌',
};

export const SentGifts = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { data: gifts, isLoading, refetch } = useQuery({
    queryKey: ['sent-gifts', user?.id],
    queryFn: async () => {
      const { data: giftData, error } = await supabase
        .from('gift_analytics')
        .select('*')
        .eq('sender_id', user?.id)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;

      const receiverIds = [...new Set(giftData?.map(g => g.receiver_id) || [])];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, display_name, username, avatar_url')
        .in('id', receiverIds);

      const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);
      return giftData?.map(gift => ({ ...gift, receiver: profileMap.get(gift.receiver_id) || null }));
    },
    enabled: !!user,
  });

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('sent-gifts-realtime')
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'gift_analytics',
        filter: `sender_id=eq.${user.id}`,
      }, () => refetch())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, refetch]);

  if (isLoading) {
    return (
      <div className="space-y-px">
        {[1, 2, 3].map(i => (
          <div key={i} className="animate-pulse h-14 bg-muted/30 rounded" />
        ))}
      </div>
    );
  }

  if (!gifts || gifts.length === 0) {
    return (
      <div className="text-center py-10 text-muted-foreground text-sm">
        No gifts sent yet
      </div>
    );
  }

  const handleGiftClick = (gift: any) => {
    if (gift.source_type === 'post' && gift.source_id) navigate(`/feed/post/${gift.source_id}`);
    else if (gift.source_type === 'live' && gift.source_id) navigate(`/live/stream/${gift.source_id}`);
  };

  const isClickable = (gift: any) =>
    (gift.source_type === 'post' || gift.source_type === 'live') && gift.source_id;

  return (
    <div className="max-h-[400px] overflow-y-auto divide-y divide-border/50">
      {gifts.map((gift) => {
        const receiver = gift.receiver as any;
        const clickable = isClickable(gift);

        return (
          <div
            key={gift.id}
            onClick={() => clickable && handleGiftClick(gift)}
            className={`flex items-center justify-between py-3 px-1 transition-colors ${clickable ? 'cursor-pointer hover:bg-muted/30' : ''}`}
          >
            <div className="flex items-center gap-3 min-w-0">
              <span className="text-lg shrink-0">{giftEmojis[gift.gift_type?.toLowerCase()] || '🎁'}</span>
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">
                  {receiver?.display_name || receiver?.username || 'Unknown'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {format(new Date(gift.created_at), 'MMM d · h:mm a')}
                  <span className="ml-1.5 opacity-60">{gift.source_type}</span>
                </p>
              </div>
            </div>

            <span className="text-sm font-semibold text-muted-foreground shrink-0">
              −{gift.credit_value}
            </span>
          </div>
        );
      })}
    </div>
  );
};
