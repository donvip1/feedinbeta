import { Badge } from '@/components/ui/badge';
import { Shield, Crown, Code, Star, Sparkles, Zap } from 'lucide-react';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface RolePlanBadgeProps {
  userId: string;
  compact?: boolean;
}

const ROLE_CONFIG: Record<string, { label: string; icon: React.ElementType; gradient: string }> = {
  super_admin: { label: 'Full Access', icon: Crown, gradient: 'from-amber-500 to-red-500' },
  developer: { label: 'Developer', icon: Code, gradient: 'from-violet-500 to-purple-600' },
  admin: { label: 'Admin', icon: Shield, gradient: 'from-blue-500 to-cyan-500' },
  moderator: { label: 'Moderator', icon: Star, gradient: 'from-green-500 to-emerald-500' },
};

const PLAN_CONFIG: Record<string, { label: string; icon: React.ElementType; gradient: string }> = {
  premium: { label: 'Premium', icon: Crown, gradient: 'from-yellow-500 to-orange-500' },
  pro: { label: 'Pro', icon: Sparkles, gradient: 'from-purple-500 to-pink-500' },
  popular: { label: 'Popular', icon: Zap, gradient: 'from-blue-500 to-indigo-500' },
};

export const RolePlanBadge = ({ userId, compact = false }: RolePlanBadgeProps) => {
  const [role, setRole] = useState<string | null>(null);
  const [planName, setPlanName] = useState<string | null>(null);

  useEffect(() => {
    const fetchRoleAndPlan = async () => {
      const [roleResult, planResult] = await Promise.all([
        supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', userId)
          .in('role', ['admin', 'moderator', 'developer', 'super_admin'])
          .maybeSingle(),
        supabase
          .from('user_subscriptions')
          .select('subscription_tiers(name)')
          .eq('user_id', userId)
          .eq('status', 'active')
          .maybeSingle(),
      ]);

      if (roleResult.data) setRole(roleResult.data.role);
      const tierData = planResult.data as any;
      if (tierData?.subscription_tiers?.name) {
        setPlanName(tierData.subscription_tiers.name.toLowerCase());
      }
    };

    if (userId) fetchRoleAndPlan();
  }, [userId]);

  const roleConfig = role ? ROLE_CONFIG[role] : null;
  const planConfig = planName ? Object.entries(PLAN_CONFIG).find(([key]) => planName.includes(key))?.[1] : null;

  if (!roleConfig && !planConfig) return null;

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {roleConfig && (
        <Badge className={`bg-gradient-to-r ${roleConfig.gradient} text-white border-0 shadow-md text-[10px] ${compact ? 'px-1.5 py-0' : 'px-2 py-0.5'}`}>
          <roleConfig.icon className={`${compact ? 'w-2.5 h-2.5' : 'w-3 h-3'} mr-0.5`} />
          {roleConfig.label}
        </Badge>
      )}
      {planConfig && !roleConfig && (
        <Badge className={`bg-gradient-to-r ${planConfig.gradient} text-white border-0 shadow-md text-[10px] ${compact ? 'px-1.5 py-0' : 'px-2 py-0.5'}`}>
          <planConfig.icon className={`${compact ? 'w-2.5 h-2.5' : 'w-3 h-3'} mr-0.5`} />
          {planConfig.label}
        </Badge>
      )}
    </div>
  );
};
