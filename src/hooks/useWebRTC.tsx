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
  }, [isVideo, toast, getVideoConstraints]);

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
    
    // Start monitoring stats
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
            const packetsLost = report.packetsLost || 0;
            const packetsReceived = report.packetsReceived || 0;
            packetLoss = packetsReceived > 0 ? (packetsLost / packetsReceived) * 100 : 0;
            bandwidth = report.bytesReceived || 0;
          }
        });

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

  const startScreenShare = useCallback(async () => {
    if (!peerConnection.current || !localStream) return;

    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          frameRate: { ideal: 30 },
        },
      });

      const screenTrack = screenStream.getVideoTracks()[0];
      
      // Save original video track
      originalVideoTrack.current = localStream.getVideoTracks()[0];

      // Replace video track in peer connection
      const sender = peerConnection.current
        .getSenders()
        .find((s) => s.track?.kind === 'video');

      if (sender) {
        await sender.replaceTrack(screenTrack);
        setIsScreenSharing(true);

        // Listen for screen share stop
        screenTrack.onended = () => {
          stopScreenShare();
        };

        toast({
          title: 'Screen sharing started',
          description: 'Your screen is now visible to the other user',
        });
      }
    } catch (error) {
      console.error('Error sharing screen:', error);
      toast({
        title: 'Screen Share Error',
        description: 'Could not start screen sharing',
        variant: 'destructive',
      });
    }
  }, [localStream, toast]);

  const stopScreenShare = useCallback(async () => {
    if (!peerConnection.current || !originalVideoTrack.current) return;

    try {
      const sender = peerConnection.current
        .getSenders()
        .find((s) => s.track?.kind === 'video');

      if (sender && originalVideoTrack.current) {
        await sender.replaceTrack(originalVideoTrack.current);
        setIsScreenSharing(false);
        originalVideoTrack.current = null;

        toast({
          title: 'Screen sharing stopped',
          description: 'Camera feed restored',
        });
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
