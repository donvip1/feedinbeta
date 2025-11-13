import { Button } from '@/components/ui/button';
import { Mic, MicOff, Video, VideoOff, PhoneOff, Volume2, SwitchCamera } from 'lucide-react';

interface CallControlsProps {
  isMuted: boolean;
  isVideoOff: boolean;
  isVideoCall: boolean;
  isSpeakerOn: boolean;
  onToggleMute: () => void;
  onToggleVideo: () => void;
  onToggleSpeaker: () => void;
  onEndCall: () => void;
}

export const CallControls = ({
  isMuted,
  isVideoOff,
  isVideoCall,
  isSpeakerOn,
  onToggleMute,
  onToggleVideo,
  onToggleSpeaker,
  onEndCall,
}: CallControlsProps) => {
  return (
    <div className="flex items-center justify-center gap-3 px-4">
      {/* Mute/Unmute Button */}
      <button
        onClick={onToggleMute}
        className={`rounded-full w-16 h-16 flex items-center justify-center transition-all ${
          isMuted 
            ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30' 
            : 'bg-white/10 text-white hover:bg-white/20'
        }`}
      >
        {isMuted ? (
          <MicOff className="w-6 h-6" />
        ) : (
          <Mic className="w-6 h-6" />
        )}
      </button>

      {/* Video Toggle (only for video calls) */}
      {isVideoCall && (
        <button
          onClick={onToggleVideo}
          className={`rounded-full w-16 h-16 flex items-center justify-center transition-all ${
            isVideoOff 
              ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30' 
              : 'bg-white/10 text-white hover:bg-white/20'
          }`}
        >
          {isVideoOff ? (
            <VideoOff className="w-6 h-6" />
          ) : (
            <Video className="w-6 h-6" />
          )}
        </button>
      )}

      {/* End Call Button */}
      <button
        onClick={onEndCall}
        className="rounded-full w-20 h-20 flex items-center justify-center bg-red-600 hover:bg-red-700 transition-all hover:scale-105 shadow-lg shadow-red-600/50"
      >
        <PhoneOff className="w-8 h-8 text-white" />
      </button>

      {/* Speaker Button */}
      <button
        onClick={onToggleSpeaker}
        className={`rounded-full w-16 h-16 flex items-center justify-center transition-all ${
          isSpeakerOn 
            ? 'bg-primary/20 text-primary hover:bg-primary/30' 
            : 'bg-white/10 text-white hover:bg-white/20'
        }`}
      >
        <Volume2 className="w-6 h-6" />
      </button>
    </div>
  );
};