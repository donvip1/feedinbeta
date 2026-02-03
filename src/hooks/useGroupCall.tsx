import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Room, RoomEvent, RemoteParticipant, LocalParticipant, Track, Participant } from 'livekit-client';
import { toast } from 'sonner';
import { getFriendlyError, isTemporaryError } from '@/lib/error-messages';

export interface GroupCallParticipant {
  id: string;
  odilUserId: string;
  name: string;
  avatar?: string;
  isMuted: boolean;
  isVideoOff: boolean;
  isSpeaking: boolean;
  isLocal: boolean;
  videoTrack?: Track;
  audioTrack?: Track;
}

export interface ActiveGroupCall {
  id: string;
  groupId: string;
  callType: 'voice' | 'video';
  startedAt: string;
  participantCount: number;
  livekitRoomName: string;
}

interface UseGroupCallResult {
  activeCall: ActiveGroupCall | null;
  participants: GroupCallParticipant[];
  room: Room | null;
  isConnected: boolean;
  isConnecting: boolean;
  isMuted: boolean;
  isVideoOff: boolean;
  speakingParticipantIds: Set<string>;
  startCall: (callType: 'voice' | 'video') => Promise<string | null>;
  joinCall: (callId: string) => Promise<boolean>;
  leaveCall: () => Promise<void>;
  endCall: () => Promise<void>;
  toggleMute: () => void;
  toggleVideo: () => void;
  checkActiveCall: () => Promise<ActiveGroupCall | null>;
}

export function useGroupCall(groupId: string): UseGroupCallResult {
  const { user } = useAuth();
  const [activeCall, setActiveCall] = useState<ActiveGroupCall | null>(null);
  const [participants, setParticipants] = useState<GroupCallParticipant[]>([]);
  const [room, setRoom] = useState<Room | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(true);
  const [speakingParticipantIds, setSpeakingParticipantIds] = useState<Set<string>>(new Set());
  const roomRef = useRef<Room | null>(null);

  // Check for active call in group
  const checkActiveCall = useCallback(async (): Promise<ActiveGroupCall | null> => {
    const { data, error } = await supabase
      .from('group_calls')
      .select(`
        id,
        group_id,
        call_type,
        started_at,
        livekit_room_name,
        group_call_participants(id)
      `)
      .eq('group_id', groupId)
      .eq('status', 'active')
      .single();

    if (error || !data) {
      setActiveCall(null);
      return null;
    }

    const call: ActiveGroupCall = {
      id: data.id,
      groupId: data.group_id,
      callType: data.call_type as 'voice' | 'video',
      startedAt: data.started_at,
      participantCount: data.group_call_participants?.length || 0,
      livekitRoomName: data.livekit_room_name,
    };

    setActiveCall(call);
    return call;
  }, [groupId]);

  // Subscribe to call changes
  useEffect(() => {
    checkActiveCall();

    const channel = supabase
      .channel(`group-calls-${groupId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'group_calls',
          filter: `group_id=eq.${groupId}`,
        },
        () => {
          checkActiveCall();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'group_call_participants',
        },
        () => {
          checkActiveCall();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [groupId, checkActiveCall]);

  // Update participants from LiveKit room
  const updateParticipantsFromRoom = useCallback(async (lkRoom: Room) => {
    const participantsList: GroupCallParticipant[] = [];

    // Add local participant
    const local = lkRoom.localParticipant;
    if (local) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('display_name, avatar_url')
        .eq('id', local.identity)
        .single();

      participantsList.push({
        id: local.sid,
        odilUserId: local.identity,
        name: profile?.display_name || 'You',
        avatar: profile?.avatar_url,
        isMuted: !local.isMicrophoneEnabled,
        isVideoOff: !local.isCameraEnabled,
        isSpeaking: local.isSpeaking,
        isLocal: true,
        videoTrack: local.getTrackPublication(Track.Source.Camera)?.track,
        audioTrack: local.getTrackPublication(Track.Source.Microphone)?.track,
      });
    }

    // Add remote participants
    for (const participant of lkRoom.remoteParticipants.values()) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('display_name, avatar_url')
        .eq('id', participant.identity)
        .single();

      participantsList.push({
        id: participant.sid,
        odilUserId: participant.identity,
        name: profile?.display_name || 'Unknown',
        avatar: profile?.avatar_url,
        isMuted: !participant.isMicrophoneEnabled,
        isVideoOff: !participant.isCameraEnabled,
        isSpeaking: participant.isSpeaking,
        isLocal: false,
        videoTrack: participant.getTrackPublication(Track.Source.Camera)?.track,
        audioTrack: participant.getTrackPublication(Track.Source.Microphone)?.track,
      });
    }

    setParticipants(participantsList);
  }, []);

  // Start a new call
  const startCall = useCallback(async (callType: 'voice' | 'video'): Promise<string | null> => {
    if (!user) return null;

    try {
      setIsConnecting(true);
      const roomName = `group-call-${groupId}-${Date.now()}`;

      // Create call in database
      const { data: callData, error: callError } = await supabase
        .from('group_calls')
        .insert({
          group_id: groupId,
          initiated_by: user.id,
          call_type: callType,
          livekit_room_name: roomName,
        })
        .select()
        .single();

      if (callError) throw callError;

      // Join the call
      await joinCall(callData.id);
      return callData.id;
    } catch (error: any) {
      console.error('Error starting call:', error);
      const friendly = getFriendlyError(error?.message || 'connection');
      toast.error(friendly.title, { description: friendly.description });
      setIsConnecting(false);
      return null;
    }
  }, [user, groupId]);

  // Join existing call
  const joinCall = useCallback(async (callId: string): Promise<boolean> => {
    if (!user) return false;

    try {
      setIsConnecting(true);

      // Get call details
      const { data: callData, error: callError } = await supabase
        .from('group_calls')
        .select('*')
        .eq('id', callId)
        .single();

      if (callError || !callData) throw new Error('Call not found');

      // Get LiveKit token
      const { data: tokenData, error: tokenError } = await supabase.functions.invoke('livekit-token', {
        body: {
          roomName: callData.livekit_room_name,
          participantIdentity: user.id,
          participantName: user.user_metadata?.display_name || 'User',
        },
      });

      if (tokenError || !tokenData?.token) throw new Error('Failed to get token');

      // Create and connect room
      const lkRoom = new Room();
      roomRef.current = lkRoom;
      setRoom(lkRoom);

      // Set up event handlers
      lkRoom.on(RoomEvent.ParticipantConnected, () => updateParticipantsFromRoom(lkRoom));
      lkRoom.on(RoomEvent.ParticipantDisconnected, () => updateParticipantsFromRoom(lkRoom));
      lkRoom.on(RoomEvent.TrackSubscribed, () => updateParticipantsFromRoom(lkRoom));
      lkRoom.on(RoomEvent.TrackUnsubscribed, () => updateParticipantsFromRoom(lkRoom));
      lkRoom.on(RoomEvent.TrackMuted, () => updateParticipantsFromRoom(lkRoom));
      lkRoom.on(RoomEvent.TrackUnmuted, () => updateParticipantsFromRoom(lkRoom));
      lkRoom.on(RoomEvent.ActiveSpeakersChanged, (speakers: Participant[]) => {
        setSpeakingParticipantIds(new Set(speakers.map(s => s.identity)));
        updateParticipantsFromRoom(lkRoom);
      });
      lkRoom.on(RoomEvent.Disconnected, () => {
        setIsConnected(false);
        setParticipants([]);
      });

      // Connect to room
      await lkRoom.connect(tokenData.url, tokenData.token);

      // Enable audio by default
      await lkRoom.localParticipant.setMicrophoneEnabled(true);
      setIsMuted(false);

      // Enable video for video calls
      if (callData.call_type === 'video') {
        await lkRoom.localParticipant.setCameraEnabled(true);
        setIsVideoOff(false);
      }

      // Add participant to database
      await supabase
        .from('group_call_participants')
        .upsert({
          call_id: callId,
          user_id: user.id,
          is_muted: false,
          is_video_off: callData.call_type !== 'video',
        });

      setIsConnected(true);
      updateParticipantsFromRoom(lkRoom);
      await checkActiveCall();

      return true;
    } catch (error: any) {
      console.error('Error joining call:', error);
      const friendly = getFriendlyError(error?.message || 'connection');
      if (isTemporaryError(error?.message || '')) {
        toast(friendly.title, { description: friendly.description });
      } else {
        toast.error(friendly.title, { description: friendly.description });
      }
      return false;
    } finally {
      setIsConnecting(false);
    }
  }, [user, updateParticipantsFromRoom, checkActiveCall]);

  // Leave call
  const leaveCall = useCallback(async () => {
    if (!user || !activeCall) return;

    try {
      // Disconnect from LiveKit
      if (roomRef.current) {
        roomRef.current.disconnect();
        roomRef.current = null;
      }

      setRoom(null);
      setIsConnected(false);
      setParticipants([]);

      // Update database
      await supabase
        .from('group_call_participants')
        .update({ left_at: new Date().toISOString() })
        .eq('call_id', activeCall.id)
        .eq('user_id', user.id);

      // Check if we're the last participant
      const { data: remainingParticipants } = await supabase
        .from('group_call_participants')
        .select('id')
        .eq('call_id', activeCall.id)
        .is('left_at', null);

      // End call if no participants left
      if (!remainingParticipants || remainingParticipants.length === 0) {
        await supabase
          .from('group_calls')
          .update({ status: 'ended', ended_at: new Date().toISOString() })
          .eq('id', activeCall.id);
      }

      setActiveCall(null);
    } catch (error) {
      console.error('Error leaving call:', error);
    }
  }, [user, activeCall]);

  // End call for everyone
  const endCall = useCallback(async () => {
    if (!activeCall) return;

    try {
      await supabase
        .from('group_calls')
        .update({ status: 'ended', ended_at: new Date().toISOString() })
        .eq('id', activeCall.id);

      await leaveCall();
    } catch (error) {
      console.error('Error ending call:', error);
    }
  }, [activeCall, leaveCall]);

  // Toggle mute
  const toggleMute = useCallback(() => {
    if (!roomRef.current) return;

    const newMuted = !isMuted;
    roomRef.current.localParticipant.setMicrophoneEnabled(!newMuted);
    setIsMuted(newMuted);

    // Update database
    if (user && activeCall) {
      supabase
        .from('group_call_participants')
        .update({ is_muted: newMuted })
        .eq('call_id', activeCall.id)
        .eq('user_id', user.id);
    }
  }, [isMuted, user, activeCall]);

  // Toggle video
  const toggleVideo = useCallback(() => {
    if (!roomRef.current) return;

    const newVideoOff = !isVideoOff;
    roomRef.current.localParticipant.setCameraEnabled(!newVideoOff);
    setIsVideoOff(newVideoOff);

    // Update database
    if (user && activeCall) {
      supabase
        .from('group_call_participants')
        .update({ is_video_off: newVideoOff })
        .eq('call_id', activeCall.id)
        .eq('user_id', user.id);
    }
  }, [isVideoOff, user, activeCall]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (roomRef.current) {
        roomRef.current.disconnect();
      }
    };
  }, []);

  return {
    activeCall,
    participants,
    room,
    isConnected,
    isConnecting,
    isMuted,
    isVideoOff,
    speakingParticipantIds,
    startCall,
    joinCall,
    leaveCall,
    endCall,
    toggleMute,
    toggleVideo,
    checkActiveCall,
  };
}
