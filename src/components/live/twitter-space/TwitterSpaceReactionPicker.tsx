import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface TwitterSpaceReactionPickerProps {
  isOpen: boolean;
  onClose: () => void;
  onReaction: (emoji: string) => void;
}

const REACTION_EMOJIS = [
  '😂', '😮', '😢', '💜', '💯',
  '👏', '✊', '👍', '👎', '👋'
];

export const TwitterSpaceReactionPicker = ({
  isOpen,
  onClose,
  onReaction,
}: TwitterSpaceReactionPickerProps) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 z-50"
            onClick={onClose}
          />

          {/* Reaction Grid */}
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 50, scale: 0.95 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 z-50 bg-zinc-900 rounded-t-3xl p-6 pb-safe"
          >
            <div className="w-12 h-1 bg-zinc-700 rounded-full mx-auto mb-6" />
            
            <div className="grid grid-cols-5 gap-4 max-w-xs mx-auto">
              {REACTION_EMOJIS.map(emoji => (
                <button
                  key={emoji}
                  onClick={() => onReaction(emoji)}
                  className="text-4xl aspect-square flex items-center justify-center hover:scale-125 active:scale-90 transition-transform duration-150"
                >
                  {emoji}
                </button>
              ))}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
