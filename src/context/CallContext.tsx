import React, { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react';
import { WebRTCP2PManager, CallStatus as P2PCallStatus } from '@/lib/webrtc-p2p-manager';
import { supabase } from '@/integrations/supabase/client';
import { callSounds } from '@/utils/callSounds';
import { useToast } from '@/hooks/use-toast';

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
  connectionStatus: P2PCallStatus;
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
  
  const callManagerRef = useRef<WebRTCP2PManager | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(0);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
      }
      callManagerRef.current?.cleanup();
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

  const startCall = useCallback(async (
    callId: string,
    callType: 'video' | 'voice',
    otherUserId: string,
    isCaller: boolean
  ) => {
    console.log('[CallContext] Starting P2P call:', { callId, callType, otherUserId, isCaller });

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
      // Create P2P call manager
      callManagerRef.current = new WebRTCP2PManager(
        callId,
        user.id,
        otherUserId,
        {
          onLocalStream: (stream) => {
            console.log('[CallContext] Got local stream');
            setCallState(prev => ({ ...prev, localStream: stream }));
            
            if (callType === 'video' && localVideoRef.current) {
              localVideoRef.current.srcObject = stream;
            }
          },
          onRemoteStream: (stream) => {
            console.log('[CallContext] Got remote stream');
            setCallState(prev => ({ ...prev, remoteStream: stream }));
            
            if (callType === 'video' && remoteVideoRef.current) {
              remoteVideoRef.current.srcObject = stream;
            } else if (remoteAudioRef.current) {
              remoteAudioRef.current.srcObject = stream;
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
        }
      );

      const isVideo = callType === 'video';
      
      // Initialize as caller or receiver
      if (isCaller) {
        await callManagerRef.current.initializeAsCaller(isVideo);
      } else {
        await callManagerRef.current.initializeAsReceiver(isVideo);
      }

    } catch (error: any) {
      console.error('[CallContext] Error setting up call:', error);
      toast({
        title: 'Media Access Error',
        description: error.message || 'Failed to access camera/microphone. Please check permissions.',
        variant: 'destructive',
      });
    }
  }, [toast, startDurationTimer]);

  const endCall = useCallback(async () => {
    console.log('[CallContext] Ending call');
    
    callSounds.stopAllSounds();
    callSounds.playDisconnected();
    stopDurationTimer();
    
    // Exit PiP if active
    if (document.pictureInPictureElement) {
      await document.exitPictureInPicture().catch(() => {});
    }
    
    if (callState.callId) {
      try {
        await supabase
          .from('call_logs')
          .update({
            status: 'ended',
            ended_at: new Date().toISOString(),
            duration: callState.callDuration,
          })
          .eq('id', callState.callId);
      } catch (error) {
        console.error('[CallContext] Error updating call log:', error);
      }
    }
    
    await callManagerRef.current?.cleanup();
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

  const toggleMute = useCallback(() => {
    if (callManagerRef.current) {
      const isEnabled = callManagerRef.current.toggleMute();
      setCallState(prev => ({ ...prev, isMuted: !isEnabled }));
    }
  }, []);

  const toggleVideo = useCallback(() => {
    if (callManagerRef.current) {
      const isEnabled = callManagerRef.current.toggleVideo();
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
        localVideoRef.current.srcObject = callManagerRef.current.getLocalStream();
      }
    }
  }, []);

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
    }
  }, [callState.localStream]);

  const setRemoteVideoRef = useCallback((ref: HTMLVideoElement | null) => {
    remoteVideoRef.current = ref;
    if (ref && callState.remoteStream) {
      ref.srcObject = callState.remoteStream;
    }
  }, [callState.remoteStream]);

  const setRemoteAudioRef = useCallback((ref: HTMLAudioElement | null) => {
    remoteAudioRef.current = ref;
    if (ref && callState.remoteStream) {
      ref.srcObject = callState.remoteStream;
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
