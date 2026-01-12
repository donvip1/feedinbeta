import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { P2P_CONFIG } from '@/lib/p2p-config';

interface P2PEligibility {
  canTrade: boolean;
  canBuy: boolean;
  minTradeAmount: number;
  hasPurchasedPack: boolean;
  hasPaymentMethod: boolean;
  hasCompletedFirstTrade: boolean;
  isReseller: boolean;
  totalTrades: number;
  totalVolumeUsd: number;
  requiresPaymentSetup: boolean;
  userCountry: string | null;
  userPhoneNumber: string | null;
  reasons: string[];
  buyerCancellationCount: number;
  buyerBanUntil: string | null;
  isBuyerBanned: boolean;
  profileIncomplete: boolean;
}

export const useP2PEligibility = () => {
  const { user } = useAuth();

  const { data: eligibility, isLoading, refetch } = useQuery({
    queryKey: ['p2p-eligibility', user?.id],
    queryFn: async (): Promise<P2PEligibility> => {
      if (!user?.id) {
        return {
          canTrade: false,
          canBuy: false,
          minTradeAmount: P2P_CONFIG.MIN_TRADE_FIRST_TIME,
          hasPurchasedPack: false,
          hasPaymentMethod: false,
          hasCompletedFirstTrade: false,
          isReseller: false,
          totalTrades: 0,
          totalVolumeUsd: 0,
          requiresPaymentSetup: true,
          userCountry: null,
          userPhoneNumber: null,
          reasons: ['Please sign in to trade'],
          buyerCancellationCount: 0,
          buyerBanUntil: null,
          isBuyerBanned: false,
          profileIncomplete: true,
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

      // Fetch user profile for country and phone
      const { data: profile } = await supabase
        .from('profiles')
        .select('country, phone_number')
        .eq('id', user.id)
        .single();

      const hasPaymentMethod = (paymentMethods?.length ?? 0) > 0;
      const hasPurchasedPack = eligibilityData?.has_purchased_pack ?? false;
      const hasCompletedFirstTrade = eligibilityData?.first_p2p_trade_completed ?? false;
      const isReseller = eligibilityData?.is_reseller ?? false;
      const totalTrades = eligibilityData?.total_trades ?? 0;
      const totalVolumeUsd = Number(eligibilityData?.total_volume_usd ?? 0);
      const userCountry = profile?.country ?? null;
      const userPhoneNumber = profile?.phone_number ?? null;
      const buyerCancellationCount = (eligibilityData as any)?.buyer_cancellation_count ?? 0;
      const buyerBanUntil = (eligibilityData as any)?.buyer_ban_until ?? null;

      // Check if buyer is currently banned
      const isBuyerBanned = buyerBanUntil ? new Date(buyerBanUntil) > new Date() : false;

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

      if (!userPhoneNumber) {
        reasons.push('Add your phone number in profile settings');
      }

      if (isBuyerBanned) {
        reasons.push(`You are banned from buying until ${new Date(buyerBanUntil!).toLocaleDateString()}`);
      }

      const profileIncomplete = !userCountry || !userPhoneNumber;
      const canTrade = hasPaymentMethod && !!userCountry && !!userPhoneNumber;
      const canBuy = canTrade && !isBuyerBanned;

      return {
        canTrade,
        canBuy,
        minTradeAmount,
        hasPurchasedPack,
        hasPaymentMethod,
        hasCompletedFirstTrade,
        isReseller,
        totalTrades,
        totalVolumeUsd,
        requiresPaymentSetup: !hasPaymentMethod,
        userCountry,
        userPhoneNumber,
        reasons,
        buyerCancellationCount,
        buyerBanUntil,
        isBuyerBanned,
        profileIncomplete,
      };
    },
    enabled: !!user?.id,
    staleTime: 30000,
  });

  return {
    eligibility: eligibility ?? {
      canTrade: false,
      canBuy: false,
      minTradeAmount: P2P_CONFIG.MIN_TRADE_FIRST_TIME,
      hasPurchasedPack: false,
      hasPaymentMethod: false,
      hasCompletedFirstTrade: false,
      isReseller: false,
      totalTrades: 0,
      totalVolumeUsd: 0,
      requiresPaymentSetup: true,
      userCountry: null,
      userPhoneNumber: null,
      reasons: ['Loading...'],
      buyerCancellationCount: 0,
      buyerBanUntil: null,
      isBuyerBanned: false,
      profileIncomplete: true,
    },
    isLoading,
    refetch,
  };
};
