import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface SubscriptionFeatures {
  /** User has any active subscription */
  isSubscribed: boolean;
  /** Subscription tier name: 'Basic' | 'Pro' | 'Premium' | null */
  tierName: string | null;
  /** Highest credit pack tier level purchased */
  creditTierLevel: number;
  /** Whether user has admin/moderator/developer role (bypasses all gates) */
  hasAdminAccess: boolean;

  // Feature gates
  canAccessPremiumGroups: boolean;
  canAccessAdultGroups: boolean;
  canUnlimitedMessaging: boolean;
  canUnlimitedAI: boolean;
  canAccessP2PMarketplace: boolean;
  canLivestream: boolean;
  canPromotePosts: boolean;
  canSchedulePosts: boolean;
  canGetVerifiedBadge: boolean;
  canGetFeaturedProfile: boolean;
  canBoostedReach: boolean;
  maxFriends: number;
  aiImagesPerDay: number;
}

const DEFAULT_FEATURES: SubscriptionFeatures = {
  isSubscribed: false,
  tierName: null,
  creditTierLevel: 0,
  hasAdminAccess: false,
  canAccessPremiumGroups: false,
  canAccessAdultGroups: false,
  canUnlimitedMessaging: false,
  canUnlimitedAI: false,
  canAccessP2PMarketplace: false,
  canLivestream: false,
  canPromotePosts: false,
  canSchedulePosts: false,
  canGetVerifiedBadge: false,
  canGetFeaturedProfile: false,
  canBoostedReach: false,
  maxFriends: 20,
  aiImagesPerDay: 0,
};

export const useSubscriptionFeatures = () => {
  const { user } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ['subscription-features', user?.id],
    queryFn: async (): Promise<SubscriptionFeatures> => {
      if (!user) return DEFAULT_FEATURES;

      // Fetch subscription, credit tier, and admin role in parallel
      const [subResult, creditsResult, roleResult] = await Promise.all([
        supabase
          .from('user_subscriptions')
          .select('status, subscription_tiers(name)')
          .eq('user_id', user.id)
          .eq('status', 'active')
          .maybeSingle(),
        supabase
          .from('user_credits')
          .select('highest_tier_level')
          .eq('user_id', user.id)
          .maybeSingle(),
        supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .in('role', ['admin', 'moderator', 'developer'])
          .maybeSingle(),
      ]);

      const hasAdminAccess = !!roleResult.data;

      // Admin/mod/dev bypass all gates
      if (hasAdminAccess) {
        return {
          isSubscribed: true,
          tierName: 'Admin',
          creditTierLevel: 99,
          hasAdminAccess: true,
          canAccessPremiumGroups: true,
          canAccessAdultGroups: true,
          canUnlimitedMessaging: true,
          canUnlimitedAI: true,
          canAccessP2PMarketplace: true,
          canLivestream: true,
          canPromotePosts: true,
          canSchedulePosts: true,
          canGetVerifiedBadge: true,
          canGetFeaturedProfile: true,
          canBoostedReach: true,
          maxFriends: 9999,
          aiImagesPerDay: 9999,
        };
      }

      const subTiers = subResult.data?.subscription_tiers;
      const tierObj = Array.isArray(subTiers) ? subTiers[0] : subTiers;
      const tierName = (tierObj as any)?.name ?? null;
      const isSubscribed = !!subResult.data && !!tierName;
      const creditTierLevel = creditsResult.data?.highest_tier_level ?? 0;

      // Determine features based on subscription tier + credit pack tier
      const isBasic = tierName === 'Basic';
      const isPro = tierName === 'Pro' || creditTierLevel >= 2;
      const isPremium = tierName === 'Premium' || creditTierLevel >= 4;

      return {
        isSubscribed,
        tierName,
        creditTierLevel,
        hasAdminAccess: false,
        canAccessPremiumGroups: isPro || isPremium,
        canAccessAdultGroups: isPremium,
        canUnlimitedMessaging: isPro || isPremium,
        canUnlimitedAI: isPremium,
        canAccessP2PMarketplace: isPremium,
        canLivestream: creditTierLevel >= 2 || isPro || isPremium,
        canPromotePosts: creditTierLevel >= 2 || isPro || isPremium,
        canSchedulePosts: creditTierLevel >= 3 || isPremium,
        canGetVerifiedBadge: creditTierLevel >= 4 || isPremium,
        canGetFeaturedProfile: creditTierLevel >= 4 || isPremium,
        canBoostedReach: creditTierLevel >= 3 || isPremium,
        maxFriends: isPremium ? 150 : isPro ? 50 : isBasic ? 20 : 10,
        aiImagesPerDay: isPremium ? 99 : isPro ? 2 : isBasic ? 0 : 0,
      };
    },
    enabled: !!user,
    staleTime: 2 * 60 * 1000,
  });

  return {
    features: data ?? DEFAULT_FEATURES,
    isLoading,
  };
};
