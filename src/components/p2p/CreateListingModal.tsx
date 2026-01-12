import { useState } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useCurrency } from '@/context/CurrencyContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Plus, Coins, Info, AlertCircle, Globe, Lock } from 'lucide-react';
import { P2P_CONFIG, creditsToUsdForSelling, getCountryByCode } from '@/lib/p2p-config';
import { useP2PEligibility } from '@/hooks/useP2PEligibility';
import { useNavigate } from 'react-router-dom';

interface CreateListingModalProps {
  userCredits: number;
}

export const CreateListingModal = ({ userCredits }: CreateListingModalProps) => {
  const { user } = useAuth();
  const { formatPrice, convertFromUSD, currencySymbol, userLocation } = useCurrency();
  const { eligibility } = useP2PEligibility();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  
  // Get user's country
  const { data: profile } = useQuery({
    queryKey: ['profile-country', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('profiles')
        .select('country')
        .eq('id', user?.id)
        .single();
      return data;
    },
    enabled: !!user?.id,
  });

  const userCountry = profile?.country || (typeof userLocation === 'string' ? userLocation : userLocation?.countryCode) || 'NG';
  const countryInfo = getCountryByCode(userCountry);
  
  // Form state
  const [creditsAmount, setCreditsAmount] = useState('');
  const [priceUsd, setPriceUsd] = useState('');
  const [minAmount, setMinAmount] = useState(eligibility.minTradeAmount.toString());
  const [maxAmount, setMaxAmount] = useState('');
  const [paymentWindow, setPaymentWindow] = useState('30');
  const [terms, setTerms] = useState('');

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
          price_usd: price,
          min_amount: minAmount ? parseInt(minAmount) : eligibility.minTradeAmount,
          max_amount: maxAmount ? parseInt(maxAmount) : null,
          payment_window_minutes: parseInt(paymentWindow) || 30,
          terms: terms || null,
          country_code: userCountry,
          currency_code: countryInfo?.currency || 'USD',
          credits_per_dollar: P2P_CONFIG.SELL_RATE,
          is_international: false,
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
    setMinAmount(eligibility.minTradeAmount.toString());
    setMaxAmount('');
    setPaymentWindow('30');
    setTerms('');
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
              {!eligibility.userCountry && (
                <Button variant="outline" onClick={() => navigate('/settings/account')} className="flex-1">
                  Set Country
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
          {/* Region Lock Badge */}
          <div className="flex items-center gap-2 p-3 rounded-lg bg-primary/10 border border-primary/20">
            <Lock className="h-4 w-4 text-primary" />
            <div className="flex-1">
              <span className="text-sm font-medium flex items-center gap-2">
                <Globe className="h-3 w-3" />
                {countryInfo?.name || userCountry} Only
              </span>
              <p className="text-xs text-muted-foreground">
                Only users in {countryInfo?.name || userCountry} can buy
              </p>
            </div>
            <Badge variant="outline" className="text-xs">
              {countryInfo?.currency || 'USD'}
            </Badge>
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
                ≈ {currencySymbol}{localPrice.toLocaleString(undefined, { maximumFractionDigits: 2 })} in {countryInfo?.currency || 'local currency'}
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

          {/* Min/Max Limits */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Min Amount</Label>
              <Input
                type="number"
                placeholder={eligibility.minTradeAmount.toString()}
                value={minAmount}
                onChange={(e) => setMinAmount(e.target.value)}
                min={eligibility.minTradeAmount}
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

          {/* International Coming Soon */}
          <div className="flex items-center gap-2 p-3 bg-yellow-500/10 rounded-lg">
            <Globe className="w-4 h-4 text-yellow-600" />
            <div className="flex-1">
              <p className="text-sm font-medium text-yellow-600">PayPal International</p>
              <p className="text-xs text-muted-foreground">Coming soon for cross-border trades</p>
            </div>
            <Badge variant="outline" className="text-xs">Soon</Badge>
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
