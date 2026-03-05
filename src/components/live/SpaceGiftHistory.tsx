import { useState, useEffect } from 'react';
import { X, Gift, Coins, Crown, Clock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { formatDistanceToNow } from 'date-fns';

const GIFT_EMOJI_MAP: Record<string, string> = {
  rose: '🌹', coffee: '☕', heart: '❤️', diamond: '💎',
  rocket: '🚀', castle: '🏰', crown: '👑', universe: '🌌', credits: '💰',
};

interface GiftRecord {
  id: string;
  sender_id: string;
  receiver_id: string;
  gift_type: string;
  credit_value: number;
  created_at: string;
  sender?: { display_name: string; username: string; avatar_url: string };
  receiver?: { display_name: string; username: string; avatar_url: string };
}

interface SpaceGiftHistoryProps {
  isOpen: boolean;
  onClose: () => void;
  spaceId: string;
}

export const SpaceGiftHistory = ({ isOpen, onClose, spaceId }: SpaceGiftHistoryProps) => {
  const [gifts, setGifts] = useState<GiftRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalValue, setTotalValue] = useState(0);

  useEffect(() => {
    if (!isOpen) return;
    fetchGifts();
  }, [isOpen, spaceId]);

  const fetchGifts = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('live_space_gifts')
      .select('id, sender_id, receiver_id, gift_type, credit_value, created_at')
      .eq('space_id', spaceId)
      .order('created_at', { ascending: false })
      .limit(100);

    if (error || !data) {
      setLoading(false);
      return;
    }

    const userIds = [...new Set(data.flatMap(g => [g.sender_id, g.receiver_id]))];
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, display_name, username, avatar_url')
      .in('id', userIds);

    const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

    const enriched: GiftRecord[] = data.map(g => ({
      ...g,
      sender: profileMap.get(g.sender_id) as any,
      receiver: profileMap.get(g.receiver_id) as any,
    }));

    setGifts(enriched);
    setTotalValue(data.reduce((sum, g) => sum + (g.credit_value || 0), 0));
    setLoading(false);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={onClose}
        >
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-sm bg-background rounded-2xl border border-border shadow-2xl flex flex-col max-h-[80vh]"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
                  <Gift className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-lg">Gift History</h3>
                  <p className="text-xs text-muted-foreground">
                    Total: <span className="text-amber-400 font-semibold">{totalValue.toLocaleString()} credits</span> · {gifts.length} gifts
                  </p>
                </div>
              </div>
              <button onClick={onClose} className="p-2 rounded-full hover:bg-muted">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Gift List */}
            <ScrollArea className="flex-1">
              <div className="p-3 space-y-1">
                {loading ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="w-6 h-6 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : gifts.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground text-sm">
                    No gifts yet in this space
                  </div>
                ) : (
                  gifts.map((gift) => (
                    <div
                      key={gift.id}
                      className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-muted/50 transition-colors"
                    >
                      {/* Sender avatar */}
                      <Avatar className="w-9 h-9 shrink-0">
                        <AvatarImage src={gift.sender?.avatar_url} />
                        <AvatarFallback className="text-xs bg-muted">
                          {gift.sender?.display_name?.[0] || '?'}
                        </AvatarFallback>
                      </Avatar>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm leading-tight">
                          <span className="font-semibold">{gift.sender?.display_name || 'User'}</span>
                          <span className="text-muted-foreground"> sent </span>
                          <span className="font-semibold">{gift.receiver?.display_name || 'User'}</span>
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatDistanceToNow(new Date(gift.created_at), { addSuffix: true })}
                          </span>
                        </div>
                      </div>

                      {/* Gift type + value */}
                      <div className="flex flex-col items-center shrink-0">
                        <span className="text-lg">{GIFT_EMOJI_MAP[gift.gift_type] || '🎁'}</span>
                        <div className="flex items-center gap-0.5">
                          <Coins className="w-3 h-3 text-amber-400" />
                          <span className="text-[11px] font-bold text-amber-400">{gift.credit_value}</span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
