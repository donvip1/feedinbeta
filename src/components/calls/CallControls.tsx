import { Mic, MicOff, Video, VideoOff, PhoneOff, Volume2, SwitchCamera, Monitor, MonitorOff } from 'lucide-react';

interface CallControlsProps {
  isMuted: boolean;
  isVideoOff: boolean;
  isVideoCall: boolean;
  isSpeakerOn: boolean;
  isScreenSharing?: boolean;
  onToggleMute: () => void;
  onToggleVideo: () => void;
  onToggleSpeaker: () => void;
  onEndCall: () => void;
  onFlipCamera?: () => void;
  onToggleScreenShare?: () => void;
}

export const CallControls = ({
  isMuted,
  isVideoOff,
  isVideoCall,
  isSpeakerOn,
  isScreenSharing = false,
  onToggleMute,
  onToggleVideo,
  onToggleSpeaker,
  onEndCall,
  onFlipCamera,
  onToggleScreenShare,
}: CallControlsProps) => {
  return (
    <div className="flex items-center justify-center gap-3 px-4 flex-wrap">
      {/* Mute/Unmute Button */}
      <button
        onClick={onToggleMute}
        className={`rounded-full w-14 h-14 flex items-center justify-center transition-all ${
          isMuted 
            ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30' 
            : 'bg-white/10 text-white hover:bg-white/20'
        }`}
        title={isMuted ? 'Unmute' : 'Mute'}
      >
        {isMuted ? (
          <MicOff className="w-5 h-5" />
        ) : (
          <Mic className="w-5 h-5" />
        )}
      </button>

      {/* Video Toggle (only for video calls) */}
      {isVideoCall && (
        <button
          onClick={onToggleVideo}
          className={`rounded-full w-14 h-14 flex items-center justify-center transition-all ${
            isVideoOff 
              ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30' 
              : 'bg-white/10 text-white hover:bg-white/20'
          }`}
          title={isVideoOff ? 'Turn on camera' : 'Turn off camera'}
        >
          {isVideoOff ? (
            <VideoOff className="w-5 h-5" />
          ) : (
            <Video className="w-5 h-5" />
          )}
        </button>
      )}

      {/* Flip Camera (only for video calls on mobile) */}
      {isVideoCall && onFlipCamera && (
        <button
          onClick={onFlipCamera}
          className="rounded-full w-14 h-14 flex items-center justify-center bg-white/10 text-white hover:bg-white/20 transition-all"
          title="Flip camera"
        >
          <SwitchCamera className="w-5 h-5" />
        </button>
      )}

      {/* Screen Share (only for video calls on desktop) */}
      {isVideoCall && onToggleScreenShare && (
        <button
          onClick={onToggleScreenShare}
          className={`rounded-full w-14 h-14 flex items-center justify-center transition-all ${
            isScreenSharing
              ? 'bg-primary/20 text-primary hover:bg-primary/30'
              : 'bg-white/10 text-white hover:bg-white/20'
          }`}
          title={isScreenSharing ? 'Stop sharing' : 'Share screen'}
        >
          {isScreenSharing ? (
            <MonitorOff className="w-5 h-5" />
          ) : (
            <Monitor className="w-5 h-5" />
          )}
        </button>
      )}

      {/* End Call Button */}
      <button
        onClick={onEndCall}
        className="rounded-full w-16 h-16 flex items-center justify-center bg-red-600 hover:bg-red-700 transition-all hover:scale-105 shadow-lg shadow-red-600/50"
        title="End call"
      >
        <PhoneOff className="w-6 h-6 text-white" />
      </button>

      {/* Speaker Button */}
      <button
        onClick={onToggleSpeaker}
        className={`rounded-full w-14 h-14 flex items-center justify-center transition-all ${
          isSpeakerOn 
            ? 'bg-primary/20 text-primary hover:bg-primary/30' 
            : 'bg-white/10 text-white hover:bg-white/20'
        }`}
        title={isSpeakerOn ? 'Switch to earpiece' : 'Switch to speaker'}
      >
        <Volume2 className="w-5 h-5" />
      </button>
    </div>
  );
};
