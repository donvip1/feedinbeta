import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { CallControls } from '@/components/calls/CallControls';
import { CallQualityIndicator } from '@/components/calls/CallQualityIndicator';
import { CallStatsDashboard } from '@/components/calls/CallStatsDashboard';
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
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  const [isRecording, setIsRecording] = useState(false);
  const [isPipEnabled, setIsPipEnabled] = useState(false);
  const [showStats, setShowStats] = useState(false);
  
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const startTimeRef = useRef<number>(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const notificationRef = useRef<Notification | null>(null);

  const { 
    localStream, 
    remoteStream, 
    connectionState: rtcState, 
    isScreenSharing,
    callStats,
    statsHistory,
    toggleScreenShare,
    cleanup: cleanupWebRTC 
  } = useWebRTC({
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
    if (remoteStream) {
      // Set video stream
      if (remoteVideoRef.current && callType === 'video') {
        remoteVideoRef.current.srcObject = remoteStream;
      }
      
      // Set audio stream for playback
      if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = remoteStream;
        remoteAudioRef.current.play().catch(e => console.error('Error playing remote audio:', e));
      }
      
      // Show connection established toast
      toast({
        title: 'Connected',
        description: 'Call connected successfully',
      });
    }
  }, [remoteStream, callType, toast]);

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
    requestNotificationPermission();

    return () => {
      cleanup();
    };
  }, [callId]);

  // Background notification when page is hidden
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && connectionState === 'connected') {
        showBackgroundNotification();
      } else if (!document.hidden && notificationRef.current) {
        notificationRef.current.close();
        notificationRef.current = null;
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (notificationRef.current) {
        notificationRef.current.close();
      }
    };
  }, [connectionState, callData]);

  const requestNotificationPermission = async () => {
    if ('Notification' in window && Notification.permission === 'default') {
      await Notification.requestPermission();
    }
  };

  const showBackgroundNotification = () => {
    if ('Notification' in window && Notification.permission === 'granted') {
      const otherUser = callData?.profiles;
      notificationRef.current = new Notification('Call in progress', {
        body: `Call with ${otherUser?.display_name || 'Unknown'}`,
        icon: otherUser?.avatar_url || '/favicon.png',
        tag: 'active-call',
        requireInteraction: true,
      });

      notificationRef.current.onclick = () => {
        window.focus();
        notificationRef.current?.close();
      };
    }
  };

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

  const toggleSpeaker = () => {
    if (remoteAudioRef.current) {
      const newVolume = isSpeakerOn ? 0.5 : 1.0;
      remoteAudioRef.current.volume = newVolume;
      setIsSpeakerOn(!isSpeakerOn);
      
      toast({
        title: isSpeakerOn ? 'Speaker lowered' : 'Speaker mode',
        description: isSpeakerOn ? 'Volume reduced' : 'Full volume enabled',
      });
    }
  };

  const togglePip = async () => {
    if (!remoteVideoRef.current) return;

    try {
      if (!isPipEnabled) {
        if (document.pictureInPictureElement) {
          await document.exitPictureInPicture();
        }
        await remoteVideoRef.current.requestPictureInPicture();
        setIsPipEnabled(true);
        toast({
          title: 'Picture-in-Picture enabled',
          description: 'Video moved to floating window',
        });
      } else {
        if (document.pictureInPictureElement) {
          await document.exitPictureInPicture();
        }
        setIsPipEnabled(false);
        toast({
          title: 'Picture-in-Picture disabled',
          description: 'Video returned to main window',
        });
      }
    } catch (error) {
      console.error('Error toggling PiP:', error);
      toast({
        title: 'PiP Error',
        description: 'Could not enable Picture-in-Picture mode',
        variant: 'destructive',
      });
    }
  };

  // Handle PiP state changes
  useEffect(() => {
    const videoElement = remoteVideoRef.current;
    if (!videoElement) return;

    const handlePipChange = () => {
      setIsPipEnabled(document.pictureInPictureElement === videoElement);
    };

    videoElement.addEventListener('enterpictureinpicture', handlePipChange);
    videoElement.addEventListener('leavepictureinpicture', handlePipChange);

    return () => {
      videoElement.removeEventListener('enterpictureinpicture', handlePipChange);
      videoElement.removeEventListener('leavepictureinpicture', handlePipChange);
    };
  }, []);

  const startRecording = async () => {
    if (!localStream) return;

    try {
      // Combine local and remote streams for recording
      const audioContext = new AudioContext();
      const destination = audioContext.createMediaStreamDestination();

      // Add local audio
      if (localStream) {
        const localSource = audioContext.createMediaStreamSource(localStream);
        localSource.connect(destination);
      }

      // Add remote audio
      if (remoteStream) {
        const remoteSource = audioContext.createMediaStreamSource(remoteStream);
        remoteSource.connect(destination);
      }

      // Create MediaRecorder with combined stream
      const options = { mimeType: 'video/webm;codecs=vp9,opus' };
      const recorder = new MediaRecorder(destination.stream, options);
      
      recordedChunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        downloadRecording();
      };

      recorder.start(1000); // Collect data every second
      mediaRecorderRef.current = recorder;
      setIsRecording(true);

      toast({
        title: 'Recording started',
        description: 'Call is being recorded to your device',
      });
    } catch (error) {
      console.error('Error starting recording:', error);
      toast({
        title: 'Recording failed',
        description: 'Could not start call recording',
        variant: 'destructive',
      });
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const downloadRecording = () => {
    const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = `call-recording-${callId}-${Date.now()}.webm`;
    document.body.appendChild(a);
    a.click();
    
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);

    toast({
      title: 'Recording saved',
      description: 'Call recording downloaded to your device',
    });
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
    if (isRecording) {
      stopRecording();
    }
    if (notificationRef.current) {
      notificationRef.current.close();
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
      {/* Hidden audio element for remote stream playback */}
      <audio ref={remoteAudioRef} autoPlay playsInline />
      
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
                  <div className="flex flex-col items-center gap-3">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-primary rounded-full animate-pulse" />
                      <p className="text-lg text-gray-300">
                        {connectionState === 'connecting' ? 'Connecting...' : 
                         connectionState === 'failed' ? 'Connection failed' : 'Waiting...'}
                      </p>
                    </div>
                    {connectionState === 'connecting' && (
                      <div className="flex gap-1">
                        <div className="w-2 h-2 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                        <div className="w-2 h-2 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                        <div className="w-2 h-2 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                    )}
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
          <div className="absolute top-6 left-6 flex items-center gap-3">
            <div className="bg-black/70 backdrop-blur-md px-5 py-3 rounded-full border border-white/10">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                <p className="text-white text-sm font-semibold">
                  {formatDuration(callDuration)}
                </p>
              </div>
            </div>
            <CallQualityIndicator 
              connectionState={rtcState}
              stats={callStats || undefined}
            />
          </div>
        )}

        {/* Screen sharing indicator */}
        {isScreenSharing && (
          <div className="absolute top-6 right-6 bg-primary/90 backdrop-blur-md px-5 py-3 rounded-full border border-white/20 animate-pulse">
            <p className="text-white text-sm font-semibold">
              Sharing Screen
            </p>
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
        <div className="flex flex-col items-center gap-4">
          {/* Quality indicator for voice calls */}
          {!isVideo && connectionState === 'connected' && (
            <CallQualityIndicator 
              connectionState={rtcState}
              stats={callStats || undefined}
            />
          )}
          
          <CallControls
            isMuted={isMuted}
            isVideoOff={isVideoOff}
            isVideoCall={isVideo}
            isScreenSharing={isScreenSharing}
            isSpeakerOn={isSpeakerOn}
            isRecording={isRecording}
            isPipEnabled={isPipEnabled}
            onToggleMute={toggleMute}
            onToggleVideo={toggleVideo}
            onToggleScreenShare={toggleScreenShare}
            onToggleSpeaker={toggleSpeaker}
            onToggleRecording={isRecording ? stopRecording : startRecording}
            onTogglePip={isVideo ? togglePip : undefined}
            onShowStats={() => setShowStats(true)}
            onEndCall={endCall}
          />
        </div>
      </div>

      <CallStatsDashboard
        open={showStats}
        onOpenChange={setShowStats}
        statsHistory={statsHistory}
        currentStats={callStats}
      />

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