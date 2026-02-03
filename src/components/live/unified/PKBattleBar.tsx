import { motion } from "framer-motion";
import { Zap } from "lucide-react";
import { cn } from "@/lib/utils";

interface PKBattleBarProps {
  hostScore: number;
  challengerScore: number;
  timeLeft: number;
  hostName?: string;
  challengerName?: string;
  hostAvatar?: string;
  challengerAvatar?: string;
  className?: string;
}

export const PKBattleBar = ({
  hostScore,
  challengerScore,
  timeLeft,
  hostName = "Host",
  challengerName = "Challenger",
  hostAvatar,
  challengerAvatar,
  className,
}: PKBattleBarProps) => {
  const total = hostScore + challengerScore;
  const hostPercent = total === 0 ? 50 : (hostScore / total) * 100;

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className={cn("w-full px-4 py-2", className)}>
      {/* Score Display */}
      <div className="flex justify-between items-center mb-2">
        {/* Host Side */}
        <div className="flex items-center gap-2">
          {hostAvatar && (
            <img
              src={hostAvatar}
              alt={hostName}
              className="w-8 h-8 rounded-full border-2 border-blue-500"
            />
          )}
          <div className="text-left">
            <p className="text-xl font-bold text-blue-400">{hostScore.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground truncate max-w-[80px]">
              {hostName}
            </p>
          </div>
        </div>

        {/* Timer */}
        <motion.div
          className="bg-black/60 backdrop-blur-sm px-3 py-1 rounded-full border border-yellow-500/50"
          animate={{ scale: timeLeft <= 10 ? [1, 1.1, 1] : 1 }}
          transition={{ duration: 0.5, repeat: timeLeft <= 10 ? Infinity : 0 }}
        >
          <span className={cn(
            "font-mono font-bold",
            timeLeft <= 10 ? "text-red-500" : "text-yellow-400"
          )}>
            {formatTime(timeLeft)}
          </span>
        </motion.div>

        {/* Challenger Side */}
        <div className="flex items-center gap-2">
          <div className="text-right">
            <p className="text-xl font-bold text-red-400">{challengerScore.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground truncate max-w-[80px]">
              {challengerName}
            </p>
          </div>
          {challengerAvatar && (
            <img
              src={challengerAvatar}
              alt={challengerName}
              className="w-8 h-8 rounded-full border-2 border-red-500"
            />
          )}
        </div>
      </div>

      {/* HP Bar */}
      <div className="relative h-4 rounded-full overflow-hidden bg-gradient-to-r from-blue-900/50 to-red-900/50">
        {/* Host Bar (Blue) */}
        <motion.div
          className="absolute inset-y-0 left-0 bg-gradient-to-r from-blue-500 to-blue-400"
          initial={{ width: "50%" }}
          animate={{ width: `${hostPercent}%` }}
          transition={{ type: "spring", stiffness: 100, damping: 15 }}
        />

        {/* Challenger Bar (Red) */}
        <motion.div
          className="absolute inset-y-0 right-0 bg-gradient-to-l from-red-500 to-red-400"
          initial={{ width: "50%" }}
          animate={{ width: `${100 - hostPercent}%` }}
          transition={{ type: "spring", stiffness: 100, damping: 15 }}
        />

        {/* Center Lightning Divider */}
        <motion.div
          className="absolute top-1/2 -translate-y-1/2 z-10"
          style={{ left: `${hostPercent}%`, transform: `translateX(-50%) translateY(-50%)` }}
          animate={{ 
            scale: [1, 1.2, 1],
            rotate: [0, 5, -5, 0]
          }}
          transition={{ duration: 0.5, repeat: Infinity }}
        >
          <div className="bg-yellow-400 rounded-full p-1 shadow-lg shadow-yellow-500/50">
            <Zap className="w-3 h-3 text-black" fill="currentColor" />
          </div>
        </motion.div>
      </div>

      {/* PK Battle Label */}
      <div className="flex justify-center mt-2">
        <motion.div
          className="flex items-center gap-1 bg-gradient-to-r from-blue-500/20 via-purple-500/20 to-red-500/20 px-3 py-1 rounded-full border border-purple-500/30"
          animate={{ 
            boxShadow: [
              "0 0 10px rgba(168, 85, 247, 0.3)",
              "0 0 20px rgba(168, 85, 247, 0.5)",
              "0 0 10px rgba(168, 85, 247, 0.3)"
            ]
          }}
          transition={{ duration: 1.5, repeat: Infinity }}
        >
          <Zap className="w-3 h-3 text-yellow-400" />
          <span className="text-xs font-bold bg-gradient-to-r from-blue-400 via-purple-400 to-red-400 bg-clip-text text-transparent">
            PK BATTLE LIVE
          </span>
        </motion.div>
      </div>
    </div>
  );
};
