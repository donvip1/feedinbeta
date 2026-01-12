import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useCurrency } from '@/context/CurrencyContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Plus, Coins, Info } from 'lucide-react';

interface CreateListingModalProps {
  userCredits: number;
}

const PAYMENT_METHODS = [
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'mobile_money', label: 'Mobile Money' },
  { value: 'crypto', label: 'Cryptocurrency' },
  { value: 'paypal', label: 'PayPal' },
  { value: 'other', label: 'Other' },
];

export const CreateListingModal = ({ userCredits }: CreateListingModalProps) => {
  const { user } = useAuth();
  const { formatPrice, convertFromUSD, currencySymbol } = useCurrency();
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  
  // Form state
  const [creditsAmount, setCreditsAmount] = useState('');
  const [priceUsd, setPriceUsd] = useState('');
  const [minAmount, setMinAmount] = useState('');
  const [maxAmount, setMaxAmount] = useState('');
  const [paymentWindow, setPaymentWindow] = useState('30');
  const [terms, setTerms] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');

  // Calculate rate
  const credits = parseInt(creditsAmount) || 0;
  const price = parseFloat(priceUsd) || 0;
  const rate = price > 0 ? Math.round(credits / price) : 0;
  const localPrice = convertFromUSD(price);

  const createListingMutation = useMutation({
    mutationFn: async () => {
      if (credits <= 0 || price <= 0) {
        throw new Error('Invalid amounts');
      }

      if (credits > userCredits) {
        throw new Error('Insufficient credits');
      }

      const { error } = await supabase
        .from('p2p_listings')
        .insert({
          seller_id: user?.id,
          credits_amount: credits,
          price_usd: price,
          min_amount: minAmount ? parseInt(minAmount) : null,
          max_amount: maxAmount ? parseInt(maxAmount) : null,
          payment_window_minutes: parseInt(paymentWindow) || 30,
          terms: terms || null,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Listing created successfully!');
      setIsOpen(false);
      resetForm();
      queryClient.invalidateQueries({ queryKey: ['p2p-listings'] });
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to create listing');
    },
  });

  const resetForm = () => {
    setCreditsAmount('');
    setPriceUsd('');
    setMinAmount('');
    setMaxAmount('');
    setPaymentWindow('30');
    setTerms('');
    setPaymentMethod('');
  };

  const handleQuickAmount = (percentage: number) => {
    const amount = Math.floor(userCredits * percentage);
    setCreditsAmount(amount.toString());
    // Auto-calculate price at market rate (100 credits = $1)
    setPriceUsd((amount / 100).toFixed(2));
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="w-4 h-4 mr-2" />
          Sell Credits
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Coins className="w-5 h-5" />
            Create P2P Listing
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Available Balance */}
          <div className="p-3 bg-muted rounded-lg">
            <p className="text-sm text-muted-foreground">Available Balance</p>
            <p className="text-2xl font-bold">{userCredits.toLocaleString()} credits</p>
          </div>

          {/* Quick Select */}
          <div className="space-y-2">
            <Label>Quick Select</Label>
            <div className="flex gap-2">
              {[0.25, 0.5, 0.75, 1].map((pct) => (
                <Button
                  key={pct}
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleQuickAmount(pct)}
                >
                  {pct * 100}%
                </Button>
              ))}
            </div>
          </div>

          {/* Credits Amount */}
          <div className="space-y-2">
            <Label>Credits to Sell</Label>
            <Input
              type="number"
              placeholder="Enter amount"
              value={creditsAmount}
              onChange={(e) => setCreditsAmount(e.target.value)}
              max={userCredits}
            />
            {credits > userCredits && (
              <p className="text-xs text-destructive">Exceeds available balance</p>
            )}
          </div>

          {/* Price */}
          <div className="space-y-2">
            <Label>Price (USD)</Label>
            <Input
              type="number"
              step="0.01"
              placeholder="Enter price"
              value={priceUsd}
              onChange={(e) => setPriceUsd(e.target.value)}
            />
            {price > 0 && (
              <p className="text-sm text-muted-foreground">
                ≈ {currencySymbol}{localPrice.toLocaleString(undefined, { maximumFractionDigits: 2 })} in local currency
              </p>
            )}
          </div>

          {/* Rate Preview */}
          {rate > 0 && (
            <div className="p-3 bg-primary/10 rounded-lg">
              <p className="text-sm font-medium">
                Rate: {rate} credits per $1
              </p>
              <p className="text-xs text-muted-foreground">
                Market rate is ~100 credits per $1
              </p>
            </div>
          )}

          {/* Min/Max Limits */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Min Amount (optional)</Label>
              <Input
                type="number"
                placeholder="100"
                value={minAmount}
                onChange={(e) => setMinAmount(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Max Amount (optional)</Label>
              <Input
                type="number"
                placeholder="No limit"
                value={maxAmount}
                onChange={(e) => setMaxAmount(e.target.value)}
              />
            </div>
          </div>

          {/* Payment Window */}
          <div className="space-y-2">
            <Label>Payment Window</Label>
            <Select value={paymentWindow} onValueChange={setPaymentWindow}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="15">15 minutes</SelectItem>
                <SelectItem value="30">30 minutes</SelectItem>
                <SelectItem value="60">1 hour</SelectItem>
                <SelectItem value="120">2 hours</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Time allowed for buyer to make payment
            </p>
          </div>

          {/* Terms */}
          <div className="space-y-2">
            <Label>Terms & Instructions (optional)</Label>
            <Textarea
              placeholder="E.g., Payment must be from a verified account..."
              value={terms}
              onChange={(e) => setTerms(e.target.value)}
              rows={3}
            />
          </div>

          {/* Info Note */}
          <div className="flex items-start gap-2 p-3 bg-blue-500/10 rounded-lg text-sm">
            <Info className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
            <p className="text-muted-foreground">
              Your credits will be locked in escrow when a buyer initiates a transaction.
              They will only be released after you confirm payment.
            </p>
          </div>

          {/* Submit Button */}
          <Button
            className="w-full"
            onClick={() => createListingMutation.mutate()}
            disabled={
              createListingMutation.isPending ||
              credits <= 0 ||
              price <= 0 ||
              credits > userCredits
            }
          >
            {createListingMutation.isPending ? 'Creating...' : 'Create Listing'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
