import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Coins, Gift } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useAdminRole } from '@/hooks/useAdminRole';
import { toast } from 'sonner';

interface QuickGiftBarProps {
  isOpen: boolean;
  onClose: () => void;
  recipientId: string;
  roomId: string;
  isSpace?: boolean;
  onGiftSent?: (gift: { type: string; value: number; emoji: string }) => void;
  userCredits: number;
  onCreditsChange?: (newBalance: number) => void;
}

const QUICK_GIFTS = [
  { type: 'rose', name: 'Rose', value: 10, emoji: '🌹' },
  { type: 'heart', name: 'Heart', value: 25, emoji: '❤️' },
  { type: 'coffee', name: 'Coffee', value: 50, emoji: '☕' },
  { type: 'diamond', name: 'Diamond', value: 100, emoji: '💎' },
  { type: 'rocket', name: 'Rocket', value: 500, emoji: '🚀' },
  { type: 'castle', name: 'Castle', value: 1000, emoji: '🏰' },
];

export const QuickGiftBar = ({
  isOpen,
  onClose,
  recipientId,
  roomId,
  isSpace = false,
  onGiftSent,
  userCredits,
  onCreditsChange,
}: QuickGiftBarProps) => {
  const { user } = useAuth();
  const { permissions } = useAdminRole();
  const hasUnlimitedCredits = permissions.isDeveloper;
  const [sending, setSending] = useState<string | null>(null);

  const handleSendGift = async (gift: typeof QUICK_GIFTS[0]) => {
    if (!user) {
      toast.error('Please sign in to send gifts');
      return;
    }

    if (!hasUnlimitedCredits && userCredits < gift.value) {
      toast.error('Insufficient credits! Top up to send gifts.');
      return;
    }

    setSending(gift.type);

    try {
      // Deduct credits from sender
      await supabase.from('credit_transactions').insert({
        user_id: user.id,
        amount: -gift.value,
        type: 'gift_sent',
        description: `Sent ${gift.name} gift in live`,
        related_id: roomId,
      });

      // Add credits to recipient (85% - 15% platform fee)
      const recipientAmount = Math.floor(gift.value * 0.85);
      await supabase.from('credit_transactions').insert({
        user_id: recipientId,
        amount: recipientAmount,
        type: 'gift_received',
        description: `Received ${gift.name} gift in live`,
        related_id: roomId,
      });

      // Record the gift
      if (isSpace) {
        await supabase.from('live_space_gifts').insert({
          space_id: roomId,
          sender_id: user.id,
          receiver_id: recipientId,
          gift_type: gift.type,
          credit_value: gift.value,
        });
      } else {
        await supabase.from('live_stream_gifts').insert({
          stream_id: roomId,
          sender_id: user.id,
          receiver_id: recipientId,
          gift_type: gift.type,
          credit_value: gift.value,
        });
      }

      // Notify
      await supabase.from('notifications').insert({
        user_id: recipientId,
        from_user_id: user.id,
        type: 'live_gift',
        title: 'Gift received!',
        message: `Someone sent you ${gift.emoji} ${gift.name}`,
        related_id: roomId,
        related_type: isSpace ? 'space' : 'live_stream',
      });

      // Update local credits
      if (!hasUnlimitedCredits) {
        onCreditsChange?.(userCredits - gift.value);
      }

      onGiftSent?.({ type: gift.type, value: gift.value, emoji: gift.emoji });
      toast.success(`${gift.emoji} ${gift.name} sent!`);
    } catch (error: any) {
      toast.error(error.message || 'Failed to send gift');
    } finally {
      setSending(null);
    }
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
                <span className="text-white font-semibold">Send Gift</span>
              </div>
              <div className="flex items-center gap-1.5 bg-white/10 px-3 py-1 rounded-full">
                <Coins className="w-4 h-4 text-amber-400" />
                <span className="text-white text-sm font-medium">
                  {hasUnlimitedCredits ? '∞' : userCredits}
                </span>
              </div>
            </div>

            {/* Gift Grid */}
            <div className="grid grid-cols-6 gap-2">
              {QUICK_GIFTS.map((gift) => {
                const canAfford = hasUnlimitedCredits || userCredits >= gift.value;
                const isSending = sending === gift.type;

                return (
                  <motion.button
                    key={gift.type}
                    whileTap={{ scale: canAfford ? 0.9 : 1 }}
                    onClick={() => canAfford && handleSendGift(gift)}
                    disabled={!canAfford || !!sending}
                    className={cn(
                      "flex flex-col items-center gap-1 p-2 rounded-xl transition-all",
                      canAfford 
                        ? "bg-white/5 hover:bg-white/10 active:bg-white/20" 
                        : "opacity-40 cursor-not-allowed",
                      isSending && "animate-pulse"
                    )}
                  >
                    <span className="text-2xl">{gift.emoji}</span>
                    <span className="text-[10px] text-white/70">{gift.value}</span>
                  </motion.button>
                );
              })}
            </div>

            {/* Close hint */}
            <button
              onClick={onClose}
              className="w-full mt-3 text-center text-xs text-white/40 hover:text-white/60"
            >
              Tap to close
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default QuickGiftBar;
