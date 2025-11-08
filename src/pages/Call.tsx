import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { CallControls } from '@/components/calls/CallControls';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useWebRTC } from '@/hooks/useWebRTC';

interface CallData {
  id: string;
  caller_id: string;
  receiver_id: string;
  call_type: 'video' | 'voice';
  status: string;
  profiles: {
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
  const callType = searchParams.get('type') as 'video' | 'voice';
  const [callData, setCallData] = useState<CallData | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [isInitiator, setIsInitiator] = useState(false);
  const [connectionState, setConnectionState] = useState<'connecting' | 'connected' | 'failed'>('connecting');
  
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const startTimeRef = useRef<number>(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const { localStream, remoteStream, connectionState: rtcState, cleanup: cleanupWebRTC } = useWebRTC({
    callId: callId || '',
    isInitiator,
    otherUserId: callData?.caller_id === user?.id ? callData.receiver_id : callData?.caller_id || '',
    isVideo: callType === 'video',
    onConnectionStateChange: (state) => {
      if (state === 'connected') {
        setConnectionState('connected');
        updateCallStatus('answered');
        startTimer();
      } else if (state === 'failed') {
        setConnectionState('failed');
      }
    },
  });

  // Set up video refs
  useEffect(() => {
    if (localStream && localVideoRef.current && callType === 'video') {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream, callType]);

  useEffect(() => {
    if (remoteStream && remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  useEffect(() => {
    if (!callId) {
      toast({
        title: 'Invalid call',
        description: 'No call ID provided',
        variant: 'destructive',
      });
      navigate('/messages');
      return;
    }

    loadCallData();

    return () => {
      cleanup();
    };
  }, [callId]);

  const loadCallData = async () => {
    try {
      const { data, error } = await supabase
        .from('call_logs')
        .select(`
          *,
          caller:profiles!call_logs_caller_id_fkey(display_name, avatar_url),
          receiver:profiles!call_logs_receiver_id_fkey(display_name, avatar_url)
        `)
        .eq('id', callId)
        .single();

      if (error) throw error;
      
      // Determine if current user is the initiator
      const isUserCaller = data.caller_id === user?.id;
      setIsInitiator(isUserCaller);
      
      // Get the other user's profile
      const otherUserProfile = isUserCaller ? data.receiver : data.caller;
      setCallData({
        ...data,
        profiles: otherUserProfile,
      } as CallData);

      // Subscribe to call status changes
      const channel = supabase
        .channel(`call:${callId}`)
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
            if (newStatus === 'ended' || newStatus === 'rejected') {
              endCall();
            }
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    } catch (error: any) {
      console.error('Error loading call:', error);
      toast({
        title: 'Error',
        description: 'Failed to load call data',
        variant: 'destructive',
      });
    }
  };

  const startTimer = () => {
    startTimeRef.current = Date.now();
    intervalRef.current = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
      setCallDuration(elapsed);
    }, 1000);
  };

  const updateCallStatus = async (status: string) => {
    try {
      await supabase
        .from('call_logs')
        .update({ status })
        .eq('id', callId);
    } catch (error) {
      console.error('Error updating call status:', error);
    }
  };

  const toggleMute = () => {
    if (localStream) {
      localStream.getAudioTracks().forEach((track) => {
        track.enabled = !track.enabled;
      });
      setIsMuted(!isMuted);
    }
  };

  const toggleVideo = () => {
    if (localStream) {
      localStream.getVideoTracks().forEach((track) => {
        track.enabled = !track.enabled;
      });
      setIsVideoOff(!isVideoOff);
    }
  };

  const endCall = async () => {
    const duration = Math.floor((Date.now() - startTimeRef.current) / 1000);
    const durationMinutes = Math.max(1, Math.ceil(duration / 60));
    
    try {
      await supabase
        .from('call_logs')
        .update({
          status: 'ended',
          duration: duration,
          ended_at: new Date().toISOString(),
        })
        .eq('id', callId);

      if (callData && connectionState === 'connected') {
        const action = callData.call_type === 'video' ? 'video_call' : 'voice_call';
        
        await supabase.functions.invoke('credit-deduction', {
          body: {
            action,
            userId: user?.id,
            targetUserId: callData.caller_id === user?.id ? callData.receiver_id : callData.caller_id,
            metadata: {
              minutes: durationMinutes,
              duration: duration,
            },
          },
        });

        const costPerMinute = callData.call_type === 'video' ? 30 : 20;
        const totalCost = costPerMinute * durationMinutes;
        
        toast({
          title: 'Call ended',
          description: `Duration: ${formatDuration(duration)}. ${totalCost} credits deducted.`,
        });
      }
    } catch (error) {
      console.error('Error ending call:', error);
      toast({
        title: 'Call ended',
        description: duration > 0 ? `Duration: ${formatDuration(duration)}` : undefined,
      });
    }

    cleanup();
    navigate('/messages');
  };

  const cleanup = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    cleanupWebRTC();
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const isVideo = callType === 'video';
  const otherUser = callData?.profiles;

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col">
      {/* Video Container */}
      <div className="flex-1 relative">
        {isVideo ? (
          <>
            {/* Remote Video (full screen) */}
            {remoteStream ? (
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-900 to-black">
                <div className="text-center">
                  <Avatar className="w-40 h-40 mx-auto mb-6 border-4 border-primary/20">
                    <AvatarImage src={otherUser?.avatar_url || ''} />
                    <AvatarFallback className="text-5xl bg-primary/10">
                      {otherUser?.display_name?.[0] || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <h2 className="text-3xl font-bold text-white mb-3">
                    {otherUser?.display_name || 'Unknown'}
                  </h2>
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-2 h-2 bg-primary rounded-full animate-pulse" />
                    <p className="text-lg text-gray-300">
                      {connectionState === 'connecting' ? 'Connecting...' : 
                       connectionState === 'failed' ? 'Connection failed' : 'Waiting...'}
                    </p>
                  </div>
                </div>
              </div>
            )}
            
            {/* Local Video (picture-in-picture) */}
            {localStream && !isVideoOff && (
              <div className="absolute top-6 right-6 w-36 h-48 rounded-2xl overflow-hidden shadow-2xl border-2 border-white/30 backdrop-blur-sm">
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover mirror"
                />
              </div>
            )}
          </>
        ) : (
          /* Voice Call - Show Avatar */
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-900 via-black to-gray-900">
            <div className="text-center space-y-6">
              <div className="relative inline-block">
                {connectionState === 'connected' && (
                  <div className="absolute inset-0 rounded-full border-4 border-primary animate-ping opacity-20" />
                )}
                <Avatar className="w-40 h-40 mx-auto border-4 border-primary/30">
                  <AvatarImage src={otherUser?.avatar_url || ''} />
                  <AvatarFallback className="text-5xl bg-primary/10">
                    {otherUser?.display_name?.[0] || 'U'}
                  </AvatarFallback>
                </Avatar>
              </div>
              <div>
                <h2 className="text-3xl font-bold text-white mb-3">
                  {otherUser?.display_name || 'Unknown'}
                </h2>
                <p className="text-xl text-gray-300 font-medium">
                  {connectionState === 'connected' ? formatDuration(callDuration) : 
                   connectionState === 'connecting' ? 'Connecting...' : 
                   'Connection failed'}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Call Status Overlay for Video */}
        {isVideo && connectionState === 'connected' && (
          <div className="absolute top-6 left-6 bg-black/70 backdrop-blur-md px-5 py-3 rounded-full border border-white/10">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              <p className="text-white text-sm font-semibold">
                {formatDuration(callDuration)}
              </p>
            </div>
          </div>
        )}

        {/* Other user name overlay for video */}
        {isVideo && remoteStream && (
          <div className="absolute bottom-6 left-6 bg-black/70 backdrop-blur-md px-5 py-3 rounded-full border border-white/10">
            <p className="text-white text-sm font-medium">
              {otherUser?.display_name || 'Unknown'}
            </p>
          </div>
        )}
      </div>

      {/* Call Controls */}
      <div className="p-8 bg-gradient-to-t from-black via-black/95 to-transparent">
        <CallControls
          isMuted={isMuted}
          isVideoOff={isVideoOff}
          isVideoCall={isVideo}
          onToggleMute={toggleMute}
          onToggleVideo={toggleVideo}
          onEndCall={endCall}
        />
      </div>

      <style>{`
        .mirror {
          transform: scaleX(-1);
        }
        @keyframes ping {
          75%, 100% {
            transform: scale(1.5);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
};

export default Call;