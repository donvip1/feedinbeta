import React from 'react';
import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useP2PEligibility } from '@/hooks/useP2PEligibility';
import { P2P_CONFIG } from '@/lib/p2p-config';

interface EligibilityBannerProps {
  compact?: boolean;
}

export const EligibilityBanner: React.FC<EligibilityBannerProps> = ({ compact = false }) => {
  const navigate = useNavigate();
  const { eligibility, isLoading } = useP2PEligibility();

  if (isLoading) {
    return <div className="animate-pulse h-10 bg-muted/30 rounded-lg" />;
  }

  if (eligibility.canTrade) {
    if (compact) {
      return (
        <p className="text-xs text-muted-foreground">
          Ready to trade · Min {eligibility.minTradeAmount} credits
        </p>
      );
    }

    return (
      <div className="rounded-lg border border-border/50 bg-card p-3 flex items-center justify-between">
        <div className="text-sm">
          <span className="font-medium text-foreground">Ready to trade</span>
          <span className="text-muted-foreground ml-2">Min {eligibility.minTradeAmount}</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {eligibility.totalTrades > 0 && <span>{eligibility.totalTrades} trades</span>}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border/50 bg-card p-4 space-y-3">
      <p className="text-sm font-medium text-foreground">Complete setup to trade</p>
      <ul className="space-y-1.5">
        {eligibility.reasons.map((reason, index) => (
          <li key={index} className="text-xs text-muted-foreground flex items-center gap-2">
            <span className="w-1 h-1 rounded-full bg-muted-foreground shrink-0" />
            {reason}
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-2">
        {eligibility.requiresPaymentSetup && (
          <Button size="sm" variant="outline" onClick={() => navigate('/p2p/payment-methods')} className="h-7 text-xs gap-1">
            Add Payment <ArrowRight className="w-3 h-3" />
          </Button>
        )}
        {!eligibility.userCountry && (
          <Button size="sm" variant="outline" onClick={() => navigate('/settings/account')} className="h-7 text-xs gap-1">
            Set Country <ArrowRight className="w-3 h-3" />
          </Button>
        )}
        {!eligibility.hasPurchasedPack && (
          <Button size="sm" variant="default" onClick={() => navigate('/wallet/credits')} className="h-7 text-xs gap-1">
            Buy Credits <ArrowRight className="w-3 h-3" />
          </Button>
        )}
      </div>
      <p className="text-[11px] text-muted-foreground">
        First-time: {P2P_CONFIG.MIN_TRADE_FIRST_TIME}+ credits · After first trade: {P2P_CONFIG.MIN_TRADE_REGULAR}
      </p>
    </div>
  );
};
