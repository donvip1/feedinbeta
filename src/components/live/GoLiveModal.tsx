import { motion, AnimatePresence } from "framer-motion";
import { X, Video, Mic, Calendar, ChevronRight, Lock, Crown, Shield, Play } from "lucide-react";
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
            className="fixed inset-0 bg-black/80 backdrop-blur-md z-50"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, y: 100 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 100 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 z-50 sm:bottom-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:max-w-lg sm:w-full"
          >
            <div className="bg-[#0F1119] rounded-t-[3rem] sm:rounded-[3rem] p-8 border border-white/5 shadow-2xl relative overflow-hidden">
              {/* Gradient top accent */}
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-purple-500 to-transparent opacity-50" />

              {/* Header */}
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h2 className="text-2xl font-black tracking-tight text-white">Broadcast Center</h2>
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">Select your medium</p>
                </div>
                <button
                  onClick={onClose}
                  className="w-12 h-12 flex items-center justify-center rounded-2xl bg-white/5 hover:bg-white/10 transition-all"
                >
                  <X className="w-6 h-6 text-white" />
                </button>
              </div>

              {/* Options */}
              <div className="grid grid-cols-1 gap-4 mb-10">
                {/* Video Stream Option */}
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleVideoClick}
                  className={`flex items-center justify-between p-6 border rounded-[2.5rem] transition-all group text-left ${
                    canLivestream
                      ? "bg-white/5 hover:bg-white/[0.08] border-white/5"
                      : "bg-white/[0.02] border-white/5 opacity-70"
                  }`}
                >
                  <div className="flex items-center gap-6">
                    <div className={`w-16 h-16 rounded-3xl flex items-center justify-center shadow-lg shrink-0 group-hover:scale-105 transition-transform ${
                      canLivestream
                        ? "bg-gradient-to-br from-rose-500 to-pink-600 shadow-rose-500/20"
                        : "bg-gradient-to-br from-slate-600 to-slate-700"
                    }`}>
                      {canLivestream ? (
                        <Video className="w-8 h-8 text-white" />
                      ) : (
                        <Lock className="w-8 h-8 text-white/60" />
                      )}
                    </div>
                    <div>
                      <p className="text-xl font-black text-white flex items-center gap-2">
                        Video Stream
                        {!canLivestream && (
                          <span className="text-xs bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full flex items-center gap-1">
                            <Crown className="w-3 h-3" /> Popular+
                          </span>
                        )}
                      </p>
                      <p className="text-slate-500 text-sm">
                        {canLivestream
                          ? "Face-to-face live engagement"
                          : "Upgrade to Popular Pack or higher to unlock"}
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="w-6 h-6 text-slate-700 group-hover:translate-x-1 transition-transform" />
                </motion.button>

                {/* Audio Space Option - Always available */}
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleAudioClick}
                  className="flex items-center justify-between p-6 bg-white/5 hover:bg-white/[0.08] border border-white/5 rounded-[2.5rem] transition-all group text-left"
                >
                  <div className="flex items-center gap-6">
                    <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-purple-500/20 shrink-0 group-hover:scale-105 transition-transform">
                      <Mic className="w-8 h-8 text-white" />
                    </div>
                    <div>
                      <p className="text-xl font-black text-white">Audio Space</p>
                      <p className="text-slate-500 text-sm">Conversational voice-only room</p>
                    </div>
                  </div>
                  <ChevronRight className="w-6 h-6 text-slate-700 group-hover:translate-x-1 transition-transform" />
                </motion.button>
              </div>

              {/* Schedule for Later */}
              {onSchedule && (
                <div className="mb-6">
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

              {/* Security Notice */}
              <div className="bg-white/5 rounded-3xl p-4 flex items-center gap-4 border border-white/5">
                <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center shrink-0">
                  <Shield className="w-5 h-5 text-purple-400" />
                </div>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest leading-relaxed">
                  Secure broadcasting enabled. All streams are monitored for community safety.
                </p>
              </div>

              {/* Safe area spacing */}
              <div className="h-6 sm:h-0" />
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
