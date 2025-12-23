import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

interface PeerConnection {
  peerId: string;
  connection: RTCPeerConnection;
  audioLevel: number;
}

interface UseSpaceAudioProps {
  spaceId: string;
  isMuted: boolean;
  isHost: boolean;
  isSpeaker: boolean;
}

interface AudioLevels {
  [peerId: string]: number;
}

export const useSpaceAudio = ({ spaceId, isMuted, isHost, isSpeaker }: UseSpaceAudioProps) => {
  const { user } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [audioLevels, setAudioLevels] = useState<AudioLevels>({});
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  
  const peersRef = useRef<Map<string, PeerConnection>>(new Map());
  const localStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyzersRef = useRef<Map<string, AnalyserNode>>(new Map());
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // ICE servers configuration
  const iceServers: RTCConfiguration = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
    ],
  };

  // Initialize audio context
  const initAudioContext = useCallback(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext();
    }
    return audioContextRef.current;
  }, []);

  // Create audio analyzer for speaking indicators
  const createAnalyzer = useCallback((stream: MediaStream, peerId: string) => {
    const audioContext = initAudioContext();
    const source = audioContext.createMediaStreamSource(stream);
    const analyzer = audioContext.createAnalyser();
    analyzer.fftSize = 256;
    analyzer.smoothingTimeConstant = 0.8;
    source.connect(analyzer);
    analyzersRef.current.set(peerId, analyzer);
    return analyzer;
  }, [initAudioContext]);

  // Monitor audio levels for speaking indicators
  const monitorAudioLevels = useCallback(() => {
    const levels: AudioLevels = {};
    
    analyzersRef.current.forEach((analyzer, peerId) => {
      const dataArray = new Uint8Array(analyzer.frequencyBinCount);
      analyzer.getByteFrequencyData(dataArray);
      const average = dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length;
      levels[peerId] = Math.min(100, average * 1.5); // Normalize to 0-100
    });

    setAudioLevels(levels);
    animationFrameRef.current = requestAnimationFrame(monitorAudioLevels);
  }, []);

  // Get local audio stream
  const getLocalStream = useCallback(async () => {
    if (localStreamRef.current) {
      return localStreamRef.current;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 48000,
        },
        video: false,
      });

      localStreamRef.current = stream;
      setLocalStream(stream);

      // Create analyzer for local audio
      if (user) {
        createAnalyzer(stream, user.id);
      }

      return stream;
    } catch (error) {
      console.error('Error accessing microphone:', error);
      toast.error('Could not access microphone. Please check permissions.');
      throw error;
    }
  }, [user, createAnalyzer]);

  // Create peer connection
  const createPeerConnection = useCallback(async (peerId: string, initiator: boolean) => {
    if (!user) return null;

    console.log(`Creating peer connection with ${peerId}, initiator: ${initiator}`);
    
    const peerConnection = new RTCPeerConnection(iceServers);
    
    // Add local stream tracks
    if (localStreamRef.current && (isHost || isSpeaker)) {
      localStreamRef.current.getTracks().forEach(track => {
        peerConnection.addTrack(track, localStreamRef.current!);
      });
    }

    // Handle incoming tracks
    peerConnection.ontrack = (event) => {
      console.log(`Received track from ${peerId}`);
      const remoteStream = event.streams[0];
      
      // Create audio element to play the stream
      const audio = new Audio();
      audio.srcObject = remoteStream;
      audio.autoplay = true;
      audio.id = `audio-${peerId}`;
      document.body.appendChild(audio);

      // Create analyzer for remote audio
      createAnalyzer(remoteStream, peerId);
    };

    // Handle ICE candidates
    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        console.log(`Sending ICE candidate to ${peerId}`);
        channelRef.current?.send({
          type: 'broadcast',
          event: 'ice-candidate',
          payload: {
            from: user.id,
            to: peerId,
            candidate: event.candidate,
          },
        });
      }
    };

    // Handle connection state changes
    peerConnection.onconnectionstatechange = () => {
      console.log(`Connection state with ${peerId}: ${peerConnection.connectionState}`);
      if (peerConnection.connectionState === 'connected') {
        setIsConnected(true);
      } else if (peerConnection.connectionState === 'failed' || peerConnection.connectionState === 'disconnected') {
        // Attempt to reconnect
        handlePeerDisconnect(peerId);
      }
    };

    // Store peer connection
    peersRef.current.set(peerId, {
      peerId,
      connection: peerConnection,
      audioLevel: 0,
    });

    // If initiator, create and send offer
    if (initiator) {
      try {
        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);
        
        channelRef.current?.send({
          type: 'broadcast',
          event: 'offer',
          payload: {
            from: user.id,
            to: peerId,
            sdp: offer,
          },
        });
      } catch (error) {
        console.error('Error creating offer:', error);
      }
    }

    return peerConnection;
  }, [user, isHost, isSpeaker, createAnalyzer]);

  // Handle peer disconnect
  const handlePeerDisconnect = useCallback((peerId: string) => {
    const peer = peersRef.current.get(peerId);
    if (peer) {
      peer.connection.close();
      peersRef.current.delete(peerId);
      analyzersRef.current.delete(peerId);
      
      // Remove audio element
      const audioElement = document.getElementById(`audio-${peerId}`);
      if (audioElement) {
        audioElement.remove();
      }
    }
  }, []);

  // Handle incoming offer
  const handleOffer = useCallback(async (from: string, sdp: RTCSessionDescriptionInit) => {
    if (!user || from === user.id) return;

    console.log(`Received offer from ${from}`);
    
    let peerConnection = peersRef.current.get(from)?.connection;
    if (!peerConnection) {
      peerConnection = await createPeerConnection(from, false);
    }
    
    if (!peerConnection) return;

    try {
      await peerConnection.setRemoteDescription(new RTCSessionDescription(sdp));
      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);
      
      channelRef.current?.send({
        type: 'broadcast',
        event: 'answer',
        payload: {
          from: user.id,
          to: from,
          sdp: answer,
        },
      });
    } catch (error) {
      console.error('Error handling offer:', error);
    }
  }, [user, createPeerConnection]);

  // Handle incoming answer
  const handleAnswer = useCallback(async (from: string, sdp: RTCSessionDescriptionInit) => {
    if (!user || from === user.id) return;

    console.log(`Received answer from ${from}`);
    
    const peerConnection = peersRef.current.get(from)?.connection;
    if (!peerConnection) return;

    try {
      await peerConnection.setRemoteDescription(new RTCSessionDescription(sdp));
    } catch (error) {
      console.error('Error handling answer:', error);
    }
  }, [user]);

  // Handle incoming ICE candidate
  const handleIceCandidate = useCallback(async (from: string, candidate: RTCIceCandidateInit) => {
    if (!user || from === user.id) return;

    const peerConnection = peersRef.current.get(from)?.connection;
    if (!peerConnection) return;

    try {
      await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (error) {
      console.error('Error adding ICE candidate:', error);
    }
  }, [user]);

  // Connect to space audio
  const connect = useCallback(async () => {
    if (!user || isConnecting) return;
    
    setIsConnecting(true);
    console.log('Connecting to space audio...');

    try {
      // Get local stream if we're a host or speaker
      if (isHost || isSpeaker) {
        await getLocalStream();
      }

      // Subscribe to signaling channel
      const channel = supabase.channel(`space-audio-${spaceId}`, {
        config: {
          broadcast: { self: false },
          presence: { key: user.id },
        },
      });

      channel
        .on('broadcast', { event: 'offer' }, ({ payload }) => {
          if (payload.to === user.id) {
            handleOffer(payload.from, payload.sdp);
          }
        })
        .on('broadcast', { event: 'answer' }, ({ payload }) => {
          if (payload.to === user.id) {
            handleAnswer(payload.from, payload.sdp);
          }
        })
        .on('broadcast', { event: 'ice-candidate' }, ({ payload }) => {
          if (payload.to === user.id) {
            handleIceCandidate(payload.from, payload.candidate);
          }
        })
        .on('presence', { event: 'join' }, async ({ key, newPresences }) => {
          // When a new peer joins, initiate connection if we're host/speaker
          if ((isHost || isSpeaker) && key !== user.id) {
            console.log(`New peer joined: ${key}`);
            await createPeerConnection(key, true);
          }
        })
        .on('presence', { event: 'leave' }, ({ key }) => {
          handlePeerDisconnect(key);
        });

      await channel.subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ user_id: user.id, role: isHost ? 'host' : isSpeaker ? 'speaker' : 'listener' });
          setIsConnected(true);
          setIsConnecting(false);
          
          // Start monitoring audio levels
          monitorAudioLevels();
        }
      });

      channelRef.current = channel;

    } catch (error) {
      console.error('Error connecting to space audio:', error);
      setIsConnecting(false);
      toast.error('Failed to connect to audio');
    }
  }, [user, spaceId, isHost, isSpeaker, isConnecting, getLocalStream, handleOffer, handleAnswer, handleIceCandidate, createPeerConnection, handlePeerDisconnect, monitorAudioLevels]);

  // Disconnect from space audio
  const disconnect = useCallback(() => {
    console.log('Disconnecting from space audio...');
    
    // Stop monitoring
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }

    // Close all peer connections
    peersRef.current.forEach((peer, peerId) => {
      peer.connection.close();
      const audioElement = document.getElementById(`audio-${peerId}`);
      if (audioElement) {
        audioElement.remove();
      }
    });
    peersRef.current.clear();
    analyzersRef.current.clear();

    // Stop local stream
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
      setLocalStream(null);
    }

    // Close audio context
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    // Unsubscribe from channel
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    setIsConnected(false);
  }, []);

  // Toggle mute
  useEffect(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach(track => {
        track.enabled = !isMuted;
      });
    }
  }, [isMuted]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    isConnected,
    isConnecting,
    audioLevels,
    localStream,
    connect,
    disconnect,
  };
};
