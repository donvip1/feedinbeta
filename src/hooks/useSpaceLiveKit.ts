import { useState, useRef, useCallback, useEffect } from 'react';
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
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { audioPlaybackManager } from '@/lib/audio-playback-manager';
import { getFriendlyError, isTemporaryError } from '@/lib/error-messages';

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'failed' | 'reconnecting';

interface AudioLevels {
  [participantId: string]: number;
}

interface UseSpaceLiveKitProps {
  spaceId: string;
  displayName: string;
  isHost: boolean;
  isMuted: boolean;
  onAudioLevelsChange?: (levels: AudioLevels) => void;
  onConnectionStatusChange?: (status: ConnectionStatus) => void;
}

interface UseSpaceLiveKitReturn {
  connect: () => Promise<boolean>;
  disconnect: () => Promise<void>;
  toggleMute: (muted: boolean) => void;
  startBroadcasting: () => Promise<boolean>;
  stopBroadcasting: () => void;
  connectionStatus: ConnectionStatus;
  audioLevels: AudioLevels;
  room: Room | null;
  localTrack: LocalAudioTrack | null;
}

export const useSpaceLiveKit = ({
  spaceId,
  displayName,
  isHost,
  isMuted,
  onAudioLevelsChange,
  onConnectionStatusChange,
}: UseSpaceLiveKitProps): UseSpaceLiveKitReturn => {
  const { user } = useAuth();
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const [audioLevels, setAudioLevels] = useState<AudioLevels>({});
  
  const roomRef = useRef<Room | null>(null);
  const localTrackRef = useRef<LocalAudioTrack | null>(null);
  const audioElementsRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  const audioLevelIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isConnectingRef = useRef(false);

  // Update status and notify parent
  const updateStatus = useCallback((status: ConnectionStatus) => {
    setConnectionStatus(status);
    onConnectionStatusChange?.(status);
  }, [onConnectionStatusChange]);

  // Update audio levels and notify parent
  const updateAudioLevels = useCallback((levels: AudioLevels) => {
    setAudioLevels(levels);
    onAudioLevelsChange?.(levels);
  }, [onAudioLevelsChange]);

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
      console.warn('[SpaceLiveKit] Audio autoplay blocked:', err);
      // Register for user interaction to enable audio
      audioPlaybackManager.enableAudioPlayback();
    });

    console.log(`[SpaceLiveKit] ✅ Playing audio from ${participantId}`);
  }, []);

  // Remove remote audio element
  const removeRemoteAudio = useCallback((participantId: string) => {
    const audioEl = audioElementsRef.current.get(participantId);
    if (audioEl) {
      audioEl.pause();
      audioEl.srcObject = null;
      audioEl.remove();
      audioElementsRef.current.delete(participantId);
      console.log(`[SpaceLiveKit] Removed audio for ${participantId}`);
    }
  }, []);

  // Monitor audio levels from LiveKit
  const startAudioLevelMonitoring = useCallback(() => {
    if (audioLevelIntervalRef.current) return;

    audioLevelIntervalRef.current = setInterval(() => {
      const room = roomRef.current;
      if (!room) return;

      const levels: AudioLevels = {};

      // Local participant audio level - only report if track is not muted
      if (room.localParticipant && localTrackRef.current) {
        const isMuted = localTrackRef.current.isMuted;
        const localLevel = isMuted ? 0 : (room.localParticipant.audioLevel || 0);
        levels[room.localParticipant.identity] = localLevel * 100;
      }

      // Remote participants audio levels
      room.remoteParticipants.forEach((participant) => {
        levels[participant.identity] = (participant.audioLevel || 0) * 100;
      });

      updateAudioLevels(levels);
    }, 100);
  }, [updateAudioLevels]);

  const stopAudioLevelMonitoring = useCallback(() => {
    if (audioLevelIntervalRef.current) {
      clearInterval(audioLevelIntervalRef.current);
      audioLevelIntervalRef.current = null;
    }
  }, []);

  // Connect to LiveKit room
  const connect = useCallback(async (): Promise<boolean> => {
    if (!user || isConnectingRef.current) {
      console.log('[SpaceLiveKit] Cannot connect - no user or already connecting');
      return false;
    }

    if (roomRef.current?.state === ConnectionState.Connected) {
      console.log('[SpaceLiveKit] Already connected');
      return true;
    }

    isConnectingRef.current = true;
    updateStatus('connecting');

    try {
      console.log('[SpaceLiveKit] Getting token for space:', spaceId);

      // Get token from livekit-token edge function
      const { data, error } = await supabase.functions.invoke('livekit-token', {
        body: {
          roomName: `space-${spaceId}`,
          participantName: displayName || 'Listener',
          participantIdentity: user.id,
          isHost,
        },
      });

      if (error || !data?.token) {
        throw new Error(data?.error || 'Failed to get LiveKit token');
      }

      console.log('[SpaceLiveKit] Token received, connecting...');

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
        console.log('[SpaceLiveKit] Connection state:', state);
        if (state === ConnectionState.Connected) {
          updateStatus('connected');
        } else if (state === ConnectionState.Reconnecting) {
          updateStatus('reconnecting');
        } else if (state === ConnectionState.Disconnected) {
          updateStatus('disconnected');
        }
      });

      // Handle incoming audio tracks - CRITICAL for receiving audio
      room.on(RoomEvent.TrackSubscribed, (track: RemoteTrack, publication, participant: RemoteParticipant) => {
        console.log(`[SpaceLiveKit] 🎧 Track subscribed from ${participant.identity}:`, track.kind);
        
        if (track.kind === Track.Kind.Audio) {
          playRemoteAudio(track, participant.identity);
        }
      });

      room.on(RoomEvent.TrackUnsubscribed, (track: RemoteTrack, publication, participant: RemoteParticipant) => {
        console.log(`[SpaceLiveKit] Track unsubscribed from ${participant.identity}`);
        if (track.kind === Track.Kind.Audio) {
          removeRemoteAudio(participant.identity);
        }
      });

      // Handle participant events
      room.on(RoomEvent.ParticipantConnected, (participant: RemoteParticipant) => {
        console.log(`[SpaceLiveKit] 👋 Participant joined: ${participant.identity}`);
      });

      room.on(RoomEvent.ParticipantDisconnected, (participant: RemoteParticipant) => {
        console.log(`[SpaceLiveKit] 👋 Participant left: ${participant.identity}`);
        removeRemoteAudio(participant.identity);
      });

      // Handle active speakers for visual indicators
      room.on(RoomEvent.ActiveSpeakersChanged, (speakers) => {
        console.log('[SpaceLiveKit] Active speakers:', speakers.map(s => s.identity));
      });

      // Handle disconnection
      room.on(RoomEvent.Disconnected, (reason?: DisconnectReason) => {
        console.log('[SpaceLiveKit] Disconnected, reason:', reason);
        if (reason === DisconnectReason.DUPLICATE_IDENTITY) {
          toast.error('Connected from another device');
        } else if (reason !== DisconnectReason.CLIENT_INITIATED) {
          // Show friendly reconnecting message for unexpected disconnects
          toast('Reconnecting...', { description: 'Please wait a moment' });
        }
      });

      // Connect to the room
      await room.connect(data.url, data.token);

      console.log('[SpaceLiveKit] ✅ Connected to room, participants:', room.remoteParticipants.size);

      // Subscribe to any existing tracks
      room.remoteParticipants.forEach((participant) => {
        participant.audioTrackPublications.forEach((publication) => {
          if (publication.track && publication.isSubscribed) {
            console.log(`[SpaceLiveKit] Attaching existing track from ${participant.identity}`);
            playRemoteAudio(publication.track as RemoteTrack, participant.identity);
          }
        });
      });

      // Start monitoring audio levels
      startAudioLevelMonitoring();

      updateStatus('connected');
      isConnectingRef.current = false;
      return true;

    } catch (error: any) {
      console.error('[SpaceLiveKit] ❌ Connection failed:', error);
      updateStatus('failed');
      isConnectingRef.current = false;
      
      // Show user-friendly error message
      const friendly = getFriendlyError(error?.message || 'connection');
      if (isTemporaryError(error?.message || '')) {
        toast(friendly.title, { description: friendly.description });
      } else {
        toast.error(friendly.title, { description: friendly.description });
      }
      return false;
    }
  }, [user, spaceId, displayName, isHost, updateStatus, playRemoteAudio, removeRemoteAudio, startAudioLevelMonitoring]);

  // Disconnect from room
  const disconnect = useCallback(async () => {
    console.log('[SpaceLiveKit] Disconnecting...');

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
    }

    // Remove all audio elements
    audioElementsRef.current.forEach((el, id) => {
      el.remove();
    });
    audioElementsRef.current.clear();

    updateStatus('disconnected');
    updateAudioLevels({});
    isConnectingRef.current = false;

    console.log('[SpaceLiveKit] ✅ Disconnected');
  }, [stopAudioLevelMonitoring, updateStatus, updateAudioLevels]);

  // Start broadcasting (publish local audio)
  const startBroadcasting = useCallback(async (): Promise<boolean> => {
    const room = roomRef.current;
    if (!room || room.state !== ConnectionState.Connected) {
      console.log('[SpaceLiveKit] Cannot broadcast - not connected');
      return false;
    }

    try {
      console.log('[SpaceLiveKit] 🎤 Starting broadcast...');

      const localTrack = await createLocalAudioTrack({
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        sampleRate: 48000,
      });

      localTrackRef.current = localTrack;

      // Apply initial mute state
      localTrack.mute();
      if (!isMuted) {
        await localTrack.unmute();
      }

      // Publish to room
      await room.localParticipant.publishTrack(localTrack);

      console.log('[SpaceLiveKit] ✅ Broadcasting started');
      return true;

    } catch (error: any) {
      console.error('[SpaceLiveKit] ❌ Failed to start broadcasting:', error);
      const friendly = getFriendlyError(error?.message || error?.name || 'microphone');
      toast.error(friendly.title, { description: friendly.description });
      return false;
    }
  }, [isMuted]);

  // Stop broadcasting
  const stopBroadcasting = useCallback(() => {
    if (localTrackRef.current && roomRef.current) {
      roomRef.current.localParticipant.unpublishTrack(localTrackRef.current);
      localTrackRef.current.stop();
      localTrackRef.current = null;
      console.log('[SpaceLiveKit] Stopped broadcasting');
    }
  }, []);

  // Toggle mute
  const toggleMute = useCallback((muted: boolean) => {
    if (localTrackRef.current) {
      if (muted) {
        localTrackRef.current.mute();
      } else {
        localTrackRef.current.unmute();
      }
      console.log('[SpaceLiveKit] Mute:', muted);
    }
  }, []);

  // Sync mute state with prop
  useEffect(() => {
    toggleMute(isMuted);
  }, [isMuted, toggleMute]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    connect,
    disconnect,
    toggleMute,
    startBroadcasting,
    stopBroadcasting,
    connectionStatus,
    audioLevels,
    room: roomRef.current,
    localTrack: localTrackRef.current,
  };
};
