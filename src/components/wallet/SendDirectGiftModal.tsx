import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Gift, Loader2, Search } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SendDirectGiftModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface GiftType {
  id: string;
  label: string;
  emoji: string;
  cost: number;
  category: 'basic' | 'premium' | 'exclusive';
}

const allGifts: GiftType[] = [
  { id: 'heart', label: 'Heart', emoji: '❤️', cost: 5, category: 'basic' },
  { id: 'star', label: 'Star', emoji: '⭐', cost: 10, category: 'basic' },
  { id: 'fire', label: 'Fire', emoji: '🔥', cost: 15, category: 'basic' },
  { id: 'clap', label: 'Clap', emoji: '👏', cost: 20, category: 'basic' },
  { id: 'rocket', label: 'Rocket', emoji: '🚀', cost: 50, category: 'premium' },
  { id: 'diamond', label: 'Diamond', emoji: '💎', cost: 100, category: 'premium' },
  { id: 'crown', label: 'Crown', emoji: '👑', cost: 200, category: 'exclusive' },
  { id: 'rose', label: 'Rose', emoji: '🌹', cost: 25, category: 'basic' },
  { id: 'gift', label: 'Gift Box', emoji: '🎁', cost: 75, category: 'premium' },
  { id: 'money', label: 'Money Bag', emoji: '💰', cost: 500, category: 'exclusive' },
];

export const SendDirectGiftModal = ({ isOpen, onClose }: SendDirectGiftModalProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [recipient, setRecipient] = useState('');
  const [selectedGift, setSelectedGift] = useState<GiftType | null>(null);
  const [sending, setSending] = useState(false);

  // Fetch user credits
  const { data: credits } = useQuery({
    queryKey: ['user-credits', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_credits')
        .select('balance')
        .eq('user_id', user?.id)
        .single();
      
      if (error && error.code !== 'PGRST116') throw error;
      return data?.balance || 0;
    },
    enabled: !!user,
  });

  const handleSendGift = async () => {
    if (!recipient.trim()) {
      toast({
        title: 'Enter recipient',
        description: 'Please enter a username or email',
        variant: 'destructive',
      });
      return;
    }

    if (!selectedGift) {
      toast({
        title: 'Select a gift',
        description: 'Please select a gift to send',
        variant: 'destructive',
      });
      return;
    }

    if ((credits || 0) < selectedGift.cost) {
      toast({
        title: 'Insufficient credits',
        description: `You need ${selectedGift.cost} credits to send this gift`,
        variant: 'destructive',
      });
      return;
    }

    setSending(true);
    try {
      const { error } = await supabase.rpc('send_direct_gift', {
        p_recipient_identifier: recipient.replace('@', '').trim(),
        p_gift_type: selectedGift.id,
        p_credit_value: selectedGift.cost,
      });

      if (error) {
        if (error.message.includes('User not found')) {
          toast({
            title: 'User not found',
            description: 'No user found with that username or email',
            variant: 'destructive',
          });
        } else if (error.message.includes('yourself')) {
          toast({
            title: 'Invalid recipient',
            description: 'You cannot send a gift to yourself',
            variant: 'destructive',
          });
        } else if (error.message.includes('Insufficient')) {
          toast({
            title: 'Insufficient credits',
            description: 'You do not have enough credits',
            variant: 'destructive',
          });
        } else {
          throw error;
        }
        return;
      }

      toast({
        title: 'Gift sent!',
        description: `You sent a ${selectedGift.emoji} ${selectedGift.label} to @${recipient}`,
      });

      // Refresh queries
      queryClient.invalidateQueries({ queryKey: ['user-credits'] });
      queryClient.invalidateQueries({ queryKey: ['sent-gifts'] });
      queryClient.invalidateQueries({ queryKey: ['gift-stats'] });
      queryClient.invalidateQueries({ queryKey: ['credit-transactions'] });

      // Reset and close
      setRecipient('');
      setSelectedGift(null);
      onClose();
    } catch (error: any) {
      toast({
        title: 'Failed to send gift',
        description: error.message || 'Please try again',
        variant: 'destructive',
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Gift className="w-5 h-5 text-primary" />
            Send Gift
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Recipient Input */}
          <div>
            <Label>Recipient (username or email)</Label>
            <div className="relative mt-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="@username or email"
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          {/* Available Credits */}
          <div className="text-sm text-muted-foreground">
            Available: <span className="font-semibold text-foreground">{credits || 0}</span> credits
          </div>

          {/* Gift Selection */}
          <div>
            <Label>Select Gift</Label>
            <div className="grid grid-cols-5 gap-2 mt-2">
              {allGifts.map((gift) => (
                <button
                  key={gift.id}
                  onClick={() => setSelectedGift(gift)}
                  disabled={(credits || 0) < gift.cost}
                  className={cn(
                    'flex flex-col items-center p-2 rounded-lg border transition-all',
                    selectedGift?.id === gift.id
                      ? 'border-primary bg-primary/10 ring-2 ring-primary'
                      : 'border-border hover:border-primary/50',
                    (credits || 0) < gift.cost && 'opacity-40 cursor-not-allowed'
                  )}
                >
                  <span className="text-2xl">{gift.emoji}</span>
                  <span className="text-xs font-medium mt-1">{gift.cost}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Selected Gift Info */}
          {selectedGift && (
            <div className="p-3 rounded-lg bg-accent/50 text-sm">
              <div className="flex justify-between items-center">
                <span>Selected: {selectedGift.emoji} {selectedGift.label}</span>
                <span className="font-bold">{selectedGift.cost} credits</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Recipient will receive {Math.floor(selectedGift.cost * 0.9)} credits (10% platform fee)
              </p>
            </div>
          )}

          {/* Send Button */}
          <Button 
            onClick={handleSendGift} 
            className="w-full"
            disabled={!recipient || !selectedGift || sending}
          >
            {sending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Gift className="w-4 h-4 mr-2" />
                Send {selectedGift?.emoji} Gift
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
