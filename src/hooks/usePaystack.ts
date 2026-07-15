import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

const PAYSTACK_PUBLIC_KEY = 'pk_live_46502116c36569fdcca4eead55dcd34597c4601c';

interface UsePaystackOptions {
  type: 'credits' | 'subscription';
  onSuccess?: () => void;
}

export const usePaystack = ({ type, onSuccess }: UsePaystackOptions) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState<string | null>(null);

  // Handle redirect callback verification
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const reference = params.get('reference') || params.get('trxref');
    if (reference) {
      verifyPayment(reference);
      // Clean URL
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  const verifyPayment = async (reference: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('paystack-checkout', {
        body: { action: 'verify', reference },
      });

      if (error) throw error;

      toast.success('Payment successful!');
      onSuccess?.();
    } catch (err: any) {
      console.error('Verification error:', err);
      toast.error('Payment verification failed. Please contact support.');
    }
  };

  const initializePayment = async (itemId: string) => {
    try {
      setLoading(itemId);
      if (type !== 'credits') {
        toast.error('Paystack currently supports Feedin credit purchases only.');
        return;
      }
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        navigate('/auth');
        return;
      }

      const { data, error } = await supabase.functions.invoke('paystack-checkout', {
        body: { type, itemId },
      });

      if (error) throw error;

      if (data?.authorization_url) {
        window.location.href = data.authorization_url;
      }
    } catch (err: any) {
      console.error('Payment error:', err);
      toast.error(err.message || 'Failed to initialize payment');
    } finally {
      setLoading(null);
    }
  };

  return { loading, initializePayment };
};
