import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';

interface PKBattleData {
  id: string;
  stream_id: string;
  host_id: string;
  challenger_id: string | null;
  host_score: number;
  challenger_score: number;
  status: 'waiting' | 'active' | 'completed' | 'cancelled';
  duration_seconds: number;
  started_at: string | null;
  ended_at: string | null;
  winner_id: string | null;
}

export const usePKBattle = (streamId?: string) => {
  const { user } = useAuth();
  const [battle, setBattle] = useState<PKBattleData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch existing battle for stream
  const fetchBattle = useCallback(async () => {
    if (!streamId) return;
    
    try {
      const { data } = await supabase.functions.invoke('pk-battle-manager', {
        body: { action: 'get', streamId },
      });
      
      if (data?.battle) {
        setBattle(data.battle);
      }
    } catch (err) {
      console.error('Error fetching battle:', err);
    }
  }, [streamId]);

  // Create a new PK battle
  const createBattle = useCallback(async (durationSeconds = 300) => {
    if (!streamId || !user) return null;
    
    setLoading(true);
    setError(null);
    
    try {
      const { data, error: fnError } = await supabase.functions.invoke('pk-battle-manager', {
        body: { action: 'create', streamId, durationSeconds },
      });
      
      if (fnError) throw new Error(fnError.message);
      if (data?.error) throw new Error(data.error);
      
      setBattle(data.battle);
      toast.success('PK Battle created! Waiting for challenger...');
      return data.battle;
    } catch (err: any) {
      setError(err.message);
      toast.error(err.message || 'Failed to create battle');
      return null;
    } finally {
      setLoading(false);
    }
  }, [streamId, user]);

  // Send challenge to another user
  const sendChallenge = useCallback(async (challengerId: string) => {
    if (!battle?.id) return false;
    
    setLoading(true);
    
    try {
      const { data, error: fnError } = await supabase.functions.invoke('pk-battle-manager', {
        body: { action: 'challenge', battleId: battle.id, challengerId },
      });
      
      if (fnError) throw new Error(fnError.message);
      if (data?.error) throw new Error(data.error);
      
      setBattle(data.battle);
      toast.success('Challenge sent!');
      return true;
    } catch (err: any) {
      toast.error(err.message || 'Failed to send challenge');
      return false;
    } finally {
      setLoading(false);
    }
  }, [battle?.id]);

  // Accept a challenge
  const acceptChallenge = useCallback(async (battleId: string) => {
    setLoading(true);
    
    try {
      const { data, error: fnError } = await supabase.functions.invoke('pk-battle-manager', {
        body: { action: 'accept', battleId },
      });
      
      if (fnError) throw new Error(fnError.message);
      if (data?.error) throw new Error(data.error);
      
      setBattle(data.battle);
      toast.success('Battle started! 🔥');
      return true;
    } catch (err: any) {
      toast.error(err.message || 'Failed to accept challenge');
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  // Decline a challenge
  const declineChallenge = useCallback(async (battleId: string) => {
    setLoading(true);
    
    try {
      const { data, error: fnError } = await supabase.functions.invoke('pk-battle-manager', {
        body: { action: 'decline', battleId },
      });
      
      if (fnError) throw new Error(fnError.message);
      if (data?.error) throw new Error(data.error);
      
      setBattle(null);
      toast.info('Challenge declined');
      return true;
    } catch (err: any) {
      toast.error(err.message || 'Failed to decline challenge');
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  // End the battle
  const endBattle = useCallback(async () => {
    if (!battle?.id) return false;
    
    setLoading(true);
    
    try {
      const { data, error: fnError } = await supabase.functions.invoke('pk-battle-manager', {
        body: { action: 'end', battleId: battle.id },
      });
      
      if (fnError) throw new Error(fnError.message);
      if (data?.error) throw new Error(data.error);
      
      setBattle(data.battle);
      
      if (data.winner_id) {
        const isWinner = data.winner_id === user?.id;
        toast.success(isWinner ? 'You won! 🏆' : 'Battle ended!');
      } else {
        toast.info('It\'s a tie!');
      }
      
      return true;
    } catch (err: any) {
      toast.error(err.message || 'Failed to end battle');
      return false;
    } finally {
      setLoading(false);
    }
  }, [battle?.id, user?.id]);

  // Subscribe to battle updates
  useEffect(() => {
    if (!battle?.id) return;
    
    const channel = supabase
      .channel(`pk-battle-${battle.id}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'pk_battles',
        filter: `id=eq.${battle.id}`,
      }, (payload) => {
        setBattle(payload.new as PKBattleData);
      })
      .subscribe();
    
    return () => {
      supabase.removeChannel(channel);
    };
  }, [battle?.id]);

  // Initial fetch
  useEffect(() => {
    fetchBattle();
  }, [fetchBattle]);

  return {
    battle,
    loading,
    error,
    createBattle,
    sendChallenge,
    acceptChallenge,
    declineChallenge,
    endBattle,
    refetch: fetchBattle,
  };
};
