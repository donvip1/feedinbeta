import React, { useState } from 'react';
import { Gift } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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

interface GiftCatalogItem {
  id: string;
  key: string;
  name: string;
  asset_key: string;
  credit_cost: number;
}

const GIFT_EMOJI: Record<string, string> = {
  heart: '❤️',
  star: '⭐',
  fire: '🔥',
  clap: '👏',
  rose: '🌹',
  rocket: '🚀',
  gift: '🎁',
  diamond: '💎',
  crown: '👑',
  money: '💰',
};

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
  const [catalog, setCatalog] = useState<GiftCatalogItem[]>([]);
  const [sentGift, setSentGift] = useState<GiftCatalogItem | null>(null);
  const [userCredits, setUserCredits] = useState<number>(0);

  // Fetch user credits when modal opens
  React.useEffect(() => {
    if (isOpen && user) {
      void Promise.all([fetchCredits(), fetchCatalog()]);
    }
  }, [isOpen, user]);

  const fetchCredits = async () => {
    if (!user) return;
    
    const { data, error } = await supabase
      .from('user_credits')
      .select('balance')
      .eq('user_id', user.id)
      .single();
    
    if (!error && data) {
      setUserCredits(data.balance || 0);
    } else {
      setUserCredits(0);
    }
  };

  const fetchCatalog = async () => {
    const { data, error } = await supabase
      .from('gift_catalog' as any)
      .select('id, key, name, asset_key, credit_cost')
      .eq('is_active', true)
      .order('display_order');
    if (!error) setCatalog((data || []) as unknown as GiftCatalogItem[]);
  };

  const sendGift = async (gift: GiftCatalogItem) => {
    if (!user) {
      toast({
        title: 'Sign in required',
        description: 'Please sign in to send gifts',
        variant: 'destructive',
      });
      return;
    }

    if (userCredits < gift.credit_cost) {
      toast({
        title: 'Insufficient credits',
        description: `You need ${gift.credit_cost} credits. Current balance: ${userCredits}`,
        variant: 'destructive',
      });
      return;
    }

    setIsSending(true);

    try {
      const { error } = await supabase.rpc('send_chat_gift' as any, {
        p_conversation_id: conversationId,
        p_catalog_key: gift.key,
        p_message_id: crypto.randomUUID(),
        p_idempotency_key: crypto.randomUUID(),
        p_recipient_id: recipientId,
      } as any);

      if (error) throw error;

      // Show success animation
      setSentGift(gift);
      playGiftSound();

      setTimeout(() => {
        setSentGift(null);
        setIsOpen(false);
        onGiftSent?.();
      }, 2000);

      toast({
        title: 'Gift sent! 🎁',
        description: `You sent ${gift.name} to ${recipientName}`,
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
          <div className="grid grid-cols-2 gap-3 py-4 max-h-72 overflow-y-auto">
            {catalog.map((gift) => (
              <button
                key={gift.id}
                onClick={() => sendGift(gift)}
                disabled={isSending || userCredits < gift.credit_cost}
                className={cn(
                  "p-4 rounded-xl border transition-all duration-200",
                  "flex flex-col items-center gap-2",
                  userCredits >= gift.credit_cost
                    ? "border-border hover:border-primary hover:scale-105"
                    : 'border-border/50 opacity-50 cursor-not-allowed',
                  "bg-card hover:bg-accent"
                )}
              >
                <span className="text-3xl">{GIFT_EMOJI[gift.asset_key] || '🎁'}</span>
                <span className="font-semibold">{gift.name}</span>
                <span className="text-xs text-muted-foreground">{gift.credit_cost} credits</span>
              </button>
            ))}
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
                    {GIFT_EMOJI[sentGift.asset_key] || '🎁'}
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
