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
  const processingCallIds = useRef<Set<string>>(new Set());
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Check for pending calls on mount and periodically (fallback for realtime)
  const checkPendingCalls = useCallback(async () => {
    if (!user || incomingCall) return;

    try {
      const { data: pendingCalls, error } = await supabase
        .from('call_logs')
        .select('*')
        .eq('receiver_id', user.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(1);

      if (error || !pendingCalls || pendingCalls.length === 0) return;

      const call = pendingCalls[0];
      
      // Check if call was created within last 60 seconds (not stale)
      const callAge = Date.now() - new Date(call.created_at).getTime();
      if (callAge > 60000) return;
      
      // Prevent duplicate processing
      if (processingCallIds.current.has(call.id)) return;
      processingCallIds.current.add(call.id);

      console.log('[IncomingCallListener] Found pending call via poll:', call.id);

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
      console.error('[IncomingCallListener] Error checking pending calls:', error);
    }
  }, [user, incomingCall]);

  useEffect(() => {
    if (!user) return;

    console.log('[IncomingCallListener] Setting up listener for user:', user.id);

    // Check for pending calls immediately on mount
    checkPendingCalls();

    // Set up poll-based fallback every 5 seconds
    pollIntervalRef.current = setInterval(checkPendingCalls, 5000);

    // Clean up any existing channel
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

    // Use stable channel name (no Date.now()) to reduce subscription churn
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
          console.log('[IncomingCallListener] New call received:', call.id, 'status:', call.status);
          
          // Only show for pending calls
          if (call.status !== 'pending') {
            console.log('[IncomingCallListener] Ignoring non-pending call');
            return;
          }
          
          // Prevent duplicate processing
          if (processingCallIds.current.has(call.id)) {
            console.log('[IncomingCallListener] Already processing this call');
            return;
          }
          processingCallIds.current.add(call.id);
          
          // Don't show if we already have an incoming call
          if (incomingCall) {
            console.log('[IncomingCallListener] Already have an incoming call, ignoring');
            processingCallIds.current.delete(call.id);
            return;
          }

          try {
            // Fetch caller's profile
            const { data: callerProfile } = await supabase
              .from('profiles')
              .select('display_name, avatar_url')
              .eq('id', call.caller_id)
              .single();

            console.log('[IncomingCallListener] Incoming call from:', callerProfile?.display_name);
            
            setIncomingCall({
              callId: call.id,
              callerId: call.caller_id,
              callerName: callerProfile?.display_name || 'Unknown',
              callerAvatar: callerProfile?.avatar_url || null,
              callType: call.call_type as 'video' | 'voice',
            });

            // Request notification permission if not granted
            if ('Notification' in window && Notification.permission === 'default') {
              await Notification.requestPermission();
            }

            // Show browser notification if permission granted
            if ('Notification' in window && Notification.permission === 'granted') {
              const notification = new Notification('Incoming Call', {
                body: `${callerProfile?.display_name || 'Someone'} is calling you`,
                icon: callerProfile?.avatar_url || '/favicon.png',
                tag: `call-${call.id}`,
                requireInteraction: true,
                silent: false,
              });

              notification.onclick = () => {
                window.focus();
                notification.close();
              };
              
              // Auto-close notification after 30 seconds
              setTimeout(() => notification.close(), 30000);
            }
          } catch (error) {
            console.error('[IncomingCallListener] Error loading caller profile:', error);
            processingCallIds.current.delete(call.id);
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
          console.log('[IncomingCallListener] Receiver call updated:', call.id, 'status:', call.status);
          
          // Clear incoming call if it's ended, rejected, or answered
          if (call.status === 'ended' || call.status === 'rejected' || call.status === 'answered') {
            setIncomingCall(prev => {
              if (prev?.callId === call.id) {
                console.log('[IncomingCallListener] Clearing incoming call - status:', call.status);
                callSounds.stopAllSounds();
                processingCallIds.current.delete(call.id);
                return null;
              }
              return prev;
            });
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'call_logs',
          filter: `caller_id=eq.${user.id}`,
        },
        (payload) => {
          // This helps the caller know when the call is answered/rejected
          // But don't clear incoming call state for caller updates
          console.log('[IncomingCallListener] Outgoing call updated:', payload.new.id, 'status:', payload.new.status);
        }
      )
      .subscribe((status) => {
        console.log('[IncomingCallListener] Channel status:', status);
      });

    channelRef.current = channel;

    return () => {
      console.log('[IncomingCallListener] Cleaning up');
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
      processingCallIds.current.clear();
    };
  }, [user, checkPendingCalls]);

  // Handle incoming call being dismissed by caller
  useEffect(() => {
    if (!incomingCall) return;

    // Poll for call status changes (backup for realtime)
    const checkInterval = setInterval(async () => {
      try {
        const { data } = await supabase
          .from('call_logs')
          .select('status')
          .eq('id', incomingCall.callId)
          .single();
        
        if (data?.status === 'ended' || data?.status === 'rejected') {
          console.log('[IncomingCallListener] Call ended by caller:', data.status);
          callSounds.stopAllSounds();
          setIncomingCall(null);
          processingCallIds.current.delete(incomingCall.callId);
        }
      } catch (error) {
        console.error('[IncomingCallListener] Error checking call status:', error);
      }
    }, 3000);

    return () => clearInterval(checkInterval);
  }, [incomingCall]);

  // Handle visibility change - keep listening even when tab is hidden
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && incomingCall) {
        console.log('[IncomingCallListener] Tab visible, incoming call active');
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [incomingCall]);

  const handleAccept = useCallback(() => {
    console.log('[IncomingCallListener] Call accepted');
    if (incomingCall) {
      processingCallIds.current.delete(incomingCall.callId);
    }
    setIncomingCall(null);
  }, [incomingCall]);

  const handleReject = useCallback(() => {
    console.log('[IncomingCallListener] Call rejected');
    if (incomingCall) {
      processingCallIds.current.delete(incomingCall.callId);
    }
    setIncomingCall(null);
  }, [incomingCall]);

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
