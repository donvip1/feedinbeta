import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Room, RoomEvent, LocalVideoTrack, LocalAudioTrack, createLocalTracks, VideoPresets } from 'livekit-client';
import { supabase } from '@/integrations/supabase/client';
import { AuthContext } from '@/context/AuthContext';
import { toast } from 'sonner';

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
      toast.error(error.message || 'Failed to start stream');
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
