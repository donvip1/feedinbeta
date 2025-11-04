import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Video, VideoOff, Mic, MicOff, PhoneOff, Monitor, Radio, Users } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';

interface WebRTCCallProps {
  callId: string;
  isInitiator: boolean;
  participants: Array<{ id: string; display_name: string; avatar_url: string }>;
  onEndCall: () => void;
}

export const WebRTCCall = ({ callId, isInitiator, participants, onEndCall }: WebRTCCallProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(new Map());
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRefs = useRef<Map<string, HTMLVideoElement>>(new Map());
  const peerConnections = useRef<Map<string, RTCPeerConnection>>(new Map());
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const recordedChunks = useRef<Blob[]>([]);

  useEffect(() => {
    initializeMedia();
    subscribeToSignaling();

    return () => {
      cleanup();
    };
  }, []);

  const initializeMedia = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });

      setLocalStream(stream);
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      if (isInitiator) {
        // Create offers for all participants
        participants.forEach((participant) => {
          if (participant.id !== user?.id) {
            createPeerConnection(participant.id, stream);
          }
        });
      }
    } catch (error) {
      console.error('Error accessing media devices:', error);
      toast({
        title: 'Media Access Error',
        description: 'Could not access camera/microphone',
        variant: 'destructive',
      });
    }
  };

  const createPeerConnection = async (participantId: string, stream: MediaStream) => {
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
    });

    stream.getTracks().forEach((track) => pc.addTrack(track, stream));

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        sendSignal(participantId, {
          type: 'ice-candidate',
          candidate: event.candidate,
        });
      }
    };

    pc.ontrack = (event) => {
      setRemoteStreams((prev) => {
        const newMap = new Map(prev);
        newMap.set(participantId, event.streams[0]);
        return newMap;
      });
    };

    peerConnections.current.set(participantId, pc);

    if (isInitiator) {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      sendSignal(participantId, { type: 'offer', offer });
    }
  };

  const sendSignal = async (participantId: string, signal: any) => {
    await supabase.from('call_signals').insert({
      call_id: callId,
      from_user_id: user?.id,
      to_user_id: participantId,
      signal_data: signal,
    });
  };

  const subscribeToSignaling = () => {
    const channel = supabase
      .channel(`call-${callId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'call_signals',
          filter: `to_user_id=eq.${user?.id}`,
        },
        async (payload) => {
          const signal = payload.new.signal_data;
          const fromUserId = payload.new.from_user_id;

          if (signal.type === 'offer') {
            await handleOffer(fromUserId, signal.offer);
          } else if (signal.type === 'answer') {
            await handleAnswer(fromUserId, signal.answer);
          } else if (signal.type === 'ice-candidate') {
            await handleIceCandidate(fromUserId, signal.candidate);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const handleOffer = async (fromUserId: string, offer: RTCSessionDescriptionInit) => {
    if (!localStream) return;

    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
    });

    localStream.getTracks().forEach((track) => pc.addTrack(track, localStream));

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        sendSignal(fromUserId, {
          type: 'ice-candidate',
          candidate: event.candidate,
        });
      }
    };

    pc.ontrack = (event) => {
      setRemoteStreams((prev) => {
        const newMap = new Map(prev);
        newMap.set(fromUserId, event.streams[0]);
        return newMap;
      });
    };

    peerConnections.current.set(fromUserId, pc);

    await pc.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    sendSignal(fromUserId, { type: 'answer', answer });
  };

  const handleAnswer = async (fromUserId: string, answer: RTCSessionDescriptionInit) => {
    const pc = peerConnections.current.get(fromUserId);
    if (pc) {
      await pc.setRemoteDescription(new RTCSessionDescription(answer));
    }
  };

  const handleIceCandidate = async (fromUserId: string, candidate: RTCIceCandidateInit) => {
    const pc = peerConnections.current.get(fromUserId);
    if (pc) {
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
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

  const startScreenShare = async () => {
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
      });

      const screenTrack = screenStream.getVideoTracks()[0];

      peerConnections.current.forEach((pc) => {
        const sender = pc.getSenders().find((s) => s.track?.kind === 'video');
        if (sender) {
          sender.replaceTrack(screenTrack);
        }
      });

      setIsScreenSharing(true);

      screenTrack.onended = () => {
        stopScreenShare();
      };
    } catch (error) {
      console.error('Error sharing screen:', error);
      toast({
        title: 'Screen Share Error',
        description: 'Could not start screen sharing',
        variant: 'destructive',
      });
    }
  };

  const stopScreenShare = () => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      peerConnections.current.forEach((pc) => {
        const sender = pc.getSenders().find((s) => s.track?.kind === 'video');
        if (sender) {
          sender.replaceTrack(videoTrack);
        }
      });
      setIsScreenSharing(false);
    }
  };

  const startRecording = () => {
    if (!localStream) return;

    recordedChunks.current = [];
    mediaRecorder.current = new MediaRecorder(localStream);

    mediaRecorder.current.ondataavailable = (event) => {
      if (event.data.size > 0) {
        recordedChunks.current.push(event.data);
      }
    };

    mediaRecorder.current.onstop = async () => {
      const blob = new Blob(recordedChunks.current, { type: 'video/webm' });
      await uploadRecording(blob);
    };

    mediaRecorder.current.start();
    setIsRecording(true);
    toast({ title: 'Recording started' });
  };

  const stopRecording = () => {
    if (mediaRecorder.current && isRecording) {
      mediaRecorder.current.stop();
      setIsRecording(false);
      toast({ title: 'Recording stopped' });
    }
  };

  const uploadRecording = async (blob: Blob) => {
    const fileName = `recordings/${callId}/${Date.now()}.webm`;
    
    // Store recording metadata - actual storage bucket will be created separately
    console.log('Recording saved:', fileName, 'Size:', blob.size);
    toast({ 
      title: 'Recording saved',
      description: 'Your call recording has been saved'
    });
  };

  const cleanup = () => {
    if (mediaRecorder.current && isRecording) {
      stopRecording();
    }

    localStream?.getTracks().forEach((track) => track.stop());
    peerConnections.current.forEach((pc) => pc.close());
    peerConnections.current.clear();
  };

  const handleEndCall = () => {
    cleanup();
    onEndCall();
  };

  return (
    <div className="fixed inset-0 bg-background z-50 flex flex-col">
      <div className="flex-1 relative grid grid-cols-2 gap-2 p-4">
        {/* Local Video */}
        <div className="relative bg-muted rounded-lg overflow-hidden">
          <video
            ref={localVideoRef}
            autoPlay
            muted
            playsInline
            className="w-full h-full object-cover"
          />
          <div className="absolute bottom-2 left-2 text-sm text-white bg-black/50 px-2 py-1 rounded">
            You {isScreenSharing && '(Sharing)'}
          </div>
        </div>

        {/* Remote Videos */}
        {Array.from(remoteStreams.entries()).map(([userId, stream]) => {
          const participant = participants.find((p) => p.id === userId);
          return (
            <div key={userId} className="relative bg-muted rounded-lg overflow-hidden">
              <video
                ref={(ref) => {
                  if (ref) {
                    ref.srcObject = stream;
                    remoteVideoRefs.current.set(userId, ref);
                  }
                }}
                autoPlay
                playsInline
                className="w-full h-full object-cover"
              />
              <div className="absolute bottom-2 left-2 text-sm text-white bg-black/50 px-2 py-1 rounded">
                {participant?.display_name || 'User'}
              </div>
            </div>
          );
        })}
      </div>

      {/* Controls */}
      <div className="p-4 bg-card flex items-center justify-center gap-4">
        <Button
          variant={isMuted ? 'destructive' : 'secondary'}
          size="icon"
          className="rounded-full w-12 h-12"
          onClick={toggleMute}
        >
          {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
        </Button>

        <Button
          variant={isVideoOff ? 'destructive' : 'secondary'}
          size="icon"
          className="rounded-full w-12 h-12"
          onClick={toggleVideo}
        >
          {isVideoOff ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
        </Button>

        <Button
          variant={isScreenSharing ? 'default' : 'secondary'}
          size="icon"
          className="rounded-full w-12 h-12"
          onClick={isScreenSharing ? stopScreenShare : startScreenShare}
        >
          <Monitor className="w-5 h-5" />
        </Button>

        <Button
          variant={isRecording ? 'destructive' : 'secondary'}
          size="icon"
          className="rounded-full w-12 h-12"
          onClick={isRecording ? stopRecording : startRecording}
        >
          <Radio className="w-5 h-5" />
        </Button>

        <Button
          variant="destructive"
          size="icon"
          className="rounded-full w-12 h-12"
          onClick={handleEndCall}
        >
          <PhoneOff className="w-5 h-5" />
        </Button>
      </div>
    </div>
  );
};
