import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { CallControls } from '@/components/calls/CallControls';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Phone, Video, Mic, MicOff, VideoOff, PhoneOff } from 'lucide-react';

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
  const [callDuration, setCallDuration] = useState(0);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  
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
    };
  }, [callId]);

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
            } else if (newStatus === 'answered') {
              setIsConnected(true);
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

      // In a real implementation, this is where you'd set up WebRTC peer connection
      // For now, we'll simulate connection after a delay
      setTimeout(() => {
        updateCallStatus('answered');
      }, 2000);
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

  const endCall = async () => {
    const duration = Math.floor((Date.now() - startTimeRef.current) / 1000);
    
    try {
      await supabase
        .from('call_logs')
        .update({
          status: 'ended',
          duration: duration,
          ended_at: new Date().toISOString(),
        })
        .eq('id', callId);
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

  const isVideo = callData?.call_type === 'video';
  const otherUser = callData?.profiles;

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col">
      {/* Video Container */}
      <div className="flex-1 relative">
        {isVideo ? (
          <>
            {/* Remote Video (full screen) */}
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="w-full h-full object-cover"
            />
            
            {/* Local Video (picture-in-picture) */}
            {!isVideoOff && (
              <div className="absolute top-4 right-4 w-32 h-40 rounded-lg overflow-hidden shadow-lg border-2 border-white/20">
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
          <div className="w-full h-full flex items-center justify-center">
            <div className="text-center">
              <Avatar className="w-32 h-32 mx-auto mb-6">
                <AvatarImage src={otherUser?.avatar_url || ''} />
                <AvatarFallback className="text-4xl">
                  {otherUser?.display_name?.[0] || 'U'}
                </AvatarFallback>
              </Avatar>
              <h2 className="text-2xl font-bold text-white mb-2">
                {otherUser?.display_name || 'Unknown'}
              </h2>
              <p className="text-gray-400">
                {isConnected ? formatDuration(callDuration) : 'Connecting...'}
              </p>
            </div>
          </div>
        )}

        {/* Call Status Overlay */}
        {isVideo && (
          <div className="absolute top-4 left-4 bg-black/60 backdrop-blur-sm px-4 py-2 rounded-full">
            <p className="text-white text-sm font-medium">
              {isConnected ? formatDuration(callDuration) : 'Connecting...'}
            </p>
          </div>
        )}
      </div>

      {/* Call Controls */}
      <div className="p-6 bg-gradient-to-t from-black via-black/90 to-transparent">
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
      `}</style>
    </div>
  );
};

export default Call;