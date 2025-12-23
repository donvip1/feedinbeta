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
  isListener?: boolean;
}

interface AudioLevels {
  [peerId: string]: number;
}

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'failed' | 'reconnecting';

export const useSpaceAudio = ({ spaceId, isMuted, isHost, isSpeaker, isListener = false }: UseSpaceAudioProps) => {
  const { user } = useAuth();
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const [audioLevels, setAudioLevels] = useState<AudioLevels>({});
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  
  const peersRef = useRef<Map<string, PeerConnection>>(new Map());
  const localStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyzersRef = useRef<Map<string, AnalyserNode>>(new Map());
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;

  // Derived states for backward compatibility
  const isConnected = connectionStatus === 'connected';
  const isConnecting = connectionStatus === 'connecting' || connectionStatus === 'reconnecting';

  // Can this user broadcast audio?
  const canBroadcast = isHost || isSpeaker;
  
  // Log role changes
  console.log(`[SpaceAudio] Role check - isHost: ${isHost}, isSpeaker: ${isSpeaker}, canBroadcast: ${canBroadcast}`);

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
    try {
      const audioContext = initAudioContext();
      const source = audioContext.createMediaStreamSource(stream);
      const analyzer = audioContext.createAnalyser();
      analyzer.fftSize = 256;
      analyzer.smoothingTimeConstant = 0.8;
      source.connect(analyzer);
      analyzersRef.current.set(peerId, analyzer);
      return analyzer;
    } catch (error) {
      console.error('Error creating audio analyzer:', error);
      return null;
    }
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

  // Get local audio stream (only for hosts/speakers)
  const getLocalStream = useCallback(async () => {
    if (localStreamRef.current) {
      return localStreamRef.current;
    }

    if (!canBroadcast) {
      return null; // Listeners don't need a local stream
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
      return null;
    }
  }, [user, createAnalyzer, canBroadcast]);

  // Create peer connection
  const createPeerConnection = useCallback(async (peerId: string, initiator: boolean) => {
    if (!user) return null;

    // Check if we already have a connection to this peer
    if (peersRef.current.has(peerId)) {
      console.log(`Already connected to ${peerId}`);
      return peersRef.current.get(peerId)?.connection || null;
    }

    console.log(`Creating peer connection with ${peerId}, initiator: ${initiator}, canBroadcast: ${canBroadcast}`);
    
    const peerConnection = new RTCPeerConnection(iceServers);
    
    // Add local stream tracks ONLY if we can broadcast
    if (localStreamRef.current && canBroadcast) {
      localStreamRef.current.getTracks().forEach(track => {
        peerConnection.addTrack(track, localStreamRef.current!);
      });
    } else if (!canBroadcast) {
      // For listeners, add a transceiver to receive audio
      peerConnection.addTransceiver('audio', { direction: 'recvonly' });
    }

    // Handle incoming tracks (everyone needs this to receive audio)
    peerConnection.ontrack = (event) => {
      console.log(`Received track from ${peerId}`, event.streams);
      const remoteStream = event.streams[0];
      
      if (remoteStream) {
        // Create audio element to play the stream
        const existingAudio = document.getElementById(`audio-${peerId}`);
        if (existingAudio) {
          existingAudio.remove();
        }
        
        const audio = new Audio();
        audio.srcObject = remoteStream;
        audio.autoplay = true;
        audio.id = `audio-${peerId}`;
        audio.volume = 1.0;
        document.body.appendChild(audio);
        
        // Play audio (handle autoplay policy)
        audio.play().catch(err => {
          console.warn('Audio autoplay blocked, waiting for user interaction:', err);
        });

        // Create analyzer for remote audio
        createAnalyzer(remoteStream, peerId);
      }
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
        setConnectionStatus('connected');
        reconnectAttempts.current = 0;
      } else if (peerConnection.connectionState === 'failed') {
        handlePeerDisconnect(peerId);
        attemptReconnect();
      } else if (peerConnection.connectionState === 'disconnected') {
        // Don't immediately disconnect, might reconnect
        setTimeout(() => {
          if (peerConnection.connectionState === 'disconnected') {
            handlePeerDisconnect(peerId);
          }
        }, 3000);
      }
    };

    // Store peer connection
    peersRef.current.set(peerId, {
      peerId,
      connection: peerConnection,
      audioLevel: 0,
    });

    // If initiator and can broadcast, create and send offer
    if (initiator && canBroadcast) {
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
  }, [user, canBroadcast, createAnalyzer]);

  // Attempt to reconnect
  const attemptReconnect = useCallback(async () => {
    if (reconnectAttempts.current >= maxReconnectAttempts) {
      setConnectionStatus('failed');
      toast.error('Failed to connect to audio. Please try rejoining.');
      return;
    }

    reconnectAttempts.current++;
    setConnectionStatus('reconnecting');
    
    // Wait with exponential backoff
    await new Promise(resolve => setTimeout(resolve, Math.min(1000 * Math.pow(2, reconnectAttempts.current), 10000)));
    
    // Try to reconnect
    if (channelRef.current) {
      console.log(`Reconnection attempt ${reconnectAttempts.current}`);
      // Reconnection handled by channel
    }
  }, []);

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

  // Connect to space audio - NOW ALL USERS CAN CONNECT (not just speakers)
  const connect = useCallback(async () => {
    if (!user || connectionStatus === 'connecting') return;
    
    setConnectionStatus('connecting');
    console.log(`Connecting to space audio... canBroadcast: ${canBroadcast}`);

    try {
      // Get local stream ONLY if we can broadcast (host/speaker)
      if (canBroadcast) {
        await getLocalStream();
      }

      // Subscribe to signaling channel - ALL users connect to receive audio
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
          if (payload.to === user.id) {            handleAnswer(payload.from, payload.sdp);
          }
        })
        .on('broadcast', { event: 'ice-candidate' }, ({ payload }) => {
          if (payload.to === user.id) {
            handleIceCandidate(payload.from, payload.candidate);
          }
        })
        .on('broadcast', { event: 'broadcaster-joined' }, async ({ payload }) => {
          // A broadcaster joined - if we're a listener, prepare to receive
          if (!canBroadcast && payload.userId !== user.id) {
            console.log(`Broadcaster ${payload.userId} joined, preparing to receive audio`);
            // The broadcaster will send us an offer, but create the connection placeholder
            if (!peersRef.current.has(payload.userId)) {
              await createPeerConnection(payload.userId, false);
            }
          }
        })
        .on('presence', { event: 'join' }, async ({ key, newPresences }) => {
          // When a new peer joins
          if (key !== user.id) {
            console.log(`New peer joined: ${key}`, newPresences);
            // Hosts/speakers initiate connection to new joiners
            if (canBroadcast) {
              await createPeerConnection(key, true);
            }
          }
        })
        .on('presence', { event: 'leave' }, ({ key }) => {
          handlePeerDisconnect(key);
        })
        .on('presence', { event: 'sync' }, async () => {
          // Handle initial sync - connect to all existing peers
          const state = channel.presenceState();
          console.log('Presence sync, state:', Object.keys(state));
          
          for (const key of Object.keys(state)) {
            if (key !== user.id && !peersRef.current.has(key)) {
              const presence = state[key][0] as any;
              console.log(`Found peer ${key}, role: ${presence?.role}, canBroadcast: ${presence?.canBroadcast}`);
              
              // If we can broadcast, send offers to everyone (including listeners)
              if (canBroadcast) {
                console.log(`Sending offer to ${key} as broadcaster`);
                await createPeerConnection(key, true);
              } 
              // If we're a listener and they can broadcast, wait for their offer
              else if (presence?.canBroadcast) {
                console.log(`Waiting for offer from broadcaster ${key}`);
                // Create connection but don't initiate - wait for their offer
                await createPeerConnection(key, false);
              }
            }
          }
        });

      await channel.subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          console.log(`Subscribed to channel as ${isHost ? 'host' : isSpeaker ? 'speaker' : 'listener'}, canBroadcast: ${canBroadcast}`);
          
          await channel.track({ 
            user_id: user.id, 
            role: isHost ? 'host' : isSpeaker ? 'speaker' : 'listener',
            canBroadcast 
          });
          
          // If we're a broadcaster, announce ourselves so listeners can prepare
          if (canBroadcast) {
            channel.send({
              type: 'broadcast',
              event: 'broadcaster-joined',
              payload: { userId: user.id }
            });
          }
          
          setConnectionStatus('connected');
          
          // Start monitoring audio levels
          monitorAudioLevels();
        }
      });

      channelRef.current = channel;

    } catch (error) {
      console.error('Error connecting to space audio:', error);
      setConnectionStatus('failed');
      toast.error('Failed to connect to audio');
    }
  }, [user, spaceId, canBroadcast, isHost, isSpeaker, connectionStatus, getLocalStream, handleOffer, handleAnswer, handleIceCandidate, createPeerConnection, handlePeerDisconnect, monitorAudioLevels]);

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

    setConnectionStatus('disconnected');
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
    connectionStatus,
    audioLevels,
    localStream,
    connect,
    disconnect,
  };
};
