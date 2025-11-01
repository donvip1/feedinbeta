import { Button } from '@/components/ui/button';
import { Mic, MicOff, Video, VideoOff, PhoneOff, Volume2, SwitchCamera } from 'lucide-react';

interface CallControlsProps {
  isMuted: boolean;
  isVideoOff: boolean;
  isVideoCall: boolean;
  onToggleMute: () => void;
  onToggleVideo: () => void;
  onEndCall: () => void;
}

export const CallControls = ({
  isMuted,
  isVideoOff,
  isVideoCall,
  onToggleMute,
  onToggleVideo,
  onEndCall,
}: CallControlsProps) => {
  return (
    <div className="flex items-center justify-center space-x-4">
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

      {/* End Call Button */}
      <Button
        onClick={onEndCall}
        size="lg"
        variant="destructive"
        className="rounded-full w-16 h-16 p-0 bg-red-600 hover:bg-red-700"
      >
        <PhoneOff className="w-7 h-7" />
      </Button>

      {/* Speaker Button (future enhancement) */}
      <Button
        size="lg"
        variant="secondary"
        className="rounded-full w-14 h-14 p-0"
      >
        <Volume2 className="w-6 h-6" />
      </Button>

      {/* Switch Camera (only for video calls) */}
      {isVideoCall && (
        <Button
          size="lg"
          variant="secondary"
          className="rounded-full w-14 h-14 p-0"
        >
          <SwitchCamera className="w-6 h-6" />
        </Button>
      )}
    </div>
  );
};