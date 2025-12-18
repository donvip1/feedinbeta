import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { IncomingCall } from '@/components/calls/IncomingCall';
import { callSounds } from '@/utils/callSounds';

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
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    if (!user) return;

    console.log('[IncomingCallListener] Setting up listener for user:', user.id);

    // Clean up any existing channel
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

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
          console.log('[IncomingCallListener] New call:', call);
          
          // Only show for pending calls
          if (call.status !== 'pending') {
            console.log('[IncomingCallListener] Ignoring non-pending call');
            return;
          }
          
          // Don't show if we already have an incoming call
          if (incomingCall) {
            console.log('[IncomingCallListener] Already have an incoming call');
            return;
          }

          try {
            // Fetch caller's profile
            const { data: callerProfile } = await supabase
              .from('profiles')
              .select('display_name, avatar_url')
              .eq('id', call.caller_id)
              .single();

            console.log('[IncomingCallListener] Setting incoming call from:', callerProfile?.display_name);
            
            setIncomingCall({
              callId: call.id,
              callerId: call.caller_id,
              callerName: callerProfile?.display_name || 'Unknown',
              callerAvatar: callerProfile?.avatar_url || null,
              callType: call.call_type as 'video' | 'voice',
            });

            // Show browser notification if permission granted
            if ('Notification' in window && Notification.permission === 'granted') {
              const notification = new Notification('Incoming Call', {
                body: `${callerProfile?.display_name || 'Someone'} is calling you`,
                icon: callerProfile?.avatar_url || '/favicon.png',
                tag: `call-${call.id}`,
                requireInteraction: true,
              });

              notification.onclick = () => {
                window.focus();
                notification.close();
              };
            }
          } catch (error) {
            console.error('[IncomingCallListener] Error loading caller profile:', error);
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
          console.log('[IncomingCallListener] Call updated:', call.status);
          
          // Clear incoming call if it's ended, rejected, or answered
          if (call.status === 'ended' || call.status === 'rejected' || call.status === 'answered') {
            setIncomingCall(prev => {
              if (prev?.callId === call.id) {
                console.log('[IncomingCallListener] Clearing incoming call');
                callSounds.stopAllSounds();
                return null;
              }
              return prev;
            });
          }
        }
      )
      .subscribe((status) => {
        console.log('[IncomingCallListener] Channel status:', status);
      });

    channelRef.current = channel;

    // Check call status periodically (less frequently to avoid race conditions)
    const checkCallTimeout = setInterval(() => {
      if (incomingCall) {
        // Check if call is still pending
        supabase
          .from('call_logs')
          .select('status')
          .eq('id', incomingCall.callId)
          .single()
          .then(({ data }) => {
            // Only dismiss if call has been explicitly ended or rejected
            // Don't dismiss on 'answered' because we navigate to call page
            if (data?.status === 'ended' || data?.status === 'rejected') {
              console.log('[IncomingCallListener] Call status changed to:', data?.status);
              setIncomingCall(null);
              callSounds.stopAllSounds();
            }
          });
      }
    }, 10000); // Check every 10 seconds instead of 5

    return () => {
      console.log('[IncomingCallListener] Cleaning up');
      clearInterval(checkCallTimeout);
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [user]);

  // Handle visibility change - keep listening even when tab is hidden
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && incomingCall) {
        // Re-focus on incoming call when tab becomes visible
        console.log('[IncomingCallListener] Tab visible, incoming call active');
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [incomingCall]);

  const handleAccept = useCallback(() => {
    console.log('[IncomingCallListener] Call accepted');
    setIncomingCall(null);
  }, []);

  const handleReject = useCallback(() => {
    console.log('[IncomingCallListener] Call rejected');
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
