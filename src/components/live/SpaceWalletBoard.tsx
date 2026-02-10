import { useState, useEffect } from 'react';
import { Coins, Gift, TrendingUp, Crown } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

interface TopGifter {
  sender_id: string;
  display_name: string;
  username: string;
  avatar_url: string;
  total_value: number;
}

interface SpaceWalletBoardProps {
  spaceId: string;
  className?: string;
  variant?: 'compact' | 'bar';
}

const GIFT_EMOJI_MAP: Record<string, string> = {
  rose: '🌹', coffee: '☕', heart: '❤️', diamond: '💎',
  rocket: '🚀', castle: '🏰', crown: '👑', universe: '🌌', credits: '💰',
};

export const SpaceWalletBoard = ({ spaceId, className, variant = 'compact' }: SpaceWalletBoardProps) => {
  const [totalValue, setTotalValue] = useState(0);
  const [giftCount, setGiftCount] = useState(0);
  const [topGifters, setTopGifters] = useState<TopGifter[]>([]);
  const [lastGift, setLastGift] = useState<{ emoji: string; value: number; sender: string } | null>(null);

  const fetchData = async () => {
    const { data, count } = await supabase
      .from('live_space_gifts')
      .select('sender_id, gift_type, credit_value', { count: 'exact' })
      .eq('space_id', spaceId);

    setGiftCount(count || 0);
    const total = data?.reduce((sum, g) => sum + (g.credit_value || 0), 0) || 0;
    setTotalValue(total);

    if (data && data.length > 0) {
      const gifterMap = new Map<string, number>();
      data.forEach(g => {
        gifterMap.set(g.sender_id, (gifterMap.get(g.sender_id) || 0) + (g.credit_value || 0));
      });

      const topIds = [...gifterMap.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([id, val]) => ({ id, val }));

      if (topIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, display_name, username, avatar_url')
          .in('id', topIds.map(t => t.id));

        const gifters: TopGifter[] = topIds.map(t => {
          const profile = profiles?.find(p => p.id === t.id);
          return {
            sender_id: t.id,
            display_name: profile?.display_name || 'User',
            username: profile?.username || 'user',
            avatar_url: profile?.avatar_url || '',
            total_value: t.val,
          };
        });
        setTopGifters(gifters);
      }
    }
  };

  useEffect(() => {
    fetchData();

    const channel = supabase
      .channel(`space-wallet-${spaceId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'live_space_gifts',
        filter: `space_id=eq.${spaceId}`,
      }, async (payload: any) => {
        fetchData();
        const emoji = GIFT_EMOJI_MAP[payload.new?.gift_type] || '🎁';
        // Get sender name
        const { data: sender } = await supabase
          .from('profiles')
          .select('display_name')
          .eq('id', payload.new?.sender_id)
          .single();
        setLastGift({ emoji, value: payload.new?.credit_value || 0, sender: sender?.display_name || 'Someone' });
        setTimeout(() => setLastGift(null), 3000);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [spaceId]);

  // Bar variant - full width, prominent
  if (variant === 'bar') {
    return (
      <div className={cn("relative w-full", className)}>
        <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-pink-500/10 border border-amber-500/20">
          {/* Left: Total earnings */}
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-500/30 to-orange-500/30 flex items-center justify-center">
              <Coins className="w-4 h-4 text-amber-400" />
            </div>
            <div>
              <p className="text-amber-400 font-bold text-sm leading-tight">{totalValue.toLocaleString()}</p>
              <p className="text-[10px] text-muted-foreground">{giftCount} gifts</p>
            </div>
          </div>

          {/* Center: Top gifters */}
          <div className="flex items-center gap-2">
            {topGifters.slice(0, 3).map((gifter, i) => (
              <div key={gifter.sender_id} className="flex items-center gap-1 text-[10px]">
                <span className={cn(
                  "w-4 h-4 rounded-full flex items-center justify-center font-bold",
                  i === 0 ? "bg-amber-500/30 text-amber-400" :
                  i === 1 ? "bg-gray-400/20 text-gray-400" :
                  "bg-orange-500/20 text-orange-400"
                )}>
                  {i === 0 ? <Crown className="w-2.5 h-2.5" /> : i + 1}
                </span>
                <span className="text-muted-foreground truncate max-w-[50px]">{gifter.display_name}</span>
              </div>
            ))}
            {topGifters.length === 0 && (
              <span className="text-[10px] text-muted-foreground">No gifts yet</span>
            )}
          </div>

          {/* Right: Gift icon */}
          <Gift className="w-4 h-4 text-amber-400/60" />
        </div>

        {/* New gift animation */}
        <AnimatePresence>
          {lastGift && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="absolute -bottom-7 left-0 right-0 flex items-center justify-center"
            >
              <span className="text-xs bg-amber-500/20 border border-amber-500/30 rounded-full px-3 py-0.5 text-amber-400">
                {lastGift.emoji} {lastGift.sender} sent +{lastGift.value} credits
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // Compact variant (default) - small badge
  return (
    <div className={cn("relative", className)}>
      <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-500/30">
        <Coins className="w-3.5 h-3.5 text-amber-400" />
        <span className="text-amber-400 font-bold text-xs">{totalValue.toLocaleString()}</span>
        {giftCount > 0 && (
          <span className="text-muted-foreground text-[10px]">({giftCount})</span>
        )}
      </div>
    </div>
  );
};
