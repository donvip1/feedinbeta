import { motion, AnimatePresence } from 'framer-motion';
import { FloatingReactions } from '../FloatingReactions';

interface GiftAnimation {
  id: string;
  emoji: string;
  senderName: string;
  receiverName: string;
  value: number;
}

interface FloatingReaction {
  id: string;
  emoji: string;
  left: number;
  displayName?: string;
}

interface FloatingGiftReaction {
  id: string | number;
  type: string;
  senderName?: string;
  emoji?: string;
}

interface GiftOverlayProps {
  giftAnimations: GiftAnimation[];
  floatingReactions: FloatingReaction[];
  floatingGiftReactions: FloatingGiftReaction[];
  giftOverlay: { icon: string; sender: string; name: string; receiver: string } | null;
}

export const GiftOverlay = ({
  giftAnimations,
  floatingReactions,
  floatingGiftReactions,
  giftOverlay,
}: GiftOverlayProps) => {
  return (
    <>
      {/* Floating emoji reactions */}
      <div className="fixed inset-0 pointer-events-none z-50 flex items-center justify-center">
        <AnimatePresence>
          {floatingReactions.map((r) => (
            <motion.div
              key={r.id}
              initial={{ opacity: 0, y: 40, scale: 0.5 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -200, scale: 0.6 }}
              transition={{ duration: 2.5, ease: 'easeOut' }}
              className="absolute flex flex-col items-center gap-1"
              style={{ left: `${r.left}%`, top: '40%' }}
            >
              <span className="text-5xl drop-shadow-lg">{r.emoji}</span>
              {r.displayName && (
                <span className="text-xs font-bold text-white bg-black/60 px-2 py-0.5 rounded-full whitespace-nowrap backdrop-blur-sm">
                  {r.displayName}
                </span>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Floating gift reactions */}
      <FloatingReactions reactions={floatingGiftReactions} className="z-40" />

      {/* Gift slide-in animations */}
      <AnimatePresence mode="popLayout">
        {giftAnimations.map((gift) => (
          <motion.div
            key={gift.id}
            layout
            initial={{ opacity: 0, x: -80 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 80 }}
            transition={{ type: 'tween', ease: [0.25, 0.1, 0.25, 1], duration: 0.4 }}
            className="fixed left-4 top-1/3 z-50 max-w-[280px]"
          >
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-gradient-to-r from-amber-500/90 to-pink-500/90 backdrop-blur-sm shadow-lg">
              <motion.span className="text-3xl" animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 0.6, repeat: 1 }}>
                {gift.emoji}
              </motion.span>
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-bold truncate">{gift.senderName}</p>
                <p className="text-white/80 text-xs truncate">sent {gift.emoji} to {gift.receiverName}</p>
              </div>
              <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/20">
                <span className="text-white text-xs font-black">+{gift.value}</span>
              </div>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>

      {/* Fullscreen gift overlay */}
      <AnimatePresence>
        {giftOverlay && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center pointer-events-none"
          >
            <motion.div
              initial={{ scale: 0, rotate: -20 }}
              animate={{ scale: 1, rotate: 0 }}
              exit={{ scale: 0, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 200, damping: 12 }}
              className="flex flex-col items-center gap-3"
            >
              <span className="text-8xl drop-shadow-2xl">{giftOverlay.icon}</span>
              <div className="bg-black/70 backdrop-blur-xl px-6 py-3 rounded-2xl border border-white/10">
                <p className="text-white font-bold text-center text-sm">
                  {giftOverlay.sender} sent {giftOverlay.name} to {giftOverlay.receiver}!
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
