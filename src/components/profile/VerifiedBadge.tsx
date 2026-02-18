import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import badgePro from '@/assets/badge-pro.png';
import badgePremium from '@/assets/badge-premium.png';

interface VerifiedBadgeProps {
  userId: string;
  size?: 'sm' | 'md' | 'lg';
}

// Unified cache for badge data
const badgeDataCache = new Map<string, { plan: string | null; hasAdminRole: boolean; ts: number }>();
const CACHE_TTL = 120000; // 2 minutes

function getBadgeSrc(plan: string | null, hasAdminRole: boolean): string | null {
  if (hasAdminRole) return badgePremium;
  if (plan?.includes('premium')) return badgePremium;
  if (plan?.includes('pro') || plan?.includes('popular')) return badgePro;
  return null;
}

export const VerifiedBadge = ({ userId, size = 'sm' }: VerifiedBadgeProps) => {
  const cached = userId ? badgeDataCache.get(userId) : null;
  const [planName, setPlanName] = useState<string | null>(cached?.plan ?? null);
  const [hasAdminRole, setHasAdminRole] = useState(cached?.hasAdminRole ?? false);
  const [loaded, setLoaded] = useState(!!cached && Date.now() - cached.ts < CACHE_TTL);

  useEffect(() => {
    if (!userId) return;

    // Use cache if fresh
    const c = badgeDataCache.get(userId);
    if (c && Date.now() - c.ts < CACHE_TTL) {
      setPlanName(c.plan);
      setHasAdminRole(c.hasAdminRole);
      setLoaded(true);
      return;
    }

    let cancelled = false;

    const fetchBadgeData = async () => {
      const [planResult, roleResult] = await Promise.all([
        supabase
          .from('user_subscriptions')
          .select('subscription_tiers(name)')
          .eq('user_id', userId)
          .eq('status', 'active')
          .maybeSingle(),
        supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', userId)
          .in('role', ['admin', 'moderator', 'developer', 'super_admin'])
          .maybeSingle(),
      ]);

      if (cancelled) return;

      const tierData = planResult.data as any;
      const plan = tierData?.subscription_tiers?.name?.toLowerCase() || null;
      const isAdmin = !!roleResult.data;

      badgeDataCache.set(userId, { plan, hasAdminRole: isAdmin, ts: Date.now() });
      setPlanName(plan);
      setHasAdminRole(isAdmin);
      setLoaded(true);
    };

    fetchBadgeData();
    return () => { cancelled = true; };
  }, [userId]);

  // Don't render anything until loaded (prevents flash), unless cache gave us data
  if (!loaded) return null;

  const badgeSrc = getBadgeSrc(planName, hasAdminRole);
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
