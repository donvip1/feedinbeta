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
  LocalVideoTrack,
  LocalAudioTrack,
  createLocalTracks,
  createLocalAudioTrack,
  ConnectionState,
  VideoPresets,
  AudioPresets,
  DisconnectReason,
} from 'livekit-client';

// ============= TYPES =============

export type RoomType = 'video_broadcast' | 'audio_space' | 'pk_battle';
export type ConnectionStatus = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'error' | 'ended';
export type ParticipantRole = 'host' | 'co_host' | 'speaker' | 'viewer' | 'listener';

export interface RoomInfo {
  id: string;
  title: string;
  type: RoomType;
  hostId: string;
  hostName: string;
  hostAvatar: string;
  startedAt?: string;
  coverImageUrl?: string | null;
  pkData?: {
    challengerId: string;
    challengerName: string;
    challengerAvatar: string;
    hostScore: number;
    challengerScore: number;
    endTime: string;
  };
}

export interface AudioLevels {
  [participantId: string]: number;
}

export interface Participant {
  id: string;
  user_id: string;
  role: ParticipantRole;
  is_muted: boolean;
  is_hard_muted: boolean; // Host forced mute - cannot unmute
  is_speaking: boolean;
  joined_at: string;
  profile?: {
    id: string;
    display_name: string;
    username: string;
    avatar_url: string;
    level?: number;
  };
}

export interface UnifiedLiveState {
  isActive: boolean;
  isMinimized: boolean;
  roomInfo: RoomInfo | null;
  role: ParticipantRole;
  isMuted: boolean;
  isCameraOn: boolean;
  isScreenSharing: boolean;
  isRecording: boolean; // Cloud recording enabled
  isHardMuted: boolean; // Host forced mute on current user
  canSpeak: boolean;
  connectionStatus: ConnectionStatus;
  viewerCount: number;
  audioLevels: AudioLevels;
  participants: Participant[];
  userCredits: number;
  hasRaisedHand: boolean; // For listeners to request speaking permission
  remoteVideoTrack: RemoteTrack | null; // Host's video track for viewers
  screenShareTrack: LocalVideoTrack | null; // Screen share track
}

const defaultState: UnifiedLiveState = {
  isActive: false,
  isMinimized: false,
  roomInfo: null,
  role: 'viewer',
  isMuted: true,
  isCameraOn: false,
  isScreenSharing: false,
  isRecording: false,
  isHardMuted: false,
  canSpeak: true,
  connectionStatus: 'idle',
  viewerCount: 0,
  audioLevels: {},
  participants: [],
  userCredits: 0,
  hasRaisedHand: false,
  remoteVideoTrack: null,
  screenShareTrack: null,
};

// ============= CONTEXT TYPE =============

export interface UnifiedLiveContextType {
  state: UnifiedLiveState;
  // Core Actions
  joinRoom: (roomInfo: RoomInfo, role: ParticipantRole) => Promise<boolean>;
  leaveRoom: () => Promise<void>;
  minimize: () => void;
  maximize: () => void;
  toggleMute: () => void;
  toggleCamera: () => void;
  toggleScreenShare: () => Promise<void>;
  toggleRecording: () => Promise<void>;
  updateRole: (role: ParticipantRole) => Promise<void>;
  toggleRaiseHand: () => Promise<void>;
  // Moderation Actions (Host Only)
  muteParticipant: (userId: string) => void;
  unmuteParticipant: (userId: string) => void;
  muteAll: () => void;
  unmuteAll: () => void;
  inviteToSpeak: (userId: string) => void;
  removeFromSpeakers: (userId: string) => void;
  // Feature Actions
  sendBroadcastMessage: (message: string) => Promise<void>;
  startPKBattle: (challengerId: string) => Promise<void>;
  // LiveKit refs
  room: Room | null;
  videoTrack: LocalVideoTrack | null;
  audioTrack: LocalAudioTrack | null;
  localStream: MediaStream | null;
}

// ============= CONTEXT =============

const UnifiedLiveContext = createContext<UnifiedLiveContextType | null>(null);

export const useUnifiedLive = () => {
  const context = useContext(UnifiedLiveContext);
  if (!context) {
    throw new Error('useUnifiedLive must be used within UnifiedLiveProvider');
  }
  return context;
};

export const useOptionalUnifiedLive = () => {
  return useContext(UnifiedLiveContext);
};

// ============= PROVIDER =============

export const UnifiedLiveProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const authContext = useContext(AuthContext);
  const user = authContext?.user ?? null;
  const [state, setState] = useState<UnifiedLiveState>(defaultState);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);

  // Refs persist across renders and navigation
  const roomRef = useRef<Room | null>(null);
  const videoTrackRef = useRef<LocalVideoTrack | null>(null);
  const audioTrackRef = useRef<LocalAudioTrack | null>(null);
  const audioElementsRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  const audioLevelIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const roomInfoRef = useRef<RoomInfo | null>(null);
  const roleRef = useRef<ParticipantRole>('viewer');
  const userRef = useRef(user);
  const isConnectingRef = useRef(false);
  const presenceChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Keep refs in sync
  useEffect(() => { userRef.current = user; }, [user]);
  useEffect(() => { roleRef.current = state.role; }, [state.role]);
  useEffect(() => { roomInfoRef.current = state.roomInfo; }, [state.roomInfo]);

  // ============= AUDIO HELPERS =============

  const playRemoteAudio = useCallback((track: RemoteTrack, participantId: string) => {
    console.log('[UnifiedLive] Playing audio for:', participantId);
    
    // Clean up existing audio element for this participant
    const existingEl = audioElementsRef.current.get(participantId);
    if (existingEl) {
      existingEl.pause();
      existingEl.srcObject = null;
      existingEl.remove();
      audioElementsRef.current.delete(participantId);
    }

    const audioEl = document.createElement('audio');
    audioEl.id = `unified-audio-${participantId}`;
    audioEl.autoplay = true;
    audioEl.volume = 1.0;
    audioEl.setAttribute('playsinline', 'true');
    
    // Attach LiveKit track to audio element
    track.attach(audioEl);
    document.body.appendChild(audioEl);
    audioElementsRef.current.set(participantId, audioEl);

    // Force play with autoplay fallback
    audioEl.play().catch((err) => {
      console.warn('[UnifiedLive] Audio autoplay blocked, enabling playback manager:', err);
      audioPlaybackManager.enableAudioPlayback();
      // Retry play after enabling
      setTimeout(() => {
        audioEl.play().catch(e => console.warn('[UnifiedLive] Retry play failed:', e));
      }, 100);
    });
  }, []);

  const removeRemoteAudio = useCallback((participantId: string) => {
    const audioEl = audioElementsRef.current.get(participantId);
    if (audioEl) {
      audioEl.pause();
      audioEl.srcObject = null;
      audioEl.remove();
      audioElementsRef.current.delete(participantId);
    }
  }, []);

  const startAudioLevelMonitoring = useCallback(() => {
    if (audioLevelIntervalRef.current) return;

    audioLevelIntervalRef.current = setInterval(() => {
      const room = roomRef.current;
      if (!room) return;

      const levels: AudioLevels = {};

      if (room.localParticipant && audioTrackRef.current) {
        levels[room.localParticipant.identity] = (room.localParticipant.audioLevel || 0) * 100;
      }

      room.remoteParticipants.forEach((participant) => {
        levels[participant.identity] = (participant.audioLevel || 0) * 100;
      });

      setState(prev => ({ ...prev, audioLevels: levels }));
    }, 100);
  }, []);

  const stopAudioLevelMonitoring = useCallback(() => {
    if (audioLevelIntervalRef.current) {
      clearInterval(audioLevelIntervalRef.current);
      audioLevelIntervalRef.current = null;
    }
  }, []);

  // ============= JOIN ROOM (Polymorphic) =============

  const joinRoom = useCallback(async (roomInfo: RoomInfo, role: ParticipantRole): Promise<boolean> => {
    const currentUser = userRef.current;
    if (!currentUser) {
      toast.error('Please sign in to join');
      return false;
    }

    if (isConnectingRef.current) {
      console.log('[UnifiedLive] Already connecting...');
      return false;
    }

    if (roomRef.current?.state === ConnectionState.Connected) {
      console.log('[UnifiedLive] Already connected');
      return true;
    }

    isConnectingRef.current = true;
    roomInfoRef.current = roomInfo;
    roleRef.current = role;

    console.log(`[UnifiedLive] Joining ${roomInfo.type} as ${role}:`, roomInfo.id);
    setState(prev => ({ 
      ...prev, 
      connectionStatus: 'connecting',
      isActive: true,
      isMinimized: false,
      roomInfo,
      role,
    }));

    try {
      // Get display name
      let displayName = 'User';
      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('display_name, username')
          .eq('id', currentUser.id)
          .single();
        displayName = profile?.display_name || profile?.username || 'User';
      } catch (e) {
        console.warn('[UnifiedLive] Could not fetch profile');
      }

      // Determine room name based on type
      const roomName = roomInfo.type === 'audio_space' 
        ? `space-${roomInfo.id}` 
        : `stream-${roomInfo.id}`;

      const isHost = role === 'host' || role === 'co_host';
      const canBroadcast = isHost || role === 'speaker';
      const needsVideo = roomInfo.type !== 'audio_space' && canBroadcast;

      // Get LiveKit token
      const { data: tokenData, error: tokenError } = await supabase.functions.invoke('livekit-token', {
        body: {
          roomName,
          participantName: displayName,
          participantIdentity: currentUser.id,
          isHost,
        },
      });

      if (tokenError || !tokenData?.token) {
        throw new Error(tokenData?.error || 'Failed to get streaming token');
      }

      // Create LiveKit room with type-specific settings
      const room = new Room({
        adaptiveStream: true,
        dynacast: true,
        videoCaptureDefaults: needsVideo ? { resolution: VideoPresets.h720 } : undefined,
        publishDefaults: {
          audioPreset: AudioPresets.speech,
        },
      });

      roomRef.current = room;

      // Set up room event handlers
      room.on(RoomEvent.ConnectionStateChanged, (connectionState) => {
        console.log('[UnifiedLive] Connection state:', connectionState);
        if (connectionState === ConnectionState.Connected) {
          setState(prev => ({ ...prev, connectionStatus: 'connected' }));
        } else if (connectionState === ConnectionState.Reconnecting) {
          setState(prev => ({ ...prev, connectionStatus: 'reconnecting' }));
        } else if (connectionState === ConnectionState.Disconnected) {
          setState(prev => ({ ...prev, connectionStatus: 'ended' }));
        }
      });

      room.on(RoomEvent.TrackSubscribed, (track: RemoteTrack, publication, participant: RemoteParticipant) => {
        console.log(`[UnifiedLive] Track subscribed from ${participant.identity}:`, track.kind);
        if (track.kind === Track.Kind.Audio) {
          playRemoteAudio(track, participant.identity);
        }
        // Store remote video track for viewers to display
        if (track.kind === Track.Kind.Video) {
          console.log('[UnifiedLive] Storing remote video track from:', participant.identity);
          setState(prev => ({ ...prev, remoteVideoTrack: track }));
        }
      });

      room.on(RoomEvent.TrackUnsubscribed, (track: RemoteTrack, publication, participant: RemoteParticipant) => {
        if (track.kind === Track.Kind.Audio) {
          removeRemoteAudio(participant.identity);
        }
        if (track.kind === Track.Kind.Video) {
          console.log('[UnifiedLive] Remote video track unsubscribed');
          setState(prev => ({ ...prev, remoteVideoTrack: null }));
        }
      });

      room.on(RoomEvent.ParticipantConnected, () => {
        const count = room.remoteParticipants.size;
        setState(prev => ({ ...prev, viewerCount: count }));
      });

      room.on(RoomEvent.ParticipantDisconnected, (participant: RemoteParticipant) => {
        const count = room.remoteParticipants.size;
        setState(prev => ({ ...prev, viewerCount: count }));
        removeRemoteAudio(participant.identity);
      });

      room.on(RoomEvent.Disconnected, (reason?: DisconnectReason) => {
        console.log('[UnifiedLive] Disconnected:', reason);
        if (reason === DisconnectReason.DUPLICATE_IDENTITY) {
          toast.error('Connected from another device');
        } else if (reason !== DisconnectReason.CLIENT_INITIATED) {
          toast('Reconnecting...', { description: 'Please wait' });
        }
      });

      // Connect to room
      await room.connect(tokenData.url, tokenData.token);
      console.log('[UnifiedLive] Connected to room');

      // Handle existing remote tracks (for viewers joining after host started)
      room.remoteParticipants.forEach((participant) => {
        participant.audioTrackPublications.forEach((pub) => {
          if (pub.track && pub.isSubscribed) {
            playRemoteAudio(pub.track as RemoteTrack, participant.identity);
          }
        });
        // Also handle existing video tracks
        participant.videoTrackPublications.forEach((pub) => {
          if (pub.track && pub.isSubscribed) {
            console.log('[UnifiedLive] Found existing video track from:', participant.identity);
            setState(prev => ({ ...prev, remoteVideoTrack: pub.track as RemoteTrack }));
          }
        });
      });

      // Publish tracks based on role and room type
      // For audio spaces, ALL participants should be able to talk (like Telegram spaces)
      const shouldPublishAudio = roomInfo.type === 'audio_space' || canBroadcast;
      
      if (shouldPublishAudio || (canBroadcast && needsVideo)) {
        try {
          if (needsVideo && canBroadcast) {
            // Video mode - create both video and audio
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

            if (videoTrack) {
              videoTrackRef.current = videoTrack;
              await room.localParticipant.publishTrack(videoTrack);
            }

            if (audioTrack) {
              audioTrackRef.current = audioTrack;
              if (role !== 'host') await audioTrack.mute(); // Non-hosts start muted
              await room.localParticipant.publishTrack(audioTrack);
            }

            setState(prev => ({ 
              ...prev, 
              isCameraOn: true, 
              isMuted: role !== 'host' 
            }));
          } else {
            // Audio-only mode (audio spaces - everyone gets a mic)
            const audioTrack = await createLocalAudioTrack({
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
              sampleRate: 48000,
            });

            audioTrackRef.current = audioTrack;
            // Start muted unless host
            if (role !== 'host') await audioTrack.mute();
            await room.localParticipant.publishTrack(audioTrack);

            const stream = new MediaStream([audioTrack.mediaStreamTrack]);
            setLocalStream(stream);

            setState(prev => ({ 
              ...prev, 
              isMuted: role !== 'host',
              isCameraOn: false,
              canSpeak: true, // All audio space participants can speak
            }));
          }
          console.log('[UnifiedLive] Tracks published');
        } catch (mediaError: any) {
          console.error('[UnifiedLive] Media error:', mediaError);
          const friendly = getFriendlyError(mediaError.message || 'media');
          toast.error(friendly.title, { description: friendly.description });
          // Continue - can still listen/watch
        }
      }

      // Start audio level monitoring
      startAudioLevelMonitoring();

      // Update database status for streams
      if (roomInfo.type !== 'audio_space' && role === 'host') {
        await supabase
          .from('live_streams')
          .update({ status: 'live', started_at: new Date().toISOString() })
          .eq('id', roomInfo.id);
      }

      // Set up presence channel with room_ended listener
      const presenceChannel = supabase.channel(`room-presence-${roomInfo.id}`, {
        config: { presence: { key: currentUser.id } },
      });

      presenceChannel
        .on('presence', { event: 'sync' }, () => {
          const presenceState = presenceChannel.presenceState();
          const count = Object.keys(presenceState).length;
          setState(prev => ({ ...prev, viewerCount: Math.max(count, room.remoteParticipants.size) }));
        })
        .on('broadcast', { event: 'room_ended' }, async (payload) => {
          // Host ended the room - auto-leave for all participants
          console.log('[UnifiedLive] Room ended by host:', payload);
          const roomType = roomInfoRef.current?.type;
          toast(roomType === 'audio_space' ? 'Host ended the space' : 'Host ended the stream');
          
          // Delay slightly then leave
          setTimeout(async () => {
            await leaveRoom();
          }, 1500);
        })
        .subscribe(async (status) => {
          if (status === 'SUBSCRIBED') {
            await presenceChannel.track({ user_id: currentUser.id, role });
          }
        });

      presenceChannelRef.current = presenceChannel;

      setState(prev => ({ ...prev, connectionStatus: 'connected' }));
      isConnectingRef.current = false;
      console.log('[UnifiedLive] ✅ Joined successfully');
      return true;

    } catch (error: any) {
      console.error('[UnifiedLive] Error joining:', error);
      const friendly = getFriendlyError(error?.message || 'connection');
      if (isTemporaryError(error?.message || '')) {
        toast(friendly.title, { description: friendly.description });
      } else {
        toast.error(friendly.title, { description: friendly.description });
      }
      setState(prev => ({ ...prev, connectionStatus: 'error' }));
      isConnectingRef.current = false;
      return false;
    }
  }, [playRemoteAudio, removeRemoteAudio, startAudioLevelMonitoring]);

  // ============= LEAVE ROOM =============

  const leaveRoom = useCallback(async () => {
    console.log('[UnifiedLive] Leaving room...');
    const currentUser = userRef.current;
    const roomInfo = roomInfoRef.current;

    stopAudioLevelMonitoring();

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

    // Remove audio elements
    audioElementsRef.current.forEach((el) => el.remove());
    audioElementsRef.current.clear();

    // Cleanup presence
    if (presenceChannelRef.current) {
      supabase.removeChannel(presenceChannelRef.current);
      presenceChannelRef.current = null;
    }

    // Update database
    if (roomInfo && currentUser) {
      if (roomInfo.type === 'audio_space') {
        // Update speaker record
        await supabase
          .from('live_space_speakers')
          .update({ left_at: new Date().toISOString() })
          .eq('space_id', roomInfo.id)
          .eq('user_id', currentUser.id);
        
        // If host, also end the space in database
        if (roleRef.current === 'host') {
          await supabase
            .from('live_spaces')
            .update({ status: 'ended', ended_at: new Date().toISOString() })
            .eq('id', roomInfo.id);
          
          // Broadcast room_ended event to all participants
          await supabase.channel(`room-presence-${roomInfo.id}`).send({
            type: 'broadcast',
            event: 'room_ended',
            payload: { roomId: roomInfo.id, hostId: currentUser.id }
          });
        }
      } else if (roleRef.current === 'host') {
        await supabase
          .from('live_streams')
          .update({ status: 'ended', ended_at: new Date().toISOString() })
          .eq('id', roomInfo.id);
        
        // Broadcast room_ended event to all participants
        await supabase.channel(`room-presence-${roomInfo.id}`).send({
          type: 'broadcast',
          event: 'room_ended',
          payload: { roomId: roomInfo.id, hostId: currentUser.id }
        });
      }
    }

    // Cleanup
    audioPlaybackManager.cleanup();
    document.querySelectorAll('[id^="unified-audio-"]').forEach(el => el.remove());

    setLocalStream(null);
    isConnectingRef.current = false;
    setState(defaultState);
    console.log('[UnifiedLive] ✅ Left room');
  }, [stopAudioLevelMonitoring]);

  // ============= CONTROLS =============

  const minimize = useCallback(() => {
    console.log('[UnifiedLive] Minimizing - connection persists');
    setState(prev => ({ ...prev, isMinimized: true }));
  }, []);

  const maximize = useCallback(() => {
    console.log('[UnifiedLive] Maximizing');
    setState(prev => ({ ...prev, isMinimized: false }));
  }, []);

  const toggleMute = useCallback(() => {
    // Prevent unmuting if hard-muted by host
    if (state.isHardMuted && state.isMuted) {
      toast.error('You have been muted by the host');
      return;
    }
    
    if (audioTrackRef.current) {
      const newMuted = !state.isMuted;
      if (newMuted) {
        audioTrackRef.current.mute();
      } else {
        audioTrackRef.current.unmute();
      }
      setState(prev => ({ ...prev, isMuted: newMuted }));
    }
  }, [state.isMuted, state.isHardMuted]);

  const toggleCamera = useCallback(() => {
    if (videoTrackRef.current) {
      const newCameraOff = state.isCameraOn;
      if (newCameraOff) {
        videoTrackRef.current.mute();
      } else {
        videoTrackRef.current.unmute();
      }
      setState(prev => ({ ...prev, isCameraOn: !newCameraOff }));
    }
  }, [state.isCameraOn]);

  const updateRole = useCallback(async (newRole: ParticipantRole) => {
    const previousRole = roleRef.current;
    roleRef.current = newRole;
    setState(prev => ({ ...prev, role: newRole }));

    const canNowBroadcast = newRole === 'host' || newRole === 'co_host' || newRole === 'speaker';
    const couldBroadcast = previousRole === 'host' || previousRole === 'co_host' || previousRole === 'speaker';

    // Promoted to broadcaster
    if (canNowBroadcast && !couldBroadcast && roomRef.current) {
      try {
        const audioTrack = await createLocalAudioTrack({
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        });

        audioTrackRef.current = audioTrack;
        await roomRef.current.localParticipant.publishTrack(audioTrack);
        
        const stream = new MediaStream([audioTrack.mediaStreamTrack]);
        setLocalStream(stream);
        
        setState(prev => ({ ...prev, isMuted: false }));
        console.log('[UnifiedLive] ✅ Started broadcasting after role upgrade');
      } catch (error) {
        console.error('[UnifiedLive] Failed to start broadcasting:', error);
      }
    }
  }, []);

  // ============= SCREEN SHARE =============

  const toggleScreenShare = useCallback(async () => {
    const roomInfo = roomInfoRef.current;
    const room = roomRef.current;
    
    if (!roomInfo || !room) return;
    
    if (roomInfo.type === 'audio_space') {
      toast.error('Screen sharing not available in audio spaces');
      return;
    }
    
    if (!state.role || !['host', 'co_host', 'speaker'].includes(state.role)) {
      toast.error('Only hosts and speakers can share screen');
      return;
    }

    try {
      if (state.isScreenSharing) {
        // Stop screen sharing
        await room.localParticipant.setScreenShareEnabled(false);
        setState(prev => ({ ...prev, isScreenSharing: false, screenShareTrack: null }));
        toast.success('Screen share stopped');
      } else {
      // Start screen sharing
        await room.localParticipant.setScreenShareEnabled(true);
        setState(prev => ({ 
          ...prev, 
          isScreenSharing: true,
        }));
        toast.success('Screen sharing started');
      }
    } catch (error: any) {
      console.error('[UnifiedLive] Screen share error:', error);
      // User likely cancelled the screen picker
      if (error.name !== 'NotAllowedError') {
        toast.error('Failed to share screen');
      }
    }
  }, [state.role, state.isScreenSharing]);

  // ============= RECORDING =============

  const toggleRecording = useCallback(async () => {
    const roomInfo = roomInfoRef.current;
    const currentUser = userRef.current;
    
    if (!roomInfo || !currentUser) return;
    
    if (state.role !== 'host') {
      toast.error('Only the host can control recording');
      return;
    }

    const roomType = roomInfo.type === 'audio_space' ? 'live_spaces' : 'live_streams';
    const action = state.isRecording ? 'stop' : 'start';

    try {
      setState(prev => ({ ...prev, isRecording: action === 'start' }));
      
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;

      const response = await supabase.functions.invoke('livekit-recording', {
        body: { action, roomId: roomInfo.id, roomType },
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
      });

      if (response.error) {
        throw new Error(response.error.message || 'Recording failed');
      }

      if (action === 'start') {
        toast.success('🔴 Recording started');
      } else {
        toast.success('Recording saved');
        if (response.data?.recordingUrl) {
          toast.info('Recording will be available shortly');
        }
      }
    } catch (error: any) {
      console.error('[UnifiedLive] Recording error:', error);
      // Revert state on error
      setState(prev => ({ ...prev, isRecording: action !== 'start' }));
      toast.error(error.message || 'Recording failed');
    }
  }, [state.role, state.isRecording]);

  // ============= HAND RAISE (Listeners only in audio spaces) =============

  const toggleRaiseHand = useCallback(async () => {
    const currentUser = userRef.current;
    const roomInfo = roomInfoRef.current;
    if (!currentUser || !roomInfo || roomInfo.type !== 'audio_space') return;
    if (state.role !== 'listener') {
      toast.info('Only listeners can raise their hand');
      return;
    }

    const newState = !state.hasRaisedHand;
    setState(prev => ({ ...prev, hasRaisedHand: newState }));

    try {
      await supabase
        .from('live_space_speakers')
        .update({ 
          has_raised_hand: newState,
          hand_raised_at: newState ? new Date().toISOString() : null
        })
        .eq('space_id', roomInfo.id)
        .eq('user_id', currentUser.id);

      toast.success(newState ? '✋ Hand raised!' : 'Hand lowered');
    } catch (error) {
      console.error('[UnifiedLive] Failed to toggle hand raise:', error);
      // Revert state on error
      setState(prev => ({ ...prev, hasRaisedHand: !newState }));
    }
  }, [state.role, state.hasRaisedHand]);

  // ============= MODERATION ACTIONS =============

  const muteParticipant = useCallback((userId: string) => {
    if (roleRef.current !== 'host' && roleRef.current !== 'co_host') {
      toast.error('Only hosts can mute participants');
      return;
    }

    setState(prev => ({
      ...prev,
      participants: prev.participants.map(p =>
        p.user_id === userId ? { ...p, is_muted: true, is_hard_muted: true } : p
      ),
    }));

    // TODO: Send mute command via LiveKit data channel
    toast.success('Participant muted');
  }, []);

  const unmuteParticipant = useCallback((userId: string) => {
    if (roleRef.current !== 'host' && roleRef.current !== 'co_host') {
      toast.error('Only hosts can unmute participants');
      return;
    }

    setState(prev => ({
      ...prev,
      participants: prev.participants.map(p =>
        p.user_id === userId ? { ...p, is_muted: false, is_hard_muted: false } : p
      ),
    }));

    toast.success('Participant can now speak');
  }, []);

  const muteAll = useCallback(() => {
    if (roleRef.current !== 'host' && roleRef.current !== 'co_host') {
      toast.error('Only hosts can mute all participants');
      return;
    }

    setState(prev => ({
      ...prev,
      participants: prev.participants.map(p => 
        p.role !== 'host' && p.role !== 'co_host' 
          ? { ...p, is_muted: true, is_hard_muted: true } 
          : p
      ),
    }));

    toast.success('All participants muted');
  }, []);

  const unmuteAll = useCallback(() => {
    if (roleRef.current !== 'host' && roleRef.current !== 'co_host') {
      toast.error('Only hosts can unmute all participants');
      return;
    }

    setState(prev => ({
      ...prev,
      participants: prev.participants.map(p => 
        p.role !== 'host' && p.role !== 'co_host' 
          ? { ...p, is_muted: false, is_hard_muted: false } 
          : p
      ),
    }));

    toast.success('All participants can now speak');
  }, []);

  const inviteToSpeak = useCallback(async (userId: string) => {
    if (roleRef.current !== 'host' && roleRef.current !== 'co_host') {
      toast.error('Only hosts can invite speakers');
      return;
    }

    const roomInfo = roomInfoRef.current;
    if (!roomInfo) return;

    // Update participant role
    setState(prev => ({
      ...prev,
      participants: prev.participants.map(p =>
        p.user_id === userId ? { ...p, role: 'speaker' as ParticipantRole, is_hard_muted: false } : p
      ),
    }));

    // Send notification to the user
    await supabase.from('notifications').insert({
      user_id: userId,
      from_user_id: userRef.current?.id,
      type: 'live_invite',
      title: 'Invited to speak!',
      message: `You've been invited to speak in "${roomInfo.title}"`,
      related_id: roomInfo.id,
      related_type: roomInfo.type === 'audio_space' ? 'space' : 'live_stream',
    });

    toast.success('Invitation sent');
  }, []);

  const removeFromSpeakers = useCallback((userId: string) => {
    if (roleRef.current !== 'host' && roleRef.current !== 'co_host') {
      toast.error('Only hosts can remove speakers');
      return;
    }

    setState(prev => ({
      ...prev,
      participants: prev.participants.map(p =>
        p.user_id === userId ? { ...p, role: 'listener' as ParticipantRole, is_muted: true, is_hard_muted: true } : p
      ),
    }));

    toast.success('Removed from speakers');
  }, []);

  // ============= FEATURE ACTIONS =============

  const sendBroadcastMessage = useCallback(async (message: string) => {
    if (roleRef.current !== 'host' && roleRef.current !== 'co_host') {
      toast.error('Only hosts can send broadcast messages');
      return;
    }

    const roomInfo = roomInfoRef.current;
    const currentUser = userRef.current;
    if (!roomInfo || !currentUser) return;

    try {
      if (roomInfo.type === 'audio_space') {
        await supabase.from('live_space_messages').insert({
          space_id: roomInfo.id,
          user_id: currentUser.id,
          content: `📢 ${message}`,
          is_broadcast: true,
        });
      } else {
        await supabase.from('live_stream_comments').insert({
          stream_id: roomInfo.id,
          user_id: currentUser.id,
          content: `📢 ${message}`,
        });
      }
    } catch (error) {
      console.error('[UnifiedLive] Failed to send broadcast message:', error);
      toast.error('Failed to send message');
    }
  }, []);

  const startPKBattle = useCallback(async (challengerId: string) => {
    if (roleRef.current !== 'host') {
      toast.error('Only hosts can start PK battles');
      return;
    }

    const roomInfo = roomInfoRef.current;
    if (!roomInfo || roomInfo.type !== 'video_broadcast') {
      toast.error('PK battles only available in video broadcasts');
      return;
    }

    // Get challenger profile
    const { data: challengerProfile } = await supabase
      .from('profiles')
      .select('id, display_name, username, avatar_url')
      .eq('id', challengerId)
      .single();

    if (!challengerProfile) {
      toast.error('Challenger not found');
      return;
    }

    // Update room to PK mode
    const updatedRoom: RoomInfo = {
      ...roomInfo,
      type: 'pk_battle',
      pkData: {
        challengerId,
        challengerName: challengerProfile.display_name || challengerProfile.username || 'Challenger',
        challengerAvatar: challengerProfile.avatar_url || '',
        hostScore: 0,
        challengerScore: 0,
        endTime: new Date(Date.now() + 300000).toISOString(), // 5 min battle
      },
    };

    roomInfoRef.current = updatedRoom;
    setState(prev => ({ ...prev, roomInfo: updatedRoom }));
    toast.success('PK Battle started!');
  }, []);

  useEffect(() => {
    let reconnectTimer: NodeJS.Timeout | null = null;
    let attempts = 0;
    const maxAttempts = 10;
    const baseDelay = 2000;

    if (state.isActive && state.connectionStatus === 'error') {
      const attemptReconnect = () => {
        if (attempts >= maxAttempts) {
          toast.error('Connection failed. Please rejoin.');
          return;
        }
        attempts++;
        const delay = Math.min(baseDelay * Math.pow(1.5, attempts - 1), 30000);
        setState(prev => ({ ...prev, connectionStatus: 'reconnecting' }));

        reconnectTimer = setTimeout(async () => {
          if (!state.isActive || !roomInfoRef.current) return;
          try {
            await joinRoom(roomInfoRef.current, roleRef.current);
            attempts = 0;
          } catch {
            attemptReconnect();
          }
        }, delay);
      };
      attemptReconnect();
    }

    const handleOnline = () => {
      if (state.isActive && state.connectionStatus !== 'connected' && roomInfoRef.current) {
        toast.info('Network restored. Reconnecting...');
        attempts = 0;
        joinRoom(roomInfoRef.current, roleRef.current);
      }
    };

    const handleOffline = () => {
      if (state.isActive) {
        toast.warning('Network disconnected');
        setState(prev => ({ ...prev, connectionStatus: 'error' }));
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      if (reconnectTimer) clearTimeout(reconnectTimer);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [state.isActive, state.connectionStatus, joinRoom]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopAudioLevelMonitoring();
      if (roomRef.current) roomRef.current.disconnect();
      if (videoTrackRef.current) videoTrackRef.current.stop();
      if (audioTrackRef.current) audioTrackRef.current.stop();
      if (presenceChannelRef.current) supabase.removeChannel(presenceChannelRef.current);
      audioElementsRef.current.forEach((el) => el.remove());
    };
  }, [stopAudioLevelMonitoring]);

  return (
    <UnifiedLiveContext.Provider
      value={{
        state,
        joinRoom,
        leaveRoom,
        minimize,
        maximize,
        toggleMute,
        toggleCamera,
        toggleScreenShare,
        toggleRecording,
        updateRole,
        toggleRaiseHand,
        // Moderation
        muteParticipant,
        unmuteParticipant,
        muteAll,
        unmuteAll,
        inviteToSpeak,
        removeFromSpeakers,
        // Features
        sendBroadcastMessage,
        startPKBattle,
        // LiveKit refs
        room: roomRef.current,
        videoTrack: videoTrackRef.current,
        audioTrack: audioTrackRef.current,
        localStream,
      }}
    >
      {children}
    </UnifiedLiveContext.Provider>
  );
};

export default UnifiedLiveContext;
