import { Button } from '@/components/ui/button';
import { Mic, MicOff, Video, VideoOff, PhoneOff, Monitor, MonitorOff, Volume2, VolumeX, Circle } from 'lucide-react';

interface CallControlsProps {
  isMuted: boolean;
  isVideoOff: boolean;
  isVideoCall: boolean;
  isScreenSharing?: boolean;
  isSpeakerOn?: boolean;
  isRecording?: boolean;
  onToggleMute: () => void;
  onToggleVideo: () => void;
  onToggleScreenShare?: () => void;
  onToggleSpeaker?: () => void;
  onToggleRecording?: () => void;
  onEndCall: () => void;
}

export const CallControls = ({
  isMuted,
  isVideoOff,
  isVideoCall,
  isScreenSharing = false,
  isSpeakerOn = true,
  isRecording = false,
  onToggleMute,
  onToggleVideo,
  onToggleScreenShare,
  onToggleSpeaker,
  onToggleRecording,
  onEndCall,
}: CallControlsProps) => {
  return (
    <div className="flex items-center justify-center space-x-3">
      {/* Mute/Unmute Button */}
      <Button
        onClick={onToggleMute}
        size="lg"
        variant={isMuted ? 'destructive' : 'secondary'}
        className="rounded-full w-14 h-14 p-0"
      >
        {isMuted ? (
          <MicOff className="w-6 h-6" />
        ) : (
          <Mic className="w-6 h-6" />
        )}
      </Button>

      {/* Video Toggle (only for video calls) */}
      {isVideoCall && (
        <Button
          onClick={onToggleVideo}
          size="lg"
          variant={isVideoOff ? 'destructive' : 'secondary'}
          className="rounded-full w-14 h-14 p-0"
        >
          {isVideoOff ? (
            <VideoOff className="w-6 h-6" />
          ) : (
            <Video className="w-6 h-6" />
          )}
        </Button>
      )}

      {/* Screen Share Toggle (only for video calls) */}
      {isVideoCall && onToggleScreenShare && (
        <Button
          onClick={onToggleScreenShare}
          size="lg"
          variant={isScreenSharing ? 'default' : 'secondary'}
          className="rounded-full w-14 h-14 p-0"
          title={isScreenSharing ? 'Stop sharing' : 'Share screen'}
        >
          {isScreenSharing ? (
            <MonitorOff className="w-6 h-6" />
          ) : (
            <Monitor className="w-6 h-6" />
          )}
        </Button>
      )}

      {/* Speaker Toggle */}
      {onToggleSpeaker && (
        <Button
          onClick={onToggleSpeaker}
          size="lg"
          variant={isSpeakerOn ? 'default' : 'secondary'}
          className="rounded-full w-14 h-14 p-0"
          title={isSpeakerOn ? 'Lower volume' : 'Speaker mode'}
        >
          {isSpeakerOn ? (
            <Volume2 className="w-6 h-6" />
          ) : (
            <VolumeX className="w-6 h-6" />
          )}
        </Button>
      )}

      {/* Recording Toggle */}
      {onToggleRecording && (
        <Button
          onClick={onToggleRecording}
          size="lg"
          variant={isRecording ? 'destructive' : 'secondary'}
          className="rounded-full w-14 h-14 p-0"
          title={isRecording ? 'Stop recording' : 'Start recording'}
        >
          <Circle className={`w-6 h-6 ${isRecording ? 'fill-current animate-pulse' : ''}`} />
        </Button>
      )}

      {/* End Call Button */}
      <Button
        onClick={onEndCall}
        size="lg"
        variant="destructive"
        className="rounded-full w-16 h-16 p-0 bg-red-600 hover:bg-red-700"
      >
        <PhoneOff className="w-7 h-7" />
      </Button>
    </div>
  );
};