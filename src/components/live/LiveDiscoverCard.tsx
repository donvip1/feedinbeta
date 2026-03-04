import { motion } from "framer-motion";
import { Users, Mic, Flame } from "lucide-react";
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

export const LiveDiscoverCard = ({
  id,
  title,
  hostName,
  hostAvatar,
  hostLevel,
  roomType,
  viewerCount,
  thumbnailUrl,
  isPremium,
  category,
  hashtags,
  description,
  onClick,
  className,
  participants,
  trendingScore,
}: LiveDiscoverCardProps) => {
  const formatViewers = (count: number) => {
    if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
    if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
    return count.toString();
  };

  return (
    <motion.div
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={cn(
        "bg-[#11131E] border border-white/5 rounded-[2.5rem] overflow-hidden hover:border-purple-500/30 transition-all cursor-pointer group relative",
        className
      )}
    >
      {/* Cover Image Banner */}
      {thumbnailUrl && (
        <div className="relative w-full h-28 overflow-hidden">
          <img
            src={thumbnailUrl}
            alt={title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#11131E] via-[#11131E]/40 to-transparent" />
        </div>
      )}

      <div className={cn("p-5", thumbnailUrl && "-mt-6 relative z-10")}>
        <div className="flex items-center gap-4">
          {/* Host Avatar */}
          <div className="relative shrink-0">
            <img
              src={hostAvatar || `https://i.pravatar.cc/150?u=${id}`}
              alt={hostName}
              className="w-16 h-16 rounded-3xl object-cover border-2 border-white/5 group-hover:border-purple-500/50 transition-all"
            />
            <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-purple-600 rounded-lg flex items-center justify-center border-2 border-[#11131E]">
              {roomType === "audio_space" ? (
                <Mic className="w-3 h-3 text-white" />
              ) : (
                <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
              )}
            </div>
            {hostLevel && (
              <div className="absolute -top-1 -left-1 bg-gradient-to-r from-amber-500 to-orange-500 text-[8px] font-bold px-1.5 rounded-lg text-white min-w-[18px] text-center border-2 border-[#11131E]">
                {hostLevel}
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-base text-white truncate pr-8 group-hover:text-purple-400 transition-colors">
              {title}
            </h3>
            <p className="text-xs text-slate-500 font-bold mb-1">Hosted by {hostName}</p>
            {description && (
              <p className="text-xs text-slate-400 line-clamp-2 mb-2">{description}</p>
            )}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 bg-white/5 px-2 py-0.5 rounded-lg text-[10px] font-black text-slate-400 uppercase">
                <Users className="w-3 h-3" /> {formatViewers(viewerCount)}
              </div>
              {(trendingScore || viewerCount > 50) && (
                <div className="flex items-center gap-1.5 bg-purple-500/10 px-2 py-0.5 rounded-lg text-[10px] font-black text-purple-400 uppercase">
                  <Flame className="w-3 h-3" /> {trendingScore || viewerCount}
                </div>
              )}
              {category && (
                <span className="text-[10px] bg-white/5 px-2 py-0.5 rounded-lg text-slate-500 capitalize font-bold">
                  {category.replace(/_/g, ' ')}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Stacked participant avatars in top-right */}
      {participants && participants.length > 0 && (
        <div className={cn("absolute right-6", thumbnailUrl ? "top-2" : "top-6")}>
          <div className="flex -space-x-3">
            {participants.slice(0, 3).map((p, i) => (
              <img
                key={i}
                src={p.avatar_url || `https://i.pravatar.cc/150?u=${id}-${i}`}
                className="w-8 h-8 rounded-xl border-2 border-[#11131E] object-cover"
              />
            ))}
          </div>
        </div>
      )}

      {/* Decorative glow */}
      <div className="absolute -bottom-10 -right-10 w-24 h-24 bg-purple-500/5 blur-[40px] rounded-full group-hover:bg-purple-500/10 transition-colors pointer-events-none" />
    </motion.div>
  );
};
