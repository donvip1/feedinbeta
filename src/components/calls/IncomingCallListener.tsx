import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { IncomingCall } from '@/components/calls/IncomingCall';

interface IncomingCallData {
  callId: string;
  callerId: string;
  callerName: string;
  callerAvatar: string | null;
  callType: 'video' | 'voice';
}

export const IncomingCallListener = () => {
  const { user } = useAuth();
  const [incomingCall, setIncomingCall] = useState<IncomingCallData | null>(null);

  useEffect(() => {
    if (!user) return;

    // Subscribe to incoming calls where we are the receiver
    const channel = supabase
      .channel(`incoming-calls:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'call_logs',
          filter: `receiver_id=eq.${user.id}`,
        },
        async (payload) => {
          const call = payload.new;
          
          // Only show for pending calls
          if (call.status !== 'pending') return;
          
          // Don't show if we already have an incoming call
          if (incomingCall) return;

          try {
            // Fetch caller's profile
            const { data: callerProfile } = await supabase
              .from('profiles')
              .select('display_name, avatar_url')
              .eq('id', call.caller_id)
              .single();

            setIncomingCall({
              callId: call.id,
              callerId: call.caller_id,
              callerName: callerProfile?.display_name || 'Unknown',
              callerAvatar: callerProfile?.avatar_url || null,
              callType: call.call_type as 'video' | 'voice',
            });
          } catch (error) {
            console.error('Error loading caller profile:', error);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'call_logs',
          filter: `receiver_id=eq.${user.id}`,
        },
        (payload) => {
          const call = payload.new;
          
          // Clear incoming call if it's ended, rejected, or answered
          if (incomingCall?.callId === call.id) {
            if (call.status === 'ended' || call.status === 'rejected' || call.status === 'answered') {
              setIncomingCall(null);
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, incomingCall]);

  const handleAccept = useCallback(() => {
    setIncomingCall(null);
  }, []);

  const handleReject = useCallback(() => {
    setIncomingCall(null);
  }, []);

  if (!incomingCall) return null;

  return (
    <IncomingCall
      callId={incomingCall.callId}
      callerId={incomingCall.callerId}
      callerName={incomingCall.callerName}
      callerAvatar={incomingCall.callerAvatar}
      callType={incomingCall.callType}
      onAccept={handleAccept}
      onReject={handleReject}
    />
  );
};
