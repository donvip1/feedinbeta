import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Gift, Heart, Star, Trophy, Crown, Sparkles, Zap } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

interface GiftModalProps {
  isOpen: boolean;
  onClose: () => void;
  postOwnerId: string;
  postId: string;
}

interface GiftOption {
  id: string;
  name: string;
  icon: any;
  credits: number;
  color: string;
}

const giftOptions: GiftOption[] = [
  { id: 'heart', name: 'Heart', icon: Heart, credits: 5, color: 'from-red-500 to-pink-500' },
  { id: 'star', name: 'Star', icon: Star, credits: 10, color: 'from-yellow-500 to-amber-500' },
  { id: 'trophy', name: 'Trophy', icon: Trophy, credits: 20, color: 'from-orange-500 to-red-500' },
  { id: 'crown', name: 'Crown', icon: Crown, credits: 50, color: 'from-purple-500 to-pink-500' },
  { id: 'sparkle', name: 'Sparkle', icon: Sparkles, credits: 100, color: 'from-cyan-500 to-blue-500' },
  { id: 'lightning', name: 'Lightning', icon: Zap, credits: 200, color: 'from-indigo-500 to-purple-500' },
];

export const GiftModal = ({ isOpen, onClose, postOwnerId, postId }: GiftModalProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [sending, setSending] = useState(false);
  const [selectedGift, setSelectedGift] = useState<string | null>(null);

  const handleSendGift = async (gift: GiftOption) => {
    if (!user) {
      toast({
        title: "Authentication Required",
        description: "Please sign in to send gifts",
        variant: "destructive",
      });
      return;
    }

    if (user.id === postOwnerId) {
      toast({
        title: "Cannot Send Gift",
        description: "You cannot send a gift to yourself",
        variant: "destructive",
      });
      return;
    }

    setSending(true);
    setSelectedGift(gift.id);

    try {
      // Deduct credits from sender
      const { error: deductError } = await supabase.from('credit_transactions').insert({
        user_id: user.id,
        type: 'spent',
        amount: -gift.credits,
        description: `Sent ${gift.name} gift`,
        related_id: postId
      });

      if (deductError) throw deductError;

      // Add credits to receiver
      const { error: addError } = await supabase.from('credit_transactions').insert({
        user_id: postOwnerId,
        type: 'gift',
        amount: gift.credits,
        description: `Received ${gift.name} gift`,
        related_id: postId
      });

      if (addError) throw addError;

      // Create notification for receiver
      await supabase.from('notifications').insert({
        user_id: postOwnerId,
        from_user_id: user.id,
        type: 'gift',
        title: 'Gift Received! 🎁',
        message: `Someone sent you a ${gift.name} gift worth ${gift.credits} credits!`,
        related_type: 'post',
        related_id: postId
      });

      toast({
        title: "Gift Sent! 🎁",
        description: `You sent a ${gift.name} worth ${gift.credits} credits`,
      });

      onClose();
    } catch (error: any) {
      toast({
        title: "Failed to Send Gift",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    } finally {
      setSending(false);
      setSelectedGift(null);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Gift className="w-5 h-5 text-primary" />
            Send a Gift
          </DialogTitle>
          <DialogDescription>
            Show your appreciation by sending a gift to the creator
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3 py-4">
          {giftOptions.map((gift) => {
            const Icon = gift.icon;
            return (
              <Button
                key={gift.id}
                variant="outline"
                className="h-auto p-4 flex flex-col gap-2 hover:scale-105 transition-transform"
                onClick={() => handleSendGift(gift)}
                disabled={sending}
              >
                <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${gift.color} flex items-center justify-center shadow-lg`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
                <span className="font-semibold">{gift.name}</span>
                <span className="text-xs text-muted-foreground">{gift.credits} credits</span>
              </Button>
            );
          })}
        </div>

        <p className="text-xs text-muted-foreground text-center">
          Gifts help creators earn credits and motivate them to create more amazing content!
        </p>
      </DialogContent>
    </Dialog>
  );
};
