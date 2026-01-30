import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Crown, Send, CreditCard, ArrowDownLeft, ArrowUpRight, Globe, Gift } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface BalanceCardProps {
  balance: number;
  totalEarned: number;
  totalSpent: number;
  tierName?: string | null;
  currencySymbol?: string;
  exchangeRate?: number;
  currencyCode?: string;
  onSendClick: () => void;
  onBuyClick: () => void;
}

// 100 credits = $1 USD
const CREDITS_PER_USD = 100;

export const BalanceCard: React.FC<BalanceCardProps> = ({
  balance,
  totalEarned,
  totalSpent,
  tierName,
  currencySymbol = '$',
  exchangeRate = 1,
  currencyCode = 'USD',
  onSendClick,
  onBuyClick,
}) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  
  // Fetch unconverted gifts total
  const { data: unconvertedGifts } = useQuery({
    queryKey: ['unconverted-gifts-balance', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('gift_analytics')
        .select('credit_value, platform_fee')
        .eq('receiver_id', user?.id)
        .or('is_converted.eq.false,is_converted.is.null');

      if (error) throw error;

      const totalValue = data?.reduce((sum, g) => sum + (g.credit_value - (g.platform_fee || 0)), 0) || 0;
      return totalValue;
    },
    enabled: !!user,
  });
  
  // Calculate local currency value of credits
  const balanceInLocalCurrency = (balance / CREDITS_PER_USD) * exchangeRate;
  
  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/20 via-primary/10 to-accent/20 border border-primary/30 p-5">
      {/* Decorative elements */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl" />
      <div className="absolute bottom-0 left-0 w-24 h-24 bg-accent/10 rounded-full translate-y-1/2 -translate-x-1/2 blur-xl" />
      
      <div className="relative z-10">
        {/* Header with tier badge and currency selector */}
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm text-muted-foreground font-medium">Current Balance</span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/settings/currency')}
              className="flex items-center gap-1 px-2 py-1 rounded-full bg-background/50 backdrop-blur-sm text-xs text-muted-foreground hover:bg-background/80 transition-colors"
            >
              <Globe className="w-3 h-3" />
              {currencyCode}
            </button>
            {tierName && (
              <Badge variant="secondary" className="flex items-center gap-1 bg-background/50 backdrop-blur-sm">
                <Crown className="w-3 h-3 text-primary" />
                {tierName}
              </Badge>
            )}
          </div>
        </div>

        {/* Balance display */}
        <div className="mb-5">
          <div className="flex items-baseline gap-2">
            <span className="text-4xl sm:text-5xl font-bold text-foreground">{balance.toLocaleString()}</span>
            <span className="text-base text-muted-foreground">credits</span>
          </div>
          {/* Show local currency value */}
          <p className="text-sm text-muted-foreground mt-1">
            ≈ {currencySymbol}{balanceInLocalCurrency.toLocaleString(undefined, { maximumFractionDigits: exchangeRate > 100 ? 0 : 2 })} {currencyCode}
          </p>
          {/* Show unconverted gifts indicator */}
          {unconvertedGifts && unconvertedGifts > 0 && (
            <div className="flex items-center gap-1.5 mt-2 text-sm text-yellow-500">
              <Gift className="w-3.5 h-3.5" />
              <span>+ {unconvertedGifts} credits in unconverted gifts</span>
            </div>
          )}
        </div>

        {/* Stats row */}
        <div className="flex gap-4 mb-5">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-full bg-green-500/20">
              <ArrowDownLeft className="w-3 h-3 text-green-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Earned</p>
              <p className="text-sm font-semibold text-green-500">+{totalEarned.toLocaleString()}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-full bg-red-500/20">
              <ArrowUpRight className="w-3 h-3 text-red-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Spent</p>
              <p className="text-sm font-semibold text-red-500">-{totalSpent.toLocaleString()}</p>
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex gap-3">
          <Button 
            onClick={onSendClick} 
            variant="secondary" 
            className="flex-1 bg-background/50 backdrop-blur-sm hover:bg-background/80"
          >
            <Send className="w-4 h-4 mr-2" />
            Send
          </Button>
          <Button 
            onClick={onBuyClick} 
            className="flex-1"
          >
            <CreditCard className="w-4 h-4 mr-2" />
            Buy Credits
          </Button>
        </div>
      </div>
    </div>
  );
};
