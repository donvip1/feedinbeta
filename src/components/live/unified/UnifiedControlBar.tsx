import { motion } from "framer-motion";
import { 
  Mic, MicOff, Video, VideoOff, 
  MessageCircle, Gift, Share2, 
  PhoneOff, Settings
} from "lucide-react";
import { cn } from "@/lib/utils";
import { StreamOptionsMenu } from "../StreamOptionsMenu";

type RoomType = 'video_broadcast' | 'audio_space' | 'pk_battle';

interface UnifiedControlBarProps {
  roomType: RoomType;
  isHost: boolean;
  isMuted: boolean;
  isCameraOn: boolean;
  streamId?: string;
  hostId?: string;
  streamTitle?: string;
  onMicToggle: () => void;
  onCameraToggle: () => void;
  onChatToggle: () => void;
  onGiftClick: () => void;
  onShareClick: () => void;
  onEndStream: () => void;
  onMinimize?: () => void;
  onSettingsClick?: () => void;
  className?: string;
}

export const UnifiedControlBar = ({
  roomType,
  isHost,
  isMuted,
  isCameraOn,
  streamId = '',
  hostId = '',
  streamTitle = 'Live Stream',
  onMicToggle,
  onCameraToggle,
  onChatToggle,
  onGiftClick,
  onShareClick,
  onEndStream,
  onMinimize,
  onSettingsClick,
  className,
}: UnifiedControlBarProps) => {
  const showVideoControls = roomType === 'video_broadcast' || roomType === 'pk_battle';

  return (
    <motion.div
      initial={{ y: 100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className={cn(
        "absolute bottom-0 left-0 right-0 z-30",
        "bg-gradient-to-t from-black/90 via-black/60 to-transparent",
        "px-4 py-6 pb-8",
        className
      )}
    >
      <div className="flex items-center justify-between max-w-lg mx-auto">
        {/* Left Side - Viewer Actions */}
        {!isHost && (
          <div className="flex items-center gap-3">
            <ControlButton
              icon={<MessageCircle className="w-5 h-5" />}
              onClick={onChatToggle}
            />
            <ControlButton
              icon={<Gift className="w-5 h-5" />}
              onClick={onGiftClick}
              highlight
            />
          </div>
        )}

        {/* Center - Host Controls */}
        {isHost && (
          <div className="flex items-center gap-4 mx-auto">
            {/* Mic Toggle */}
            <ControlButton
              icon={isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
              onClick={onMicToggle}
              active={!isMuted}
              danger={isMuted}
            />

            {/* End Stream Button */}
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={onEndStream}
              className="w-14 h-14 rounded-full bg-red-600 hover:bg-red-700 flex items-center justify-center shadow-lg shadow-red-500/30 transition-colors"
            >
              <PhoneOff className="w-6 h-6 text-white" />
            </motion.button>

            {/* Camera Toggle (Video modes only) */}
            {showVideoControls && (
              <ControlButton
                icon={isCameraOn ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
                onClick={onCameraToggle}
                active={isCameraOn}
                danger={!isCameraOn}
              />
            )}

            {/* Audio Space - Settings */}
            {roomType === 'audio_space' && (
              <ControlButton
                icon={<Settings className="w-5 h-5" />}
                onClick={onSettingsClick || (() => {})}
              />
            )}
          </div>
        )}

        {/* Right Side - Common Actions */}
        <div className="flex items-center gap-3">
          <ControlButton
            icon={<Share2 className="w-5 h-5" />}
            onClick={onShareClick}
          />
          <StreamOptionsMenu
            isHost={isHost}
            streamId={streamId}
            hostId={hostId}
            streamTitle={streamTitle}
            onEndStream={onEndStream}
          />
        </div>
      </div>
    </motion.div>
  );
};

interface ControlButtonProps {
  icon: React.ReactNode;
  onClick: () => void;
  active?: boolean;
  danger?: boolean;
  highlight?: boolean;
}

const ControlButton = ({ 
  icon, 
  onClick, 
  active, 
  danger,
  highlight,
}: ControlButtonProps) => {
  return (
    <motion.button
      whileTap={{ scale: 0.9 }}
      onClick={onClick}
      className={cn(
        "p-3 rounded-full flex items-center justify-center transition-colors",
        active && "bg-white text-black",
        danger && "bg-slate-800 text-white",
        highlight && "bg-gradient-to-r from-pink-500 to-orange-500 text-white",
        !active && !danger && !highlight && "bg-white/10 text-white hover:bg-white/20"
      )}
    >
      {icon}
    </motion.button>
  );
};
