import { motion, AnimatePresence } from "framer-motion";
import { X, Video, Mic, Calendar, ChevronRight, Lock, Crown } from "lucide-react";
import { useLivestreamPermission } from "@/hooks/useLivestreamPermission";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

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
  const { canLivestream } = useLivestreamPermission();
  const navigate = useNavigate();

  const handleVideoClick = () => {
    if (!canLivestream) {
      toast(
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 font-semibold">
            <Lock className="w-4 h-4" /> Livestream Locked
          </div>
          <p className="text-sm text-muted-foreground">
            Video livestreaming requires the <strong>Popular Pack</strong> or higher. Upgrade your credit pack to unlock this feature!
          </p>
          <button
            onClick={() => {
              navigate('/credits');
              toast.dismiss();
            }}
            className="mt-1 text-sm font-semibold text-primary hover:underline text-left"
          >
            Upgrade Now →
          </button>
        </div>,
        { duration: 6000 }
      );
      return;
    }
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
                className={`w-full flex items-center gap-4 p-4 rounded-2xl border transition-colors text-left relative ${
                  canLivestream
                    ? "bg-gradient-to-r from-pink-500/10 to-red-500/10 border-pink-500/20 hover:border-pink-500/40"
                    : "bg-gradient-to-r from-slate-800/50 to-slate-700/50 border-slate-600/30 opacity-70"
                }`}
              >
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 ${
                  canLivestream
                    ? "bg-gradient-to-br from-pink-500 to-red-500"
                    : "bg-gradient-to-br from-slate-600 to-slate-700"
                }`}>
                  {canLivestream ? (
                    <Video className="w-7 h-7 text-white" />
                  ) : (
                    <Lock className="w-7 h-7 text-white/60" />
                  )}
                </div>
                <div className="flex-1">
                  <p className="text-lg font-semibold text-white flex items-center gap-2">
                    Video Stream
                    {!canLivestream && (
                      <span className="text-xs bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full flex items-center gap-1">
                        <Crown className="w-3 h-3" /> Popular+
                      </span>
                    )}
                  </p>
                  <p className="text-sm text-white/60">
                    {canLivestream
                      ? "Standard broadcast with camera"
                      : "Upgrade to Popular Pack or higher to unlock"}
                  </p>
                </div>
                <ChevronRight className="w-5 h-5 text-white/40" />
              </motion.button>

              {/* Audio Space Option - Always available */}
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
