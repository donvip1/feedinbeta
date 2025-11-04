import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export function usePremiumStatus() {
  const { user } = useAuth();
  const [isPremium, setIsPremium] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setIsPremium(false);
      setLoading(false);
      return;
    }

    checkPremiumStatus();
  }, [user]);

  const checkPremiumStatus = async () => {
    try {
      const { data: subscription } = await supabase
        .from('user_subscriptions')
        .select('status, subscription_tiers(name)')
        .eq('user_id', user?.id)
        .eq('status', 'active')
        .single();

      const tier = Array.isArray(subscription?.subscription_tiers)
        ? subscription.subscription_tiers[0]
        : subscription?.subscription_tiers;

      const premium = subscription && (tier?.name === 'Pro' || tier?.name === 'Premium');
      setIsPremium(premium || false);
    } catch (error) {
      setIsPremium(false);
    } finally {
      setLoading(false);
    }
  };

  return { isPremium, loading };
}
