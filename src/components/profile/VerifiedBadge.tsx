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
const CACHE_TTL = 120000; // 2 minutes

function getBadgeSrc(plan: string | null): string | null {
  if (plan?.includes('premium')) return badgePremium;
  if (plan?.includes('pro') || plan?.includes('popular')) return badgePro;
  return null;
}

export const VerifiedBadge = ({ userId, size = 'sm' }: VerifiedBadgeProps) => {
  const cached = userId ? badgeDataCache.get(userId) : null;
  const [planName, setPlanName] = useState<string | null>(cached?.plan ?? null);
  const [loaded, setLoaded] = useState(!!cached && Date.now() - cached.ts < CACHE_TTL);

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
      const planResult = await supabase
        .from('user_subscriptions')
        .select('subscription_tiers(name)')
        .eq('user_id', userId)
        .eq('status', 'active')
        .maybeSingle();

      if (cancelled) return;

      const tierData = planResult.data as any;
      const plan = tierData?.subscription_tiers?.name?.toLowerCase() || null;

      badgeDataCache.set(userId, { plan, ts: Date.now() });
      setPlanName(plan);
      setLoaded(true);
    };

    fetchBadgeData();
    return () => { cancelled = true; };
  }, [userId]);

  if (!loaded) return null;

  const badgeSrc = getBadgeSrc(planName);
  if (!badgeSrc) return null;

  const sizeMap = {
    sm: 'w-[22px] h-[22px]',
    md: 'w-[27px] h-[27px]',
    lg: 'w-[32px] h-[32px]',
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
