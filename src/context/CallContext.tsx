import React, { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react';
import { LiveKitCallManager, CallConnectionStatus } from '@/lib/livekit-call-manager';
import { supabase } from '@/integrations/supabase/client';
import { callSounds } from '@/utils/callSounds';
import { useToast } from '@/hooks/use-toast';
import { backgroundServiceManager } from '@/lib/background-service-manager';

interface CallState {
  callId: string | null;
  callType: 'video' | 'voice';
  isActive: boolean;
  isMinimized: boolean;
  isConnected: boolean;
  isMuted: boolean;
  isVideoOff: boolean;
  isSpeakerOn: boolean;
  isScreenSharing: boolean;
  callDuration: number;
  connectionStatus: CallConnectionStatus;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  otherUserId: string | null;
  otherUserProfile: {
    display_name: string | null;
    avatar_url: string | null;
  } | null;
  isPiPActive: boolean;
}

interface CallContextType {
  callState: CallState;
  // Actions
  startCall: (callId: string, callType: 'video' | 'voice', otherUserId: string, isCaller: boolean) => Promise<void>;
  endCall: () => Promise<void>;
  minimizeCall: () => void;
  maximizeCall: () => void;
  toggleMute: () => void;
  toggleVideo: () => void;
  toggleSpeaker: () => void;
  flipCamera: () => Promise<void>;
  startScreenShare: () => Promise<void>;
  stopScreenShare: () => Promise<void>;
  createCallInvite: () => Promise<{ inviteCode: string; inviteLink: string } | null>;
  // Refs for video elements
  setLocalVideoRef: (ref: HTMLVideoElement | null) => void;
  setRemoteVideoRef: (ref: HTMLVideoElement | null) => void;
  setRemoteAudioRef: (ref: HTMLAudioElement | null) => void;
}

const defaultCallState: CallState = {
  callId: null,
  callType: 'voice',
  isActive: false,
  isMinimized: false,
  isConnected: false,
  isMuted: false,
  isVideoOff: false,
  isSpeakerOn: true,
  isScreenSharing: false,
  callDuration: 0,
  connectionStatus: 'idle',
  localStream: null,
  remoteStream: null,
  otherUserId: null,
  otherUserProfile: null,
  isPiPActive: false,
};

const CallContext = createContext<CallContextType | null>(null);

export const useCallContext = () => {
  const context = useContext(CallContext);
  if (!context) {
    throw new Error('useCallContext must be used within a CallProvider');
  }
  return context;
};

export const useOptionalCallContext = () => {
  return useContext(CallContext);
};

export const CallProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { toast } = useToast();
  const [callState, setCallState] = useState<CallState>(defaultCallState);
  
  const callManagerRef = useRef<LiveKitCallManager | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(0);
  const callEndSubscriptionRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
      }
      if (callEndSubscriptionRef.current) {
        supabase.removeChannel(callEndSubscriptionRef.current);
      }
      callManagerRef.current?.disconnect();
    };
  }, []);

  const startDurationTimer = useCallback(() => {
    if (durationIntervalRef.current) return;
    startTimeRef.current = Date.now();
    durationIntervalRef.current = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
      setCallState(prev => ({ ...prev, callDuration: elapsed }));
    }, 1000);
  }, []);

  const stopDurationTimer = useCallback(() => {
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }
  }, []);

  const loadOtherUserProfile = async (userId: string) => {
    const { data } = await supabase
      .from('profiles')
      .select('display_name, avatar_url')
      .eq('id', userId)
      .single();
    
    if (data) {
      setCallState(prev => ({ ...prev, otherUserProfile: data }));
    }
  };

  // Subscribe to call status changes at the context level for early detection
  const subscribeToCallStatus = useCallback((callId: string) => {
    // Clean up existing subscription
    if (callEndSubscriptionRef.current) {
      supabase.removeChannel(callEndSubscriptionRef.current);
    }

    console.log('[CallContext] Subscribing to call status:', callId);

    callEndSubscriptionRef.current = supabase
      .channel(`call-context-${callId}-${Date.now()}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'call_logs',
          filter: `id=eq.${callId}`,
        },
        (payload) => {
          const newStatus = payload.new.status;
          console.log('[CallContext] Call status changed:', newStatus);
          
          if (newStatus === 'ended' || newStatus === 'rejected') {
            console.log('[CallContext] Call ended/rejected, cleaning up');
            endCall();
          }
        }
      )
      .subscribe();
  }, []);

  const startCall = useCallback(async (
    callId: string,
    callType: 'video' | 'voice',
    otherUserId: string,
    isCaller: boolean
  ) => {
    console.log('[CallContext] Starting LiveKit call:', { callId, callType, otherUserId, isCaller });

    // Subscribe to call status changes immediately
    subscribeToCallStatus(callId);

    // Load other user's profile
    await loadOtherUserProfile(otherUserId);

    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast({
        title: 'Authentication required',
        description: 'Please sign in to make calls',
        variant: 'destructive',
      });
      return;
    }

    // Get current user's display name
    const { data: profile } = await supabase
      .from('profiles')
      .select('display_name')
      .eq('id', user.id)
      .single();
    
    const displayName = profile?.display_name || 'User';

    // Start background service for this call
    const serviceType = callType === 'video' ? 'video_call' : 'voice_call';
    await backgroundServiceManager.startService(
      callId,
      serviceType,
      `${callType === 'video' ? 'Video' : 'Voice'} Call`,
      []
    );

    setCallState(prev => ({
      ...prev,
      callId,
      callType,
      isActive: true,
      isMinimized: false,
      otherUserId,
      connectionStatus: 'connecting',
    }));

    try {
      // Create LiveKit call manager
      callManagerRef.current = new LiveKitCallManager(
        callId,
        user.id,
        {
          onLocalStream: (stream) => {
            console.log('[CallContext] Got local stream');
            setCallState(prev => ({ ...prev, localStream: stream }));
            
            if (callType === 'video' && localVideoRef.current) {
              localVideoRef.current.srcObject = stream;
              localVideoRef.current.play().catch(e => console.warn('[CallContext] Local video play error:', e));
            }
          },
          onRemoteStream: (stream) => {
            console.log('[CallContext] Got remote stream');
            setCallState(prev => ({ ...prev, remoteStream: stream }));
            
            if (callType === 'video' && remoteVideoRef.current) {
              remoteVideoRef.current.srcObject = stream;
              remoteVideoRef.current.play().catch(e => console.warn('[CallContext] Remote video play error:', e));
            }
          },
          onRemoteAudioTrack: (track) => {
            console.log('[CallContext] Got remote audio track');
            // Audio is handled by LiveKitCallManager directly with attached audio elements
            // This callback is for reference/logging purposes
            
            // Also attach to our audio ref as backup
            if (remoteAudioRef.current) {
              const stream = new MediaStream([track]);
              remoteAudioRef.current.srcObject = stream;
              remoteAudioRef.current.play().catch(e => console.warn('[CallContext] Audio play error:', e));
            }
          },
          onStatusChange: (status, message) => {
            console.log('[CallContext] Status change:', status, message);
            setCallState(prev => ({ ...prev, connectionStatus: status }));
            
            if (status === 'connected') {
              callSounds.stopAllSounds();
              callSounds.playConnected();
              startDurationTimer();
              setCallState(prev => ({ ...prev, isConnected: true }));
            } else if (status === 'failed') {
              toast({
                title: 'Connection Failed',
                description: message || 'Unable to establish call connection',
                variant: 'destructive',
              });
            }
          },
          onError: (error) => {
            console.error('[CallContext] Call error:', error);
            toast({
              title: 'Call Error',
              description: error.message || 'An error occurred during the call',
              variant: 'destructive',
            });
          },
          onParticipantJoined: (participantId, participantName) => {
            console.log('[CallContext] Participant joined:', participantId, participantName);
            toast({
              title: 'Connected',
              description: `${participantName} joined the call`,
            });
          },
          onParticipantLeft: (participantId) => {
            console.log('[CallContext] Participant left:', participantId);
          },
          onCallEnded: () => {
            console.log('[CallContext] Call ended by other participant or system');
            endCall();
          },
        }
      );

      const isVideo = callType === 'video';
      await callManagerRef.current.initialize(isVideo, displayName);

    } catch (error: any) {
      console.error('[CallContext] Error setting up call:', error);
      toast({
        title: 'Media Access Error',
        description: error.message || 'Failed to access camera/microphone. Please check permissions.',
        variant: 'destructive',
      });
    }
  }, [toast, startDurationTimer, subscribeToCallStatus]);

  const endCall = useCallback(async () => {
    console.log('[CallContext] Ending call');
    
    callSounds.stopAllSounds();
    callSounds.playDisconnected();
    stopDurationTimer();
    
    // Clean up call status subscription
    if (callEndSubscriptionRef.current) {
      await supabase.removeChannel(callEndSubscriptionRef.current);
      callEndSubscriptionRef.current = null;
    }
    
    // Exit PiP if active
    if (document.pictureInPictureElement) {
      await document.exitPictureInPicture().catch(() => {});
    }
    
    if (callState.callId) {
      try {
        // Update call status to ended - this will trigger the realtime update for the other user
        await supabase
          .from('call_logs')
          .update({
            status: 'ended',
            ended_at: new Date().toISOString(),
            duration: callState.callDuration,
          })
          .eq('id', callState.callId);
        console.log('[CallContext] Call log updated to ended');
      } catch (error) {
        console.error('[CallContext] Error updating call log:', error);
      }
    }
    
    // Stop background service for this call
    if (callState.callId) {
      await backgroundServiceManager.stopService(callState.callId);
    }
    
    await callManagerRef.current?.disconnect();
    callManagerRef.current = null;
    
    setCallState(defaultCallState);
  }, [callState.callId, callState.callDuration, stopDurationTimer]);

  const minimizeCall = useCallback(() => {
    console.log('[CallContext] Minimizing call');
    setCallState(prev => ({ ...prev, isMinimized: true }));
  }, []);

  const maximizeCall = useCallback(() => {
    console.log('[CallContext] Maximizing call');
    setCallState(prev => ({ ...prev, isMinimized: false }));
  }, []);

  const toggleMute = useCallback(async () => {
    if (callManagerRef.current) {
      const isEnabled = await callManagerRef.current.toggleMute();
      setCallState(prev => ({ ...prev, isMuted: !isEnabled }));
    }
  }, []);

  const toggleVideo = useCallback(async () => {
    if (callManagerRef.current) {
      const isEnabled = await callManagerRef.current.toggleVideo();
      setCallState(prev => ({ ...prev, isVideoOff: !isEnabled }));
    }
  }, []);

  const toggleSpeaker = useCallback(() => {
    setCallState(prev => ({ ...prev, isSpeakerOn: !prev.isSpeakerOn }));
    toast({
      title: callState.isSpeakerOn ? 'Speaker Off' : 'Speaker On',
      description: callState.isSpeakerOn ? 'Switched to earpiece' : 'Switched to loudspeaker',
    });
  }, [callState.isSpeakerOn, toast]);

  const flipCamera = useCallback(async () => {
    if (callManagerRef.current) {
      const success = await callManagerRef.current.flipCamera();
      if (success && localVideoRef.current) {
        const stream = callManagerRef.current.getLocalStream();
        if (stream) {
          localVideoRef.current.srcObject = stream;
          setCallState(prev => ({ ...prev, localStream: stream }));
        }
      }
    }
  }, []);

  const startScreenShare = useCallback(async () => {
    if (callManagerRef.current) {
      const success = await callManagerRef.current.startScreenShare();
      if (success) {
        setCallState(prev => ({ ...prev, isScreenSharing: true }));
        toast({
          title: 'Screen Sharing',
          description: 'You are now sharing your screen',
        });
      } else {
        toast({
          title: 'Screen Share Failed',
          description: 'Could not start screen sharing',
          variant: 'destructive',
        });
      }
    }
  }, [toast]);

  const stopScreenShare = useCallback(async () => {
    if (callManagerRef.current) {
      const success = await callManagerRef.current.stopScreenShare();
      if (success) {
        setCallState(prev => ({ ...prev, isScreenSharing: false }));
        toast({
          title: 'Screen Sharing Stopped',
          description: 'You stopped sharing your screen',
        });
      }
    }
  }, [toast]);

  const createCallInvite = useCallback(async (): Promise<{ inviteCode: string; inviteLink: string } | null> => {
    if (!callState.callId) {
      toast({
        title: 'No Active Call',
        description: 'Start a call first to create an invite link',
        variant: 'destructive',
      });
      return null;
    }

    try {
      const { data, error } = await supabase.functions.invoke('create-call-invite', {
        body: {
          callId: callState.callId,
          callType: callState.callType,
        },
      });

      if (error || !data) {
        throw new Error(error?.message || 'Failed to create invite');
      }

      return {
        inviteCode: data.inviteCode,
        inviteLink: data.inviteLink,
      };
    } catch (error: any) {
      console.error('[CallContext] Error creating invite:', error);
      toast({
        title: 'Failed to create invite',
        description: error.message || 'Please try again',
        variant: 'destructive',
      });
      return null;
    }
  }, [callState.callId, callState.callType, toast]);

  // Listen for PiP exit
  useEffect(() => {
    const handlePiPChange = () => {
      if (!document.pictureInPictureElement) {
        setCallState(prev => ({ ...prev, isPiPActive: false }));
      }
    };

    document.addEventListener('leavepictureinpicture', handlePiPChange);
    return () => document.removeEventListener('leavepictureinpicture', handlePiPChange);
  }, []);

  const setLocalVideoRef = useCallback((ref: HTMLVideoElement | null) => {
    localVideoRef.current = ref;
    if (ref && callState.localStream) {
      ref.srcObject = callState.localStream;
      ref.play().catch(e => console.warn('[CallContext] Local video ref play error:', e));
    }
  }, [callState.localStream]);

  const setRemoteVideoRef = useCallback((ref: HTMLVideoElement | null) => {
    remoteVideoRef.current = ref;
    if (ref && callState.remoteStream) {
      ref.srcObject = callState.remoteStream;
      ref.play().catch(e => console.warn('[CallContext] Remote video ref play error:', e));
    }
  }, [callState.remoteStream]);

  const setRemoteAudioRef = useCallback((ref: HTMLAudioElement | null) => {
    remoteAudioRef.current = ref;
    if (ref && callState.remoteStream) {
      ref.srcObject = callState.remoteStream;
      ref.play().catch(e => console.warn('[CallContext] Audio ref play error:', e));
    }
  }, [callState.remoteStream]);

  const value: CallContextType = {
    callState,
    startCall,
    endCall,
    minimizeCall,
    maximizeCall,
    toggleMute,
    toggleVideo,
    toggleSpeaker,
    flipCamera,
    startScreenShare,
    stopScreenShare,
    createCallInvite,
    setLocalVideoRef,
    setRemoteVideoRef,
    setRemoteAudioRef,
  };

  return (
    <CallContext.Provider value={value}>
      {children}
    </CallContext.Provider>
  );
};

export default CallContext;
