import React, { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { format } from 'date-fns';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const giftEmojis: Record<string, string> = {
  heart: '❤️', star: '⭐', fire: '🔥', clap: '👏', rocket: '🚀',
  diamond: '💎', crown: '👑', rose: '🌹', gift: '🎁', money: '💰',
  sparkle: '✨', custom: '🎁', coffee: '☕', flower: '🌸', sun: '☀️',
  music: '🎵', pizza: '🍕', icecream: '🍦', moon: '🌙', lightning: '⚡',
  trophy: '🏆', party: '🎉', cake: '🎂', rainbow: '🌈', universe: '🌌',
};

interface ReceivedGiftsProps {
  selectionMode?: boolean;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
}

export const ReceivedGifts = ({ selectionMode = false, selectedIds, onToggleSelect }: ReceivedGiftsProps) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [convertingId, setConvertingId] = useState<string | null>(null);

  const { data: gifts, isLoading, refetch } = useQuery({
    queryKey: ['received-gifts', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('gift_analytics')
        .select(`
          *,
          sender:profiles!gift_analytics_sender_id_fkey(
            id, display_name, username, avatar_url
          )
        `)
        .eq('receiver_id', user?.id)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('received-gifts-realtime')
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'gift_analytics',
        filter: `receiver_id=eq.${user.id}`,
      }, () => refetch())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, refetch]);

  const handleConvertGift = async (giftId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setConvertingId(giftId);
    try {
      const { data, error } = await supabase.rpc('convert_gift', { p_gift_id: giftId });
      if (error) throw error;
      const result = data as { success: boolean; error?: string; credits_added?: number };
      if (!result.success) throw new Error(result.error || 'Failed to convert gift');
      toast.success(`+${result.credits_added} credits added`);
      queryClient.invalidateQueries({ queryKey: ['received-gifts'] });
      queryClient.invalidateQueries({ queryKey: ['user-credits'] });
      queryClient.invalidateQueries({ queryKey: ['gift-stats'] });
      queryClient.invalidateQueries({ queryKey: ['unconverted-gifts'] });
    } catch (error: any) {
      toast.error(error.message || 'Failed to convert gift');
    } finally {
      setConvertingId(null);
    }
  };

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
        No gifts received yet
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
        const sender = gift.sender as any;
        const netAmount = gift.credit_value - (gift.platform_fee || 0);
        const clickable = isClickable(gift);
        const isConverted = gift.is_converted === true;
        const isConverting = convertingId === gift.id;

        return (
          <div
            key={gift.id}
            onClick={() => clickable && handleGiftClick(gift)}
            className={`flex items-center justify-between py-3 px-1 transition-colors ${clickable ? 'cursor-pointer hover:bg-muted/30' : ''}`}
          >
            <div className="flex items-center gap-3 min-w-0">
              {selectionMode && !isConverted && (
                <Checkbox
                  checked={selectedIds?.has(gift.id)}
                  onCheckedChange={() => onToggleSelect?.(gift.id)}
                  onClick={(e) => e.stopPropagation()}
                  className="data-[state=checked]:bg-primary shrink-0"
                />
              )}
              <span className="text-lg shrink-0">{giftEmojis[gift.gift_type?.toLowerCase()] || '🎁'}</span>
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">
                  {sender?.display_name || sender?.username || 'Anonymous'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {format(new Date(gift.created_at), 'MMM d · h:mm a')}
                  <span className="ml-1.5 opacity-60">{gift.source_type}</span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {isConverted ? (
                <span className="text-sm font-semibold text-primary">+{netAmount}</span>
              ) : (
                <>
                  <span className="text-sm font-semibold text-foreground">{netAmount}</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={(e) => handleConvertGift(gift.id, e)}
                    disabled={isConverting}
                    className="h-7 px-2.5 text-xs text-primary hover:text-primary hover:bg-primary/10"
                  >
                    {isConverting ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Redeem'}
                  </Button>
                </>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
