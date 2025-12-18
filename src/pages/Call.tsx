import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { CallControls } from '@/components/calls/CallControls';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { usePresence } from '@/hooks/usePresence';
import { callSounds } from '@/utils/callSounds';
import { WebRTCManager } from '@/utils/webrtcManager';
import { Loader2 } from 'lucide-react';

interface CallData {
  id: string;
  caller_id: string;
  receiver_id: string;
  call_type: 'video' | 'voice';
  status: string;
  caller_profile?: {
    display_name: string | null;
    avatar_url: string | null;
  };
  receiver_profile?: {
    display_name: string | null;
    avatar_url: string | null;
  };
}

const Call = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { toast } = useToast();
  
  const callId = searchParams.get('callId');
  const callTypeParam = searchParams.get('type') as 'video' | 'voice';
  
  const [callData, setCallData] = useState<CallData | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  const [callDuration, setCallDuration] = useState(0);
  const [callStatus, setCallStatus] = useState<'connecting' | 'ringing' | 'connected' | 'offline' | 'ended'>('connecting');
  const [otherUserProfile, setOtherUserProfile] = useState<{ display_name: string | null; avatar_url: string | null } | null>(null);
  
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const startTimeRef = useRef<number>(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const webrtcRef = useRef<WebRTCManager | null>(null);
  const hasEndedRef = useRef(false);
  const setupCompleteRef = useRef(false);
  const callTypeRef = useRef<'video' | 'voice'>('voice');

  const isCaller = callData?.caller_id === user?.id;
  const otherUserId = isCaller ? callData?.receiver_id : callData?.caller_id;
  const { isOnline } = usePresence(otherUserId);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const startTimer = useCallback(() => {
    if (intervalRef.current) return;
    startTimeRef.current = Date.now();
    intervalRef.current = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
      setCallDuration(elapsed);
    }, 1000);
  }, []);

  const endCall = useCallback(async () => {
    if (hasEndedRef.current) return;
    hasEndedRef.current = true;

    callSounds.stopAllSounds();
    callSounds.playDisconnected();
    setCallStatus('ended');
    
    try {
      const endTime = new Date().toISOString();
      const duration = startTimeRef.current 
        ? Math.floor((Date.now() - startTimeRef.current) / 1000)
        : 0;

      // Update call log
      await supabase
        .from('call_logs')
        .update({
          status: 'ended',
          ended_at: endTime,
          duration: duration,
        })
        .eq('id', callId);

      // Deduct credits if call was connected
      if (isConnected && duration > 0 && user?.id) {
        const durationMinutes = Math.max(1, Math.ceil(duration / 60));
        const action = callTypeRef.current === 'video' ? 'video_call' : 'voice_call';
        
        try {
          await supabase.functions.invoke('credit-deduction', {
            body: {
              action,
              userId: user.id,
              metadata: {
                minutes: durationMinutes,
                duration: duration,
              },
            },
          });

          const costPerMinute = callTypeRef.current === 'video' ? 30 : 20;
          const totalCost = costPerMinute * durationMinutes;
          
          toast({
            title: 'Call ended',
            description: `Duration: ${formatDuration(duration)}. ${totalCost} credits deducted.`,
          });
        } catch (creditError) {
          console.error('Credit deduction error:', creditError);
        }
      }
    } catch (error) {
      console.error('Error ending call:', error);
    }

    // Cleanup
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    
    await webrtcRef.current?.cleanup();
    webrtcRef.current = null;

    // Navigate back after a short delay
    setTimeout(() => {
      navigate('/messages');
    }, 1500);
  }, [callId, isConnected, user?.id, toast, navigate]);

  // Initialize call
  useEffect(() => {
    if (!callId || !user) {
      toast({
        title: 'Invalid call',
        description: 'No call ID provided',
        variant: 'destructive',
      });
      navigate('/messages');
      return;
    }

    callSounds.reset();
    loadCallData();

    return () => {
      callSounds.stopAllSounds();
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [callId, user]);

  const loadCallData = async () => {
    try {
      // Get call data with both caller and receiver profiles
      const { data, error } = await supabase
        .from('call_logs')
        .select('*')
        .eq('id', callId)
        .single();

      if (error) throw error;

      // Store the call type from DB
      callTypeRef.current = data.call_type as 'video' | 'voice';

      // Get profiles for both users
      const [callerProfile, receiverProfile] = await Promise.all([
        supabase.from('profiles').select('display_name, avatar_url').eq('id', data.caller_id).single(),
        supabase.from('profiles').select('display_name, avatar_url').eq('id', data.receiver_id).single(),
      ]);

      const callDataWithProfiles: CallData = {
        id: data.id,
        caller_id: data.caller_id,
        receiver_id: data.receiver_id,
        call_type: data.call_type as 'video' | 'voice',
        status: data.status,
        caller_profile: callerProfile.data,
        receiver_profile: receiverProfile.data,
      };

      setCallData(callDataWithProfiles);
      
      // Set the other user's profile
      const otherProfile = data.caller_id === user?.id 
        ? receiverProfile.data 
        : callerProfile.data;
      setOtherUserProfile(otherProfile);

      // Handle existing call status
      if (data.status === 'ended' || data.status === 'rejected') {
        toast({
          title: 'Call unavailable',
          description: 'This call has already ended.',
        });
        navigate('/messages');
        return;
      }

      // If we're the caller, start ringing
      if (callDataWithProfiles.caller_id === user?.id && callDataWithProfiles.status === 'pending') {
        setCallStatus('ringing');
        callSounds.playRinging();
      } 
      // If call is answered, setup WebRTC connection
      else if (callDataWithProfiles.status === 'answered') {
        setCallStatus('connecting');
        await setupWebRTC(callDataWithProfiles);
      }

      // Subscribe to call status changes
      subscribeToCallUpdates(callDataWithProfiles);
    } catch (error: any) {
      console.error('Error loading call:', error);
      toast({
        title: 'Error',
        description: 'Failed to load call data',
        variant: 'destructive',
      });
      navigate('/messages');
    }
  };

  const subscribeToCallUpdates = (data: CallData) => {
    const channel = supabase
      .channel(`call-updates:${callId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'call_logs',
          filter: `id=eq.${callId}`,
        },
        async (payload) => {
          const newStatus = payload.new.status;
          console.log('Call status updated:', newStatus);
          
          if (newStatus === 'ended' || newStatus === 'rejected') {
            if (!hasEndedRef.current) {
              callSounds.stopAllSounds();
              callSounds.playDisconnected();
              setCallStatus('ended');
              
              setTimeout(() => {
                navigate('/messages');
              }, 1500);
            }
          } else if (newStatus === 'answered' && !setupCompleteRef.current) {
            callSounds.stopRinging();
            setCallStatus('connecting');
            await setupWebRTC(data);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const setupWebRTC = async (data: CallData) => {
    if (webrtcRef.current || setupCompleteRef.current) {
      console.log('[Call] WebRTC already setup, skipping');
      return;
    }
    
    setupCompleteRef.current = true;

    const otherUserId = data.caller_id === user?.id ? data.receiver_id : data.caller_id;
    const isVideo = callTypeRef.current === 'video';

    console.log('[Call] Setting up WebRTC for', isVideo ? 'video' : 'voice', 'call');

    try {
      webrtcRef.current = new WebRTCManager(
        callId!,
        user!.id,
        otherUserId,
        {
          onRemoteStream: (stream) => {
            console.log('[Call] Got remote stream with tracks:', stream.getTracks().map(t => t.kind));
            
            if (isVideo && remoteVideoRef.current) {
              remoteVideoRef.current.srcObject = stream;
            } else if (remoteAudioRef.current) {
              remoteAudioRef.current.srcObject = stream;
            }
            
            // Call is now connected
            if (!isConnected) {
              callSounds.stopAllSounds();
              callSounds.playConnected();
              setIsConnected(true);
              setCallStatus('connected');
              startTimer();
            }
          },
          onConnectionStateChange: (state) => {
            console.log('[Call] Connection state:', state);
            if (state === 'connected') {
              if (!isConnected) {
                setIsConnected(true);
                setCallStatus('connected');
                startTimer();
              }
            } else if (state === 'disconnected' || state === 'failed') {
              if (!hasEndedRef.current) {
                toast({
                  title: 'Connection Lost',
                  description: 'The call connection was lost.',
                  variant: 'destructive',
                });
                endCall();
              }
            }
          },
          onIceConnectionStateChange: (state) => {
            console.log('[Call] ICE state:', state);
            if (state === 'connected' || state === 'completed') {
              if (!isConnected) {
                callSounds.stopAllSounds();
                callSounds.playConnected();
                setIsConnected(true);
                setCallStatus('connected');
                startTimer();
              }
            }
          },
          onError: (error) => {
            console.error('[Call] WebRTC error:', error);
            toast({
              title: 'Connection Error',
              description: error.message || 'Failed to establish call connection',
              variant: 'destructive',
            });
            if (!hasEndedRef.current) {
              endCall();
            }
          },
        }
      );

      const localStream = await webrtcRef.current.initialize(isVideo);
      
      if (localVideoRef.current && isVideo) {
        localVideoRef.current.srcObject = localStream;
      }

      // Small delay before sending offer to ensure both sides are ready
      setTimeout(async () => {
        // If we're the caller (who initiated), create and send offer
        if (data.caller_id === user?.id && webrtcRef.current) {
          console.log('[Call] Caller creating offer...');
          await webrtcRef.current.createAndSendOffer();
        }
      }, 500);
      
    } catch (error: any) {
      console.error('[Call] Error setting up WebRTC:', error);
      setupCompleteRef.current = false;
      toast({
        title: 'Media Access Error',
        description: error.message || 'Failed to access camera/microphone. Please check permissions.',
        variant: 'destructive',
      });
      endCall();
    }
  };

  // Handle presence changes for offline detection
  useEffect(() => {
    if (!callData || isConnected || callStatus === 'ended') return;

    if (isOnline === false && callStatus === 'ringing') {
      setCallStatus('offline');
      callSounds.stopRinging();
      callSounds.playBusy();
      
      // End call after showing offline status
      setTimeout(() => {
        if (!hasEndedRef.current) {
          endCall();
        }
      }, 3000);
    }
  }, [isOnline, callData, isConnected, callStatus, endCall]);

  const toggleMute = () => {
    if (webrtcRef.current) {
      const isEnabled = webrtcRef.current.toggleMute();
      setIsMuted(!isEnabled);
    }
  };

  const toggleVideo = () => {
    if (webrtcRef.current) {
      const isEnabled = webrtcRef.current.toggleVideo();
      setIsVideoOff(!isEnabled);
    }
  };

  const toggleSpeaker = () => {
    setIsSpeakerOn(!isSpeakerOn);
    toast({
      title: isSpeakerOn ? 'Speaker Off' : 'Speaker On',
      description: isSpeakerOn ? 'Switched to earpiece' : 'Switched to loudspeaker',
    });
  };

  if (!callData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const isVideoCall = callTypeRef.current === 'video';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-white flex flex-col relative overflow-hidden">
      {/* Hidden audio element for voice calls */}
      <audio ref={remoteAudioRef} autoPlay playsInline />
      
      {/* Background effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl animate-pulse" />
      </div>

      {/* Main content area */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center p-6">
        {isVideoCall ? (
          /* Video call layout */
          <div className="w-full h-full flex flex-col items-center">
            {/* Remote video (main view) */}
            <div className="relative w-full max-w-2xl aspect-video bg-gradient-to-br from-gray-900 to-gray-800 rounded-3xl overflow-hidden shadow-2xl">
              <video 
                ref={remoteVideoRef} 
                autoPlay 
                playsInline 
                className="w-full h-full object-cover"
              />
              {!isConnected && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
                  <Avatar className="w-24 h-24 border-4 border-primary shadow-xl">
                    <AvatarImage src={otherUserProfile?.avatar_url || ''} />
                    <AvatarFallback className="text-3xl bg-gradient-to-br from-purple-600 to-blue-600">
                      {otherUserProfile?.display_name?.[0] || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <p className="text-lg text-gray-300">{otherUserProfile?.display_name || 'Unknown User'}</p>
                  <div className="flex items-center gap-2 text-sm text-gray-400">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {callStatus === 'ringing' ? 'Ringing...' : 'Connecting...'}
                  </div>
                </div>
              )}
            </div>
            
            {/* Local video (picture-in-picture) */}
            <div className="absolute top-8 right-8 w-28 h-40 bg-gray-900 rounded-2xl overflow-hidden shadow-2xl border-2 border-white/10">
              <video 
                ref={localVideoRef} 
                autoPlay 
                playsInline 
                muted 
                className={`w-full h-full object-cover ${isVideoOff ? 'hidden' : ''}`}
              />
              {isVideoOff && (
                <div className="w-full h-full flex items-center justify-center bg-gray-800">
                  <span className="text-gray-400 text-xs">Camera off</span>
                </div>
              )}
            </div>
            
            {/* Call info */}
            <div className="mt-6 text-center">
              <h2 className="text-2xl font-bold">{otherUserProfile?.display_name || 'Unknown User'}</h2>
              <p className="text-lg text-gray-300 mt-2">
                {callStatus === 'connected' ? (
                  <span className="text-green-400">{formatDuration(callDuration)}</span>
                ) : callStatus === 'ended' ? (
                  <span className="text-gray-400">Call ended</span>
                ) : null}
              </p>
            </div>
          </div>
        ) : (
          /* Voice call layout - single avatar only */
          <div className="flex flex-col items-center justify-center gap-8">
            <div className="relative">
              {(callStatus === 'ringing' || callStatus === 'connecting') && (
                <>
                  <div className="absolute inset-0 rounded-full border-4 border-primary/50 animate-ping" />
                  <div className="absolute inset-0 rounded-full border-4 border-primary/30 animate-ping" style={{ animationDelay: '300ms' }} />
                </>
              )}
              {isConnected && (
                <div className="absolute inset-0 rounded-full bg-primary/20 animate-pulse" />
              )}
              <Avatar className="w-40 h-40 border-8 border-primary/30 shadow-2xl shadow-primary/20 relative">
                <AvatarImage src={otherUserProfile?.avatar_url || ''} />
                <AvatarFallback className="text-5xl bg-gradient-to-br from-purple-600 to-blue-600">
                  {otherUserProfile?.display_name?.[0] || 'U'}
                </AvatarFallback>
              </Avatar>
            </div>
            
            <div className="text-center space-y-3">
              <h2 className="text-3xl font-bold">{otherUserProfile?.display_name || 'Unknown User'}</h2>
              <p className="text-lg text-gray-300">
                {callStatus === 'offline' && (
                  <span className="flex items-center justify-center gap-2 text-red-400">
                    <span className="w-2 h-2 bg-red-400 rounded-full" />
                    User is offline
                  </span>
                )}
                {callStatus === 'connecting' && (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Connecting...
                  </span>
                )}
                {callStatus === 'ringing' && (
                  <span className="flex items-center justify-center gap-2 text-primary">
                    <span className="w-2 h-2 bg-primary rounded-full animate-pulse" />
                    Ringing...
                  </span>
                )}
                {callStatus === 'connected' && (
                  <span className="text-green-400 text-2xl font-mono">{formatDuration(callDuration)}</span>
                )}
                {callStatus === 'ended' && (
                  <span className="text-gray-400">Call ended</span>
                )}
              </p>
              {callStatus === 'offline' && (
                <p className="text-sm text-gray-400 max-w-md mx-auto">
                  This user isn't available at the moment. Please try again later.
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Call controls */}
      <div className="relative z-10 p-6 pb-10 bg-gradient-to-t from-black/50 to-transparent">
        <CallControls
          isMuted={isMuted}
          isVideoOff={isVideoOff}
          isSpeakerOn={isSpeakerOn}
          isVideoCall={isVideoCall}
          onToggleMute={toggleMute}
          onToggleVideo={toggleVideo}
          onToggleSpeaker={toggleSpeaker}
          onEndCall={endCall}
        />
      </div>
    </div>
  );
};

export default Call;
