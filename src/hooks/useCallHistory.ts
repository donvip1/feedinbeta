import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface CallRecord {
  id: string;
  caller_id: string;
  receiver_id: string;
  status: string;
  duration: number | null;
  started_at: string;
  ended_at: string | null;
}

export const useCallHistory = (userId?: string) => {
  const [calls, setCalls] = useState<CallRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const loadCallHistory = useCallback(async () => {
    if (!userId) return;

    try {
      setLoading(true);
      // For now, return empty array until call_history table is confirmed
      setCalls([]);
    } catch (error: any) {
      console.error('Error loading call history:', error);
      toast({
        title: 'Error',
        description: 'Failed to load call history',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [userId, toast]);

  useEffect(() => {
    loadCallHistory();
  }, [loadCallHistory]);

  return {
    calls,
    loading,
    refreshCalls: loadCallHistory,
  };
};
