import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Shield, Crown, Code, Star, Sparkles, Zap } from 'lucide-react';

interface AvatarBadgeIconProps {
  userId: string;
  size?: 'sm' | 'md' | 'lg';
}

const ROLE_ICON_CONFIG: Record<string, { icon: React.ElementType; bg: string }> = {
  super_admin: { icon: Crown, bg: 'bg-gradient-to-br from-amber-500 to-red-500' },
  developer: { icon: Code, bg: 'bg-gradient-to-br from-violet-500 to-purple-600' },
  admin: { icon: Shield, bg: 'bg-gradient-to-br from-blue-500 to-cyan-500' },
  moderator: { icon: Star, bg: 'bg-gradient-to-br from-green-500 to-emerald-500' },
};

const PLAN_ICON_CONFIG: Record<string, { icon: React.ElementType; bg: string }> = {
  premium: { icon: Crown, bg: 'bg-gradient-to-br from-yellow-500 to-orange-500' },
  pro: { icon: Sparkles, bg: 'bg-gradient-to-br from-purple-500 to-pink-500' },
  popular: { icon: Zap, bg: 'bg-gradient-to-br from-blue-500 to-indigo-500' },
};

// Simple in-memory cache to avoid repeated queries
const badgeCache = new Map<string, { role: string | null; plan: string | null; ts: number }>();
const CACHE_TTL = 60000; // 1 minute

export const AvatarBadgeIcon = ({ userId, size = 'sm' }: AvatarBadgeIconProps) => {
  const { user } = useAuth();
  const [role, setRole] = useState<string | null>(null);
  const [planName, setPlanName] = useState<string | null>(null);
  const [viewerIsAdmin, setViewerIsAdmin] = useState(false);

  useEffect(() => {
    if (!userId) return;

    // Check cache
    const cached = badgeCache.get(userId);
    if (cached && Date.now() - cached.ts < CACHE_TTL) {
      setRole(cached.role);
      setPlanName(cached.plan);
      return;
    }

    const fetch = async () => {
      const [roleResult, planResult] = await Promise.all([
        supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', userId)
          .in('role', ['admin', 'moderator', 'developer', 'super_admin'])
          .maybeSingle(),
        supabase
          .from('user_subscriptions')
          .select('tier_id')
          .eq('user_id', userId)
          .eq('status', 'active')
          .maybeSingle(),
      ]);

      const r = roleResult.data?.role || null;
      let p: string | null = null;
      if (planResult.data?.tier_id) {
        const { data: tierData } = await supabase
          .from('subscription_tiers')
          .select('name')
          .eq('id', planResult.data.tier_id)
          .maybeSingle();
        p = tierData?.name?.toLowerCase() || null;
      }

      badgeCache.set(userId, { role: r, plan: p, ts: Date.now() });
      setRole(r);
      setPlanName(p);
    };

    fetch();
  }, [userId]);

  // Check if viewer is admin/mod so they can see other admin badges
  useEffect(() => {
    if (!user?.id || user.id === userId) {
      setViewerIsAdmin(user?.id === userId); // own badge always visible
      return;
    }
    supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .in('role', ['admin', 'moderator', 'developer', 'super_admin'])
      .maybeSingle()
      .then(({ data }) => setViewerIsAdmin(!!data));
  }, [user?.id, userId]);

  const isOwnProfile = user?.id === userId;
  const canSeeAdminRole = isOwnProfile || viewerIsAdmin;

  // Only show subscription plan badge on avatar, not role badges
  const planConfig = planName
    ? Object.entries(PLAN_ICON_CONFIG).find(([key]) => planName.includes(key))?.[1]
    : null;

  const config = planConfig;
  if (!config) return null;

  const Icon = config.icon;

  const sizeClasses = {
    sm: 'w-4 h-4 -bottom-0.5 -right-0.5',
    md: 'w-5 h-5 -bottom-0.5 -right-0.5',
    lg: 'w-6 h-6 -bottom-1 -right-1',
  };

  const iconSizes = {
    sm: 'w-2.5 h-2.5',
    md: 'w-3 h-3',
    lg: 'w-3.5 h-3.5',
  };

  return (
    <div className={`absolute ${sizeClasses[size]} ${config.bg} rounded-full flex items-center justify-center ring-2 ring-background shadow-sm`}>
      <Icon className={`${iconSizes[size]} text-white`} />
    </div>
  );
};
