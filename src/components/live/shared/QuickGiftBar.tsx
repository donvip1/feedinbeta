import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Coins, Gift, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useAdminRole } from '@/hooks/useAdminRole';
import { toast } from 'sonner';
import { useNavigate, useLocation } from 'react-router-dom';
interface QuickGiftBarProps {
  isOpen: boolean;
  onClose: () => void;
  recipientId: string;
  roomId: string;
  isSpace?: boolean;
  onGiftSent?: (gift: { type: string; value: number; emoji: string }) => void;
  userCredits?: number;
  onCreditsChange?: (newBalance: number) => void;
  hostId?: string; // Add hostId to detect self-gifting
}

// Updated gift packs with colors matching reference design
const QUICK_GIFTS = [
  { type: 'rose', name: 'Rose', value: 10, emoji: '🌹', color: 'from-red-500/20 to-red-900/20 border-red-500/50' },
  { type: 'coffee', name: 'Coffee', value: 20, emoji: '☕', color: 'from-amber-700/20 to-amber-900/20 border-amber-700/50' },
  { type: 'heart', name: 'Love', value: 50, emoji: '❤️', color: 'from-pink-500/20 to-pink-900/20 border-pink-500/50' },
  { type: 'diamond', name: 'Diamond', value: 100, emoji: '💎', color: 'from-cyan-400/20 to-cyan-900/20 border-cyan-400/50' },
  { type: 'rocket', name: 'Rocket', value: 500, emoji: '🚀', color: 'from-purple-600/20 to-purple-900/20 border-purple-600/50' },
  { type: 'castle', name: 'Castle', value: 1000, emoji: '🏰', color: 'from-yellow-500/20 to-yellow-900/20 border-yellow-500/50' },
];

export const QuickGiftBar = ({
  isOpen,
  onClose,
  recipientId,
  roomId,
  isSpace = false,
  onGiftSent,
  userCredits: propCredits,
  onCreditsChange,
  hostId,
}: QuickGiftBarProps) => {
  const { user } = useAuth();
  const { permissions } = useAdminRole();
  const navigate = useNavigate();
  const location = useLocation();
  const hasUnlimitedCredits = permissions.isDeveloper;
  const [sending, setSending] = useState<string | null>(null);
  const [localCredits, setLocalCredits] = useState<number>(propCredits ?? 0);
  const [isLoadingCredits, setIsLoadingCredits] = useState(false);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  
  // Check if user is the host (prevent self-gifting)
  const isHost = user?.id === hostId;

  // Fetch real credits from user_credits table
  useEffect(() => {
    if (isOpen && user) {
      fetchCredits();
    }
  }, [isOpen, user]);

  const fetchCredits = async () => {
    if (!user) return;
    setIsLoadingCredits(true);
    try {
      const { data, error } = await supabase
        .from('user_credits')
        .select('balance')
        .eq('user_id', user.id)
        .single();
      
      if (!error && data) {
        setLocalCredits(data.balance || 0);
        onCreditsChange?.(data.balance || 0);
      }
    } catch (e) {
      console.error('Failed to fetch credits:', e);
    } finally {
      setIsLoadingCredits(false);
    }
  };

  const handleSendGift = async (gift: typeof QUICK_GIFTS[0]) => {
    if (!user) {
      toast.error('Please sign in to send gifts');
      return;
    }

    // Prevent hosts from gifting themselves
    if (isHost) {
      toast.error("Hosts can't send gifts to themselves. Use the Gift Viewers button instead!");
      return;
    }

    if (!hasUnlimitedCredits && localCredits < gift.value) {
      toast.error('Insufficient credits! Top up to send gifts.');
      return;
    }

    setSending(gift.type);

    try {
      // Use the correct RPC based on room type
      let result;
      if (isSpace) {
        result = await supabase.rpc('send_space_gift', {
          p_space_id: roomId,
          p_gift_type: gift.type,
          p_credit_value: gift.value,
          p_receiver_id: recipientId,
        });
      } else {
        result = await supabase.rpc('send_live_gift', {
          p_credit_value: gift.value,
          p_gift_type: gift.type,
          p_stream_id: roomId,
        });
      }

      if (result.error) throw result.error;
      
      // Check RPC-level error in returned JSON
      const rpcResult = result.data as any;
      if (rpcResult && rpcResult.success === false) {
        throw new Error(rpcResult.error || 'Gift failed');
      }

      // Refresh credits after successful gift
      await fetchCredits();

      // Broadcast gift for instant display to all participants
      await supabase.channel(`space-gift-broadcast-${roomId}`).send({
        type: 'broadcast',
        event: 'gift_sent',
        payload: {
          gift_type: gift.type,
          credit_value: gift.value,
          emoji: gift.emoji,
          sender_id: user.id,
          sender_name: user.user_metadata?.display_name || user.user_metadata?.username || 'Someone',
          receiver_id: recipientId,
        },
      });

      onGiftSent?.({ type: gift.type, value: gift.value, emoji: gift.emoji });
      toast.success(`${gift.emoji} ${gift.name} sent!`);
    } catch (error: any) {
      console.error('Gift error:', error);
      toast.error(error.message || 'Failed to send gift');
    } finally {
      setSending(null);
    }
  };

  const handleTopUp = () => {
    onClose();
    // Navigate to wallet with returnTo state to come back to exact location
    navigate('/wallet?tab=buy', { 
      state: { returnTo: location.pathname }
    });
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          className="absolute bottom-28 left-0 right-0 z-40 px-4"
        >
          <div className="bg-black/80 backdrop-blur-xl rounded-2xl p-4 border border-white/10">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Gift className="w-5 h-5 text-amber-400" />
                <span className="text-white font-semibold">Gift Shop</span>
              </div>
              <div className="flex items-center gap-1.5 bg-white/10 px-3 py-1 rounded-full">
                <Coins className="w-4 h-4 text-amber-400" />
                {isLoadingCredits ? (
                  <Loader2 className="w-4 h-4 text-white animate-spin" />
                ) : (
                  <span className="text-white text-sm font-medium">
                    {hasUnlimitedCredits ? '∞' : localCredits.toLocaleString()}
                  </span>
                )}
              </div>
            </div>

            {/* Gift Grid - Enhanced styling with hover effects */}
            <div className="grid grid-cols-3 gap-3">
              {QUICK_GIFTS.map((gift) => {
                const canAfford = hasUnlimitedCredits || localCredits >= gift.value;
                const isSending = sending === gift.type;
                const isHovered = hoveredId === gift.type;

                return (
                  <motion.button
                    key={gift.type}
                    whileHover={{ scale: canAfford ? 1.05 : 1 }}
                    whileTap={{ scale: canAfford ? 0.95 : 1 }}
                    onMouseEnter={() => setHoveredId(gift.type)}
                    onMouseLeave={() => setHoveredId(null)}
                    onClick={() => canAfford && handleSendGift(gift)}
                    disabled={!canAfford || !!sending}
                    className={cn(
                      "relative flex flex-col items-center justify-center p-3 rounded-2xl border transition-all duration-300 group",
                      canAfford 
                        ? isHovered
                          ? `bg-gradient-to-br ${gift.color} scale-110 -translate-y-1 shadow-[0_0_20px_rgba(255,255,255,0.1)] z-10`
                          : `bg-gradient-to-br ${gift.color}`
                        : "bg-slate-900/50 border-white/5 opacity-40 cursor-not-allowed",
                      isSending && "animate-pulse scale-110"
                    )}
                  >
                    <motion.span 
                      className="text-3xl mb-1 relative z-10"
                      animate={isSending ? { scale: [1, 1.3, 1], rotate: [0, -10, 10, 0] } : isHovered && canAfford ? { scale: [1, 1.15, 1] } : {}}
                      transition={{ duration: 0.5 }}
                    >
                      {gift.emoji}
                    </motion.span>
                    <span className="text-[11px] text-white/80 font-medium">{gift.name}</span>
                    <div className="flex items-center gap-1 mt-0.5">
                      <Coins className="w-3 h-3 text-amber-400" />
                      <span className="text-[10px] text-amber-400 font-semibold">{gift.value}</span>
                    </div>
                  </motion.button>
                );
              })}
            </div>

            {/* Footer with Top-up and Close */}
            <div className="flex items-center gap-3 mt-4">
              <button 
                onClick={handleTopUp}
                className="flex-1 bg-gradient-to-r from-amber-400 to-orange-500 text-black py-2 rounded-xl text-sm font-bold flex items-center justify-center gap-1 hover:opacity-90"
              >
                <Coins className="w-4 h-4" />
                Top-up Credits
              </button>
              <button
                onClick={onClose}
                className="flex-1 bg-white/10 text-white py-2 rounded-xl text-sm font-medium hover:bg-white/20"
              >
                Close
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default QuickGiftBar;
