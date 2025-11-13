import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { CallControls } from '@/components/calls/CallControls';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { usePresence } from '@/hooks/usePresence';
import { callSounds } from '@/utils/callSounds';
import { Loader2 } from 'lucide-react';

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
  const [callData, setCallData] = useState<CallData | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  const [callDuration, setCallDuration] = useState(0);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [callStatus, setCallStatus] = useState<'connecting' | 'ringing' | 'connected' | 'offline'>('connecting');
  
  const otherUserId = callData?.caller_id === user?.id ? callData?.receiver_id : callData?.caller_id;
  const { isOnline } = usePresence(otherUserId);
  
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const startTimeRef = useRef<number>(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

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
    setupMediaStream();

    return () => {
      cleanup();
      callSounds.stopRinging();
    };
  }, [callId]);

  useEffect(() => {
    if (!callData || isConnected) return;

    if (isOnline === false) {
      setCallStatus('offline');
      callSounds.stopRinging();
      callSounds.playBusy();
    } else if (isOnline === true && callStatus === 'connecting') {
      setCallStatus('ringing');
      callSounds.playRinging();
    }
  }, [isOnline, callData, isConnected, callStatus]);

  const loadCallData = async () => {
    try {
      const { data, error } = await supabase
        .from('call_logs')
        .select(`
          *,
          profiles!call_logs_receiver_id_fkey (
            display_name,
            avatar_url
          )
        `)
        .eq('id', callId)
        .single();

      if (error) throw error;
      setCallData(data as CallData);

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
              callSounds.stopRinging();
              callSounds.playDisconnected();
              endCall();
            } else if (newStatus === 'answered') {
              callSounds.stopRinging();
              callSounds.playConnected();
              setIsConnected(true);
              setCallStatus('connected');
              startTimer();
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

  const setupMediaStream = async () => {
    try {
      const isVideo = searchParams.get('type') === 'video';
      const stream = await navigator.mediaDevices.getUserMedia({
        video: isVideo ? { width: 1280, height: 720 } : false,
        audio: true,
      });

      setLocalStream(stream);
      
      if (localVideoRef.current && isVideo) {
        localVideoRef.current.srcObject = stream;
      }

      setTimeout(() => {
        updateCallStatus('answered');
        setIsConnected(true);
        setCallStatus('connected');
        startTimer();
      }, 3000);
    } catch (error: any) {
      console.error('Error accessing media devices:', error);
      toast({
        title: 'Media Access Error',
        description: 'Failed to access camera/microphone',
        variant: 'destructive',
      });
      endCall();
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
    setIsSpeakerOn(!isSpeakerOn);
    toast({
      title: isSpeakerOn ? 'Speaker Off' : 'Speaker On',
      description: isSpeakerOn ? 'Switched to earpiece' : 'Switched to loudspeaker',
    });
  };

  const endCall = async () => {
    callSounds.stopRinging();
    callSounds.playDisconnected();
    
    try {
      const endTime = new Date().toISOString();
      const duration = startTimeRef.current 
        ? Math.floor((Date.now() - startTimeRef.current) / 1000)
        : 0;

      await supabase
        .from('call_logs')
        .update({
          status: 'ended',
          ended_at: endTime,
          duration: duration,
        })
        .eq('id', callId);

      if (isConnected && duration > 0) {
        const durationMinutes = Math.max(1, Math.ceil(duration / 60));
        const action = callData?.call_type === 'video' ? 'video_call' : 'voice_call';
        
        await supabase.functions.invoke('credit-deduction', {
          body: {
            action,
            userId: user?.id,
            metadata: {
              minutes: durationMinutes,
              duration: duration,
            },
          },
        });

        const costPerMinute = callData?.call_type === 'video' ? 30 : 20;
        const totalCost = costPerMinute * durationMinutes;
        
        toast({
          title: 'Call ended',
          description: `Duration: ${formatDuration(duration)}. ${totalCost} credits deducted.`,
        });
      }
    } catch (error) {
      console.error('Error ending call:', error);
    }

    cleanup();
    navigate('/messages');
  };

  const cleanup = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    
    if (localStream) {
      localStream.getTracks().forEach((track) => track.stop());
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-white flex flex-col relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl animate-pulse" />
      </div>

      <div className="relative z-10 p-8 text-center space-y-6 flex-1 flex flex-col items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
          <div className="relative">
            {(callStatus === 'ringing' || callStatus === 'connecting') && (
              <div className="absolute inset-0 rounded-full border-4 border-primary/50 animate-ping" />
            )}
            <Avatar className="w-32 h-32 border-4 border-primary shadow-2xl shadow-primary/50 relative">
              <AvatarImage src={callData?.profiles?.avatar_url || ''} />
              <AvatarFallback className="text-4xl bg-gradient-to-br from-purple-600 to-blue-600">
                {callData?.profiles?.display_name?.[0] || 'U'}
              </AvatarFallback>
            </Avatar>
          </div>
          
          <div className="space-y-2">
            <h2 className="text-3xl font-bold">{callData?.profiles?.display_name || 'Unknown User'}</h2>
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
                <span className="text-green-400">{formatDuration(callDuration)}</span>
              )}
            </p>
            {callStatus === 'offline' && (
              <p className="text-sm text-gray-400 max-w-md mx-auto mt-4">
                This user isn't available at the moment. Please try again later or contact them to come online.
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="relative z-10 flex-1 backdrop-blur-sm rounded-t-3xl overflow-hidden mx-4 mb-4">
        {callData?.call_type === 'video' ? (
          <>
            <div className="w-full h-full bg-gradient-to-br from-gray-900 to-gray-800 rounded-3xl overflow-hidden">
              <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover" />
            </div>
            <div className="absolute top-6 right-6 w-32 h-48 bg-gray-900 rounded-2xl overflow-hidden shadow-2xl border-2 border-white/10">
              <video ref={localVideoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
            </div>
          </>
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <div className="relative">
              {isConnected && (
                <div className="absolute inset-0 rounded-full bg-primary/20 animate-pulse" />
              )}
              <Avatar className="w-48 h-48 border-8 border-primary/30 shadow-2xl shadow-primary/20 relative">
                <AvatarImage src={callData?.profiles?.avatar_url || ''} />
                <AvatarFallback className="text-6xl bg-gradient-to-br from-purple-600 to-blue-600">
                  {callData?.profiles?.display_name?.[0] || 'U'}
                </AvatarFallback>
              </Avatar>
            </div>
          </div>
        )}
      </div>

      <div className="relative z-10 p-6 pb-8 bg-gradient-to-t from-black/50 to-transparent backdrop-blur-xl">
        <CallControls
          isMuted={isMuted}
          isVideoOff={isVideoOff}
          isSpeakerOn={isSpeakerOn}
          isVideoCall={callData?.call_type === 'video'}
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
