import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface UseWebRTCProps {
  callId: string;
  isInitiator: boolean;
  otherUserId: string;
  isVideo: boolean;
  onConnectionStateChange?: (state: RTCPeerConnectionState) => void;
}

interface SignalData {
  type: 'offer' | 'answer' | 'ice-candidate';
  offer?: RTCSessionDescriptionInit;
  answer?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
}

export const useWebRTC = ({ callId, isInitiator, otherUserId, isVideo, onConnectionStateChange }: UseWebRTCProps) => {
  const { toast } = useToast();
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [connectionState, setConnectionState] = useState<RTCPeerConnectionState>('new');
  const peerConnection = useRef<RTCPeerConnection | null>(null);
  const pendingCandidates = useRef<RTCIceCandidateInit[]>([]);

  // High-quality configuration
  const rtcConfig: RTCConfiguration = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
    ],
    iceCandidatePoolSize: 10,
  };

  const sendSignal = useCallback(async (signal: SignalData) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from('call_signals').insert({
        call_id: callId,
        from_user_id: user?.id!,
        to_user_id: otherUserId,
        signal_data: signal as any,
      } as any);
    } catch (error) {
      console.error('Error sending signal:', error);
    }
  }, [callId, otherUserId]);

  const initializeMedia = useCallback(async () => {
    try {
      const constraints: MediaStreamConstraints = {
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 48000,
        },
        video: isVideo ? {
          width: { ideal: 1280, max: 1920 },
          height: { ideal: 720, max: 1080 },
          frameRate: { ideal: 30, max: 60 },
          facingMode: 'user',
        } : false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      setLocalStream(stream);
      return stream;
    } catch (error) {
      console.error('Error accessing media:', error);
      toast({
        title: 'Media Access Error',
        description: 'Could not access camera/microphone. Please check permissions.',
        variant: 'destructive',
      });
      throw error;
    }
  }, [isVideo, toast]);

  const createPeerConnection = useCallback((stream: MediaStream) => {
    const pc = new RTCPeerConnection(rtcConfig);

    // Add local tracks
    stream.getTracks().forEach(track => {
      pc.addTrack(track, stream);
    });

    // Handle remote stream
    pc.ontrack = (event) => {
      console.log('Received remote track:', event.track.kind);
      setRemoteStream(event.streams[0]);
    };

    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        console.log('Sending ICE candidate');
        sendSignal({
          type: 'ice-candidate',
          candidate: event.candidate.toJSON(),
        });
      }
    };

    // Handle connection state changes
    pc.onconnectionstatechange = () => {
      console.log('Connection state:', pc.connectionState);
      setConnectionState(pc.connectionState);
      onConnectionStateChange?.(pc.connectionState);

      if (pc.connectionState === 'failed') {
        toast({
          title: 'Connection Failed',
          description: 'Unable to establish connection. Please try again.',
          variant: 'destructive',
        });
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log('ICE connection state:', pc.iceConnectionState);
    };

    peerConnection.current = pc;
    return pc;
  }, [rtcConfig, sendSignal, onConnectionStateChange, toast]);

  const handleOffer = useCallback(async (offer: RTCSessionDescriptionInit) => {
    console.log('Handling offer');
    const stream = await initializeMedia();
    const pc = createPeerConnection(stream);

    await pc.setRemoteDescription(new RTCSessionDescription(offer));
    
    // Add pending candidates
    for (const candidate of pendingCandidates.current) {
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
    }
    pendingCandidates.current = [];

    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    
    await sendSignal({
      type: 'answer',
      answer: pc.localDescription!.toJSON(),
    });
  }, [initializeMedia, createPeerConnection, sendSignal]);

  const handleAnswer = useCallback(async (answer: RTCSessionDescriptionInit) => {
    console.log('Handling answer');
    if (!peerConnection.current) return;

    await peerConnection.current.setRemoteDescription(new RTCSessionDescription(answer));
    
    // Add pending candidates
    for (const candidate of pendingCandidates.current) {
      await peerConnection.current.addIceCandidate(new RTCIceCandidate(candidate));
    }
    pendingCandidates.current = [];
  }, []);

  const handleIceCandidate = useCallback(async (candidate: RTCIceCandidateInit) => {
    console.log('Handling ICE candidate');
    if (!peerConnection.current || !peerConnection.current.remoteDescription) {
      // Store candidates until remote description is set
      pendingCandidates.current.push(candidate);
      return;
    }

    try {
      await peerConnection.current.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (error) {
      console.error('Error adding ICE candidate:', error);
    }
  }, []);

  const startCall = useCallback(async () => {
    console.log('Starting call as initiator');
    const stream = await initializeMedia();
    const pc = createPeerConnection(stream);

    const offer = await pc.createOffer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: isVideo,
    });
    await pc.setLocalDescription(offer);

    await sendSignal({
      type: 'offer',
      offer: pc.localDescription!.toJSON(),
    });
  }, [initializeMedia, createPeerConnection, isVideo, sendSignal]);

  // Subscribe to signaling
  useEffect(() => {
    const channel = supabase
      .channel(`call-signals-${callId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'call_signals',
          filter: `call_id=eq.${callId}`,
        },
        async (payload: any) => {
          const { from_user_id, signal_data } = payload.new;
          
          // Ignore our own signals
          const { data: { user } } = await supabase.auth.getUser();
          if (from_user_id === user?.id) return;

          const signal = signal_data as SignalData;
          
          if (signal.type === 'offer' && signal.offer) {
            await handleOffer(signal.offer);
          } else if (signal.type === 'answer' && signal.answer) {
            await handleAnswer(signal.answer);
          } else if (signal.type === 'ice-candidate' && signal.candidate) {
            await handleIceCandidate(signal.candidate);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [callId, handleOffer, handleAnswer, handleIceCandidate]);

  // Start call if initiator
  useEffect(() => {
    if (isInitiator) {
      startCall();
    }
  }, [isInitiator, startCall]);

  const cleanup = useCallback(() => {
    localStream?.getTracks().forEach(track => track.stop());
    remoteStream?.getTracks().forEach(track => track.stop());
    peerConnection.current?.close();
    setLocalStream(null);
    setRemoteStream(null);
  }, [localStream, remoteStream]);

  return {
    localStream,
    remoteStream,
    connectionState,
    cleanup,
  };
};
