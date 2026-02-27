import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import badgePro from '@/assets/badge-pro.png';
import badgePremium from '@/assets/badge-premium.png';

interface VerifiedBadgeProps {
  userId: string;
  size?: 'sm' | 'md' | 'lg';
}

// Unified cache for badge data
const badgeDataCache = new Map<string, { plan: string | null; ts: number }>();
const CACHE_TTL = 1800000; // 30 minutes

function getBadgeSrc(plan: string | null): string | null {
  if (plan?.includes('premium')) return badgePremium;
  if (plan?.includes('pro') || plan?.includes('popular')) return badgePro;
  return null;
}

// Clear cache on auth changes
supabase.auth.onAuthStateChange((event) => {
  if (event === 'SIGNED_OUT') {
    badgeDataCache.clear();
  }
});

export const VerifiedBadge = ({ userId, size = 'sm' }: VerifiedBadgeProps) => {
  const cached = userId ? badgeDataCache.get(userId) : null;
  const validCache = cached && Date.now() - cached.ts < CACHE_TTL;
  const [planName, setPlanName] = useState<string | null>(cached?.plan ?? null);
  // Show immediately if we have valid cache (even if plan is null = no badge)
  const [loaded, setLoaded] = useState(!!validCache);

  useEffect(() => {
    if (!userId) return;

    const c = badgeDataCache.get(userId);
    if (c && Date.now() - c.ts < CACHE_TTL) {
      setPlanName(c.plan);
      setLoaded(true);
      return;
    }

    let cancelled = false;

    const fetchBadgeData = async () => {
      const { data: subData } = await supabase
        .from('user_subscriptions')
        .select('tier_id')
        .eq('user_id', userId)
        .eq('status', 'active')
        .maybeSingle();

      if (cancelled) return;

      let plan: string | null = null;

      if (subData?.tier_id) {
        const { data: tierData } = await supabase
          .from('subscription_tiers')
          .select('name')
          .eq('id', subData.tier_id)
          .maybeSingle();
        if (cancelled) return;
        plan = tierData?.name?.toLowerCase() || null;
      }

      badgeDataCache.set(userId, { plan, ts: Date.now() });
      setPlanName(plan);
      setLoaded(true);
    };

    fetchBadgeData();
    return () => { cancelled = true; };
  }, [userId]);

  // Don't hide content while loading - show nothing only if loaded and no badge
  if (!loaded) return null;

  const badgeSrc = getBadgeSrc(planName);
  if (!badgeSrc) return null;

  const sizeMap = {
    sm: 'w-[19px] h-[19px]',
    md: 'w-[23px] h-[23px]',
    lg: 'w-[27px] h-[27px]',
  };

  return (
    <img
      src={badgeSrc}
      alt="Verified"
      className={`${sizeMap[size]} inline-block flex-shrink-0`}
    />
  );
};

// Export cache invalidation for use after mutations
export const invalidateVerifiedBadgeCache = (userId?: string) => {
  if (userId) {
    badgeDataCache.delete(userId);
  } else {
    badgeDataCache.clear();
  }
};

// Preload badge data for a user (call on app init)
export const preloadBadgeData = async (userId: string) => {
  if (badgeDataCache.has(userId)) return;
  
  const { data: subData } = await supabase
    .from('user_subscriptions')
    .select('tier_id')
    .eq('user_id', userId)
    .eq('status', 'active')
    .maybeSingle();

  let plan: string | null = null;
  if (subData?.tier_id) {
    const { data: tierData } = await supabase
      .from('subscription_tiers')
      .select('name')
      .eq('id', subData.tier_id)
      .maybeSingle();
    plan = tierData?.name?.toLowerCase() || null;
  }

  badgeDataCache.set(userId, { plan, ts: Date.now() });
};
