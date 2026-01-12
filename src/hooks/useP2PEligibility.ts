import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { P2P_CONFIG } from '@/lib/p2p-config';

interface P2PEligibility {
  canTrade: boolean;
  minTradeAmount: number;
  hasPurchasedPack: boolean;
  hasPaymentMethod: boolean;
  hasCompletedFirstTrade: boolean;
  isReseller: boolean;
  totalTrades: number;
  totalVolumeUsd: number;
  requiresPaymentSetup: boolean;
  userCountry: string | null;
  reasons: string[];
}

export const useP2PEligibility = () => {
  const { user } = useAuth();

  const { data: eligibility, isLoading, refetch } = useQuery({
    queryKey: ['p2p-eligibility', user?.id],
    queryFn: async (): Promise<P2PEligibility> => {
      if (!user?.id) {
        return {
          canTrade: false,
          minTradeAmount: P2P_CONFIG.MIN_TRADE_FIRST_TIME,
          hasPurchasedPack: false,
          hasPaymentMethod: false,
          hasCompletedFirstTrade: false,
          isReseller: false,
          totalTrades: 0,
          totalVolumeUsd: 0,
          requiresPaymentSetup: true,
          userCountry: null,
          reasons: ['Please sign in to trade'],
        };
      }

      // Fetch eligibility data
      const { data: eligibilityData } = await supabase
        .from('p2p_user_eligibility')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      // Fetch payment methods
      const { data: paymentMethods } = await supabase
        .from('p2p_payment_methods')
        .select('id, country_code')
        .eq('user_id', user.id)
        .eq('is_active', true);

      // Fetch user profile for country
      const { data: profile } = await supabase
        .from('profiles')
        .select('country')
        .eq('id', user.id)
        .single();

      const hasPaymentMethod = (paymentMethods?.length ?? 0) > 0;
      const hasPurchasedPack = eligibilityData?.has_purchased_pack ?? false;
      const hasCompletedFirstTrade = eligibilityData?.first_p2p_trade_completed ?? false;
      const isReseller = eligibilityData?.is_reseller ?? false;
      const totalTrades = eligibilityData?.total_trades ?? 0;
      const totalVolumeUsd = Number(eligibilityData?.total_volume_usd ?? 0);
      const userCountry = profile?.country ?? null;

      // Determine minimum trade amount
      let minTradeAmount = P2P_CONFIG.MIN_TRADE_FIRST_TIME;
      if (hasPurchasedPack || hasCompletedFirstTrade) {
        minTradeAmount = P2P_CONFIG.MIN_TRADE_REGULAR;
      }

      // Determine if can trade and reasons
      const reasons: string[] = [];
      
      if (!hasPaymentMethod) {
        reasons.push('Add a payment method to start trading');
      }
      
      if (!userCountry) {
        reasons.push('Set your country in profile settings');
      }

      const canTrade = hasPaymentMethod && !!userCountry;

      return {
        canTrade,
        minTradeAmount,
        hasPurchasedPack,
        hasPaymentMethod,
        hasCompletedFirstTrade,
        isReseller,
        totalTrades,
        totalVolumeUsd,
        requiresPaymentSetup: !hasPaymentMethod,
        userCountry,
        reasons,
      };
    },
    enabled: !!user?.id,
    staleTime: 30000,
  });

  return {
    eligibility: eligibility ?? {
      canTrade: false,
      minTradeAmount: P2P_CONFIG.MIN_TRADE_FIRST_TIME,
      hasPurchasedPack: false,
      hasPaymentMethod: false,
      hasCompletedFirstTrade: false,
      isReseller: false,
      totalTrades: 0,
      totalVolumeUsd: 0,
      requiresPaymentSetup: true,
      userCountry: null,
      reasons: ['Loading...'],
    },
    isLoading,
    refetch,
  };
};
