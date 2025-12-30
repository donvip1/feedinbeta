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

  // Derived: can this user broadcast?
  const getCanBroadcast = useCallback(() => {
    const role = roleRef.current;
    return role === 'host' || role === 'co_host' || role === 'speaker';
  }, []);

  // Get local audio stream
  const getLocalStream = useCallback(async () => {
    const canBroadcast = getCanBroadcast();
    console.log('[SpaceContext-SFU] getLocalStream called, canBroadcast:', canBroadcast, 'role:', roleRef.current);
    
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

      // Set initial mute state
      stream.getAudioTracks().forEach(track => {
        track.enabled = !spaceState.isMuted;
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
  const connectAudio = useCallback(async () => {
    if (!user || !spaceInfoRef.current || isConnectingRef.current) {
      console.log('[SpaceContext-SFU] Cannot connect - no user/space or already connecting');
      return;
    }
    
    isConnectingRef.current = true;
    setSpaceState(prev => ({ ...prev, connectionStatus: 'connecting' }));
    
    const canBroadcast = getCanBroadcast();
    const isHost = roleRef.current === 'host' || roleRef.current === 'co_host';
    
    console.log(`[SpaceContext-SFU] Connecting to space audio... role: ${roleRef.current}, canBroadcast: ${canBroadcast}`);

    try {
      // Initialize the room manager with callbacks
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

      // If we can broadcast, start broadcasting
      if (canBroadcast) {
        const stream = await getLocalStream();
        if (stream) {
          const broadcastResult = await spaceRoomManager.startBroadcasting(stream);
          if (!broadcastResult) {
            console.warn('[SpaceContext-SFU] Failed to start broadcasting');
          }
        }
      } else {
        // We're a listener - subscribe to all active speakers
        await spaceRoomManager.subscribeToAllSpeakers();
      }

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
            role: roleRef.current,
            canBroadcast,
          });
        }
      });

      presenceChannelRef.current = presenceChannel;
      
      setSpaceState(prev => ({ ...prev, connectionStatus: 'connected' }));
      isConnectingRef.current = false;

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

  const updateRole = useCallback((role: string) => {
    console.log('[SpaceContext-SFU] Updating role to:', role);
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
