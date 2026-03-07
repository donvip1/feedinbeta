import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Gamepad2, BarChart3, Lightbulb, Volume2, TrendingUp, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CoPilotJoystickProps {
  isHost: boolean;
  onCreatePoll: () => void;
  onLightTrigger?: () => void;
  onSoundTrigger?: () => void;
  onPredictiveBet?: () => void;
}

const MENU_ITEMS = [
  { id: 'poll', label: 'Poll', icon: BarChart3, color: 'text-purple-400', bg: 'bg-purple-500/20' },
  { id: 'light', label: 'Light', icon: Lightbulb, color: 'text-yellow-400', bg: 'bg-yellow-500/20' },
  { id: 'sound', label: 'Sound', icon: Volume2, color: 'text-blue-400', bg: 'bg-blue-500/20' },
  { id: 'bet', label: 'Predict', icon: TrendingUp, color: 'text-green-400', bg: 'bg-green-500/20' },
];

export const CoPilotJoystick = ({
  isHost,
  onCreatePoll,
  onLightTrigger,
  onSoundTrigger,
  onPredictiveBet,
}: CoPilotJoystickProps) => {
  const [isOpen, setIsOpen] = useState(false);

  if (!isHost) return null;

  const handleAction = (id: string) => {
    setIsOpen(false);
    switch (id) {
      case 'poll': onCreatePoll(); break;
      case 'light': onLightTrigger?.(); break;
      case 'sound': onSoundTrigger?.(); break;
      case 'bet': onPredictiveBet?.(); break;
    }
  };

  return (
    <div className="absolute bottom-40 left-3 z-30">
      <AnimatePresence>
        {isOpen && (
          <>
            {MENU_ITEMS.map((item, index) => {
              const angle = -90 + (index * 45); // spread upward
              const radius = 60;
              const x = Math.cos((angle * Math.PI) / 180) * radius;
              const y = Math.sin((angle * Math.PI) / 180) * radius;

              return (
                <motion.button
                  key={item.id}
                  initial={{ opacity: 0, x: 0, y: 0, scale: 0 }}
                  animate={{ opacity: 1, x, y: y - 20, scale: 1 }}
                  exit={{ opacity: 0, x: 0, y: 0, scale: 0 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 20, delay: index * 0.05 }}
                  onClick={() => handleAction(item.id)}
                  className={cn(
                    'absolute w-11 h-11 rounded-full flex flex-col items-center justify-center backdrop-blur-xl border border-white/10 active:scale-90 transition-transform',
                    item.bg
                  )}
                >
                  <item.icon className={cn('w-4 h-4', item.color)} />
                  <span className={cn('text-[7px] font-bold mt-0.5', item.color)}>{item.label}</span>
                </motion.button>
              );
            })}
          </>
        )}
      </AnimatePresence>

      {/* FAB */}
      <motion.button
        onClick={() => setIsOpen(!isOpen)}
        whileTap={{ scale: 0.9 }}
        className={cn(
          'w-10 h-10 rounded-xl flex items-center justify-center backdrop-blur-xl border transition-all relative z-10',
          isOpen
            ? 'bg-white/20 border-white/30 rotate-45'
            : 'bg-black/40 border-white/10'
        )}
      >
        {isOpen ? (
          <X className="w-4 h-4 text-white" />
        ) : (
          <Gamepad2 className="w-4 h-4 text-cyan-400" />
        )}
      </motion.button>
    </div>
  );
};
