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
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [callStats, setCallStats] = useState<{
    latency: number;
    packetLoss: number;
    bandwidth: number;
  } | null>(null);
  const [statsHistory, setStatsHistory] = useState<Array<{
    timestamp: number;
    latency: number;
    packetLoss: number;
    bandwidth: number;
  }>>([]);
  const peerConnection = useRef<RTCPeerConnection | null>(null);
  const pendingCandidates = useRef<RTCIceCandidateInit[]>([]);
  const originalVideoTrack = useRef<MediaStreamTrack | null>(null);
  const statsInterval = useRef<NodeJS.Timeout | null>(null);

  const rtcConfig: RTCConfiguration = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
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

<<<<<<< HEAD
  const [videoQuality, setVideoQuality] = useState<'high' | 'medium' | 'low'>('high');

  const getVideoConstraints = useCallback((quality: 'high' | 'medium' | 'low') => {
    switch (quality) {
      case 'high':
        return {
          width: { ideal: 1280, max: 1920 },
          height: { ideal: 720, max: 1080 },
          frameRate: { ideal: 30, max: 60 },
          facingMode: 'user',
        };
      case 'medium':
        return {
          width: { ideal: 640, max: 1280 },
          height: { ideal: 480, max: 720 },
          frameRate: { ideal: 24, max: 30 },
          facingMode: 'user',
        };
      case 'low':
        return {
          width: { ideal: 320, max: 640 },
          height: { ideal: 240, max: 480 },
          frameRate: { ideal: 15, max: 24 },
          facingMode: 'user',
        };
    }
  }, []);

  const initializeMedia = useCallback(async (quality: 'high' | 'medium' | 'low' = 'high') => {
    try {
      const constraints: MediaStreamConstraints = {
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 48000,
        },
        video: isVideo ? getVideoConstraints(quality) : false,
      };
=======
  const initializeMedia = useCallback(async () => {
    let audioStream: MediaStream | null = null;
    let videoStream: MediaStream | null = null;
>>>>>>> 3d273f8 (updates on calls)

    try {
      // Try to get audio
      audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (error: any) {
      console.error('Audio access error: ', error);
      if (error.name === 'NotAllowedError') {
        toast({
          title: 'Microphone Access Denied',
          description: 'Please grant permission to use your microphone for calls.',
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'No Microphone Found',
          description: 'Could not access a microphone. Please connect a microphone and try again.',
          variant: 'destructive',
        });
      }
      throw new Error('Audio permission denied or device not found.');
    }
<<<<<<< HEAD
  }, [isVideo, toast, getVideoConstraints]);
=======

    if (isVideo) {
      try {
        // Try to get video
        videoStream = await navigator.mediaDevices.getUserMedia({ video: true });
      } catch (error: any) {
        console.error('Video access error: ', error);
        if (error.name === 'NotAllowedError') {
          toast({
            title: 'Camera Access Denied',
            description: 'You can still join with audio only.',
            variant: 'default',
          });
        } else {
          toast({
            title: 'No Camera Found',
            description: 'Proceeding with audio-only call.',
            variant: 'default',
          });
        }
        // Proceed with audio only
      }
    }

    const combinedStream = new MediaStream();
    audioStream.getTracks().forEach(track => combinedStream.addTrack(track));
    videoStream?.getTracks().forEach(track => combinedStream.addTrack(track));
    
    setLocalStream(combinedStream);
    return combinedStream;

  }, [isVideo, toast]);
>>>>>>> 3d273f8 (updates on calls)

  const createPeerConnection = useCallback((stream: MediaStream) => {
    const pc = new RTCPeerConnection(rtcConfig);

    stream.getTracks().forEach(track => {
      pc.addTrack(track, stream);
    });

    pc.ontrack = (event) => {
      setRemoteStream(event.streams[0]);
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        sendSignal({
          type: 'ice-candidate',
          candidate: event.candidate.toJSON(),
        });
      }
    };

    pc.onconnectionstatechange = () => {
      setConnectionState(pc.connectionState);
      onConnectionStateChange?.(pc.connectionState);
      if (pc.connectionState === 'failed') {
        toast({
          title: 'Connection Failed',
          description: 'Unable to establish connection.',
          variant: 'destructive',
        });
      }
    };

    peerConnection.current = pc;
    startStatsMonitoring(pc);
    return pc;
  }, [rtcConfig, sendSignal, onConnectionStateChange, toast]);

  const adjustQualityBasedOnStats = useCallback(async (stats: { latency: number; packetLoss: number }) => {
    if (!isVideo || !peerConnection.current) return;

    let newQuality: 'high' | 'medium' | 'low' = videoQuality;

    // Auto-adjust based on connection quality
    if (stats.packetLoss > 5 || stats.latency > 300) {
      // Poor connection - reduce to low quality
      newQuality = 'low';
      if (videoQuality !== 'low') {
        toast({
          title: 'Adjusting video quality',
          description: 'Connection quality is poor, reducing video to maintain audio',
        });
      }
    } else if (stats.packetLoss > 2 || stats.latency > 150) {
      // Medium connection - use medium quality
      newQuality = 'medium';
      if (videoQuality === 'high') {
        toast({
          title: 'Adjusting video quality',
          description: 'Optimizing for better connection stability',
        });
      }
    } else if (stats.packetLoss < 1 && stats.latency < 100) {
      // Good connection - use high quality
      newQuality = 'high';
    }

    // Apply quality change if different
    if (newQuality !== videoQuality && localStream) {
      setVideoQuality(newQuality);
      const newStream = await initializeMedia(newQuality);
      
      // Replace video track in peer connection
      const videoTrack = newStream.getVideoTracks()[0];
      const sender = peerConnection.current.getSenders().find(s => s.track?.kind === 'video');
      if (sender) {
        await sender.replaceTrack(videoTrack);
      }
    }
  }, [videoQuality, isVideo, localStream, initializeMedia, toast]);

  const startStatsMonitoring = useCallback((pc: RTCPeerConnection) => {
    statsInterval.current = setInterval(async () => {
      if (pc.connectionState !== 'connected') return;
      try {
        const stats = await pc.getStats();
        let latency = 0;
        let packetLoss = 0;
        let bandwidth = 0;
        stats.forEach((report) => {
          if (report.type === 'candidate-pair' && report.state === 'succeeded') {
            latency = report.currentRoundTripTime ? report.currentRoundTripTime * 1000 : 0;
          }
          if (report.type === 'inbound-rtp' && report.kind === 'video') {
            packetLoss = (report.packetsLost || 0) / (report.packetsReceived || 1);
            bandwidth = report.bytesReceived || 0;
          }
        });
<<<<<<< HEAD

        const currentStats = { latency, packetLoss, bandwidth };
        setCallStats(currentStats);
        
        // Store historical stats (keep last 30 data points)
        setStatsHistory(prev => {
          const newHistory = [...prev, { ...currentStats, timestamp: Date.now() }];
          return newHistory.slice(-30);
        });
        
        // Auto-adjust quality based on stats
        adjustQualityBasedOnStats({ latency, packetLoss });
      } catch (error) {
        console.error('Error getting stats:', error);
      }
    }, 2000);
  }, [adjustQualityBasedOnStats]);
=======
        setCallStats({ latency, packetLoss, bandwidth });
      } catch (error) {
        console.error('Error getting stats:', error);
      }
    }, 3000);
  }, []);
>>>>>>> 3d273f8 (updates on calls)

  const handleOffer = useCallback(async (offer: RTCSessionDescriptionInit) => {
    try {
        const stream = await initializeMedia();
        const pc = createPeerConnection(stream);

        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        
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
    } catch (error) {
        console.error("Failed to handle offer:", error)
    }
  }, [initializeMedia, createPeerConnection, sendSignal]);

  const handleAnswer = useCallback(async (answer: RTCSessionDescriptionInit) => {
    if (!peerConnection.current) return;
    try {
        await peerConnection.current.setRemoteDescription(new RTCSessionDescription(answer));
        for (const candidate of pendingCandidates.current) {
          await peerConnection.current.addIceCandidate(new RTCIceCandidate(candidate));
        }
        pendingCandidates.current = [];
    } catch (error) {
        console.error("Error handling answer", error)
    }
  }, []);

  const handleIceCandidate = useCallback(async (candidate: RTCIceCandidateInit) => {
    if (!peerConnection.current || !peerConnection.current.remoteDescription) {
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
    try {
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
    } catch(error) {
        console.error("Failed to start call:", error)
        onEndCall()
    }
  }, [initializeMedia, createPeerConnection, isVideo, sendSignal, onEndCall]);

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
          const { data: { user } } = await supabase.auth.getUser();
          if (payload.new.from_user_id === user?.id) return;

          const signal = payload.new.signal_data as SignalData;
          
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

  useEffect(() => {
    if (isInitiator) {
      startCall();
    }
  }, [isInitiator, startCall]);

  const startScreenShare = useCallback(async () => {
    if (!peerConnection.current || !localStream) return;
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      const screenTrack = screenStream.getVideoTracks()[0];
      
      const videoSender = peerConnection.current.getSenders().find(s => s.track?.kind === 'video');
      
      if (videoSender) {
        originalVideoTrack.current = videoSender.track;
        await videoSender.replaceTrack(screenTrack);
        setIsScreenSharing(true);

        screenTrack.onended = () => stopScreenShare();

        toast({ title: 'Screen sharing started' });
      }
    } catch (error) {
      console.error('Error sharing screen:', error);
      toast({ title: 'Screen Share Error', variant: 'destructive' });
    }
  }, [localStream, toast]);

  const stopScreenShare = useCallback(async () => {
    if (!peerConnection.current || !originalVideoTrack.current) return;
    try {
      const videoSender = peerConnection.current.getSenders().find(s => s.track?.kind === 'video');
      if (videoSender) {
        await videoSender.replaceTrack(originalVideoTrack.current);
        originalVideoTrack.current.stop() // Stop the camera track from screen share
        originalVideoTrack.current = null
        setIsScreenSharing(false);
        toast({ title: 'Screen sharing stopped' });
      }
    } catch (error) {
      console.error('Error stopping screen share:', error);
    }
  }, [toast]);

  const toggleScreenShare = useCallback(() => {
    if (isScreenSharing) {
      stopScreenShare();
    } else {
      startScreenShare();
    }
  }, [isScreenSharing, startScreenShare, stopScreenShare]);

  const cleanup = useCallback(() => {
    if (statsInterval.current) {
      clearInterval(statsInterval.current);
    }
    localStream?.getTracks().forEach(track => track.stop());
    remoteStream?.getTracks().forEach(track => track.stop());
    peerConnection.current?.close();
    setLocalStream(null);
    setRemoteStream(null);
    setIsScreenSharing(false);
  }, [localStream, remoteStream]);

  return {
    localStream,
    remoteStream,
    connectionState,
    isScreenSharing,
    callStats,
    statsHistory,
    toggleScreenShare,
    cleanup,
  };
};
