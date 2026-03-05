import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Zap, X, Users, Trophy, Clock, Swords } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

interface PKBattleChallengeProps {
  isOpen: boolean;
  onClose: () => void;
  challenger?: {
    id: string;
    name: string;
    avatar?: string;
    level?: number;
  };
  onAccept: () => void;
  onDecline: () => void;
  mode: 'incoming' | 'outgoing' | 'select';
  maxSlots?: number;
  availableUsers?: Array<{
    id: string;
    name: string;
    avatar?: string;
    level?: number;
    isLive?: boolean;
  }>;
  onSelectChallenger?: (userId: string) => void;
}

export const PKBattleChallenge = ({
  isOpen,
  onClose,
  challenger,
  onAccept,
  onDecline,
  mode,
  maxSlots = 2,
  availableUsers = [],
  onSelectChallenger,
}: PKBattleChallengeProps) => {
  const [selectedDuration, setSelectedDuration] = useState(300); // 5 minutes default

  const durations = [
    { label: '3 min', value: 180 },
    { label: '5 min', value: 300 },
    { label: '10 min', value: 600 },
  ];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md bg-gradient-to-br from-slate-900 via-purple-900/50 to-slate-900 border-purple-500/30">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-center justify-center">
            <motion.div
              animate={{ rotate: [0, 15, -15, 0] }}
              transition={{ duration: 0.5, repeat: Infinity }}
            >
              <Swords className="w-6 h-6 text-yellow-400" />
            </motion.div>
            <span className="bg-gradient-to-r from-blue-400 via-purple-400 to-red-400 bg-clip-text text-transparent font-bold">
              PK BATTLE
            </span>
          </DialogTitle>
        </DialogHeader>

        <AnimatePresence mode="wait">
          {mode === 'incoming' && challenger && (
            <motion.div
              key="incoming"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              {/* Challenger Info */}
              <div className="text-center">
                <motion.div
                  animate={{ scale: [1, 1.05, 1] }}
                  transition={{ duration: 1, repeat: Infinity }}
                  className="relative inline-block"
                >
                  <Avatar className="w-24 h-24 border-4 border-red-500 mx-auto">
                    <AvatarImage src={challenger.avatar} alt={challenger.name} />
                    <AvatarFallback>{challenger.name.charAt(0)}</AvatarFallback>
                  </Avatar>
                  {challenger.level && (
                    <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-gradient-to-r from-yellow-500 to-orange-500 px-3 py-0.5 rounded-full text-sm font-bold text-white">
                      Lvl {challenger.level}
                    </div>
                  )}
                </motion.div>
                <h3 className="text-xl font-bold text-white mt-4">{challenger.name}</h3>
                <p className="text-muted-foreground">wants to battle you!</p>
              </div>

              {/* Animated VS */}
              <motion.div
                className="flex justify-center"
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 0.8, repeat: Infinity }}
              >
                <div className="bg-gradient-to-r from-blue-500 to-red-500 rounded-full p-3">
                  <Zap className="w-8 h-8 text-white" fill="currentColor" />
                </div>
              </motion.div>

              {/* Action Buttons */}
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={onDecline}
                  className="flex-1 border-red-500/50 text-red-400 hover:bg-red-500/20"
                >
                  <X className="w-4 h-4 mr-2" />
                  Decline
                </Button>
                <Button
                  onClick={onAccept}
                  className="flex-1 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600"
                >
                  <Swords className="w-4 h-4 mr-2" />
                  Accept Battle
                </Button>
              </div>
            </motion.div>
          )}

          {mode === 'select' && (
            <motion.div
              key="select"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-4"
            >
              {/* Duration Selection */}
              <div>
                <p className="text-sm text-muted-foreground mb-2 flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  Battle Duration
                </p>
                <div className="flex gap-2">
                  {durations.map((d) => (
                    <button
                      key={d.value}
                      onClick={() => setSelectedDuration(d.value)}
                      className={cn(
                        "flex-1 py-2 rounded-lg text-sm font-medium transition-all",
                        selectedDuration === d.value
                          ? "bg-purple-500 text-white"
                          : "bg-white/10 text-white/70 hover:bg-white/20"
                      )}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Available Users */}
              <div>
                <p className="text-sm text-muted-foreground mb-2 flex items-center gap-1">
                  <Users className="w-4 h-4" />
                  Challenge a Creator
                </p>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {availableUsers.length === 0 ? (
                    <p className="text-center text-muted-foreground py-4">
                      No creators available for battle
                    </p>
                  ) : (
                    availableUsers.map((user) => (
                      <motion.button
                        key={user.id}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => onSelectChallenger?.(user.id)}
                        className="w-full flex items-center gap-3 p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
                      >
                        <Avatar className="w-10 h-10">
                          <AvatarImage src={user.avatar} alt={user.name} />
                          <AvatarFallback>{user.name.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 text-left">
                          <p className="font-medium text-white">{user.name}</p>
                          {user.level && (
                            <p className="text-xs text-muted-foreground">Level {user.level}</p>
                          )}
                        </div>
                        {user.isLive && (
                          <div className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">
                            LIVE
                          </div>
                        )}
                        <Swords className="w-5 h-5 text-purple-400" />
                      </motion.button>
                    ))
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {mode === 'outgoing' && challenger && (
            <motion.div
              key="outgoing"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="text-center space-y-4"
            >
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                className="w-16 h-16 mx-auto border-4 border-t-purple-500 border-r-blue-500 border-b-red-500 border-l-yellow-500 rounded-full"
              />
              <div>
                <p className="text-white">Waiting for</p>
                <p className="text-xl font-bold text-white">{challenger.name}</p>
                <p className="text-muted-foreground">to accept your challenge...</p>
              </div>
              <Button variant="outline" onClick={onClose}>
                Cancel Challenge
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
};
