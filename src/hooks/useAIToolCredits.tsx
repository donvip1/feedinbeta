import { useEffect, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

interface UseAIToolCreditsOptions {
  toolName: string;
  creditCost: number;
}

interface UseAIToolCreditsReturn {
  balance: number;
  isLoading: boolean;
  hasEnoughCredits: boolean;
  checkAndDeductCredits: () => Promise<boolean>;
  refetchBalance: () => void;
}

export const useAIToolCredits = ({
  toolName,
  creditCost,
}: UseAIToolCreditsOptions): UseAIToolCreditsReturn => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Fetch user credits with caching
  const { data: balance = 0, isLoading, refetch: refetchBalance } = useQuery({
    queryKey: ['user-credits', user?.id],
    queryFn: async () => {
      if (!user?.id) return 0;
      
      const { data, error } = await supabase
        .from('user_credits')
        .select('balance')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
        console.error('Error fetching credits:', error);
        return 0;
      }

      const bal = data?.balance ?? 0;

      // Cache in localStorage for instant display
      localStorage.setItem('user_credits_cache', JSON.stringify({
        balance: bal,
        timestamp: Date.now(),
      }));

      return bal;
    },
    enabled: !!user?.id,
    staleTime: 30000, // 30 seconds
    initialData: () => {
      try {
        const cached = localStorage.getItem('user_credits_cache');
        if (cached) {
          const { balance, timestamp } = JSON.parse(cached);
          // Use cache if less than 5 minutes old
          if (Date.now() - timestamp < 5 * 60 * 1000) {
            return balance;
          }
        }
      } catch {
        // Ignore parse errors
      }
      return 0;
    },
  });

  // Subscribe to realtime credit changes
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel(`credits-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_credits',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['user-credits', user.id] });
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [user?.id, queryClient]);

  const hasEnoughCredits = balance >= creditCost;

  const checkAndDeductCredits = useCallback(async (): Promise<boolean> => {
    if (!user?.id) {
      toast.error('Please sign in to use this tool');
      navigate('/auth');
      return false;
    }

    // Check balance server-side via the edge function — don't block on stale client cache
    const { data: currentBalance } = await supabase
      .from('user_credits')
      .select('balance')
      .eq('user_id', user.id)
      .maybeSingle();

    const actualBalance = currentBalance?.balance ?? 0;

    if (actualBalance < creditCost) {
      toast.error(
        `Insufficient credits. You need ${creditCost} credits to use ${toolName}. Your balance: ${actualBalance} credits.`,
        {
          action: {
            label: 'Get Credits',
            onClick: () => navigate('/credits'),
          },
        }
      );
      return false;
    }

    // Deduct credits
    try {
      const { data, error } = await supabase.functions.invoke('credit-deduction', {
        body: {
          action: 'ai_tool',
          metadata: {
            tool: toolName,
            credits: creditCost,
          },
        },
      });

      if (error || !data?.success) {
        throw new Error(data?.error || error?.message || 'Credit deduction failed');
      }

      // Refresh balance
      queryClient.invalidateQueries({ queryKey: ['user-credits', user.id] });
      
      return true;
    } catch (error: any) {
      console.error('Credit deduction error:', error);
      
      // Check if it's an insufficient credits error
      if (error.message?.includes('Insufficient')) {
        toast.error(
          `Insufficient credits. You need ${creditCost} credits. Please top up your balance.`,
          {
            action: {
              label: 'Get Credits',
              onClick: () => navigate('/credits'),
            },
          }
        );
      } else {
        toast.error('Failed to process credits. Please try again.');
      }
      
      return false;
    }
  }, [user?.id, creditCost, toolName, navigate, queryClient]);

  return {
    balance,
    isLoading,
    hasEnoughCredits,
    checkAndDeductCredits,
    refetchBalance,
  };
};

export default useAIToolCredits;
