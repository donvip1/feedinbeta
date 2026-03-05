import { motion } from "framer-motion";
import { Users } from "lucide-react";
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
        "relative aspect-[3/4] rounded-2xl overflow-hidden cursor-pointer bg-zinc-900",
        className
      )}
    >
      {/* Full portrait thumbnail */}
      {thumbnailUrl ? (
        <img
          src={thumbnailUrl}
          alt={title}
          className="absolute inset-0 w-full h-full object-cover"
        />
      ) : (
        <div className={cn(
          "absolute inset-0 bg-gradient-to-br",
          roomType === "audio_space"
            ? "from-green-900/80 to-emerald-900/80"
            : roomType === "pk_battle"
            ? "from-blue-900/80 via-purple-900/80 to-red-900/80"
            : "from-pink-900/80 to-red-900/80"
        )} />
      )}

      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/40" />

      {/* Top badges */}
      <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 uppercase tracking-wider">
            <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
            Live
          </span>
          {category && (
            <span className="text-[10px] font-medium text-white/80 bg-black/40 backdrop-blur-sm px-2 py-0.5 rounded-full capitalize">
              {category.replace(/_/g, ' ')}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 bg-black/50 backdrop-blur-sm text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
          <Users className="w-3 h-3" />
          {formatViewers(viewerCount)}
        </div>
      </div>

      {/* Bottom content */}
      <div className="absolute bottom-0 left-0 right-0 p-3">
        {hashtags && hashtags.length > 0 && (
          <div className="flex gap-1.5 flex-wrap mb-2">
            {hashtags.slice(0, 2).map((tag) => (
              <span key={tag} className="text-[9px] font-bold text-white/80 bg-white/10 backdrop-blur-sm px-2 py-0.5 rounded-full">
                #{tag}
              </span>
            ))}
          </div>
        )}
        <div className="flex items-center gap-2">
          <img
            src={hostAvatar || `https://i.pravatar.cc/150?u=${id}`}
            alt={hostName}
            className="w-7 h-7 rounded-full object-cover border border-white/20"
          />
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-xs text-white truncate">{hostName}</p>
            <p className="text-white/60 text-[10px] truncate">{title}</p>
          </div>
        </div>
      </div>
    </motion.div>
  );
};
