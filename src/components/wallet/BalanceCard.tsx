import React from 'react';
import { Button } from '@/components/ui/button';
import { Send, CreditCard, Gift, Banknote } from 'lucide-react';
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
  onWithdrawClick?: () => void;
}

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
  onWithdrawClick,
}) => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const { data: unconvertedGifts } = useQuery({
    queryKey: ['unconverted-gifts-balance', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('gift_analytics')
        .select('credit_value, platform_fee')
        .eq('receiver_id', user?.id)
        .or('is_converted.eq.false,is_converted.is.null');
      if (error) throw error;
      return data?.reduce((sum, g) => sum + (g.credit_value - (g.platform_fee || 0)), 0) || 0;
    },
    enabled: !!user,
  });

  const balanceInLocalCurrency = (balance / CREDITS_PER_USD) * exchangeRate;

  return (
    <div className="rounded-2xl border border-border/50 bg-card p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-muted-foreground uppercase tracking-wider">Balance</span>
        <button
          onClick={() => navigate('/settings/currency')}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          {currencyCode} {tierName && `· ${tierName}`}
        </button>
      </div>

      {/* Balance */}
      <div className="mb-6">
        <p className="text-4xl font-bold text-foreground tracking-tight">{balance.toLocaleString()}</p>
        <p className="text-sm text-muted-foreground mt-0.5">
          ≈ {currencySymbol}{balanceInLocalCurrency.toLocaleString(undefined, { maximumFractionDigits: exchangeRate > 100 ? 0 : 2 })}
        </p>
        {unconvertedGifts && unconvertedGifts > 0 && (
          <p className="text-xs text-muted-foreground mt-1.5">
            <Gift className="w-3 h-3 inline mr-1" />
            +{unconvertedGifts} in gifts
          </p>
        )}
      </div>

      {/* Earned / Spent */}
      <div className="flex gap-6 mb-5 text-sm">
        <div>
          <span className="text-muted-foreground">In </span>
          <span className="font-medium text-foreground">+{totalEarned.toLocaleString()}</span>
        </div>
        <div>
          <span className="text-muted-foreground">Out </span>
          <span className="font-medium text-foreground">−{totalSpent.toLocaleString()}</span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <Button onClick={onSendClick} variant="outline" className="flex-1 h-10">
          <Send className="w-4 h-4 mr-1.5" />
          Send
        </Button>
        <Button onClick={onBuyClick} className="flex-1 h-10">
          <CreditCard className="w-4 h-4 mr-1.5" />
          Buy
        </Button>
        {onWithdrawClick && (
          <Button onClick={onWithdrawClick} variant="outline" className="flex-1 h-10">
            <Banknote className="w-4 h-4 mr-1.5" />
            Withdraw
          </Button>
        )}
      </div>
    </div>
  );
};
