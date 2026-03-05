import { motion } from "framer-motion";
import { Zap } from "lucide-react";
import { cn } from "@/lib/utils";

export interface PKParticipant {
  id: string;
  name: string;
  avatar?: string;
  score: number;
  color: string;
}

interface PKBattleBarProps {
  participants: PKParticipant[];
  timeLeft: number;
  className?: string;
  // Legacy 2-way props (still supported)
  hostScore?: number;
  challengerScore?: number;
  hostName?: string;
  challengerName?: string;
  hostAvatar?: string;
  challengerAvatar?: string;
}

export const PKBattleBar = ({
  participants: participantsProp,
  timeLeft,
  className,
  // Legacy fallbacks
  hostScore,
  challengerScore,
  hostName,
  challengerName,
  hostAvatar,
  challengerAvatar,
}: PKBattleBarProps) => {
  // Support legacy 2-way props
  const participants: PKParticipant[] = participantsProp?.length > 0
    ? participantsProp
    : [
        { id: 'host', name: hostName || 'Blue Team', avatar: hostAvatar, score: hostScore || 0, color: '#3b82f6' },
        { id: 'challenger', name: challengerName || 'Red Team', avatar: challengerAvatar, score: challengerScore || 0, color: '#ef4444' },
      ];

  const totalScore = participants.reduce((sum, p) => sum + p.score, 0) || 1;
  const maxSlots = participants.length >= 4 ? 4 : participants.length >= 3 ? 3 : 2;

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className={cn("w-full px-4 py-3", className)}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <motion.div
            animate={{
              boxShadow: [
                "0 0 10px rgba(168, 85, 247, 0.3)",
                "0 0 25px rgba(168, 85, 247, 0.6)",
                "0 0 10px rgba(168, 85, 247, 0.3)",
              ],
            }}
            transition={{ duration: 1.5, repeat: Infinity }}
            className="flex items-center gap-1.5 bg-gradient-to-r from-blue-500/20 via-purple-500/20 to-red-500/20 px-3 py-1 rounded-full border border-purple-500/30"
          >
            <Zap className="w-3.5 h-3.5 text-yellow-400" />
            <span className="text-[10px] font-black uppercase tracking-wider bg-gradient-to-r from-blue-400 via-purple-400 to-red-400 bg-clip-text text-transparent">
              {maxSlots}-Way Battle
            </span>
          </motion.div>
        </div>

        <motion.div
          className="bg-black/60 backdrop-blur-sm px-3 py-1 rounded-full border border-yellow-500/50"
          animate={{ scale: timeLeft <= 10 ? [1, 1.1, 1] : 1 }}
          transition={{ duration: 0.5, repeat: timeLeft <= 10 ? Infinity : 0 }}
        >
          <span className={cn(
            "font-mono font-bold text-sm",
            timeLeft <= 10 ? "text-red-500" : "text-yellow-400"
          )}>
            {formatTime(timeLeft)}
          </span>
        </motion.div>
      </div>

      {/* Multi-participant proportional bar */}
      <div className="relative h-3 rounded-full overflow-hidden bg-white/5">
        {participants.map((p, i) => {
          const percent = (p.score / totalScore) * 100;
          const offset = participants.slice(0, i).reduce((sum, pp) => sum + (pp.score / totalScore) * 100, 0);

          return (
            <motion.div
              key={p.id}
              className="absolute inset-y-0"
              style={{
                left: `${offset}%`,
                backgroundColor: p.color,
              }}
              initial={{ width: `${100 / participants.length}%` }}
              animate={{ width: `${percent}%` }}
              transition={{ type: "spring", stiffness: 100, damping: 15 }}
            />
          );
        })}

        {/* Lightning dividers between segments */}
        {participants.slice(0, -1).map((_, i) => {
          const offset = participants.slice(0, i + 1).reduce((sum, pp) => sum + (pp.score / totalScore) * 100, 0);
          return (
            <motion.div
              key={`divider-${i}`}
              className="absolute top-1/2 z-10"
              style={{ left: `${offset}%`, transform: "translateX(-50%) translateY(-50%)" }}
              animate={{ scale: [1, 1.3, 1] }}
              transition={{ duration: 0.6, repeat: Infinity }}
            >
              <div className="bg-yellow-400 rounded-full p-1 shadow-lg shadow-yellow-500/50">
                <Zap className="w-2 h-2 text-black" fill="currentColor" />
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Participant scores */}
      <div className="flex justify-between mt-2">
        {participants.map(p => (
          <div key={p.id} className="flex items-center gap-1.5">
            {p.avatar && (
              <img
                src={p.avatar}
                alt={p.name}
                className="w-5 h-5 rounded-full border"
                style={{ borderColor: p.color }}
              />
            )}
            <div className="flex flex-col">
              <span className="text-[10px] font-bold text-white/60 truncate max-w-[60px]">{p.name}</span>
              <span className="text-xs font-black" style={{ color: p.color }}>
                {p.score.toLocaleString()}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
