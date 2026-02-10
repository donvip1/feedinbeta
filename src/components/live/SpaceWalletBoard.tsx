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
}

export const SpaceWalletBoard = ({ spaceId, className }: SpaceWalletBoardProps) => {
  const [totalValue, setTotalValue] = useState(0);
  const [giftCount, setGiftCount] = useState(0);
  const [topGifters, setTopGifters] = useState<TopGifter[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [lastGift, setLastGift] = useState<{ emoji: string; value: number } | null>(null);

  const GIFT_EMOJI_MAP: Record<string, string> = {
    rose: '🌹', coffee: '☕', heart: '❤️', diamond: '💎',
    rocket: '🚀', castle: '🏰', crown: '👑', universe: '🌌', credits: '💰',
  };

  const fetchData = async () => {
    const { data, count } = await supabase
      .from('live_space_gifts')
      .select('sender_id, gift_type, credit_value', { count: 'exact' })
      .eq('space_id', spaceId);

    setGiftCount(count || 0);
    const total = data?.reduce((sum, g) => sum + (g.credit_value || 0), 0) || 0;
    setTotalValue(total);

    // Calculate top gifters
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
      }, (payload: any) => {
        fetchData();
        // Flash animation for new gift
        const emoji = GIFT_EMOJI_MAP[payload.new?.gift_type] || '🎁';
        setLastGift({ emoji, value: payload.new?.credit_value || 0 });
        setTimeout(() => setLastGift(null), 2000);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [spaceId]);

  return (
    <div className={cn("relative", className)}>
      {/* Compact wallet badge */}
      <motion.button
        onClick={() => setExpanded(!expanded)}
        className={cn(
          "flex items-center gap-1.5 px-2.5 py-1.5 rounded-full",
          "bg-gradient-to-r from-amber-500/20 to-orange-500/20",
          "border border-amber-500/30 backdrop-blur-sm",
          "hover:scale-105 transition-transform"
        )}
        whileTap={{ scale: 0.95 }}
      >
        <Coins className="w-3.5 h-3.5 text-amber-400" />
        <span className="text-amber-400 font-bold text-xs">{totalValue.toLocaleString()}</span>
        {giftCount > 0 && (
          <span className="text-muted-foreground text-[10px]">({giftCount})</span>
        )}
      </motion.button>

      {/* New gift flash */}
      <AnimatePresence>
        {lastGift && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.5 }}
            animate={{ opacity: 1, y: -20, scale: 1 }}
            exit={{ opacity: 0, y: -40, scale: 0.5 }}
            className="absolute -top-6 left-1/2 -translate-x-1/2 text-lg pointer-events-none"
          >
            {lastGift.emoji} +{lastGift.value}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Expanded board */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: -5 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: -5 }}
            className="absolute top-full right-0 mt-2 w-56 bg-card border border-border rounded-xl shadow-xl z-50 p-3 space-y-3"
          >
            {/* Total */}
            <div className="text-center">
              <p className="text-xs text-muted-foreground">Space Earnings</p>
              <p className="text-2xl font-bold text-amber-400">{totalValue.toLocaleString()}</p>
              <p className="text-[10px] text-muted-foreground">{giftCount} gifts received</p>
            </div>

            {/* Top gifters */}
            {topGifters.length > 0 && (
              <div>
                <p className="text-[10px] uppercase text-muted-foreground font-semibold flex items-center gap-1 mb-1.5">
                  <TrendingUp className="w-3 h-3" /> Top Gifters
                </p>
                <div className="space-y-1.5">
                  {topGifters.map((gifter, i) => (
                    <div key={gifter.sender_id} className="flex items-center gap-2 text-xs">
                      <span className={cn(
                        "w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold",
                        i === 0 ? "bg-amber-500/20 text-amber-400" :
                        i === 1 ? "bg-gray-400/20 text-gray-400" :
                        "bg-orange-500/20 text-orange-400"
                      )}>
                        {i === 0 ? <Crown className="w-3 h-3" /> : i + 1}
                      </span>
                      <span className="truncate flex-1 font-medium">{gifter.display_name}</span>
                      <span className="text-amber-400 font-semibold">{gifter.total_value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
