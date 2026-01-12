import React from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  AlertCircle, 
  CheckCircle2, 
  CreditCard, 
  ShieldCheck, 
  TrendingUp,
  ArrowRight,
  Coins
} from 'lucide-react';
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
    return (
      <div className="animate-pulse h-20 bg-muted rounded-lg" />
    );
  }

  // If user can trade, show success state
  if (eligibility.canTrade) {
    if (compact) {
      return (
        <div className="flex items-center gap-2 text-sm text-green-600">
          <CheckCircle2 className="h-4 w-4" />
          <span>Ready to trade</span>
          <Badge variant="secondary" className="text-xs">
            Min: {eligibility.minTradeAmount} credits
          </Badge>
        </div>
      );
    }

    return (
      <Alert className="border-green-500/50 bg-green-500/10">
        <CheckCircle2 className="h-4 w-4 text-green-500" />
        <AlertTitle className="text-green-600">Ready to Trade</AlertTitle>
        <AlertDescription className="text-green-600/80">
          <div className="flex flex-wrap items-center gap-4 mt-2">
            <div className="flex items-center gap-1">
              <Coins className="h-4 w-4" />
              <span>Min trade: {eligibility.minTradeAmount} credits</span>
            </div>
            {eligibility.hasPurchasedPack && (
              <Badge className="bg-green-500">
                <ShieldCheck className="h-3 w-3 mr-1" />
                Pack Holder
              </Badge>
            )}
            {eligibility.isReseller && (
              <Badge className="bg-purple-500">
                <TrendingUp className="h-3 w-3 mr-1" />
                Reseller
              </Badge>
            )}
            {eligibility.totalTrades > 0 && (
              <Badge variant="outline" className="border-green-500/50 text-green-600">
                {eligibility.totalTrades} trades completed
              </Badge>
            )}
          </div>
        </AlertDescription>
      </Alert>
    );
  }

  // Show requirements
  return (
    <Alert className="border-yellow-500/50 bg-yellow-500/10">
      <AlertCircle className="h-4 w-4 text-yellow-500" />
      <AlertTitle className="text-yellow-600">Complete Setup to Trade</AlertTitle>
      <AlertDescription>
        <div className="space-y-3 mt-2">
          <ul className="space-y-2">
            {eligibility.reasons.map((reason, index) => (
              <li key={index} className="flex items-center gap-2 text-sm text-muted-foreground">
                <div className="h-1.5 w-1.5 rounded-full bg-yellow-500" />
                {reason}
              </li>
            ))}
          </ul>

          <div className="flex flex-wrap gap-2">
            {eligibility.requiresPaymentSetup && (
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => navigate('/p2p/payment-methods')}
                className="gap-1"
              >
                <CreditCard className="h-4 w-4" />
                Add Payment Method
                <ArrowRight className="h-3 w-3" />
              </Button>
            )}
            
            {!eligibility.userCountry && (
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => navigate('/settings/account')}
                className="gap-1"
              >
                Set Country
                <ArrowRight className="h-3 w-3" />
              </Button>
            )}

            {!eligibility.hasPurchasedPack && (
              <Button 
                size="sm" 
                variant="default"
                onClick={() => navigate('/wallet/credits')}
                className="gap-1"
              >
                <Coins className="h-4 w-4" />
                Buy Credits (Min {P2P_CONFIG.MIN_TRADE_REGULAR} credits)
                <ArrowRight className="h-3 w-3" />
              </Button>
            )}
          </div>

          <p className="text-xs text-muted-foreground">
            💡 First-time traders need {P2P_CONFIG.MIN_TRADE_FIRST_TIME}+ credits. 
            After your first trade or pack purchase, minimum drops to {P2P_CONFIG.MIN_TRADE_REGULAR} credits.
          </p>
        </div>
      </AlertDescription>
    </Alert>
  );
};
