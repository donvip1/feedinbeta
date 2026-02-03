import { motion, AnimatePresence } from "framer-motion";
import { X, Video, Mic, Calendar, ChevronRight } from "lucide-react";

interface GoLiveModalProps {
  open: boolean;
  onClose: () => void;
  onVideoStream: () => void;
  onAudioSpace: () => void;
  onSchedule?: () => void;
}

export const GoLiveModal = ({
  open,
  onClose,
  onVideoStream,
  onAudioSpace,
  onSchedule,
}: GoLiveModalProps) => {
  const handleVideoClick = () => {
    onClose();
    onVideoStream();
  };

  const handleAudioClick = () => {
    onClose();
    onAudioSpace();
  };

  const handleScheduleClick = () => {
    onClose();
    onSchedule?.();
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, y: 100 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 100 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 z-50 bg-slate-900 rounded-t-3xl p-6 max-h-[80vh] overflow-y-auto"
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-white">Start Broadcasting</h2>
              <button
                onClick={onClose}
                className="bg-slate-800 p-2 rounded-full text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Options */}
            <div className="space-y-4">
              {/* Video Stream Option */}
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleVideoClick}
                className="w-full flex items-center gap-4 p-4 rounded-2xl bg-gradient-to-r from-pink-500/10 to-red-500/10 border border-pink-500/20 hover:border-pink-500/40 transition-colors text-left"
              >
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-pink-500 to-red-500 flex items-center justify-center shrink-0">
                  <Video className="w-7 h-7 text-white" />
                </div>
                <div className="flex-1">
                  <p className="text-lg font-semibold text-white">Video Stream</p>
                  <p className="text-sm text-white/60">Standard broadcast with camera</p>
                </div>
                <ChevronRight className="w-5 h-5 text-white/40" />
              </motion.button>

              {/* Audio Space Option */}
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleAudioClick}
                className="w-full flex items-center gap-4 p-4 rounded-2xl bg-gradient-to-r from-green-500/10 to-emerald-500/10 border border-green-500/20 hover:border-green-500/40 transition-colors text-left"
              >
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center shrink-0">
                  <Mic className="w-7 h-7 text-white" />
                </div>
                <div className="flex-1">
                  <p className="text-lg font-semibold text-white">Audio Space</p>
                  <p className="text-sm text-white/60">Voice-only conversation room</p>
                </div>
                <ChevronRight className="w-5 h-5 text-white/40" />
              </motion.button>
            </div>

            {/* Schedule for Later */}
            {onSchedule && (
              <div className="mt-6 pt-4 border-t border-white/10">
                <button
                  onClick={handleScheduleClick}
                  className="flex items-center gap-2 text-sm text-white/60 hover:text-white transition-colors mx-auto"
                >
                  <Calendar className="w-4 h-4" />
                  Schedule for later
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Safe area spacing */}
            <div className="h-6" />
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
