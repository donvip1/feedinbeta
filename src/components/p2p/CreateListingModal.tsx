import { useState } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useCurrency } from '@/context/CurrencyContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Plus, Coins, Info, AlertCircle, Lock } from 'lucide-react';
import { P2P_CONFIG, creditsToUsdForSelling } from '@/lib/p2p-config';
import { useP2PEligibility } from '@/hooks/useP2PEligibility';
import { useNavigate } from 'react-router-dom';

interface CreateListingModalProps {
  userCredits: number;
}

export const CreateListingModal = ({ userCredits }: CreateListingModalProps) => {
  const { user } = useAuth();
  const { convertFromUSD, currencySymbol } = useCurrency();
  const { eligibility } = useP2PEligibility();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  
  const { data: paymentMethod } = useQuery({
    queryKey: ['p2p-default-payment-method', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('p2p_payment_methods')
        .select('id')
        .eq('user_id', user?.id)
        .eq('is_active', true)
        .order('is_default', { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
    enabled: !!user?.id,
  });
  
  // Form state
  const [creditsAmount, setCreditsAmount] = useState('');
  const [priceUsd, setPriceUsd] = useState('');

  // Calculate rate using P2P sell rate (85 credits = $1)
  const credits = parseInt(creditsAmount) || 0;
  const price = parseFloat(priceUsd) || 0;
  const suggestedPrice = creditsToUsdForSelling(credits);
  const rate = price > 0 ? Math.round(credits / price) : 0;
  const localPrice = convertFromUSD(price);

  const createListingMutation = useMutation({
    mutationFn: async () => {
      // Validate eligibility
      if (!eligibility.canTrade) {
        throw new Error('Please complete your P2P setup first');
      }

      if (credits < eligibility.minTradeAmount) {
        throw new Error(`Minimum trade amount is ${eligibility.minTradeAmount} credits`);
      }

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
          price_cents: Math.round(price * 100),
          currency: 'USD',
          payment_method_id: paymentMethod?.id ?? null,
          status: 'active',
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
  };

  const handleQuickAmount = (percentage: number) => {
    const amount = Math.floor(userCredits * percentage);
    setCreditsAmount(amount.toString());
    // Auto-calculate price at P2P sell rate (85 credits = $1)
    const suggestedUsd = creditsToUsdForSelling(amount);
    setPriceUsd(suggestedUsd.toFixed(2));
  };

  const handleCreditsChange = (value: string) => {
    setCreditsAmount(value);
    const creditNum = parseInt(value) || 0;
    if (creditNum > 0) {
      const suggestedUsd = creditsToUsdForSelling(creditNum);
      setPriceUsd(suggestedUsd.toFixed(2));
    }
  };

  // Check if user can create listing
  if (!eligibility.canTrade) {
    return (
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogTrigger asChild>
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            Sell Credits
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-yellow-500" />
              Complete Setup First
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              To sell credits on the P2P marketplace, you need to:
            </p>
            <ul className="space-y-2">
              {eligibility.reasons.map((reason, i) => (
                <li key={i} className="flex items-center gap-2 text-sm">
                  <div className="h-1.5 w-1.5 rounded-full bg-yellow-500" />
                  {reason}
                </li>
              ))}
            </ul>
            <div className="flex gap-2">
              {eligibility.requiresPaymentSetup && (
                <Button onClick={() => navigate('/p2p/payment-methods')} className="flex-1">
                  Add Payment Method
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

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
          {/* Settlement currency */}
          <div className="flex items-center gap-2 p-3 rounded-lg bg-primary/10 border border-primary/20">
            <Lock className="h-4 w-4 text-primary" />
            <div className="flex-1">
              <span className="text-sm font-medium">USD listing value</span>
              <p className="text-xs text-muted-foreground">
                Buyer and seller agree the external payment method in the trade
              </p>
            </div>
          </div>

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
              placeholder={`Min: ${eligibility.minTradeAmount}`}
              value={creditsAmount}
              onChange={(e) => handleCreditsChange(e.target.value)}
              max={userCredits}
            />
            {credits > 0 && credits < eligibility.minTradeAmount && (
              <p className="text-xs text-destructive">
                Minimum amount is {eligibility.minTradeAmount} credits
              </p>
            )}
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
                ≈ {currencySymbol}{localPrice.toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </p>
            )}
          </div>

          {/* Rate Preview */}
          {rate > 0 && (
            <div className="p-3 bg-primary/10 rounded-lg space-y-1">
              <p className="text-sm font-medium">
                Rate: {rate} credits per $1
              </p>
              <p className="text-xs text-muted-foreground">
                P2P sell rate is {P2P_CONFIG.SELL_RATE} credits per $1 (vs {P2P_CONFIG.BUY_RATE} in store)
              </p>
              {rate < P2P_CONFIG.SELL_RATE - 5 && (
                <p className="text-xs text-yellow-600">
                  ⚠️ Your rate is below market. Consider pricing at ${suggestedPrice.toFixed(2)}
                </p>
              )}
            </div>
          )}

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
              credits < eligibility.minTradeAmount ||
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
