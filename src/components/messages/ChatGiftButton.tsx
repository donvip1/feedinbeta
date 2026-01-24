import React, { useState } from 'react';
import { Gift, Coins, Heart, Rocket, Diamond, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { playGiftSound } from '@/lib/chat-sounds';

interface ChatGiftButtonProps {
  recipientId: string;
  recipientName: string;
  recipientAvatar?: string;
  conversationId: string;
  onGiftSent?: () => void;
}

const QUICK_GIFTS = [
  { type: 'heart', emoji: '❤️', credits: 5, label: 'Heart', icon: Heart, gradient: 'from-pink-500 to-red-500' },
  { type: 'rocket', emoji: '🚀', credits: 20, label: 'Rocket', icon: Rocket, gradient: 'from-blue-500 to-purple-500' },
  { type: 'diamond', emoji: '💎', credits: 50, label: 'Diamond', icon: Diamond, gradient: 'from-cyan-400 to-blue-500' },
  { type: 'sparkle', emoji: '✨', credits: 100, label: 'Sparkle', icon: Sparkles, gradient: 'from-yellow-400 to-orange-500' },
];

export const ChatGiftButton = ({
  recipientId,
  recipientName,
  recipientAvatar,
  conversationId,
  onGiftSent,
}: ChatGiftButtonProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [customAmount, setCustomAmount] = useState('');
  const [sentGift, setSentGift] = useState<typeof QUICK_GIFTS[0] | null>(null);
  const [userCredits, setUserCredits] = useState<number>(0);

  // Fetch user credits when modal opens
  React.useEffect(() => {
    if (isOpen && user) {
      fetchCredits();
    }
  }, [isOpen, user]);

  const fetchCredits = async () => {
    if (!user) return;
    
    const { data, error } = await supabase
      .from('credit_transactions')
      .select('amount')
      .eq('user_id', user.id);
    
    if (!error && data) {
      const total = data.reduce((sum, t) => sum + t.amount, 0);
      setUserCredits(total);
    }
  };

  const sendGift = async (giftType: string, credits: number) => {
    if (!user) {
      toast({
        title: 'Sign in required',
        description: 'Please sign in to send gifts',
        variant: 'destructive',
      });
      return;
    }

    if (userCredits < credits) {
      toast({
        title: 'Insufficient credits',
        description: `You need ${credits} credits. Current balance: ${userCredits}`,
        variant: 'destructive',
      });
      return;
    }

    setIsSending(true);

    try {
      // Use the secure RPC function for direct gifts
      const { data, error } = await supabase.rpc('send_direct_gift', {
        p_credit_value: credits,
        p_gift_type: giftType,
        p_recipient_identifier: recipientId,
      });

      if (error) throw error;

      // Show success animation
      const gift = QUICK_GIFTS.find(g => g.type === giftType);
      setSentGift(gift || null);
      playGiftSound();

      setTimeout(() => {
        setSentGift(null);
        setIsOpen(false);
        onGiftSent?.();
      }, 2000);

      toast({
        title: 'Gift sent! 🎁',
        description: `You sent ${credits} credits to ${recipientName}`,
      });

      fetchCredits(); // Refresh balance
    } catch (error: any) {
      console.error('Error sending gift:', error);
      toast({
        title: 'Failed to send gift',
        description: error.message || 'Please try again',
        variant: 'destructive',
      });
    } finally {
      setIsSending(false);
    }
  };

  const handleCustomSend = () => {
    const amount = parseInt(customAmount);
    if (isNaN(amount) || amount < 1) {
      toast({
        title: 'Invalid amount',
        description: 'Please enter a valid number of credits',
        variant: 'destructive',
      });
      return;
    }
    sendGift('custom', amount);
  };

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setIsOpen(true)}
        className="text-yellow-500 hover:text-yellow-400 hover:bg-yellow-500/10"
        title="Send a gift"
      >
        <Gift className="w-5 h-5" />
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-md bg-card border-border text-foreground">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Gift className="w-5 h-5 text-yellow-500" />
              Send Gift to {recipientName}
            </DialogTitle>
          </DialogHeader>

          {/* Recipient Preview */}
          <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-xl">
            <Avatar>
              <AvatarImage src={recipientAvatar} />
              <AvatarFallback className="bg-gradient-to-br from-primary to-primary/50">
                {recipientName[0]?.toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="font-semibold">{recipientName}</p>
              <p className="text-xs text-muted-foreground">Your balance: {userCredits} credits</p>
            </div>
          </div>

          {/* Quick Gifts */}
          <div className="grid grid-cols-2 gap-3 py-4">
            {QUICK_GIFTS.map((gift) => (
              <button
                key={gift.type}
                onClick={() => sendGift(gift.type, gift.credits)}
                disabled={isSending || userCredits < gift.credits}
                className={cn(
                  "p-4 rounded-xl border transition-all duration-200",
                  "flex flex-col items-center gap-2",
                  userCredits >= gift.credits
                    ? "border-border hover:border-primary hover:scale-105"
                    : 'border-border/50 opacity-50 cursor-not-allowed',
                  "bg-card hover:bg-accent"
                )}
              >
                <span className="text-3xl">{gift.emoji}</span>
                <span className="font-semibold">{gift.label}</span>
                <span className="text-xs text-muted-foreground">{gift.credits} credits</span>
              </button>
            ))}
          </div>

          {/* Custom Amount */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Coins className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-yellow-500" />
              <Input
                type="number"
                placeholder="Custom amount"
                value={customAmount}
                onChange={(e) => setCustomAmount(e.target.value)}
                className="pl-10"
                min="1"
              />
            </div>
            <Button
              onClick={handleCustomSend}
              disabled={isSending || !customAmount}
              className="bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-white"
            >
              Send
            </Button>
          </div>

          {/* Success Animation */}
          <AnimatePresence>
            {sentGift && (
              <motion.div
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.5 }}
                className="absolute inset-0 flex items-center justify-center bg-background/90 rounded-xl z-50"
              >
                <div className="text-center">
                  <motion.div
                    animate={{ scale: [1, 1.2, 1], rotate: [0, 10, -10, 0] }}
                    transition={{ duration: 0.5, repeat: 2 }}
                    className="text-7xl mb-4"
                  >
                    {sentGift.emoji}
                  </motion.div>
                  <p className="text-xl font-bold">Gift Sent!</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ChatGiftButton;
