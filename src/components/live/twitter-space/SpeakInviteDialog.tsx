import React from 'react';
import { Mic, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface SpeakInviteDialogProps {
  isOpen: boolean;
  inviterName: string;
  spaceName: string;
  onAccept: () => void;
  onDecline: () => void;
}

export const SpeakInviteDialog = ({
  isOpen,
  inviterName,
  spaceName,
  onAccept,
  onDecline,
}: SpeakInviteDialogProps) => {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[70] bg-black/60 flex items-center justify-center p-6" onClick={onDecline}>
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ type: 'spring', damping: 20, stiffness: 300 }}
            className="w-full max-w-sm bg-zinc-900 rounded-3xl p-6 border border-zinc-800 shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            {/* Icon */}
            <div className="w-16 h-16 rounded-full bg-purple-500/10 flex items-center justify-center mx-auto mb-4">
              <Mic className="w-8 h-8 text-purple-400" />
            </div>

            {/* Text */}
            <h3 className="text-white font-bold text-lg text-center mb-2">
              Invitation to Speak
            </h3>
            <p className="text-zinc-400 text-sm text-center mb-6">
              <span className="text-white font-semibold">{inviterName}</span> has invited you to speak in{' '}
              <span className="text-white font-semibold">{spaceName}</span>
            </p>

            {/* Buttons */}
            <div className="flex gap-3">
              <button
                onClick={onDecline}
                className="flex-1 py-3 rounded-full border border-zinc-700 text-zinc-300 font-semibold text-sm hover:bg-zinc-800 transition-colors"
              >
                Decline
              </button>
              <button
                onClick={onAccept}
                className="flex-1 py-3 rounded-full bg-purple-600 text-white font-semibold text-sm hover:bg-purple-500 transition-colors"
              >
                Accept
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
