import { useSubscriptionFeatures } from './useSubscriptionFeatures';

export function usePremiumStatus() {
  const { features, isLoading } = useSubscriptionFeatures();

  return {
    isPremium: features.isSubscribed || features.creditTierLevel >= 2 || features.hasAdminAccess,
    tierName: features.tierName,
    features,
    loading: isLoading,
  };
}
