import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import badgePro from '@/assets/badge-pro.png';
import badgePremium from '@/assets/badge-premium.png';

interface VerifiedBadgeProps {
  userId: string;
  size?: 'sm' | 'md' | 'lg';
}

// Cache to avoid repeated queries
const verifiedCache = new Map<string, { plan: string | null; ts: number }>();
const CACHE_TTL = 60000;

export const VerifiedBadge = ({ userId, size = 'sm' }: VerifiedBadgeProps) => {
  const [planName, setPlanName] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;

    const cached = verifiedCache.get(userId);
    if (cached && Date.now() - cached.ts < CACHE_TTL) {
      setPlanName(cached.plan);
      return;
    }

    const fetchPlan = async () => {
      const { data } = await supabase
        .from('user_subscriptions')
        .select('subscription_tiers(name)')
        .eq('user_id', userId)
        .eq('status', 'active')
        .maybeSingle();

      const tierData = data as any;
      const name = tierData?.subscription_tiers?.name?.toLowerCase() || null;
      verifiedCache.set(userId, { plan: name, ts: Date.now() });
      setPlanName(name);
    };

    fetchPlan();
  }, [userId]);

  // Also check for admin roles (they get premium badge)
  const [hasAdminRole, setHasAdminRole] = useState(false);
  useEffect(() => {
    if (!userId) return;
    supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .in('role', ['admin', 'moderator', 'developer', 'super_admin'])
      .maybeSingle()
      .then(({ data }) => setHasAdminRole(!!data));
  }, [userId]);

  // Determine which badge to show
  let badgeSrc: string | null = null;
  if (hasAdminRole) {
    badgeSrc = badgePremium; // admins get premium badge
  } else if (planName?.includes('premium')) {
    badgeSrc = badgePremium;
  } else if (planName?.includes('pro') || planName?.includes('popular')) {
    badgeSrc = badgePro;
  }
  // Basic or no plan = no badge

  if (!badgeSrc) return null;

  const sizeMap = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6',
  };

  return (
    <img
      src={badgeSrc}
      alt="Verified"
      className={`${sizeMap[size]} inline-block flex-shrink-0`}
    />
  );
};
