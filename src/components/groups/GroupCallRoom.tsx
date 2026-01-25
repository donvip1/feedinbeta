import React, { useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useGroupCall, GroupCallParticipant } from '@/hooks/useGroupCall';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  PhoneOff,
  Users,
  Loader2,
  ArrowLeft,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Track } from 'livekit-client';

interface ParticipantTileProps {
  participant: GroupCallParticipant;
  isSpeaking: boolean;
}

const ParticipantTile: React.FC<ParticipantTileProps> = ({ participant, isSpeaking }) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && participant.videoTrack) {
      const mediaStream = new MediaStream();
      if (participant.videoTrack.mediaStreamTrack) {
        mediaStream.addTrack(participant.videoTrack.mediaStreamTrack);
        videoRef.current.srcObject = mediaStream;
      }
    }
  }, [participant.videoTrack]);

  return (
    <div
      className={cn(
        'relative rounded-2xl overflow-hidden bg-secondary aspect-video flex items-center justify-center',
        isSpeaking && 'ring-4 ring-green-500 ring-opacity-60'
      )}
    >
      {participant.isVideoOff || !participant.videoTrack ? (
        <div className="flex flex-col items-center">
          <Avatar className="w-20 h-20 mb-2">
            <AvatarImage src={participant.avatar} />
            <AvatarFallback className="text-2xl">
              {participant.name.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <span className="text-sm font-medium">{participant.name}</span>
        </div>
      ) : (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={participant.isLocal}
          className="w-full h-full object-cover"
        />
      )}

      {/* Name and status overlay */}
      <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/60 to-transparent">
        <div className="flex items-center justify-between">
          <span className="text-white text-sm font-medium">
            {participant.isLocal ? 'You' : participant.name}
          </span>
          <div className="flex items-center gap-2">
            {participant.isMuted && (
              <div className="w-6 h-6 rounded-full bg-red-500/80 flex items-center justify-center">
                <MicOff className="w-3 h-3 text-white" />
              </div>
            )}
            {isSpeaking && (
              <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center animate-pulse">
                <Mic className="w-3 h-3 text-white" />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const GroupCallRoom = () => {
  const navigate = useNavigate();
  const { groupId } = useParams<{ groupId: string }>();
  const { user, loading: authLoading } = useAuth();

  const {
    activeCall,
    participants,
    isConnected,
    isConnecting,
    isMuted,
    isVideoOff,
    speakingParticipantIds,
    joinCall,
    leaveCall,
    toggleMute,
    toggleVideo,
    checkActiveCall,
  } = useGroupCall(groupId || '');

  useEffect(() => {
    if (!groupId) {
      navigate('/groups');
      return;
    }

    // Check for active call and join if exists
    const initCall = async () => {
      const call = await checkActiveCall();
      if (call && !isConnected) {
        await joinCall(call.id);
      }
    };

    if (user && !authLoading) {
      initCall();
    }
  }, [groupId, user, authLoading]);

  const handleLeave = async () => {
    await leaveCall();
    navigate(`/groups/${groupId}/chat`);
  };

  if (authLoading || isConnecting) {
    return (
      <div className="h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">
            {isConnecting ? 'Joining call...' : 'Loading...'}
          </p>
        </div>
      </div>
    );
  }

  if (!activeCall && !isConnected) {
    return (
      <div className="h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">No active call in this group</p>
          <Button onClick={() => navigate(`/groups/${groupId}/chat`)}>
            Return to Chat
          </Button>
        </div>
      </div>
    );
  }

  // Calculate grid layout based on participant count
  const getGridCols = () => {
    if (participants.length <= 1) return 'grid-cols-1';
    if (participants.length <= 2) return 'grid-cols-2';
    if (participants.length <= 4) return 'grid-cols-2';
    if (participants.length <= 6) return 'grid-cols-3';
    return 'grid-cols-4';
  };

  return (
    <div className="h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={handleLeave}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="font-semibold">
              {activeCall?.callType === 'video' ? 'Video Call' : 'Voice Call'}
            </h1>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Users className="w-3 h-3" />
              <span>{participants.length} participant{participants.length !== 1 ? 's' : ''}</span>
            </div>
          </div>
        </div>
      </header>

      {/* Participants Grid */}
      <div className="flex-1 p-4 overflow-auto">
        <div className={cn('grid gap-4 h-full', getGridCols())}>
          {participants.map((participant) => (
            <ParticipantTile
              key={participant.id}
              participant={participant}
              isSpeaking={speakingParticipantIds.has(participant.odilUserId)}
            />
          ))}
        </div>
      </div>

      {/* Controls */}
      <div className="p-6 border-t border-border bg-card/50">
        <div className="flex items-center justify-center gap-4">
          <Button
            variant={isMuted ? 'destructive' : 'secondary'}
            size="lg"
            className="w-14 h-14 rounded-full"
            onClick={toggleMute}
          >
            {isMuted ? (
              <MicOff className="w-6 h-6" />
            ) : (
              <Mic className="w-6 h-6" />
            )}
          </Button>

          <Button
            variant={isVideoOff ? 'secondary' : 'default'}
            size="lg"
            className="w-14 h-14 rounded-full"
            onClick={toggleVideo}
          >
            {isVideoOff ? (
              <VideoOff className="w-6 h-6" />
            ) : (
              <Video className="w-6 h-6" />
            )}
          </Button>

          <Button
            variant="destructive"
            size="lg"
            className="w-14 h-14 rounded-full"
            onClick={handleLeave}
          >
            <PhoneOff className="w-6 h-6" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default GroupCallRoom;
