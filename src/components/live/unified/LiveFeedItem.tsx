import { motion } from "framer-motion";
import { Users, Radio, Zap, Mic, Video } from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

type RoomType = 'video_broadcast' | 'audio_space' | 'pk_battle';

interface LiveFeedItemProps {
  id: string;
  title: string;
  hostName: string;
  hostAvatar?: string;
  hostLevel?: number;
  roomType: RoomType;
  viewerCount: number;
  thumbnailUrl?: string;
  isPremium?: boolean;
  onClick: () => void;
  className?: string;
}

export const LiveFeedItem = ({
  id,
  title,
  hostName,
  hostAvatar,
  hostLevel,
  roomType,
  viewerCount,
  thumbnailUrl,
  isPremium,
  onClick,
  className,
}: LiveFeedItemProps) => {
  const formatViewers = (count: number) => {
    if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
    if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
    return count.toString();
  };

  const getRoomTypeConfig = (type: RoomType) => {
    switch (type) {
      case 'pk_battle':
        return {
          label: 'PK BATTLE',
          icon: Zap,
          gradient: 'from-blue-500 via-purple-500 to-red-500',
          bgColor: 'bg-gradient-to-r from-blue-500/20 to-red-500/20',
        };
      case 'audio_space':
        return {
          label: 'AUDIO SPACE',
          icon: Mic,
          gradient: 'from-green-500 to-emerald-500',
          bgColor: 'bg-green-500/20',
        };
      default:
        return {
          label: 'LIVE',
          icon: Video,
          gradient: 'from-red-500 to-pink-500',
          bgColor: 'bg-red-500/20',
        };
    }
  };

  const config = getRoomTypeConfig(roomType);
  const Icon = config.icon;

  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={cn(
        "relative aspect-[9/16] rounded-2xl overflow-hidden cursor-pointer",
        "bg-gradient-to-br from-muted to-muted/50",
        className
      )}
    >
      {/* Background Image/Gradient */}
      {thumbnailUrl ? (
        <img
          src={thumbnailUrl}
          alt={title}
          className="absolute inset-0 w-full h-full object-cover"
        />
      ) : (
        <div className={cn(
          "absolute inset-0 bg-gradient-to-br",
          roomType === 'pk_battle' 
            ? "from-blue-900/80 via-purple-900/80 to-red-900/80"
            : roomType === 'audio_space'
            ? "from-green-900/80 to-emerald-900/80"
            : "from-pink-900/80 to-red-900/80"
        )} />
      )}

      {/* Overlay Gradient */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30" />

      {/* Top Badges */}
      <div className="absolute top-3 left-3 right-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {/* Live Badge */}
          <motion.div
            animate={{ opacity: [1, 0.7, 1] }}
            transition={{ duration: 1.5, repeat: Infinity }}
            className={cn(
              "flex items-center gap-1 px-2 py-1 rounded-full text-white text-xs font-bold",
              `bg-gradient-to-r ${config.gradient}`
            )}
          >
            <Radio className="w-3 h-3" />
            LIVE
          </motion.div>

          {/* Room Type Badge */}
          {roomType !== 'video_broadcast' && (
            <div className={cn(
              "flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium",
              config.bgColor, "text-white backdrop-blur-sm"
            )}>
              <Icon className="w-3 h-3" />
              {config.label}
            </div>
          )}
        </div>

        {/* Premium Badge */}
        {isPremium && (
          <div className="bg-gradient-to-r from-yellow-500 to-orange-500 px-2 py-1 rounded-full text-xs font-bold text-white">
            PREMIUM
          </div>
        )}
      </div>

      {/* Bottom Content */}
      <div className="absolute bottom-0 left-0 right-0 p-4">
        {/* Host Info */}
        <div className="flex items-center gap-2 mb-2">
          <div className="relative">
            <Avatar className="w-10 h-10 border-2 border-white/30">
              <AvatarImage src={hostAvatar} alt={hostName} />
              <AvatarFallback>{hostName.charAt(0)}</AvatarFallback>
            </Avatar>
            {hostLevel && (
              <div className="absolute -bottom-1 -right-1 bg-gradient-to-r from-yellow-500 to-orange-500 text-[10px] font-bold px-1.5 rounded-full text-white">
                {hostLevel}
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-white truncate">{hostName}</p>
            <p className="text-sm text-white/70 truncate">{title}</p>
          </div>
        </div>

        {/* Viewer Count */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1 text-white/80 text-sm">
            <Users className="w-4 h-4" />
            <span>{formatViewers(viewerCount)}</span>
          </div>

          {roomType === 'video_broadcast' && (
            <div className="bg-white/10 backdrop-blur-sm px-2 py-0.5 rounded text-xs text-white/80">
              HD
            </div>
          )}
        </div>
      </div>

      {/* Animated Border for PK Battle */}
      {roomType === 'pk_battle' && (
        <motion.div
          className="absolute inset-0 rounded-2xl pointer-events-none"
          animate={{
            boxShadow: [
              "inset 0 0 20px rgba(59, 130, 246, 0.5)",
              "inset 0 0 20px rgba(239, 68, 68, 0.5)",
              "inset 0 0 20px rgba(59, 130, 246, 0.5)",
            ],
          }}
          transition={{ duration: 2, repeat: Infinity }}
        />
      )}
    </motion.div>
  );
};
