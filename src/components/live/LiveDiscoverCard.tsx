import { motion } from "framer-motion";
import { Users, Flame } from "lucide-react";
import { cn } from "@/lib/utils";

type RoomType = "video_broadcast" | "audio_space" | "pk_battle";

interface LiveDiscoverCardProps {
  id: string;
  title: string;
  hostName: string;
  hostAvatar?: string;
  hostLevel?: number;
  roomType: RoomType;
  viewerCount: number;
  thumbnailUrl?: string;
  isPremium?: boolean;
  category?: string;
  hashtags?: string[];
  description?: string;
  onClick: () => void;
  className?: string;
  participants?: { avatar_url?: string }[];
  trendingScore?: number;
}

const formatViewers = (count: number) => {
  if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
  if (count >= 1000) return `${(count / 1000).toFixed(1)}k`;
  return count.toString();
};

export const LiveDiscoverCard = ({
  id,
  title,
  hostName,
  hostAvatar,
  roomType,
  viewerCount,
  thumbnailUrl,
  category,
  hashtags,
  onClick,
  className,
}: LiveDiscoverCardProps) => {
  return (
    <motion.div
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={cn(
        "bg-zinc-900 rounded-2xl overflow-hidden active:scale-[0.98] transition-transform cursor-pointer",
        className
      )}
    >
      {/* Portrait-style tall thumbnail area */}
      <div className="relative h-48 w-full overflow-hidden">
        {thumbnailUrl ? (
          <img
            src={thumbnailUrl}
            alt={title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-purple-900/50 to-pink-900/50" />
        )}

        {/* Live badge */}
        <div className="absolute top-3 left-3 flex items-center gap-1.5">
          <span className="bg-red-500 text-white text-[10px] font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1 uppercase tracking-wider">
            <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
            Live
          </span>
          {category && (
            <span className="text-[10px] font-medium text-white/80 bg-black/40 backdrop-blur-sm px-2 py-0.5 rounded-full capitalize">
              {category.replace(/_/g, ' ')}
            </span>
          )}
        </div>

        {/* Viewer count badge */}
        <div className="absolute top-3 right-3 flex items-center gap-1 bg-black/50 backdrop-blur-sm text-white text-[10px] font-bold px-2.5 py-0.5 rounded-full">
          <Users className="w-3 h-3" />
          {formatViewers(viewerCount)}
        </div>

        {/* Tags at bottom of thumbnail */}
        {hashtags && hashtags.length > 0 && (
          <div className="absolute bottom-2.5 left-3 flex gap-1.5 flex-wrap">
            {hashtags.slice(0, 3).map((tag) => (
              <span key={tag} className="text-[9px] font-bold text-white/80 bg-white/10 backdrop-blur-sm px-2 py-0.5 rounded-full">
                #{tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Card body */}
      <div className="p-4">
        <div className="flex items-center gap-2 mb-1">
          <img
            src={hostAvatar || `https://i.pravatar.cc/150?u=${id}`}
            alt={hostName}
            className="w-8 h-8 rounded-full object-cover border border-white/10"
          />
          <span className="font-semibold text-sm text-white">{hostName}</span>
        </div>
        <p className="text-white/70 text-sm line-clamp-2">{title}</p>
      </div>
    </motion.div>
  );
};
