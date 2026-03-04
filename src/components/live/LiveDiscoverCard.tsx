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
  onClick: () => void;
  className?: string;
  // Optional participants for stacked avatar display
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
        "bg-[#11131E] border border-white/5 rounded-[2.5rem] p-5 hover:border-purple-500/30 transition-all cursor-pointer group relative overflow-hidden",
        className
      )}
    >
      <div className="flex items-center gap-4 relative z-10">
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
          <p className="text-xs text-slate-500 font-bold mb-2">Hosted by {hostName}</p>
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

      {/* Stacked participant avatars in top-right */}
      {participants && participants.length > 0 && (
        <div className="absolute top-6 right-6">
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
