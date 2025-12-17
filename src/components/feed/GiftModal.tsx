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
      // Use the secure database function to handle gift transaction
      const { data, error } = await supabase.rpc('send_gift', {
        p_sender_id: user.id,
        p_recipient_id: recipientId,
        p_post_id: postId,
        p_gift_type: giftType,
        p_cost: cost,
      });

      if (error) {
        if (error.message.includes('Insufficient credits')) {
          toast({
            title: 'Insufficient credits',
            description: 'Please purchase more credits to send gifts',
            variant: 'destructive',
          });
        } else {
          throw error;
        }
        return;
      }

      toast({ title: 'Gift sent successfully! 🎁' });
      onClose();
    } catch (error: any) {
      toast({
        title: 'Error sending gift',
        description: error.message || 'Failed to send gift',
        variant: 'destructive',
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-pink-500 to-purple-500 flex items-center justify-center mb-3 animate-pulse">
            <Gift className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-2xl font-bold">Send a Gift</h2>
          <p className="text-sm text-muted-foreground mt-1">Show your appreciation</p>
        </div>
        <div className="grid grid-cols-2 gap-4">
          {gifts.map((gift, index) => (
            <Button
              key={gift.label}
              variant="outline"
              className="flex flex-col items-center gap-3 h-auto py-6 rounded-2xl border-2 hover:border-primary hover:scale-105 transition-all animate-in fade-in slide-in-from-bottom-4"
              style={{ animationDelay: `${index * 100}ms` }}
              onClick={() => handleSendGift(gift.label, gift.cost)}
              disabled={sending}
            >
              <div className="w-14 h-14 rounded-full bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center">
                <gift.icon className="w-8 h-8 text-primary" />
              </div>
              <div>
                <div className="text-sm font-bold">{gift.label}</div>
                <div className="text-xs text-muted-foreground">{gift.cost} credits</div>
              </div>
            </Button>
          ))}
        </div>
        <p className="text-xs text-center text-muted-foreground mt-4">
          Gifts support creators and show appreciation for their content
        </p>
      </DialogContent>
    </Dialog>
  );
}
