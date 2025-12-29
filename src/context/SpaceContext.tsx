import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

interface SpaceInfo {
  id: string;
  title: string;
  hostId: string;
  hostName: string;
  hostAvatar: string;
  startedAt: string;
}

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'failed' | 'reconnecting';

interface AudioLevels {
  [peerId: string]: number;
}

interface PeerConnection {
  peerId: string;
  connection: RTCPeerConnection;
  audioLevel: number;
}

interface SpaceState {
  isActive: boolean;
  isMinimized: boolean;
  spaceInfo: SpaceInfo | null;
  isMuted: boolean;
  myRole: 'host' | 'co_host' | 'speaker' | 'listener';
  connectionStatus: ConnectionStatus;
  audioLevels: AudioLevels;
}

interface SpaceContextType {
  spaceState: SpaceState;
  joinSpace: (spaceInfo: SpaceInfo, role: string) => void;
  leaveSpace: () => void;
  minimizeSpace: () => void;
  maximizeSpace: () => void;
  setMuted: (muted: boolean) => void;
  setConnectionStatus: (status: ConnectionStatus) => void;
  updateRole: (role: string) => void;
  connectAudio: () => Promise<void>;
  disconnectAudio: () => void;
  localStream: MediaStream | null;
}

const defaultState: SpaceState = {
  isActive: false,
  isMinimized: false,
  spaceInfo: null,
  isMuted: true,
  myRole: 'listener',
  connectionStatus: 'disconnected',
  audioLevels: {},
};

const SpaceContext = createContext<SpaceContextType | null>(null);

export const useSpaceContext = () => {
  const context = useContext(SpaceContext);
  if (!context) {
    throw new Error('useSpaceContext must be used within SpaceProvider');
  }
  return context;
};

export const useOptionalSpaceContext = () => {
  return useContext(SpaceContext);
};

// Default ICE servers (STUN only fallback)
const defaultIceServers: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
  ],
};

export const SpaceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [spaceState, setSpaceState] = useState<SpaceState>(defaultState);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  
  // Audio management refs - persist across navigation
  const peersRef = useRef<Map<string, PeerConnection>>(new Map());
  const localStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyzersRef = useRef<Map<string, AnalyserNode>>(new Map());
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;
  const isConnectingRef = useRef(false);
  const iceServersRef = useRef<RTCConfiguration>(defaultIceServers);
  const roleRef = useRef<string>('listener');
  const spaceInfoRef = useRef<SpaceInfo | null>(null);

  // Keep refs in sync with state
  useEffect(() => {
    roleRef.current = spaceState.myRole;
  }, [spaceState.myRole]);

  useEffect(() => {
    spaceInfoRef.current = spaceState.spaceInfo;
  }, [spaceState.spaceInfo]);

  // Fetch TURN credentials on mount
  useEffect(() => {
    const fetchTurnCredentials = async () => {
      try {
        console.log('[SpaceContext] Fetching TURN credentials...');
        const { data, error } = await supabase.functions.invoke('get-turn-credentials');
        
        if (error) throw error;
        
        if (data?.iceServers && Array.isArray(data.iceServers)) {
          console.log('[SpaceContext] Got TURN credentials:', data.iceServers.length, 'servers');
          iceServersRef.current = { iceServers: data.iceServers };
        }
      } catch (error) {
        console.warn('[SpaceContext] Failed to fetch TURN credentials, using STUN only:', error);
      }
    };
    
    fetchTurnCredentials();
  }, []);

  // Derived: can this user broadcast?
  const getCanBroadcast = useCallback(() => {
    const role = roleRef.current;
    return role === 'host' || role === 'co_host' || role === 'speaker';
  }, []);

  // Initialize audio context
  const initAudioContext = useCallback(() => {
    if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
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
      console.error('[SpaceContext] Error creating audio analyzer:', error);
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
      levels[peerId] = Math.min(100, average * 1.5);
    });

    setSpaceState(prev => ({ ...prev, audioLevels: levels }));
    animationFrameRef.current = requestAnimationFrame(monitorAudioLevels);
  }, []);

  // Get local audio stream
  const getLocalStream = useCallback(async () => {
    const canBroadcast = getCanBroadcast();
    console.log('[SpaceContext] getLocalStream called, canBroadcast:', canBroadcast, 'role:', roleRef.current);
    
    if (localStreamRef.current) {
      console.log('[SpaceContext] Using existing local stream');
      return localStreamRef.current;
    }

    if (!canBroadcast) {
      console.log('[SpaceContext] Listener mode - no local stream needed');
      return null;
    }

    try {
      console.log('[SpaceContext] Requesting microphone access...');
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 48000,
        },
        video: false,
      });

      console.log('[SpaceContext] ✅ Got microphone access, tracks:', stream.getAudioTracks().length);
      localStreamRef.current = stream;
      setLocalStream(stream);

      // Set initial mute state
      stream.getAudioTracks().forEach(track => {
        track.enabled = !spaceState.isMuted;
      });

      // Create analyzer for local audio
      if (user) {
        createAnalyzer(stream, user.id);
      }

      return stream;
    } catch (error: any) {
      console.error('[SpaceContext] ❌ Error accessing microphone:', error);
      if (error.name === 'NotAllowedError') {
        toast.error('Microphone access denied. Please allow microphone access.');
      } else if (error.name === 'NotFoundError') {
        toast.error('No microphone found. Please connect a microphone.');
      } else {
        toast.error('Could not access microphone.');
      }
      return null;
    }
  }, [user, createAnalyzer, spaceState.isMuted, getCanBroadcast]);

  // Handle peer disconnect
  const handlePeerDisconnect = useCallback((peerId: string) => {
    console.log('[SpaceContext] Disconnecting peer:', peerId);
    const peer = peersRef.current.get(peerId);
    if (peer) {
      peer.connection.close();
      peersRef.current.delete(peerId);
      analyzersRef.current.delete(peerId);
      
      const audioElement = document.getElementById(`audio-${peerId}`);
      if (audioElement) {
        audioElement.remove();
      }
    }
  }, []);

  // Send offer to a specific peer
  const sendOfferToPeer = useCallback(async (peerConnection: RTCPeerConnection, peerId: string) => {
    if (!user) return;
    
    try {
      console.log(`[SpaceContext] Creating and sending offer to ${peerId}`);
      const offer = await peerConnection.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: false,
      });
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
      console.log(`[SpaceContext] ✅ Offer sent to ${peerId}`);
    } catch (error) {
      console.error('[SpaceContext] Error creating offer:', error);
    }
  }, [user]);

  // Create peer connection
  const createPeerConnection = useCallback(async (peerId: string, initiator: boolean, forceSendOffer: boolean = false) => {
    if (!user || !spaceInfoRef.current) return null;

    const canBroadcast = getCanBroadcast();
    
    const existingPeer = peersRef.current.get(peerId);
    if (existingPeer) {
      console.log(`[SpaceContext] Already have connection to ${peerId}, state:`, existingPeer.connection.connectionState);
      if (forceSendOffer && canBroadcast && existingPeer.connection.signalingState === 'stable') {
        await sendOfferToPeer(existingPeer.connection, peerId);
      }
      return existingPeer.connection;
    }

    console.log(`[SpaceContext] Creating peer connection with ${peerId}, initiator: ${initiator}, canBroadcast: ${canBroadcast}`);
    
    const peerConnection = new RTCPeerConnection(iceServersRef.current);
    
    // Add local stream tracks ONLY if we can broadcast
    if (localStreamRef.current && canBroadcast) {
      console.log(`[SpaceContext] Adding ${localStreamRef.current.getTracks().length} local tracks to connection for ${peerId}`);
      localStreamRef.current.getTracks().forEach(track => {
        peerConnection.addTrack(track, localStreamRef.current!);
      });
    } else if (!canBroadcast) {
      console.log(`[SpaceContext] Adding recvonly transceiver for listener`);
      peerConnection.addTransceiver('audio', { direction: 'recvonly' });
    }

    // Handle incoming tracks
    peerConnection.ontrack = (event) => {
      console.log(`[SpaceContext] ✅ Received audio track from ${peerId}`, event.streams);
      const remoteStream = event.streams[0];
      
      if (remoteStream) {
        const existingAudio = document.getElementById(`audio-${peerId}`) as HTMLAudioElement;
        if (existingAudio) existingAudio.remove();
        
        const audio = document.createElement('audio') as HTMLAudioElement;
        audio.srcObject = remoteStream;
        audio.autoplay = true;
        audio.id = `audio-${peerId}`;
        audio.volume = 1.0;
        (audio as any).playsInline = true;
        audio.setAttribute('playsinline', 'true');
        
        document.body.appendChild(audio);
        
        const playAudio = async (retryCount = 0) => {
          try {
            await audio.play();
            console.log(`[SpaceContext] ✅ Audio playing from ${peerId}`);
          } catch (err: any) {
            console.warn('[SpaceContext] Audio autoplay blocked:', err);
            if (retryCount < 3) {
              setTimeout(() => playAudio(retryCount + 1), 1000);
            } else {
              const enableAudio = () => {
                audio.play().catch(console.error);
                document.removeEventListener('click', enableAudio);
                document.removeEventListener('touchstart', enableAudio);
              };
              document.addEventListener('click', enableAudio);
              document.addEventListener('touchstart', enableAudio);
              toast.info('Tap anywhere to enable audio');
            }
          }
        };
        
        playAudio();
        createAnalyzer(remoteStream, peerId);
      }
    };

    // Handle ICE candidates
    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        console.log(`[SpaceContext] Sending ICE candidate to ${peerId}`);
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
      console.log(`[SpaceContext] ICE state with ${peerId}: ${peerConnection.iceConnectionState}`);
      
      if (peerConnection.iceConnectionState === 'failed') {
        console.log(`[SpaceContext] ICE failed with ${peerId}, attempting restart...`);
        peerConnection.restartIce();
      }
    };

    // Handle connection state changes
    peerConnection.onconnectionstatechange = () => {
      console.log(`[SpaceContext] Connection state with ${peerId}: ${peerConnection.connectionState}`);
      if (peerConnection.connectionState === 'connected') {
        setSpaceState(prev => ({ ...prev, connectionStatus: 'connected' }));
        reconnectAttempts.current = 0;
      } else if (peerConnection.connectionState === 'failed') {
        handlePeerDisconnect(peerId);
      } else if (peerConnection.connectionState === 'disconnected') {
        // Give it time to recover before disconnecting
        setTimeout(() => {
          const peer = peersRef.current.get(peerId);
          if (peer && peer.connection.connectionState === 'disconnected') {
            handlePeerDisconnect(peerId);
          }
        }, 5000);
      }
    };

    peersRef.current.set(peerId, {
      peerId,
      connection: peerConnection,
      audioLevel: 0,
    });

    if (initiator && canBroadcast) {
      await sendOfferToPeer(peerConnection, peerId);
    }

    return peerConnection;
  }, [user, getCanBroadcast, createAnalyzer, sendOfferToPeer, handlePeerDisconnect]);

  // Handle incoming offer
  const handleOffer = useCallback(async (from: string, sdp: RTCSessionDescriptionInit) => {
    if (!user || from === user.id) return;

    console.log(`[SpaceContext] Received offer from ${from}`);
    
    let peerConnection = peersRef.current.get(from)?.connection;
    if (!peerConnection) {
      peerConnection = await createPeerConnection(from, false);
    }
    
    if (!peerConnection) return;

    try {
      // Handle glare (both sides sending offers)
      if (peerConnection.signalingState !== 'stable') {
        console.log(`[SpaceContext] Signaling state not stable (${peerConnection.signalingState}), rolling back...`);
        await Promise.all([
          peerConnection.setLocalDescription({ type: 'rollback' }),
          peerConnection.setRemoteDescription(new RTCSessionDescription(sdp))
        ]);
      } else {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(sdp));
      }
      
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
      console.log(`[SpaceContext] ✅ Answer sent to ${from}`);
    } catch (error) {
      console.error('[SpaceContext] Error handling offer:', error);
    }
  }, [user, createPeerConnection]);

  // Handle incoming answer
  const handleAnswer = useCallback(async (from: string, sdp: RTCSessionDescriptionInit) => {
    if (!user || from === user.id) return;

    console.log(`[SpaceContext] Received answer from ${from}`);
    const peerConnection = peersRef.current.get(from)?.connection;
    if (!peerConnection) return;

    try {
      if (peerConnection.signalingState === 'have-local-offer') {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(sdp));
        console.log(`[SpaceContext] ✅ Answer applied from ${from}`);
      } else {
        console.warn(`[SpaceContext] Ignoring answer - signaling state: ${peerConnection.signalingState}`);
      }
    } catch (error) {
      console.error('[SpaceContext] Error handling answer:', error);
    }
  }, [user]);

  // Handle incoming ICE candidate
  const handleIceCandidate = useCallback(async (from: string, candidate: RTCIceCandidateInit) => {
    if (!user || from === user.id) return;

    const peerConnection = peersRef.current.get(from)?.connection;
    if (!peerConnection) {
      console.warn(`[SpaceContext] No peer connection for ICE candidate from ${from}`);
      return;
    }

    try {
      await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (error) {
      console.error('[SpaceContext] Error adding ICE candidate:', error);
    }
  }, [user]);

  // Connect to space audio - GLOBAL function that persists
  const connectAudio = useCallback(async () => {
    if (!user || !spaceInfoRef.current || isConnectingRef.current) {
      console.log('[SpaceContext] Cannot connect - no user/space or already connecting');
      return;
    }
    
    // Check if already connected
    if (channelRef.current) {
      console.log('[SpaceContext] Already have a channel, skipping connect');
      return;
    }
    
    isConnectingRef.current = true;
    setSpaceState(prev => ({ ...prev, connectionStatus: 'connecting' }));
    
    const canBroadcast = getCanBroadcast();
    console.log(`[SpaceContext] Connecting to space audio... role: ${roleRef.current}, canBroadcast: ${canBroadcast}`);

    try {
      // Get local stream if broadcaster
      if (canBroadcast) {
        await getLocalStream();
      }

      const spaceId = spaceInfoRef.current.id;
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
        .on('broadcast', { event: 'broadcaster-joined' }, async ({ payload }) => {
          // A broadcaster joined - listeners should request audio
          const currentCanBroadcast = getCanBroadcast();
          if (!currentCanBroadcast && payload.userId !== user.id) {
            console.log(`[SpaceContext] 🎤 Broadcaster ${payload.userId} joined, requesting audio`);
            setTimeout(() => {
              channel.send({
                type: 'broadcast',
                event: 'listener-needs-audio',
                payload: { listenerId: user.id }
              });
            }, 500);
          }
        })
        .on('broadcast', { event: 'listener-needs-audio' }, async ({ payload }) => {
          // A listener needs audio - broadcasters should send offer
          const currentCanBroadcast = getCanBroadcast();
          if (currentCanBroadcast && payload.listenerId !== user.id) {
            console.log(`[SpaceContext] 👂 Listener ${payload.listenerId} requesting audio, sending offer...`);
            await createPeerConnection(payload.listenerId, true, true);
          }
        })
        .on('presence', { event: 'join' }, async ({ key, newPresences }) => {
          if (key !== user.id) {
            console.log(`[SpaceContext] 👋 Peer joined: ${key}`, newPresences);
            const currentCanBroadcast = getCanBroadcast();
            
            // If we're a broadcaster and new peer joined, send them an offer
            if (currentCanBroadcast) {
              setTimeout(async () => {
                await createPeerConnection(key, true);
              }, 1000);
            }
          }
        })
        .on('presence', { event: 'leave' }, ({ key }) => {
          console.log(`[SpaceContext] 👋 Peer left: ${key}`);
          handlePeerDisconnect(key);
        })
        .on('presence', { event: 'sync' }, async () => {
          const state = channel.presenceState();
          const peerIds = Object.keys(state).filter(k => k !== user.id);
          console.log(`[SpaceContext] 🔄 Presence sync, found ${peerIds.length} peers:`, peerIds);
          
          const currentCanBroadcast = getCanBroadcast();
          
          if (!currentCanBroadcast) {
            // I'm a listener - request audio from any broadcaster
            for (const key of peerIds) {
              const presences = state[key];
              if (presences && presences.length > 0) {
                const presence = presences[0] as any;
                if (presence?.canBroadcast) {
                  console.log(`[SpaceContext] Found broadcaster ${key}, requesting audio...`);
                  channel.send({
                    type: 'broadcast',
                    event: 'listener-needs-audio',
                    payload: { listenerId: user.id }
                  });
                  break;
                }
              }
            }
          } else {
            // I'm a broadcaster - send offers to all peers
            for (const key of peerIds) {
              await createPeerConnection(key, true);
            }
          }
        });

      await channel.subscribe(async (status) => {
        console.log(`[SpaceContext] Channel subscription status: ${status}`);
        
        if (status === 'SUBSCRIBED') {
          const currentCanBroadcast = getCanBroadcast();
          console.log(`[SpaceContext] ✅ Subscribed to audio channel, canBroadcast: ${currentCanBroadcast}`);
          
          // Track presence with our role info
          await channel.track({ 
            user_id: user.id, 
            role: roleRef.current,
            canBroadcast: currentCanBroadcast 
          });
          
          if (currentCanBroadcast) {
            // Notify others that a broadcaster joined
            channel.send({
              type: 'broadcast',
              event: 'broadcaster-joined',
              payload: { userId: user.id }
            });
            
            // Periodic heartbeat so late-joining listeners can discover us
            const heartbeatInterval = setInterval(() => {
              if (channelRef.current) {
                channel.send({
                  type: 'broadcast',
                  event: 'broadcaster-joined',
                  payload: { userId: user.id }
                });
              } else {
                clearInterval(heartbeatInterval);
              }
            }, 15000);
          } else {
            // I'm a listener - request audio after a short delay
            setTimeout(() => {
              channel.send({
                type: 'broadcast',
                event: 'listener-needs-audio',
                payload: { listenerId: user.id }
              });
            }, 1500);
          }
          
          setSpaceState(prev => ({ ...prev, connectionStatus: 'connected' }));
          monitorAudioLevels();
        } else if (status === 'CHANNEL_ERROR') {
          console.error('[SpaceContext] Channel error');
          setSpaceState(prev => ({ ...prev, connectionStatus: 'failed' }));
        }
      });

      channelRef.current = channel;
      isConnectingRef.current = false;

    } catch (error) {
      console.error('[SpaceContext] Error connecting to audio:', error);
      setSpaceState(prev => ({ ...prev, connectionStatus: 'failed' }));
      isConnectingRef.current = false;
      toast.error('Failed to connect to audio');
    }
  }, [user, getCanBroadcast, getLocalStream, handleOffer, handleAnswer, handleIceCandidate, createPeerConnection, handlePeerDisconnect, monitorAudioLevels]);

  // Disconnect from space audio
  const disconnectAudio = useCallback(() => {
    console.log('[SpaceContext] Disconnecting from space audio...');
    
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    peersRef.current.forEach((peer, peerId) => {
      peer.connection.close();
      const audioElement = document.getElementById(`audio-${peerId}`);
      if (audioElement) audioElement.remove();
    });
    peersRef.current.clear();
    analyzersRef.current.clear();

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
      setLocalStream(null);
    }

    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    isConnectingRef.current = false;
    setSpaceState(prev => ({ ...prev, connectionStatus: 'disconnected', audioLevels: {} }));
  }, []);

  // Join a space - just set state, don't connect audio yet
  const joinSpace = useCallback((spaceInfo: SpaceInfo, role: string) => {
    console.log('[SpaceContext] Joining space:', spaceInfo.id, 'as', role);
    roleRef.current = role;
    spaceInfoRef.current = spaceInfo;
    setSpaceState({
      isActive: true,
      isMinimized: false,
      spaceInfo,
      isMuted: role !== 'host',
      myRole: role as SpaceState['myRole'],
      connectionStatus: 'disconnected',
      audioLevels: {},
    });
  }, []);

  // Leave space - ONLY called on explicit user action
  const leaveSpace = useCallback(async () => {
    console.log('[SpaceContext] Leaving space explicitly');
    
    if (spaceInfoRef.current && user) {
      await supabase
        .from('live_space_speakers')
        .update({ left_at: new Date().toISOString() })
        .eq('space_id', spaceInfoRef.current.id)
        .eq('user_id', user.id);
    }
    
    // Cleanup audio
    disconnectAudio();
    
    // Remove any remaining audio elements
    document.querySelectorAll('[id^="audio-"]').forEach(el => el.remove());
    
    roleRef.current = 'listener';
    spaceInfoRef.current = null;
    setSpaceState(defaultState);
  }, [user, disconnectAudio]);

  const minimizeSpace = useCallback(() => {
    console.log('[SpaceContext] Minimizing space - audio continues');
    setSpaceState(prev => ({
      ...prev,
      isMinimized: true,
    }));
  }, []);

  const maximizeSpace = useCallback(() => {
    console.log('[SpaceContext] Maximizing space');
    setSpaceState(prev => ({
      ...prev,
      isMinimized: false,
    }));
  }, []);

  const setMuted = useCallback((muted: boolean) => {
    console.log('[SpaceContext] Setting muted:', muted);
    setSpaceState(prev => ({
      ...prev,
      isMuted: muted,
    }));
    
    // Toggle actual audio track
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach(track => {
        track.enabled = !muted;
      });
    }
  }, []);

  const setConnectionStatus = useCallback((status: ConnectionStatus) => {
    setSpaceState(prev => ({
      ...prev,
      connectionStatus: status,
    }));
  }, []);

  const updateRole = useCallback((role: string) => {
    console.log('[SpaceContext] Updating role to:', role);
    roleRef.current = role;
    setSpaceState(prev => ({
      ...prev,
      myRole: role as SpaceState['myRole'],
    }));
  }, []);

  // Handle beforeunload - cleanup on browser close
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (spaceState.isActive && spaceInfoRef.current && user) {
        // Send a beacon to mark user as left
        const url = `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/live_space_speakers?space_id=eq.${spaceInfoRef.current.id}&user_id=eq.${user.id}`;
        const headers = {
          'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal',
        };
        
        navigator.sendBeacon(
          url,
          new Blob([JSON.stringify({ left_at: new Date().toISOString() })], { type: 'application/json' })
        );
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [spaceState.isActive, user]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnectAudio();
    };
  }, [disconnectAudio]);

  return (
    <SpaceContext.Provider
      value={{
        spaceState,
        joinSpace,
        leaveSpace,
        minimizeSpace,
        maximizeSpace,
        setMuted,
        setConnectionStatus,
        updateRole,
        connectAudio,
        disconnectAudio,
        localStream,
      }}
    >
      {children}
    </SpaceContext.Provider>
  );
};
