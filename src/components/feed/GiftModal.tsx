import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Gift, Heart, Star, Trophy, Zap } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useState } from 'react';

interface GiftModalProps {
  isOpen: boolean;
  onClose: () => void;
  postId: string;
  recipientId: string;
}

const gifts = [
  { icon: Heart, label: 'Heart', cost: 10 },
  { icon: Star, label: 'Star', cost: 25 },
  { icon: Trophy, label: 'Trophy', cost: 50 },
  { icon: Zap, label: 'Lightning', cost: 100 },
];

export default function GiftModal({ isOpen, onClose, postId, recipientId }: GiftModalProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [sending, setSending] = useState(false);

  const handleSendGift = async (giftType: string, cost: number) => {
    if (!user) return;

    setSending(true);
    try {
      // Check user balance
      const { data: credits } = await supabase
        .from('user_credits')
        .select('balance')
        .eq('user_id', user.id)
        .single();

      if (!credits || credits.balance < cost) {
        toast({
          title: 'Insufficient credits',
          description: 'Please purchase more credits to send gifts',
          variant: 'destructive',
        });
        return;
      }

      // Deduct from sender
      await supabase.from('credit_transactions').insert({
        user_id: user.id,
        type: 'spent',
        amount: -cost,
        description: `Sent ${giftType} gift`,
        related_id: postId,
      });

      // Add to recipient
      await supabase.from('credit_transactions').insert({
        user_id: recipientId,
        type: 'earned',
        amount: cost,
        description: `Received ${giftType} gift`,
        related_id: postId,
      });

      toast({ title: 'Gift sent successfully! 🎁' });
      onClose();
    } catch (error) {
      toast({
        title: 'Error sending gift',
        variant: 'destructive',
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <div className="flex items-center gap-2 mb-4">
          <Gift className="w-5 h-5" />
          <h2 className="text-lg font-semibold">Send a Gift</h2>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {gifts.map((gift) => (
            <Button
              key={gift.label}
              variant="outline"
              className="flex flex-col items-center gap-2 h-auto py-4"
              onClick={() => handleSendGift(gift.label, gift.cost)}
              disabled={sending}
            >
              <gift.icon className="w-8 h-8" />
              <span className="text-sm font-semibold">{gift.label}</span>
              <span className="text-xs text-muted-foreground">{gift.cost} credits</span>
            </Button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
