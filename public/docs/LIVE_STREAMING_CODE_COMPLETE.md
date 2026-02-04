# FeedIn Live Streaming - Complete Code Documentation

## Table of Contents
1. [Page Components](#1-page-components)
2. [Context Providers](#2-context-providers)
3. [Core Components](#3-core-components)
4. [UI Components](#4-ui-components)
5. [Edge Functions](#5-edge-functions)

---

## 1. Page Components

### src/pages/Live.tsx
The main Live page that orchestrates video streams and audio spaces.

```tsx
import { useState, useEffect } from "react";
import { CreateLiveStreamModal } from "@/components/live/CreateLiveStreamModal";
import { CreateSpaceModal } from "@/components/live/CreateSpaceModal";
import { LiveKitViewer } from "@/components/live/LiveKitViewer";
import { LiveKitBroadcaster } from "@/components/live/LiveKitBroadcaster";
import { LiveSpaceRoom } from "@/components/live/LiveSpaceRoom";
import { LiveDashboard } from "@/components/live/LiveDashboard";
import { GoLiveModal } from "@/components/live/GoLiveModal";
import { SpaceContentManager } from "@/components/live/SpaceContentManager";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";

const Live = () => {
  const { user } = useAuth();
  const [createStreamModalOpen, setCreateStreamModalOpen] = useState(false);
  const [createSpaceModalOpen, setCreateSpaceModalOpen] = useState(false);
  const [selectedStreamId, setSelectedStreamId] = useState<string | null>(null);
  const [selectedSpaceId, setSelectedSpaceId] = useState<string | null>(null);
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [broadcastStreamId, setBroadcastStreamId] = useState<string | null>(null);
  const [showGoLiveModal, setShowGoLiveModal] = useState(false);
  const [showContentManager, setShowContentManager] = useState(false);

  // ===== VIDEO STREAMS QUERIES =====
  const { data: liveStreams, refetch: refetchLiveStreams, isLoading: loadingLiveStreams } = useQuery({
    queryKey: ["live-streams", "live"],
    queryFn: async () => {
      console.log('[Live] Fetching live video streams...');
      const { data, error } = await supabase
        .from("live_streams")
        .select("*")
        .eq("status", "live")
        .order("viewer_count", { ascending: false });
      
      if (error) throw error;
      
      console.log('[Live] Found live streams:', data?.length || 0);
      
      if (data && data.length > 0) {
        const userIds = [...new Set(data.map(s => s.user_id))];
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, display_name, username, avatar_url")
          .in("id", userIds);
        
        const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);
        return data.map(stream => ({
          ...stream,
          profiles: profileMap.get(stream.user_id)
        }));
      }
      return data || [];
    },
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    refetchInterval: 5000,
  });

  const { data: scheduledStreams } = useQuery({
    queryKey: ["live-streams", "scheduled"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("live_streams")
        .select("*")
        .eq("status", "scheduled")
        .order("scheduled_start", { ascending: true });
      
      if (error) throw error;
      
      if (data && data.length > 0) {
        const userIds = [...new Set(data.map(s => s.user_id))];
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, display_name, username, avatar_url")
          .in("id", userIds);
        
        const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);
        return data.map(stream => ({
          ...stream,
          profiles: profileMap.get(stream.user_id)
        }));
      }
      return data || [];
    },
  });

  const { data: myStreams, refetch: refetchMyStreams } = useQuery({
    queryKey: ["live-streams", "my-streams"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data, error } = await supabase
        .from("live_streams")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(10);
      
      if (error) throw error;
      
      if (data && data.length > 0) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("id, display_name, username, avatar_url")
          .eq("id", user.id)
          .single();
        
        return data.map(stream => ({
          ...stream,
          profiles: profile
        }));
      }
      return data || [];
    },
  });

  // ===== AUDIO SPACES QUERIES =====
  const { data: liveSpaces, refetch: refetchLiveSpaces, isLoading: loadingLiveSpaces } = useQuery({
    queryKey: ["live-spaces", "live"],
    queryFn: async () => {
      console.log('[Live] Fetching live spaces...');
      const { data, error } = await supabase
        .from("live_spaces")
        .select("*")
        .eq("status", "live")
        .order("viewer_count", { ascending: false });
      
      if (error) {
        console.error('[Live] Error fetching live spaces:', error);
        throw error;
      }
      
      console.log('[Live] Found live spaces:', data?.length || 0, data);
      
      if (data && data.length > 0) {
        const userIds = [...new Set(data.map(s => s.user_id))];
        const spaceIds = data.map(s => s.id);
        
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, display_name, username, avatar_url")
          .in("id", userIds);
        
        const { data: listenerCounts } = await supabase
          .from("live_space_speakers")
          .select("space_id")
          .in("space_id", spaceIds)
          .is("left_at", null);
        
        const countMap = new Map<string, number>();
        listenerCounts?.forEach(l => {
          countMap.set(l.space_id!, (countMap.get(l.space_id!) || 0) + 1);
        });
        
        const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);
        return data.map(space => ({
          ...space,
          active_listeners: countMap.get(space.id) || 0,
          profiles: profileMap.get(space.user_id)
        }));
      }
      return data || [];
    },
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    refetchInterval: 5000,
  });

  const { data: joinedSpaceIds } = useQuery({
    queryKey: ["joined-spaces", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase
        .from("live_space_speakers")
        .select("space_id")
        .eq("user_id", user.id)
        .is("left_at", null);
      return data?.map(s => s.space_id) || [];
    },
    enabled: !!user,
    staleTime: 0,
    refetchInterval: 5000,
  });

  const { data: scheduledSpaces } = useQuery({
    queryKey: ["live-spaces", "scheduled"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("live_spaces")
        .select("*")
        .eq("status", "scheduled")
        .order("scheduled_start", { ascending: true });
      
      if (error) throw error;
      
      if (data && data.length > 0) {
        const userIds = [...new Set(data.map(s => s.user_id))];
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, display_name, username, avatar_url")
          .in("id", userIds);
        
        const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);
        return data.map(space => ({
          ...space,
          profiles: profileMap.get(space.user_id)
        }));
      }
      return data || [];
    },
  });

  const { data: mySpaces, refetch: refetchMySpaces } = useQuery({
    queryKey: ["live-spaces", "my-spaces"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data, error } = await supabase
        .from("live_spaces")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(10);
      
      if (error) throw error;
      
      if (data && data.length > 0) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("id, display_name, username, avatar_url")
          .eq("id", user.id)
          .single();
        
        return data.map(space => ({
          ...space,
          profiles: profile
        }));
      }
      return data || [];
    },
  });

  // ===== REALTIME SUBSCRIPTIONS =====
  useEffect(() => {
    const streamsChannel = supabase
      .channel('live-streams-updates')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'live_streams',
      }, () => {
        refetchLiveStreams();
        refetchMyStreams();
      })
      .subscribe();

    const spacesChannel = supabase
      .channel('live-spaces-updates')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'live_spaces',
      }, () => {
        refetchLiveSpaces();
        refetchMySpaces();
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'live_space_speakers',
      }, () => {
        refetchLiveSpaces();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(streamsChannel);
      supabase.removeChannel(spacesChannel);
    };
  }, []);

  // ===== HANDLERS =====
  const handleStreamCreated = (streamId: string) => {
    setBroadcastStreamId(streamId);
    setIsBroadcasting(true);
    refetchMyStreams();
  };

  const handleSpaceCreated = (spaceId: string) => {
    setSelectedSpaceId(spaceId);
    refetchMySpaces();
  };

  const handleStreamClick = (stream: any) => {
    if (stream.user_id === user?.id && stream.status !== 'live') {
      setBroadcastStreamId(stream.id);
      setIsBroadcasting(true);
    } else if (stream.user_id === user?.id && stream.status === 'live') {
      setBroadcastStreamId(stream.id);
      setIsBroadcasting(true);
    } else {
      setSelectedStreamId(stream.id);
    }
  };

  const handleSpaceClick = (space: any) => {
    if (space.status === 'live' || space.status === 'ended') {
      setSelectedSpaceId(space.id);
    }
  };

  // Render modals/overlays
  if (selectedStreamId) {
    return (
      <LiveKitViewer
        streamId={selectedStreamId}
        onClose={() => setSelectedStreamId(null)}
      />
    );
  }

  if (isBroadcasting && broadcastStreamId) {
    return (
      <LiveKitBroadcaster
        streamId={broadcastStreamId}
        onClose={() => {
          setIsBroadcasting(false);
          setBroadcastStreamId(null);
        }}
      />
    );
  }

  if (selectedSpaceId) {
    return (
      <LiveSpaceRoom
        spaceId={selectedSpaceId}
        onClose={() => setSelectedSpaceId(null)}
      />
    );
  }

  return (
    <>
      {/* Modern Live Dashboard - No BottomNav */}
      <LiveDashboard
        liveStreams={liveStreams}
        liveSpaces={liveSpaces}
        scheduledStreams={scheduledStreams}
        scheduledSpaces={scheduledSpaces}
        myStreams={myStreams}
        mySpaces={mySpaces}
        user={user}
        onStreamClick={handleStreamClick}
        onSpaceClick={handleSpaceClick}
        onGoLive={() => setShowGoLiveModal(true)}
        onVideoStream={() => setCreateStreamModalOpen(true)}
        onAudioSpace={() => setCreateSpaceModalOpen(true)}
        isLoading={loadingLiveStreams || loadingLiveSpaces}
        myActiveStream={myStreams?.find(s => s.status === 'live')}
        myActiveSpace={mySpaces?.find(s => s.status === 'live')}
      />

      {/* Go Live Modal */}
      <GoLiveModal
        open={showGoLiveModal}
        onClose={() => setShowGoLiveModal(false)}
        onVideoStream={() => setCreateStreamModalOpen(true)}
        onAudioSpace={() => setCreateSpaceModalOpen(true)}
      />

      {/* Create Modals */}
      <CreateLiveStreamModal
        isOpen={createStreamModalOpen}
        onClose={() => setCreateStreamModalOpen(false)}
        onStreamCreated={handleStreamCreated}
      />

      <CreateSpaceModal
        isOpen={createSpaceModalOpen}
        onClose={() => setCreateSpaceModalOpen(false)}
        onSpaceCreated={handleSpaceCreated}
      />

      <SpaceContentManager
        isOpen={showContentManager}
        onClose={() => setShowContentManager(false)}
        onDeleted={() => {
          refetchMySpaces();
        }}
      />
    </>
  );
};

export default Live;
```

---

## 2. Context Providers

### src/context/LiveStreamContext.tsx
Global context for video live streaming state management.

```tsx
import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Room, RoomEvent, LocalVideoTrack, LocalAudioTrack, createLocalTracks, VideoPresets } from 'livekit-client';
import { supabase } from '@/integrations/supabase/client';
import { AuthContext } from '@/context/AuthContext';
import { toast } from 'sonner';
import { getFriendlyError, isTemporaryError } from '@/lib/error-messages';

export type ConnectionStatus = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'error' | 'ended';

interface StreamInfo {
  id: string;
  title: string;
  hostId: string;
  hostName: string;
  hostAvatar: string;
  type: 'video_broadcast' | 'pk_battle';
  startedAt: string;
}

interface LiveStreamState {
  isActive: boolean;
  isMinimized: boolean;
  streamInfo: StreamInfo | null;
  isMuted: boolean;
  isCameraOn: boolean;
  isHost: boolean;
  viewerCount: number;
  connectionStatus: ConnectionStatus;
}

interface LiveStreamContextType {
  streamState: LiveStreamState;
  startStream: (streamInfo: StreamInfo) => Promise<boolean>;
  endStream: () => Promise<void>;
  minimizeStream: () => void;
  maximizeStream: () => void;
  toggleMute: () => void;
  toggleCamera: () => void;
  room: Room | null;
  videoTrack: LocalVideoTrack | null;
  audioTrack: LocalAudioTrack | null;
  videoElement: HTMLVideoElement | null;
  setVideoElement: (el: HTMLVideoElement | null) => void;
}

const defaultState: LiveStreamState = {
  isActive: false,
  isMinimized: false,
  streamInfo: null,
  isMuted: false,
  isCameraOn: true,
  isHost: true,
  viewerCount: 0,
  connectionStatus: 'idle',
};

const LiveStreamContext = createContext<LiveStreamContextType | null>(null);

export const useLiveStreamContext = () => {
  const context = useContext(LiveStreamContext);
  if (!context) {
    throw new Error('useLiveStreamContext must be used within LiveStreamProvider');
  }
  return context;
};

export const useOptionalLiveStreamContext = () => {
  return useContext(LiveStreamContext);
};

export const LiveStreamProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const authContext = useContext(AuthContext);
  const user = authContext?.user ?? null;
  const [streamState, setStreamState] = useState<LiveStreamState>(defaultState);
  const [videoElement, setVideoElement] = useState<HTMLVideoElement | null>(null);

  // Refs persist across navigation
  const roomRef = useRef<Room | null>(null);
  const videoTrackRef = useRef<LocalVideoTrack | null>(null);
  const audioTrackRef = useRef<LocalAudioTrack | null>(null);
  const streamInfoRef = useRef<StreamInfo | null>(null);
  const viewerChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Keep ref in sync
  useEffect(() => {
    streamInfoRef.current = streamState.streamInfo;
  }, [streamState.streamInfo]);

  // Start streaming - initializes LiveKit and connects
  const startStream = useCallback(async (streamInfo: StreamInfo): Promise<boolean> => {
    if (!user) {
      toast.error('Please sign in to start streaming');
      return false;
    }

    console.log('[LiveStreamContext] Starting stream:', streamInfo.id);
    setStreamState(prev => ({ ...prev, connectionStatus: 'connecting' }));

    try {
      // Get LiveKit token
      const { data: tokenData, error: tokenError } = await supabase.functions.invoke('livekit-token', {
        body: {
          roomName: `stream-${streamInfo.id}`,
          participantName: streamInfo.hostName || user.user_metadata?.display_name || 'Host',
          participantIdentity: user.id,
          isHost: true,
        },
      });

      if (tokenError || !tokenData?.token) {
        throw new Error(tokenError?.message || 'Failed to get streaming token');
      }

      // Create local tracks
      const tracks = await createLocalTracks({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: {
          resolution: VideoPresets.h720,
          facingMode: 'user',
        },
      });

      const videoTrack = tracks.find(t => t.kind === 'video') as LocalVideoTrack | undefined;
      const audioTrack = tracks.find(t => t.kind === 'audio') as LocalAudioTrack | undefined;

      if (!videoTrack || !audioTrack) {
        throw new Error('Failed to create camera/microphone tracks');
      }

      videoTrackRef.current = videoTrack;
      audioTrackRef.current = audioTrack;

      // Create and connect room
      const room = new Room({
        adaptiveStream: true,
        dynacast: true,
        videoCaptureDefaults: {
          resolution: VideoPresets.h720,
        },
      });

      // Set up room event handlers
      room.on(RoomEvent.Disconnected, () => {
        console.log('[LiveStreamContext] Room disconnected');
        setStreamState(prev => ({ ...prev, connectionStatus: 'ended' }));
      });

      room.on(RoomEvent.Reconnecting, () => {
        console.log('[LiveStreamContext] Room reconnecting...');
        setStreamState(prev => ({ ...prev, connectionStatus: 'reconnecting' }));
      });

      room.on(RoomEvent.Reconnected, () => {
        console.log('[LiveStreamContext] Room reconnected');
        setStreamState(prev => ({ ...prev, connectionStatus: 'connected' }));
      });

      room.on(RoomEvent.ParticipantConnected, () => {
        const count = room.remoteParticipants.size;
        setStreamState(prev => ({ ...prev, viewerCount: count }));
      });

      room.on(RoomEvent.ParticipantDisconnected, () => {
        const count = room.remoteParticipants.size;
        setStreamState(prev => ({ ...prev, viewerCount: count }));
      });

      // Connect to room
      await room.connect(tokenData.url, tokenData.token);
      console.log('[LiveStreamContext] Connected to LiveKit room');

      // Publish tracks
      await room.localParticipant.publishTrack(videoTrack);
      await room.localParticipant.publishTrack(audioTrack);
      console.log('[LiveStreamContext] Tracks published');

      roomRef.current = room;

      // Update database status
      await supabase
        .from('live_streams')
        .update({ 
          status: 'live',
          started_at: new Date().toISOString(),
        })
        .eq('id', streamInfo.id);

      // Set up viewer count subscription
      const viewerChannel = supabase.channel(`stream-viewers-${streamInfo.id}`)
        .on('presence', { event: 'sync' }, () => {
          const state = viewerChannel.presenceState();
          const count = Object.keys(state).length;
          setStreamState(prev => ({ ...prev, viewerCount: count }));
        })
        .subscribe();

      viewerChannelRef.current = viewerChannel;

      setStreamState({
        isActive: true,
        isMinimized: false,
        streamInfo,
        isMuted: false,
        isCameraOn: true,
        isHost: true,
        viewerCount: 0,
        connectionStatus: 'connected',
      });

      console.log('[LiveStreamContext] ✅ Stream started successfully');
      return true;

    } catch (error: any) {
      console.error('[LiveStreamContext] Error starting stream:', error);
      const friendly = getFriendlyError(error?.message || 'stream');
      if (isTemporaryError(error?.message || '')) {
        toast(friendly.title, { description: friendly.description });
      } else {
        toast.error(friendly.title, { description: friendly.description });
      }
      setStreamState(prev => ({ ...prev, connectionStatus: 'error' }));
      return false;
    }
  }, [user]);

  // End stream - disconnects and cleans up
  const endStream = useCallback(async () => {
    console.log('[LiveStreamContext] Ending stream...');

    // Stop tracks
    if (videoTrackRef.current) {
      videoTrackRef.current.stop();
      videoTrackRef.current = null;
    }
    if (audioTrackRef.current) {
      audioTrackRef.current.stop();
      audioTrackRef.current = null;
    }

    // Disconnect room
    if (roomRef.current) {
      roomRef.current.disconnect();
      roomRef.current = null;
    }

    // Cleanup viewer channel
    if (viewerChannelRef.current) {
      supabase.removeChannel(viewerChannelRef.current);
      viewerChannelRef.current = null;
    }

    // Update database
    if (streamInfoRef.current) {
      await supabase
        .from('live_streams')
        .update({ 
          status: 'ended',
          ended_at: new Date().toISOString(),
        })
        .eq('id', streamInfoRef.current.id);
    }

    // Clear duration interval
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }

    setStreamState(defaultState);
    console.log('[LiveStreamContext] ✅ Stream ended');
  }, []);

  // Minimize - stream continues in background
  const minimizeStream = useCallback(() => {
    console.log('[LiveStreamContext] Minimizing stream - broadcast continues');
    setStreamState(prev => ({ ...prev, isMinimized: true }));
  }, []);

  // Maximize - return to full view
  const maximizeStream = useCallback(() => {
    console.log('[LiveStreamContext] Maximizing stream');
    setStreamState(prev => ({ ...prev, isMinimized: false }));
  }, []);

  // Toggle mute
  const toggleMute = useCallback(() => {
    if (audioTrackRef.current) {
      const newMuted = !streamState.isMuted;
      if (newMuted) {
        audioTrackRef.current.mute();
      } else {
        audioTrackRef.current.unmute();
      }
      setStreamState(prev => ({ ...prev, isMuted: newMuted }));
    }
  }, [streamState.isMuted]);

  // Toggle camera
  const toggleCamera = useCallback(() => {
    if (videoTrackRef.current) {
      const newCameraOff = !streamState.isCameraOn;
      if (newCameraOff) {
        videoTrackRef.current.mute();
      } else {
        videoTrackRef.current.unmute();
      }
      setStreamState(prev => ({ ...prev, isCameraOn: !newCameraOff }));
    }
  }, [streamState.isCameraOn]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (roomRef.current) {
        roomRef.current.disconnect();
      }
      if (videoTrackRef.current) {
        videoTrackRef.current.stop();
      }
      if (audioTrackRef.current) {
        audioTrackRef.current.stop();
      }
      if (viewerChannelRef.current) {
        supabase.removeChannel(viewerChannelRef.current);
      }
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
      }
    };
  }, []);

  return (
    <LiveStreamContext.Provider value={{
      streamState,
      startStream,
      endStream,
      minimizeStream,
      maximizeStream,
      toggleMute,
      toggleCamera,
      room: roomRef.current,
      videoTrack: videoTrackRef.current,
      audioTrack: audioTrackRef.current,
      videoElement,
      setVideoElement,
    }}>
      {children}
    </LiveStreamContext.Provider>
  );
};

export default LiveStreamContext;
```

### src/context/SpaceContext.tsx
Global context for audio spaces state management with LiveKit integration.

```tsx
// Full file is ~755 lines - key parts included here
// See project file for complete implementation

import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AuthContext } from '@/context/AuthContext';
import { toast } from 'sonner';
import { audioPlaybackManager } from '@/lib/audio-playback-manager';
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

// Key features:
// - Audio connection via LiveKit
// - Auto-reconnection on network failure
// - Audio level monitoring for speaking indicators
// - Role management (host, co_host, speaker, listener)
// - Minimize/maximize for PiP support
// - Persistent audio across navigation
```

---

## 3. Core Components

### src/components/live/LiveKitBroadcaster.tsx
Host broadcasting component using LiveKit.

```tsx
// Full component is ~843 lines
// Key features:
// - Camera preview and initialization
// - LiveKit room connection
// - Video/audio track publishing
// - Screen sharing support
// - Realtime chat overlay
// - Gift receiving
// - Connection quality indicators
// - Auto-reconnection on network issues
```

### src/components/live/LiveKitViewer.tsx
Viewer component for watching live streams.

```tsx
// Full component is ~754 lines
// Key features:
// - LiveKit room connection as viewer
// - Video/audio track subscription
// - Unmute prompt for audio
// - Realtime chat
// - Reaction sending
// - Gift sending
// - Auto-reconnection
```

### src/components/live/LiveSpaceRoom.tsx
Audio space room component with full speaker/listener management.

```tsx
// Full component is ~2111 lines
// Key features:
// - SpaceContext integration for global audio
// - Role-based permissions (host, co_host, speaker, listener)
// - Hand raise functionality
// - Host controls (mute all, promote speakers)
// - Real-time reactions
// - Gift animations
// - Screen sharing (host only)
// - Minimize to floating player
```

---

## 4. UI Components

### src/components/live/FlyingChat.tsx
TikTok-style flying chat overlay.

```tsx
import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { AnimatedGiftEmoji } from '@/components/shared/AnimatedGiftEmoji';
import { Coins, Crown } from 'lucide-react';
import { FullScreenGiftEffect } from './FullScreenGiftEffect';

interface ChatMessage {
  id: string;
  content: string;
  user_id: string;
  created_at: string;
  profiles?: {
    display_name?: string;
    username?: string;
    avatar_url?: string;
  };
}

interface FlyingGift {
  id: string;
  gift_type: string;
  sender_name: string;
  credit_value: number;
  sender_id?: string;
}

interface FlyingChatProps {
  messages: ChatMessage[];
  gifts?: FlyingGift[];
  hostId?: string;
  maxMessages?: number;
  className?: string;
  bottomOffset?: number;
  onMentionClick?: (username: string) => void;
}

const GIFT_EMOJIS: Record<string, string> = {
  heart: '❤️', star: '⭐', fire: '🔥', lightning: '⚡',
  crown: '👑', diamond: '💎', rocket: '🚀', universe: '🌌',
  credits: '💰', rose: '🌹', kiss: '💋', cake: '🎂', money: '💰',
};

export const FlyingChat = ({ 
  messages, 
  gifts = [], 
  hostId,
  maxMessages = 12,
  className,
  bottomOffset = 200,
  onMentionClick
}: FlyingChatProps) => {
  // Implementation handles:
  // - Animated message display (slide in from left)
  // - Flying gift animations (center screen)
  // - Full-screen gift effects
  // - @mention highlighting
  // - Host badge display
  // - Message auto-cleanup
};
```

### src/components/live/FloatingStreamPlayer.tsx
Draggable PiP player for hosts.

```tsx
import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useOptionalLiveStreamContext } from '@/context/LiveStreamContext';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { PhoneOff, Mic, MicOff, Video, VideoOff, Maximize2, Users } from 'lucide-react';
import { motion, AnimatePresence, PanInfo } from 'framer-motion';
import { cn } from '@/lib/utils';

export const FloatingStreamPlayer: React.FC = () => {
  const streamContext = useOptionalLiveStreamContext();
  // Features:
  // - Draggable floating widget
  // - Video preview
  // - Mic/camera toggle controls
  // - Maximize to return to full view
  // - End stream button
  // - Viewer count display
  // - Duration timer
};
```

### src/components/live/FloatingSpacePlayer.tsx
Draggable PiP player for audio spaces.

```tsx
import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useOptionalSpaceContext } from '@/context/SpaceContext';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { PhoneOff, Mic, MicOff, Maximize2, Radio, Users } from 'lucide-react';
import { motion, AnimatePresence, useDragControls, PanInfo } from 'framer-motion';
import { cn } from '@/lib/utils';

export const FloatingSpacePlayer: React.FC = () => {
  const spaceContext = useOptionalSpaceContext();
  // Features:
  // - Draggable floating widget
  // - Host avatar with connection status
  // - Mic toggle (for speakers)
  // - Maximize to return to space
  // - Leave space button
  // - Duration timer
};
```

### src/components/live/LiveDashboard.tsx
Modern TikTok-style live content discovery page.

```tsx
// Full component is ~474 lines
// Features:
// - Glassmorphism header
// - Category filters
// - "My Status" card with active session detection
// - Trending content grid
// - Audio spaces section
// - Scheduled content
// - Recommended creators based on activity
```

### src/components/live/CreateLiveStreamModal.tsx
Modal for creating new live streams.

```tsx
// Full component is ~370 lines
// Features:
// - Stream type selection (Video, Audio, PK Battle)
// - Go Live Now vs Schedule options
// - Title, description, category inputs
// - Premium stream toggle
// - Scheduled date/time picker
// - Premium user gate (configurable)
```

### src/components/live/CreateSpaceModal.tsx
Modal for creating new audio spaces.

```tsx
// Full component is ~240 lines
// Features:
// - Title and description inputs
// - Topic category selection
// - Private space toggle
// - Schedule for later option
// - Recording enable toggle
```

### src/components/live/LiveGiftModal.tsx
Modal for sending gifts during live sessions.

```tsx
// Full component is ~413 lines
// Features:
// - Premium gift grid with animations
// - Custom credit amount input
// - Recipient selection for hosts
// - Credit balance display
// - 15% platform fee handling
// - Success animation
```

---

## 5. Edge Functions

### supabase/functions/livekit-token/index.ts
LiveKit JWT token generation.

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import * as jose from "https://deno.land/x/jose@v4.14.4/index.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function generateJti(): string {
  return crypto.randomUUID();
}

async function generateLiveKitToken(
  apiKey: string,
  apiSecret: string,
  roomName: string,
  participantIdentity: string,
  participantName: string,
  isHost: boolean
): Promise<string> {
  const encoder = new TextEncoder();
  const secretKey = encoder.encode(apiSecret);
  
  const now = Math.floor(Date.now() / 1000);
  
  const claims = {
    jti: generateJti(),
    name: participantName,
    video: {
      room: roomName,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
      roomAdmin: isHost,
      roomRecord: isHost,
    },
    metadata: JSON.stringify({ userId: participantIdentity }),
    sha256: "",
  };
  
  const jwt = await new jose.SignJWT(claims)
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuer(apiKey)
    .setSubject(participantIdentity)
    .setIssuedAt(now)
    .setNotBefore(now - 10)
    .setExpirationTime(now + 21600) // 6 hours
    .sign(secretKey);

  return jwt;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const LIVEKIT_API_KEY = Deno.env.get("LIVEKIT_API_KEY");
    const LIVEKIT_API_SECRET = Deno.env.get("LIVEKIT_API_SECRET");
    const LIVEKIT_URL = Deno.env.get("LIVEKIT_URL");

    if (!LIVEKIT_API_KEY || !LIVEKIT_API_SECRET || !LIVEKIT_URL) {
      return new Response(
        JSON.stringify({ error: "LiveKit not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let wsUrl = LIVEKIT_URL;
    if (!wsUrl.startsWith('wss://') && !wsUrl.startsWith('ws://')) {
      wsUrl = `wss://${wsUrl}`;
    }

    const body = await req.json();
    const { roomName, participantName, participantIdentity, isHost } = body;

    if (!roomName || !participantName || !participantIdentity) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = await generateLiveKitToken(
      LIVEKIT_API_KEY,
      LIVEKIT_API_SECRET,
      roomName,
      participantIdentity,
      participantName,
      isHost === true
    );

    return new Response(
      JSON.stringify({ token, url: wsUrl, roomName }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Failed to generate token";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
```

---

## File Index

### Components (src/components/live/)
- `CoHostPanel.tsx` - Co-host management panel
- `CreateLiveStreamModal.tsx` - Stream creation modal
- `CreateSpaceModal.tsx` - Space creation modal
- `FloatingReactions.tsx` - Floating emoji reactions
- `FloatingSpacePlayer.tsx` - Minimized space player
- `FloatingStreamPlayer.tsx` - Minimized stream player
- `FlyingChat.tsx` - TikTok-style chat overlay
- `FullScreenGiftEffect.tsx` - Full-screen gift animations
- `GoLiveDropdown.tsx` - Go live dropdown menu
- `GoLiveModal.tsx` - Go live selection modal
- `ListenersModal.tsx` - Space listeners list
- `LiveBroadcaster.tsx` - Legacy broadcaster (deprecated)
- `LiveBroadcasterV2.tsx` - V2 broadcaster (deprecated)
- `LiveChatMessage.tsx` - Chat message component
- `LiveDashboard.tsx` - Main discovery dashboard
- `LiveDiscoverCard.tsx` - Stream/space card component
- `LiveGiftModal.tsx` - Gift sending modal
- `LiveInviteModal.tsx` - Stream invite modal
- `LiveInviteNotification.tsx` - Invite notification
- `LiveKitBroadcaster.tsx` - Main host broadcaster
- `LiveKitViewer.tsx` - Main viewer component
- `LiveSpaceRoom.tsx` - Full audio space room
- `LiveStreamCard.tsx` - Stream card component
- `LiveStreamMentionInput.tsx` - Chat input with mentions
- `LiveStreamPlayerV2.tsx` - V2 player (deprecated)
- `LiveStreamPreviewCard.tsx` - Preview card
- `LiveStreamViewer.tsx` - Legacy viewer (deprecated)
- `LiveStreamViewerWebRTC.tsx` - WebRTC viewer (deprecated)
- `RecordingsManager.tsx` - Recording management
- `ScreenShareButton.tsx` - Screen share button
- `SimpleBroadcaster.tsx` - Simple broadcaster
- `SimpleViewer.tsx` - Simple viewer
- `SpaceCard.tsx` - Space card component
- `SpaceChat.tsx` - Space chat panel
- `SpaceContentManager.tsx` - Space content management
- `SpaceInviteModal.tsx` - Space invite modal
- `SpaceInviteNotification.tsx` - Space invite notification
- `SpaceMentionInput.tsx` - Space chat input
- `SpaceReplayPlayer.tsx` - Space recording player
- `SpeakerAvatarWithWaves.tsx` - Speaking indicator avatar
- `SpeakerQueuePanel.tsx` - Speaker request queue
- `StreamHealthIndicator.tsx` - Connection quality indicator
- `StreamOptionsMenu.tsx` - Stream options menu
- `StreamReadyGate.tsx` - Stream readiness check
- `TestAudioModal.tsx` - Audio test modal
- `ViewerListPanel.tsx` - Viewer list panel

### Unified Components (src/components/live/unified/)
- `AudioVisualizer.tsx` - Audio visualization
- `LiveFeedItem.tsx` - Live feed item
- `PKBattleBar.tsx` - PK battle score bar
- `PKBattleChallenge.tsx` - PK challenge modal
- `UnifiedControlBar.tsx` - Unified control bar
- `UnifiedRoom.tsx` - Unified room component
- `types.ts` - Shared types
- `index.ts` - Exports

### Edge Functions (supabase/functions/)
- `livekit-token/` - LiveKit JWT token generation
- `pk-battle-manager/` - PK battle management
- `space-signaling/` - Space signaling

---

## Database Tables Used

- `live_streams` - Video stream records
- `live_stream_comments` - Stream chat messages
- `live_stream_reactions` - Stream reactions
- `live_stream_gifts` - Stream gifts
- `live_stream_viewers` - Stream viewer sessions
- `live_spaces` - Audio space records
- `live_space_speakers` - Space participants
- `live_space_reactions` - Space reactions
- `live_space_gifts` - Space gifts
- `pk_battles` - PK battle records
- `profiles` - User profiles

---

**Document generated:** 2026-02-04
**Total files:** 50+ live streaming related files
