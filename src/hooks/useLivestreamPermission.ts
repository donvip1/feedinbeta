import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

/**
 * Check if the current user can create video livestreams.
 * Requires tier_level >= 2 (Popular Pack or higher).
 * Audio Spaces are available to all users.
 */
export const useLivestreamPermission = () => {
  const { user } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ['livestream-permission', user?.id],
    queryFn: async () => {
      if (!user) return { canLivestream: false, tierLevel: 0 };

      const { data: credits } = await supabase
        .from('user_credits')
        .select('highest_tier_level')
        .eq('user_id', user.id)
        .single();

      const tierLevel = credits?.highest_tier_level ?? 0;

      return {
        canLivestream: tierLevel >= 2,
        tierLevel,
      };
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });

  return {
    canLivestream: data?.canLivestream ?? false,
    tierLevel: data?.tierLevel ?? 0,
    isLoading,
  };
};
