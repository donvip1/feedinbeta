import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { spaceRoomManager } from '@/lib/space-room-manager';

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
  const { user } = useAuth();
  const [spaceState, setSpaceState] = useState<SpaceState>(defaultState);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  
  // Refs for state management
  const localStreamRef = useRef<MediaStream | null>(null);
  const roleRef = useRef<string>('listener');
  const spaceInfoRef = useRef<SpaceInfo | null>(null);
  const isConnectingRef = useRef(false);
  const presenceChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Keep refs in sync with state
  useEffect(() => {
    roleRef.current = spaceState.myRole;
  }, [spaceState.myRole]);

  useEffect(() => {
    spaceInfoRef.current = spaceState.spaceInfo;
  }, [spaceState.spaceInfo]);

  // Derived: can this user broadcast? (includes listeners with permission)
  const getCanBroadcast = useCallback((overrideRole?: string) => {
    const role = overrideRole || roleRef.current;
    // Listeners can broadcast if they have mic permission (handled separately)
    return role === 'host' || role === 'co_host' || role === 'speaker' || role === 'listener_with_mic';
  }, []);

  // Get local audio stream
  const getLocalStream = useCallback(async (overrideRole?: string) => {
    const canBroadcast = getCanBroadcast(overrideRole);
    console.log('[SpaceContext-SFU] getLocalStream called, canBroadcast:', canBroadcast, 'role:', overrideRole || roleRef.current);
    
    if (localStreamRef.current) {
      console.log('[SpaceContext-SFU] Using existing local stream');
      return localStreamRef.current;
    }

    if (!canBroadcast) {
      console.log('[SpaceContext-SFU] Listener mode - no local stream needed');
      return null;
    }

    try {
      console.log('[SpaceContext-SFU] Requesting microphone access...');
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 48000,
        },
        video: false,
      });

      console.log('[SpaceContext-SFU] ✅ Got microphone access, tracks:', stream.getAudioTracks().length);
      localStreamRef.current = stream;
      setLocalStream(stream);

      // Set initial mute state - hosts start unmuted
      const isMuted = overrideRole === 'host' ? false : spaceState.isMuted;
      stream.getAudioTracks().forEach(track => {
        track.enabled = !isMuted;
      });

      return stream;
    } catch (error: any) {
      console.error('[SpaceContext-SFU] ❌ Error accessing microphone:', error);
      if (error.name === 'NotAllowedError') {
        toast.error('Microphone access denied. Please allow microphone access.');
      } else if (error.name === 'NotFoundError') {
        toast.error('No microphone found. Please connect a microphone.');
      } else {
        toast.error('Could not access microphone.');
      }
      return null;
    }
  }, [getCanBroadcast, spaceState.isMuted]);

  // Connect to space audio using Cloudflare SFU
  const connectAudio = useCallback(async (overrideRole?: string) => {
    if (!user || !spaceInfoRef.current) {
      console.log('[SpaceContext-SFU] Cannot connect - no user or space');
      return;
    }
    
    if (isConnectingRef.current) {
      console.log('[SpaceContext-SFU] Already connecting, skipping...');
      return;
    }
    
    isConnectingRef.current = true;
    setSpaceState(prev => ({ ...prev, connectionStatus: 'connecting' }));
    
    // Use override role if provided (to handle race conditions)
    const effectiveRole = overrideRole || roleRef.current;
    const canBroadcast = effectiveRole === 'host' || effectiveRole === 'co_host' || effectiveRole === 'speaker';
    const isHost = effectiveRole === 'host' || effectiveRole === 'co_host';
    
    console.log(`[SpaceContext-SFU] Connecting to space audio...`, {
      role: effectiveRole,
      canBroadcast,
      isHost,
      userId: user.id,
      spaceId: spaceInfoRef.current.id,
    });

    try {
      // CRITICAL: Both hosts AND listeners need to initialize the room manager
      // Each participant gets their own SFU session to receive tracks from others
      const result = await spaceRoomManager.initialize(
        spaceInfoRef.current.id,
        user.id,
        isHost,
        // State change callback
        (state) => {
          console.log('[SpaceContext-SFU] Room state changed:', state);
        },
        // Audio levels callback
        (levels) => {
          setSpaceState(prev => ({ ...prev, audioLevels: levels }));
        },
        // Connection state callback
        (connectionState) => {
          console.log('[SpaceContext-SFU] Connection state:', connectionState);
          if (connectionState === 'connected') {
            setSpaceState(prev => ({ ...prev, connectionStatus: 'connected' }));
          } else if (connectionState === 'failed') {
            setSpaceState(prev => ({ ...prev, connectionStatus: 'failed' }));
          } else if (connectionState === 'connecting') {
            setSpaceState(prev => ({ ...prev, connectionStatus: 'connecting' }));
          }
        }
      );

      if (!result.success) {
        throw new Error(result.error || 'Failed to initialize room');
      }
      
      console.log('[SpaceContext-SFU] ✅ Room manager initialized with session:', result.sessionId?.slice(0, 8));

      // If we can broadcast (host/speaker), start broadcasting FIRST
      // This ensures our track is published before we try to subscribe to others
      if (canBroadcast) {
        console.log('[SpaceContext-SFU] 🎤 Starting broadcast as', effectiveRole);
        const stream = await getLocalStream(effectiveRole);
        if (stream) {
          const broadcastResult = await spaceRoomManager.startBroadcasting(stream);
          if (!broadcastResult) {
            console.warn('[SpaceContext-SFU] Failed to start broadcasting');
          } else {
            console.log('[SpaceContext-SFU] ✅ Broadcasting started successfully - no delay');
          }
        } else {
          console.warn('[SpaceContext-SFU] ⚠️ No stream obtained, cannot broadcast');
        }
      }
      
      // CRITICAL: ALWAYS subscribe to all speakers (for both hosts and listeners)
      // This ensures listeners hear the host, and hosts hear other speakers
      console.log('[SpaceContext-SFU] 🎧 Subscribing to all active speakers...');
      
      // Start subscription in background - don't block connection
      spaceRoomManager.subscribeToAllSpeakers().then(() => {
        console.log('[SpaceContext-SFU] ✅ Subscription to speakers complete');
      }).catch(err => {
        console.error('[SpaceContext-SFU] Error subscribing to speakers:', err);
      });

      // Set up presence channel for coordination (separate from SFU)
      const presenceChannel = supabase.channel(`space-presence-${spaceInfoRef.current.id}`, {
        config: {
          presence: { key: user.id },
        },
      });

      presenceChannel
        .on('presence', { event: 'join' }, ({ key, newPresences }) => {
          if (key !== user.id) {
            console.log(`[SpaceContext-SFU] 👋 Peer joined: ${key}`, newPresences);
          }
        })
        .on('presence', { event: 'leave' }, ({ key }) => {
          console.log(`[SpaceContext-SFU] 👋 Peer left: ${key}`);
        })
        .on('presence', { event: 'sync' }, () => {
          const state = presenceChannel.presenceState();
          const peerCount = Object.keys(state).length;
          console.log(`[SpaceContext-SFU] 🔄 Presence sync, ${peerCount} peers online`);
        });

      await presenceChannel.subscribe(async (status) => {
        console.log(`[SpaceContext-SFU] Presence channel status: ${status}`);
        if (status === 'SUBSCRIBED') {
          await presenceChannel.track({
            user_id: user.id,
            role: effectiveRole,
            canBroadcast,
          });
        }
      });

      presenceChannelRef.current = presenceChannel;
      
      setSpaceState(prev => ({ ...prev, connectionStatus: 'connected' }));
      isConnectingRef.current = false;
      console.log('[SpaceContext-SFU] ✅ Audio connection complete');

    } catch (error) {
      console.error('[SpaceContext-SFU] Error connecting to audio:', error);
      setSpaceState(prev => ({ ...prev, connectionStatus: 'failed' }));
      isConnectingRef.current = false;
      toast.error('Failed to connect to audio');
    }
  }, [user, getCanBroadcast, getLocalStream]);

  // Disconnect from space audio
  const disconnectAudio = useCallback(async () => {
    console.log('[SpaceContext-SFU] Disconnecting from space audio...');
    
    // Cleanup room manager (handles SFU cleanup internally)
    await spaceRoomManager.cleanup();

    // Stop local stream
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
      setLocalStream(null);
    }

    // Cleanup presence channel
    if (presenceChannelRef.current) {
      supabase.removeChannel(presenceChannelRef.current);
      presenceChannelRef.current = null;
    }

    isConnectingRef.current = false;
    setSpaceState(prev => ({ ...prev, connectionStatus: 'disconnected', audioLevels: {} }));
  }, []);

  // Join a space - just set state, don't connect audio yet
  const joinSpace = useCallback((spaceInfo: SpaceInfo, role: string) => {
    console.log('[SpaceContext-SFU] Joining space:', spaceInfo.id, 'as', role);
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
    console.log('[SpaceContext-SFU] Leaving space explicitly');
    
    if (spaceInfoRef.current && user) {
      await supabase
        .from('live_space_speakers')
        .update({ left_at: new Date().toISOString() })
        .eq('space_id', spaceInfoRef.current.id)
        .eq('user_id', user.id);
    }
    
    // Cleanup audio
    await disconnectAudio();
    
    // Remove any remaining audio elements
    document.querySelectorAll('[id^="audio-"], [id^="sfu-audio-"]').forEach(el => el.remove());
    
    roleRef.current = 'listener';
    spaceInfoRef.current = null;
    setSpaceState(defaultState);
  }, [user, disconnectAudio]);

  const minimizeSpace = useCallback(() => {
    console.log('[SpaceContext-SFU] Minimizing space - audio continues');
    setSpaceState(prev => ({
      ...prev,
      isMinimized: true,
    }));
  }, []);

  const maximizeSpace = useCallback(() => {
    console.log('[SpaceContext-SFU] Maximizing space');
    setSpaceState(prev => ({
      ...prev,
      isMinimized: false,
    }));
  }, []);

  const setMuted = useCallback((muted: boolean) => {
    console.log('[SpaceContext-SFU] Setting muted:', muted);
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

    // Also update room manager
    spaceRoomManager.setMuted(muted);
  }, []);

  const setConnectionStatus = useCallback((status: ConnectionStatus) => {
    setSpaceState(prev => ({
      ...prev,
      connectionStatus: status,
    }));
  }, []);

  const updateRole = useCallback(async (role: string) => {
    console.log('[SpaceContext-SFU] Updating role to:', role);
    const previousRole = roleRef.current;
    roleRef.current = role;
    setSpaceState(prev => ({
      ...prev,
      myRole: role as SpaceState['myRole'],
    }));

    // If promoted to speaker/co_host, start broadcasting
    const canNowBroadcast = role === 'host' || role === 'co_host' || role === 'speaker';
    const couldBroadcast = previousRole === 'host' || previousRole === 'co_host' || previousRole === 'speaker';

    if (canNowBroadcast && !couldBroadcast && spaceInfoRef.current) {
      console.log('[SpaceContext-SFU] Role upgraded to broadcaster, starting audio...');
      // Get microphone and start broadcasting
      const stream = await getLocalStream(role);
      if (stream) {
        const success = await spaceRoomManager.startBroadcasting(stream);
        if (success) {
          console.log('[SpaceContext-SFU] ✅ Started broadcasting after role upgrade');
        }
      }
    }
  }, [getLocalStream]);

  // Start broadcasting for a listener with permission
  const startListenerBroadcast = useCallback(async () => {
    if (!spaceInfoRef.current || !user) return false;
    
    console.log('[SpaceContext-SFU] Starting listener broadcast with permission...');
    
    // Check if we have a session - if not, we need to connect first
    const sessionId = spaceRoomManager.getSessionId?.();
    if (!sessionId) {
      console.log('[SpaceContext-SFU] No session found, initializing first...');
      // Re-initialize as a broadcasting user
      const result = await spaceRoomManager.initialize(
        spaceInfoRef.current.id,
        user.id,
        false,
        undefined,
        (levels) => setSpaceState(prev => ({ ...prev, audioLevels: levels })),
        undefined
      );
      if (!result.success) {
        console.error('[SpaceContext-SFU] Failed to initialize for listener broadcast');
        return false;
      }
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

      const success = await spaceRoomManager.startBroadcasting(stream);
      if (success) {
        console.log('[SpaceContext-SFU] ✅ Listener started broadcasting');
      }
      return success;
    } catch (error: any) {
      console.error('[SpaceContext-SFU] Failed to start listener broadcast:', error);
      if (error.name === 'NotAllowedError') {
        toast.error('Microphone access denied');
      }
      return false;
    }
  }, [user]);

  // Handle beforeunload - cleanup on browser close
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (spaceState.isActive && spaceInfoRef.current && user) {
        // Send a beacon to mark user as left
        const url = `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/live_space_speakers?space_id=eq.${spaceInfoRef.current.id}&user_id=eq.${user.id}`;
        
        navigator.sendBeacon(
          url,
          new Blob([JSON.stringify({ left_at: new Date().toISOString() })], { type: 'application/json' })
        );
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [spaceState.isActive, user]);

  // Handle visibility change - keep connection alive when app is minimized
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        // App is minimized or screen is off - keep connection alive
        console.log('[SpaceContext] App hidden - maintaining connection');
      } else if (document.visibilityState === 'visible') {
        // App is visible again - check and reconnect if needed
        console.log('[SpaceContext] App visible - checking connection');
        if (spaceState.isActive && spaceState.connectionStatus !== 'connected') {
          console.log('[SpaceContext] Reconnecting after visibility change...');
          connectAudio(roleRef.current);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // Also handle page focus
    const handleFocus = () => {
      if (spaceState.isActive && spaceState.connectionStatus !== 'connected' && spaceState.connectionStatus !== 'connecting') {
        console.log('[SpaceContext] Page focused - reconnecting...');
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
    const baseDelay = 2000; // Start with 2 seconds

    if (spaceState.isActive && spaceState.connectionStatus === 'failed') {
      const attemptReconnect = () => {
        if (reconnectAttempts >= maxReconnectAttempts) {
          console.log('[SpaceContext] Max reconnect attempts reached');
          toast.error('Connection failed. Please rejoin the space.');
          return;
        }

        reconnectAttempts++;
        const delay = Math.min(baseDelay * Math.pow(1.5, reconnectAttempts - 1), 30000); // Max 30s
        
        console.log(`[SpaceContext] Scheduling reconnect attempt ${reconnectAttempts} in ${delay}ms`);
        setSpaceState(prev => ({ ...prev, connectionStatus: 'reconnecting' }));
        
        reconnectTimer = setTimeout(async () => {
          if (!spaceState.isActive) return;
          
          console.log(`[SpaceContext] Reconnect attempt ${reconnectAttempts}...`);
          try {
            await connectAudio(roleRef.current);
            reconnectAttempts = 0; // Reset on success
          } catch (error) {
            console.error('[SpaceContext] Reconnect failed:', error);
            attemptReconnect(); // Try again
          }
        }, delay);
      };

      attemptReconnect();
    }

    // Handle network online/offline events
    const handleOnline = () => {
      console.log('[SpaceContext] Network online - attempting reconnect');
      if (spaceState.isActive && spaceState.connectionStatus !== 'connected' && spaceState.connectionStatus !== 'connecting') {
        toast.info('Network restored. Reconnecting...');
        reconnectAttempts = 0;
        connectAudio(roleRef.current);
      }
    };

    const handleOffline = () => {
      console.log('[SpaceContext] Network offline');
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
      }}
    >
      {children}
    </SpaceContext.Provider>
  );
};
