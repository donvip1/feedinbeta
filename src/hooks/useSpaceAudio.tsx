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

  // Handle peer disconnect - MUST be defined before createPeerConnection
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

  // Attempt to reconnect - MUST be defined before createPeerConnection
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
      console.log(`[SpaceAudio] Reconnection attempt ${reconnectAttempts.current}`);
    }
  }, []);

  // Send offer to a specific peer
  const sendOfferToPeer = useCallback(async (peerConnection: RTCPeerConnection, peerId: string) => {
    if (!user) return;
    
    try {
      console.log(`[SpaceAudio] Creating and sending offer to ${peerId}`);
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
      console.log(`[SpaceAudio] Offer sent to ${peerId}`);
    } catch (error) {
      console.error('[SpaceAudio] Error creating offer:', error);
    }
  }, [user]);

  // Create peer connection
  const createPeerConnection = useCallback(async (peerId: string, initiator: boolean, forceSendOffer: boolean = false) => {
    if (!user) return null;

    // Check if we already have a connection to this peer
    const existingPeer = peersRef.current.get(peerId);
    if (existingPeer) {
      console.log(`[SpaceAudio] Already have connection to ${peerId}, state: ${existingPeer.connection.connectionState}`);
      
      // If we need to resend offer and we're broadcaster, do it
      if (forceSendOffer && canBroadcast && existingPeer.connection.signalingState === 'stable') {
        console.log(`[SpaceAudio] Re-sending offer to ${peerId}`);
        await sendOfferToPeer(existingPeer.connection, peerId);
      }
      return existingPeer.connection;
    }

    console.log(`[SpaceAudio] Creating peer connection with ${peerId}, initiator: ${initiator}, canBroadcast: ${canBroadcast}`);
    
    const peerConnection = new RTCPeerConnection(iceServers);
    
    // Add local stream tracks ONLY if we can broadcast
    if (localStreamRef.current && canBroadcast) {
      console.log(`[SpaceAudio] Adding local tracks to connection for ${peerId}`);
      localStreamRef.current.getTracks().forEach(track => {
        peerConnection.addTrack(track, localStreamRef.current!);
      });
    } else if (!canBroadcast) {
      // For listeners, add a transceiver to receive audio
      console.log(`[SpaceAudio] Adding recvonly transceiver for listener`);
      peerConnection.addTransceiver('audio', { direction: 'recvonly' });
    }

    // Handle incoming tracks (everyone needs this to receive audio)
    peerConnection.ontrack = (event) => {
      console.log(`[SpaceAudio] ✅ Received audio track from ${peerId}`, event.streams);
      const remoteStream = event.streams[0];
      
      if (remoteStream) {
        // Create audio element to play the stream
        const existingAudio = document.getElementById(`audio-${peerId}`) as HTMLAudioElement;
        if (existingAudio) {
          existingAudio.remove();
        }
        
        const audio = new Audio();
        audio.srcObject = remoteStream;
        audio.autoplay = true;
        audio.id = `audio-${peerId}`;
        audio.volume = 1.0;
        
        // Important: Set these for iOS compatibility
        (audio as any).playsInline = true;
        
        document.body.appendChild(audio);
        
        // Play audio with proper error handling
        const playPromise = audio.play();
        if (playPromise) {
          playPromise.then(() => {
            console.log(`[SpaceAudio] ✅ Audio playing from ${peerId}`);
          }).catch(err => {
            console.warn('[SpaceAudio] Audio autoplay blocked:', err);
            // Create a click handler to enable audio
            const enableAudio = () => {
              audio.play().catch(console.error);
              document.removeEventListener('click', enableAudio);
            };
            document.addEventListener('click', enableAudio);
          });
        }

        // Create analyzer for remote audio
        createAnalyzer(remoteStream, peerId);
      }
    };

    // Handle ICE candidates
    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        console.log(`[SpaceAudio] Sending ICE candidate to ${peerId}`);
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

    // Handle ICE connection state
    peerConnection.oniceconnectionstatechange = () => {
      console.log(`[SpaceAudio] ICE state with ${peerId}: ${peerConnection.iceConnectionState}`);
    };

    // Handle connection state changes
    peerConnection.onconnectionstatechange = () => {
      console.log(`[SpaceAudio] Connection state with ${peerId}: ${peerConnection.connectionState}`);
      if (peerConnection.connectionState === 'connected') {
        console.log(`[SpaceAudio] ✅ Connected to ${peerId}`);
        setConnectionStatus('connected');
        reconnectAttempts.current = 0;
      } else if (peerConnection.connectionState === 'failed') {
        console.log(`[SpaceAudio] ❌ Connection failed with ${peerId}`);
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
      await sendOfferToPeer(peerConnection, peerId);
    }

    return peerConnection;
  }, [user, canBroadcast, createAnalyzer, sendOfferToPeer, handlePeerDisconnect, attemptReconnect]);

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
    console.log(`[SpaceAudio] Connecting to space audio... canBroadcast: ${canBroadcast}, isHost: ${isHost}, isSpeaker: ${isSpeaker}`);

    try {
      // Get local stream ONLY if we can broadcast (host/speaker)
      if (canBroadcast) {
        const stream = await getLocalStream();
        console.log(`[SpaceAudio] Got local stream:`, stream ? 'yes' : 'no');
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
            console.log(`[SpaceAudio] Received offer from ${payload.from}`);
            handleOffer(payload.from, payload.sdp);
          }
        })
        .on('broadcast', { event: 'answer' }, ({ payload }) => {
          if (payload.to === user.id) {
            console.log(`[SpaceAudio] Received answer from ${payload.from}`);
            handleAnswer(payload.from, payload.sdp);
          }
        })
        .on('broadcast', { event: 'ice-candidate' }, ({ payload }) => {
          if (payload.to === user.id) {
            handleIceCandidate(payload.from, payload.candidate);
          }
        })
        .on('broadcast', { event: 'broadcaster-joined' }, async ({ payload }) => {
          // A broadcaster joined - if we're a listener, request them to send us an offer
          if (!canBroadcast && payload.userId !== user.id) {
            console.log(`[SpaceAudio] Broadcaster ${payload.userId} joined, requesting audio connection`);
            // Request the broadcaster to send us an offer
            channel.send({
              type: 'broadcast',
              event: 'listener-needs-audio',
              payload: { listenerId: user.id }
            });
          }
        })
        .on('broadcast', { event: 'listener-needs-audio' }, async ({ payload }) => {
          // A listener is requesting audio - send them an offer
          if (canBroadcast && payload.listenerId !== user.id) {
            console.log(`[SpaceAudio] Listener ${payload.listenerId} requesting audio, sending offer`);
            await createPeerConnection(payload.listenerId, true, true);
          }
        })
        .on('presence', { event: 'join' }, async ({ key, newPresences }) => {
          // When a new peer joins
          if (key !== user.id) {
            console.log(`[SpaceAudio] New peer joined: ${key}`, newPresences);
            // Hosts/speakers initiate connection to new joiners
            if (canBroadcast) {
              console.log(`[SpaceAudio] I'm a broadcaster, sending offer to new joiner ${key}`);
              // Small delay to let them set up their connection
              setTimeout(async () => {
                await createPeerConnection(key, true);
              }, 500);
            }
          }
        })
        .on('presence', { event: 'leave' }, ({ key }) => {
          console.log(`[SpaceAudio] Peer left: ${key}`);
          handlePeerDisconnect(key);
        })
        .on('presence', { event: 'sync' }, async () => {
          // Handle initial sync - connect to all existing peers
          const state = channel.presenceState();
          const peerIds = Object.keys(state).filter(k => k !== user.id);
          console.log(`[SpaceAudio] Presence sync, found ${peerIds.length} peers:`, peerIds);
          
          for (const key of peerIds) {
            const presence = state[key][0] as any;
            console.log(`[SpaceAudio] Peer ${key}: role=${presence?.role}, canBroadcast=${presence?.canBroadcast}`);
            
            // If we can broadcast, send offers to everyone (including listeners)
            if (canBroadcast) {
              console.log(`[SpaceAudio] Sending offer to ${key} as broadcaster`);
              await createPeerConnection(key, true);
            } 
            // If we're a listener and they can broadcast, request audio from them
            else if (presence?.canBroadcast) {
              console.log(`[SpaceAudio] Requesting audio from broadcaster ${key}`);
              // Request them to send us an offer
              channel.send({
                type: 'broadcast',
                event: 'listener-needs-audio',
                payload: { listenerId: user.id }
              });
            }
          }
        });

      await channel.subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          console.log(`[SpaceAudio] ✅ Subscribed to channel as ${isHost ? 'host' : isSpeaker ? 'speaker' : 'listener'}, canBroadcast: ${canBroadcast}`);
          
          await channel.track({ 
            user_id: user.id, 
            role: isHost ? 'host' : isSpeaker ? 'speaker' : 'listener',
            canBroadcast 
          });
          
          // If we're a broadcaster, announce ourselves so listeners can prepare
          if (canBroadcast) {
            console.log(`[SpaceAudio] Broadcasting presence as host/speaker`);
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
      console.error('[SpaceAudio] Error connecting to space audio:', error);
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
