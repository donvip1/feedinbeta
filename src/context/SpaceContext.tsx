import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AuthContext } from '@/context/AuthContext';
import { toast } from 'sonner';
import { audioPlaybackManager } from '@/lib/audio-playback-manager';
import { backgroundServiceManager } from '@/lib/background-service-manager';
import { getFriendlyError, isTemporaryError } from '@/lib/error-messages';
import {
  Room,
  RoomEvent,
  Track,
  RemoteTrack,
  RemoteParticipant,
  LocalAudioTrack,
  createLocalAudioTrack,
  ConnectionState,
  AudioPresets,
  DisconnectReason,
} from 'livekit-client';

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
  connectAudio: (overrideRole?: string) => Promise<void>;
  disconnectAudio: () => void;
  startListenerBroadcast: () => Promise<boolean | undefined>;
  localStream: MediaStream | null;
  room: Room | null;
  screenShareStream: MediaStream | null;
  isRemoteScreenSharing: boolean;
  screenShareDismissed: boolean;
  publishScreenShare: (stream: MediaStream) => Promise<void>;
  unpublishScreenShare: () => Promise<void>;
  dismissScreenShare: () => void;
  undismissScreenShare: () => void;
  screenSharerIdentity: string | null;
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

export const SpaceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const authContext = useContext(AuthContext);
  const user = authContext?.user ?? null;
  const [spaceState, setSpaceState] = useState<SpaceState>(defaultState);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [screenShareStream, setScreenShareStream] = useState<MediaStream | null>(null);
  const [isRemoteScreenSharing, setIsRemoteScreenSharing] = useState(false);
  const [roomReady, setRoomReady] = useState<Room | null>(null);
  const [screenShareDismissed, setScreenShareDismissed] = useState(false);
  const [screenSharerIdentity, setScreenSharerIdentity] = useState<string | null>(null);
  
  // Refs for state management
  const roomRef = useRef<Room | null>(null);
  const localTrackRef = useRef<LocalAudioTrack | null>(null);
  const audioElementsRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  const audioLevelIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const roleRef = useRef<string>('listener');
  const spaceInfoRef = useRef<SpaceInfo | null>(null);
  const isConnectingRef = useRef(false);
  const presenceChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const userRef = useRef(user);
  
  // Keep user ref in sync
  useEffect(() => {
    userRef.current = user;
  }, [user]);

  // Keep refs in sync with state
  useEffect(() => {
    roleRef.current = spaceState.myRole;
  }, [spaceState.myRole]);

  useEffect(() => {
    spaceInfoRef.current = spaceState.spaceInfo;
  }, [spaceState.spaceInfo]);

  // Play remote audio track
  const playRemoteAudio = useCallback((track: RemoteTrack, participantId: string) => {
    // Remove existing audio element if any
    const existingEl = audioElementsRef.current.get(participantId);
    if (existingEl) {
      existingEl.remove();
      audioElementsRef.current.delete(participantId);
    }

    const audioEl = document.createElement('audio');
    audioEl.id = `space-lk-audio-${participantId}`;
    audioEl.autoplay = true;
    audioEl.setAttribute('playsinline', 'true');
    
    track.attach(audioEl);
    document.body.appendChild(audioEl);
    audioElementsRef.current.set(participantId, audioEl);

    // Try to play
    audioEl.play().catch((err) => {
      console.warn('[SpaceContext-LK] Audio autoplay blocked:', err);
      audioPlaybackManager.enableAudioPlayback();
    });

    console.log(`[SpaceContext-LK] ✅ Playing audio from ${participantId}`);
  }, []);

  // Remove remote audio element
  const removeRemoteAudio = useCallback((participantId: string) => {
    const audioEl = audioElementsRef.current.get(participantId);
    if (audioEl) {
      audioEl.pause();
      audioEl.srcObject = null;
      audioEl.remove();
      audioElementsRef.current.delete(participantId);
    }
  }, []);

  // Monitor audio levels from LiveKit
  const startAudioLevelMonitoring = useCallback(() => {
    if (audioLevelIntervalRef.current) return;

    audioLevelIntervalRef.current = setInterval(() => {
      const room = roomRef.current;
      if (!room) return;

      const levels: AudioLevels = {};

      // Local participant audio level
      if (room.localParticipant && localTrackRef.current) {
        const localLevel = room.localParticipant.audioLevel || 0;
        levels[room.localParticipant.identity] = localLevel * 100;
      }

      // Remote participants audio levels
      room.remoteParticipants.forEach((participant) => {
        levels[participant.identity] = (participant.audioLevel || 0) * 100;
      });

      setSpaceState(prev => ({ ...prev, audioLevels: levels }));
    }, 100);
  }, []);

  const stopAudioLevelMonitoring = useCallback(() => {
    if (audioLevelIntervalRef.current) {
      clearInterval(audioLevelIntervalRef.current);
      audioLevelIntervalRef.current = null;
    }
  }, []);

  // Connect to space audio using LiveKit
  const connectAudio = useCallback(async (overrideRole?: string) => {
    const currentUser = userRef.current;
    if (!currentUser || !spaceInfoRef.current) {
      console.log('[SpaceContext-LK] Cannot connect - no user or space', { user: !!currentUser, space: !!spaceInfoRef.current });
      return;
    }
    
    if (isConnectingRef.current) {
      console.log('[SpaceContext-LK] Already connecting, skipping...');
      return;
    }

    // Check if already connected
    if (roomRef.current?.state === ConnectionState.Connected) {
      console.log('[SpaceContext-LK] Already connected to room');
      return;
    }
    
    isConnectingRef.current = true;
    setSpaceState(prev => ({ ...prev, connectionStatus: 'connecting' }));
    
    // Use override role if provided (to handle race conditions)
    const effectiveRole = overrideRole || roleRef.current;
    const canBroadcast = effectiveRole === 'host' || effectiveRole === 'co_host' || effectiveRole === 'speaker';
    const isHost = effectiveRole === 'host' || effectiveRole === 'co_host';

    // Get display name from profile
    let displayName = 'Listener';
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('display_name, username')
        .eq('id', currentUser.id)
        .single();
      displayName = profile?.display_name || profile?.username || 'Listener';
    } catch (e) {
      console.warn('[SpaceContext-LK] Could not fetch profile for display name');
    }
    
    console.log(`[SpaceContext-LK] Connecting to space audio...`, {
      role: effectiveRole,
      canBroadcast,
      isHost,
      userId: currentUser.id,
      spaceId: spaceInfoRef.current.id,
    });

    try {
      // Get token from livekit-token edge function
      const { data, error } = await supabase.functions.invoke('livekit-token', {
        body: {
          roomName: `space-${spaceInfoRef.current.id}`,
          participantName: displayName,
          participantIdentity: currentUser.id,
          isHost,
        },
      });

      if (error || !data?.token) {
        throw new Error(data?.error || 'Failed to get LiveKit token');
      }

      console.log('[SpaceContext-LK] Token received, connecting to room...');

      const room = new Room({
        adaptiveStream: true,
        dynacast: true,
        publishDefaults: {
          audioPreset: AudioPresets.speech,
        },
      });

      roomRef.current = room;

      // Handle connection state changes
      room.on(RoomEvent.ConnectionStateChanged, (state) => {
        console.log('[SpaceContext-LK] Connection state:', state);
        if (state === ConnectionState.Connected) {
          setSpaceState(prev => ({ ...prev, connectionStatus: 'connected' }));
        } else if (state === ConnectionState.Reconnecting) {
          setSpaceState(prev => ({ ...prev, connectionStatus: 'reconnecting' }));
        } else if (state === ConnectionState.Disconnected) {
          setSpaceState(prev => ({ ...prev, connectionStatus: 'disconnected' }));
        }
      });

      // Handle incoming tracks - audio AND video (screen share)
      room.on(RoomEvent.TrackSubscribed, (track: RemoteTrack, publication, participant: RemoteParticipant) => {
        console.log(`[SpaceContext-LK] 🎧 Track subscribed from ${participant.identity}:`, track.kind);
        
        if (track.kind === Track.Kind.Audio) {
          playRemoteAudio(track, participant.identity);
        } else if (track.kind === Track.Kind.Video) {
          // Remote screen share received
          console.log(`[SpaceContext-LK] 🖥️ Video track (screen share) from ${participant.identity}`);
          const mediaStream = new MediaStream([track.mediaStreamTrack]);
          setScreenShareStream(mediaStream);
          setIsRemoteScreenSharing(true);
          setScreenShareDismissed(false);
          setScreenSharerIdentity(participant.identity);
        }
      });

      room.on(RoomEvent.TrackUnsubscribed, (track: RemoteTrack, publication, participant: RemoteParticipant) => {
        console.log(`[SpaceContext-LK] Track unsubscribed from ${participant.identity}`);
        if (track.kind === Track.Kind.Audio) {
          removeRemoteAudio(participant.identity);
        } else if (track.kind === Track.Kind.Video) {
          console.log(`[SpaceContext-LK] 🖥️ Screen share ended from ${participant.identity}`);
          setScreenShareStream(null);
          setIsRemoteScreenSharing(false);
          setScreenShareDismissed(false);
          setScreenSharerIdentity(null);
        }
      });

      // Handle participant events
      room.on(RoomEvent.ParticipantConnected, (participant: RemoteParticipant) => {
        console.log(`[SpaceContext-LK] 👋 Participant joined: ${participant.identity}`);
      });

      room.on(RoomEvent.ParticipantDisconnected, (participant: RemoteParticipant) => {
        console.log(`[SpaceContext-LK] 👋 Participant left: ${participant.identity}`);
        removeRemoteAudio(participant.identity);
      });

      // Handle active speakers for visual indicators
      room.on(RoomEvent.ActiveSpeakersChanged, (speakers) => {
        // This is called frequently - no need to log every time
      });

      // Handle disconnection
      room.on(RoomEvent.Disconnected, (reason?: DisconnectReason) => {
        console.log('[SpaceContext-LK] Disconnected, reason:', reason);
        if (reason === DisconnectReason.DUPLICATE_IDENTITY) {
          toast.error('Connected from another device');
        } else if (reason === DisconnectReason.CLIENT_INITIATED) {
          // User intentionally left - no message needed
        } else {
          // Show friendly reconnecting message
          toast('Reconnecting to space...', { description: 'Please wait a moment' });
        }
      });

      // Connect to the room
      await room.connect(data.url, data.token);
      roomRef.current = room;
      setRoomReady(room);

      console.log('[SpaceContext-LK] ✅ Connected to room, participants:', room.remoteParticipants.size);

      // Subscribe to any existing tracks (audio AND video/screen share)
      room.remoteParticipants.forEach((participant) => {
        participant.audioTrackPublications.forEach((publication) => {
          if (publication.track && publication.isSubscribed) {
            console.log(`[SpaceContext-LK] Attaching existing audio track from ${participant.identity}`);
            playRemoteAudio(publication.track as RemoteTrack, participant.identity);
          }
        });
        participant.videoTrackPublications.forEach((publication) => {
          if (publication.track && publication.isSubscribed) {
            console.log(`[SpaceContext-LK] 🖥️ Attaching existing video track (screen share) from ${participant.identity}`);
            const mediaStream = new MediaStream([publication.track.mediaStreamTrack]);
            setScreenShareStream(mediaStream);
            setIsRemoteScreenSharing(true);
            setScreenShareDismissed(false);
            setScreenSharerIdentity(participant.identity);
          }
        });
      });

      // If we can broadcast (host/speaker), start publishing audio
      if (canBroadcast) {
        console.log('[SpaceContext-LK] 🎤 Starting broadcast as', effectiveRole);
        try {
          const localTrack = await createLocalAudioTrack({
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            sampleRate: 48000,
          });

          localTrackRef.current = localTrack;

          // Apply initial mute state - hosts start unmuted
          if (effectiveRole !== 'host') {
            await localTrack.mute();
          }

          // Publish to room
          await room.localParticipant.publishTrack(localTrack);
          console.log('[SpaceContext-LK] ✅ Broadcasting started');

          // Store the stream for reference
          const stream = new MediaStream([localTrack.mediaStreamTrack]);
          setLocalStream(stream);

        } catch (micError: any) {
          console.error('[SpaceContext-LK] Failed to get microphone:', micError);
          const friendly = getFriendlyError(micError.message || micError.name || 'microphone');
          toast.error(friendly.title, { description: friendly.description });
          // Continue - user can still listen even without mic
        }
      }

      // Start monitoring audio levels
      startAudioLevelMonitoring();

      // Set up presence channel for coordination
      const presenceChannel = supabase.channel(`space-presence-${spaceInfoRef.current.id}`, {
        config: {
          presence: { key: currentUser.id },
        },
      });

      presenceChannel
        .on('presence', { event: 'join' }, ({ key, newPresences }) => {
          if (key !== currentUser.id) {
            console.log(`[SpaceContext-LK] 👋 Peer joined presence: ${key}`);
          }
        })
        .on('presence', { event: 'leave' }, ({ key }) => {
          console.log(`[SpaceContext-LK] 👋 Peer left presence: ${key}`);
        })
        .on('presence', { event: 'sync' }, () => {
          const state = presenceChannel.presenceState();
          const peerCount = Object.keys(state).length;
          console.log(`[SpaceContext-LK] 🔄 Presence sync, ${peerCount} peers online`);
        });

      await presenceChannel.subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await presenceChannel.track({
            user_id: currentUser.id,
            role: effectiveRole,
            canBroadcast,
          });
        }
      });

      presenceChannelRef.current = presenceChannel;
      
      setSpaceState(prev => ({ ...prev, connectionStatus: 'connected' }));
      isConnectingRef.current = false;
      console.log('[SpaceContext-LK] ✅ Audio connection complete');

    } catch (error: any) {
      console.error('[SpaceContext-LK] Error connecting to audio:', error);
      setSpaceState(prev => ({ ...prev, connectionStatus: 'failed' }));
      isConnectingRef.current = false;
      
      // Show user-friendly error message
      const friendly = getFriendlyError(error?.message || 'connection');
      if (isTemporaryError(error?.message || '')) {
        toast(friendly.title, { description: friendly.description });
      } else {
        toast.error(friendly.title, { description: friendly.description });
      }
    }
  }, [playRemoteAudio, removeRemoteAudio, startAudioLevelMonitoring]);

  // Disconnect from space audio
  const disconnectAudio = useCallback(async () => {
    console.log('[SpaceContext-LK] Disconnecting from space audio...');
    
    stopAudioLevelMonitoring();

    // Stop local track
    if (localTrackRef.current) {
      localTrackRef.current.stop();
      localTrackRef.current = null;
    }

    // Disconnect room
    if (roomRef.current) {
      roomRef.current.disconnect();
      roomRef.current = null;
      setRoomReady(null);
    }

    // Remove all audio elements
    audioElementsRef.current.forEach((el) => {
      el.remove();
    });
    audioElementsRef.current.clear();

    // Cleanup presence channel
    if (presenceChannelRef.current) {
      supabase.removeChannel(presenceChannelRef.current);
      presenceChannelRef.current = null;
    }

    setLocalStream(null);
    isConnectingRef.current = false;
    setSpaceState(prev => ({ ...prev, connectionStatus: 'disconnected', audioLevels: {} }));
  }, [stopAudioLevelMonitoring]);

  // Join a space - just set state, don't connect audio yet
  const joinSpace = useCallback(async (spaceInfo: SpaceInfo, role: string) => {
    console.log('[SpaceContext-LK] Joining space:', spaceInfo.id, 'as', role);
    roleRef.current = role;
    spaceInfoRef.current = spaceInfo;
    
    // Start background service for this space
    await backgroundServiceManager.startService(
      spaceInfo.id,
      'live_space',
      spaceInfo.title,
      []
    );
    
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
    console.log('[SpaceContext-LK] Leaving space explicitly');
    const currentUser = userRef.current;
    const spaceId = spaceInfoRef.current?.id;
    
    if (spaceInfoRef.current && currentUser) {
      await supabase
        .from('live_space_speakers')
        .update({ left_at: new Date().toISOString() })
        .eq('space_id', spaceInfoRef.current.id)
        .eq('user_id', currentUser.id);
    }
    
    // Stop background service
    if (spaceId) {
      await backgroundServiceManager.stopService(spaceId);
    }
    
    // Cleanup audio
    await disconnectAudio();
    
    // Use centralized audio manager cleanup
    audioPlaybackManager.cleanup();
    
    // Remove any remaining audio elements
    document.querySelectorAll('[id^="audio-"], [id^="sfu-audio-"], [id^="space-audio-"], [id^="space-lk-audio-"]').forEach(el => el.remove());
    
    roleRef.current = 'listener';
    spaceInfoRef.current = null;
    setSpaceState(defaultState);
  }, [disconnectAudio]);

  const minimizeSpace = useCallback(() => {
    console.log('[SpaceContext-LK] Minimizing space - audio continues in background');
    setSpaceState(prev => ({
      ...prev,
      isMinimized: true,
    }));
  }, []);

  const maximizeSpace = useCallback(() => {
    console.log('[SpaceContext-LK] Maximizing space');
    setSpaceState(prev => ({
      ...prev,
      isMinimized: false,
    }));
  }, []);

  const setMuted = useCallback((muted: boolean) => {
    console.log('[SpaceContext-LK] Setting muted:', muted);
    setSpaceState(prev => ({
      ...prev,
      isMuted: muted,
    }));
    
    // Toggle local track mute
    if (localTrackRef.current) {
      if (muted) {
        localTrackRef.current.mute();
      } else {
        localTrackRef.current.unmute();
      }
    }
  }, []);

  const setConnectionStatus = useCallback((status: ConnectionStatus) => {
    setSpaceState(prev => ({
      ...prev,
      connectionStatus: status,
    }));
  }, []);

  const updateRole = useCallback(async (role: string) => {
    console.log('[SpaceContext-LK] Updating role to:', role);
    const previousRole = roleRef.current;
    roleRef.current = role;
    setSpaceState(prev => ({
      ...prev,
      myRole: role as SpaceState['myRole'],
    }));

    // If promoted to speaker/co_host, start broadcasting
    const canNowBroadcast = role === 'host' || role === 'co_host' || role === 'speaker';
    const couldBroadcast = previousRole === 'host' || previousRole === 'co_host' || previousRole === 'speaker';

    if (canNowBroadcast && !couldBroadcast && spaceInfoRef.current && roomRef.current) {
      console.log('[SpaceContext-LK] Role upgraded to broadcaster, starting audio...');
      try {
        const localTrack = await createLocalAudioTrack({
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        });

        localTrackRef.current = localTrack;
        await roomRef.current.localParticipant.publishTrack(localTrack);
        
        const stream = new MediaStream([localTrack.mediaStreamTrack]);
        setLocalStream(stream);
        
        console.log('[SpaceContext-LK] ✅ Started broadcasting after role upgrade');
      } catch (error) {
        console.error('[SpaceContext-LK] Failed to start broadcasting:', error);
      }
    }
  }, []);

  // Start broadcasting for a listener with permission
  const startListenerBroadcast = useCallback(async () => {
    const currentUser = userRef.current;
    if (!spaceInfoRef.current || !currentUser) return false;
    
    console.log('[SpaceContext-LK] Starting listener broadcast with permission...');

    const room = roomRef.current;
    if (!room || room.state !== ConnectionState.Connected) {
      console.log('[SpaceContext-LK] Not connected to room, cannot broadcast');
      return false;
    }
    
    try {
      const localTrack = await createLocalAudioTrack({
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        sampleRate: 48000,
      });

      localTrackRef.current = localTrack;
      await room.localParticipant.publishTrack(localTrack);
      
      const stream = new MediaStream([localTrack.mediaStreamTrack]);
      setLocalStream(stream);

      console.log('[SpaceContext-LK] ✅ Listener started broadcasting');
      return true;
    } catch (error: any) {
      console.error('[SpaceContext-LK] Failed to start listener broadcast:', error);
      if (error.name === 'NotAllowedError') {
        toast.error('Microphone access denied');
      }
      return false;
    }
  }, []);

  // Handle beforeunload - cleanup on browser close
  useEffect(() => {
    const handleBeforeUnload = () => {
      const currentUser = userRef.current;
      if (spaceState.isActive && spaceInfoRef.current && currentUser) {
        // Send a beacon to mark user as left
        const url = `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/live_space_speakers?space_id=eq.${spaceInfoRef.current.id}&user_id=eq.${currentUser.id}`;
        
        navigator.sendBeacon(
          url,
          new Blob([JSON.stringify({ left_at: new Date().toISOString() })], { type: 'application/json' })
        );
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [spaceState.isActive]);

  // Handle visibility change - keep connection alive when app is minimized
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        console.log('[SpaceContext-LK] App hidden - maintaining connection');
      } else if (document.visibilityState === 'visible') {
        console.log('[SpaceContext-LK] App visible - checking connection');
        if (spaceState.isActive && spaceState.connectionStatus !== 'connected') {
          console.log('[SpaceContext-LK] Reconnecting after visibility change...');
          connectAudio(roleRef.current);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    const handleFocus = () => {
      if (spaceState.isActive && spaceState.connectionStatus !== 'connected' && spaceState.connectionStatus !== 'connecting') {
        console.log('[SpaceContext-LK] Page focused - reconnecting...');
        connectAudio(roleRef.current);
      }
    };
    
    window.addEventListener('focus', handleFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, [spaceState.isActive, spaceState.connectionStatus, connectAudio]);

  // Auto-reconnect on connection failure with exponential backoff
  useEffect(() => {
    let reconnectTimer: NodeJS.Timeout | null = null;
    let reconnectAttempts = 0;
    const maxReconnectAttempts = 10;
    const baseDelay = 2000;

    if (spaceState.isActive && spaceState.connectionStatus === 'failed') {
      const attemptReconnect = () => {
        if (reconnectAttempts >= maxReconnectAttempts) {
          console.log('[SpaceContext-LK] Max reconnect attempts reached');
          toast.error('Connection failed. Please rejoin the space.');
          return;
        }

        reconnectAttempts++;
        const delay = Math.min(baseDelay * Math.pow(1.5, reconnectAttempts - 1), 30000);
        
        console.log(`[SpaceContext-LK] Scheduling reconnect attempt ${reconnectAttempts} in ${delay}ms`);
        setSpaceState(prev => ({ ...prev, connectionStatus: 'reconnecting' }));
        
        reconnectTimer = setTimeout(async () => {
          if (!spaceState.isActive) return;
          
          console.log(`[SpaceContext-LK] Reconnect attempt ${reconnectAttempts}...`);
          try {
            await connectAudio(roleRef.current);
            reconnectAttempts = 0;
          } catch (error) {
            console.error('[SpaceContext-LK] Reconnect failed:', error);
            attemptReconnect();
          }
        }, delay);
      };

      attemptReconnect();
    }

    // Handle network online/offline events
    const handleOnline = () => {
      console.log('[SpaceContext-LK] Network online - attempting reconnect');
      if (spaceState.isActive && spaceState.connectionStatus !== 'connected' && spaceState.connectionStatus !== 'connecting') {
        toast.info('Network restored. Reconnecting...');
        reconnectAttempts = 0;
        connectAudio(roleRef.current);
      }
    };

    const handleOffline = () => {
      console.log('[SpaceContext-LK] Network offline');
      if (spaceState.isActive) {
        toast.warning('Network disconnected. Will reconnect when online.');
        setSpaceState(prev => ({ ...prev, connectionStatus: 'failed' }));
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      if (reconnectTimer) clearTimeout(reconnectTimer);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [spaceState.isActive, spaceState.connectionStatus, connectAudio]);

  // Publish screen share to LiveKit room
  const publishScreenShare = useCallback(async (stream: MediaStream) => {
    const room = roomRef.current;
    if (!room || room.state !== ConnectionState.Connected) {
      console.error('[SpaceContext-LK] Cannot publish screen share - not connected, state:', room?.state);
      throw new Error('Not connected to room');
    }

    try {
      const videoTrack = stream.getVideoTracks()[0];
      const audioTrack = stream.getAudioTracks()[0];
      if (!videoTrack) throw new Error('No video track in screen share stream');

      console.log('[SpaceContext-LK] 🖥️ Publishing screen share tracks (raw MediaStreamTrack)...');
      
      // Publish raw MediaStreamTrack directly — LiveKit SDK handles wrapping internally
      await room.localParticipant.publishTrack(videoTrack, {
        name: 'screen-share',
        source: Track.Source.ScreenShare,
      });

      // Also publish screen share audio if available
      if (audioTrack) {
        await room.localParticipant.publishTrack(audioTrack, {
          name: 'screen-share-audio',
          source: Track.Source.ScreenShareAudio,
        });
      }

      setScreenShareStream(stream);
      console.log('[SpaceContext-LK] ✅ Screen share published');
    } catch (error) {
      console.error('[SpaceContext-LK] Failed to publish screen share:', error);
      throw error;
    }
  }, []);

  // Unpublish screen share from LiveKit room
  const unpublishScreenShare = useCallback(async () => {
    const room = roomRef.current;
    if (!room) return;

    try {
      // Find and unpublish ALL screen share tracks (video + audio)
      const publications = Array.from(room.localParticipant.trackPublications.values());
      for (const pub of publications) {
        if (
          pub.source === Track.Source.ScreenShare ||
          pub.source === Track.Source.ScreenShareAudio ||
          pub.trackName === 'screen-share' ||
          pub.trackName === 'screen-share-audio'
        ) {
          if (pub.track) {
            room.localParticipant.unpublishTrack(pub.track);
            pub.track.stop();
          }
          console.log('[SpaceContext-LK] 🖥️ Screen share track unpublished:', pub.trackName);
        }
      }
      setScreenShareStream(null);
      setIsRemoteScreenSharing(false);
      setScreenShareDismissed(false);
      setScreenSharerIdentity(null);
    } catch (error) {
      console.error('[SpaceContext-LK] Failed to unpublish screen share:', error);
    }
  }, []);

  // Dismiss remote screen share (listener choice)
  const dismissScreenShare = useCallback(() => {
    setScreenShareDismissed(true);
  }, []);

  // Undismiss - show screen share again
  const undismissScreenShare = useCallback(() => {
    setScreenShareDismissed(false);
  }, []);

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
        startListenerBroadcast,
        localStream,
        room: roomReady,
        screenShareStream,
        isRemoteScreenSharing,
        screenShareDismissed,
        publishScreenShare,
        unpublishScreenShare,
        dismissScreenShare,
        undismissScreenShare,
        screenSharerIdentity,
      }}
    >
      {children}
    </SpaceContext.Provider>
  );
};
