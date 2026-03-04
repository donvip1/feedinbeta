import React from 'react';
import { Mic, MicOff, UserMinus, UserPlus } from 'lucide-react';
import { motion } from 'framer-motion';

interface SpeakerActionSheetProps {
  speaker: {
    id: string;
    user_id: string;
    role: string;
    is_muted: boolean;
    profile?: {
      display_name: string;
      username: string;
      avatar_url: string;
      is_verified?: boolean;
    };
  };
  onClose: () => void;
  onInviteToSpeak: (userId: string) => void;
  onDemoteToListener: (userId: string) => void;
}

export const SpeakerActionSheet = ({
  speaker,
  onClose,
  onInviteToSpeak,
  onDemoteToListener,
}: SpeakerActionSheetProps) => {
  const isListener = speaker.role === 'listener';
  const isSpeakerOrCoHost = speaker.role === 'speaker' || speaker.role === 'co_host';

  return (
    <div className="fixed inset-0 z-[60] bg-black/60" onClick={onClose}>
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="fixed bottom-0 left-0 right-0 bg-zinc-900 rounded-t-3xl p-6 pb-safe"
        onClick={e => e.stopPropagation()}
      >
        <div className="w-12 h-1 bg-zinc-700 rounded-full mx-auto mb-6" />

        {/* User Info */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-14 h-14 rounded-full overflow-hidden bg-zinc-800">
            {speaker.profile?.avatar_url ? (
              <img
                src={speaker.profile.avatar_url}
                alt={speaker.profile.display_name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-zinc-400 text-xl font-bold">
                {speaker.profile?.display_name?.[0] || 'U'}
              </div>
            )}
          </div>
          <div>
            <p className="text-white font-bold text-lg">{speaker.profile?.display_name || 'User'}</p>
            <p className="text-zinc-500 text-sm">@{speaker.profile?.username || 'user'}</p>
          </div>
          <div className="ml-auto">
            <span className="text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full border border-zinc-700 text-zinc-400">
              {speaker.role === 'co_host' ? 'Co-host' : speaker.role === 'speaker' ? 'Speaker' : 'Listener'}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-2">
          {isListener && (
            <button
              onClick={() => {
                onInviteToSpeak(speaker.user_id);
                onClose();
              }}
              className="w-full flex items-center gap-4 p-4 rounded-xl hover:bg-zinc-800 transition-colors"
            >
              <div className="w-10 h-10 rounded-full bg-purple-500/10 flex items-center justify-center">
                <Mic className="w-5 h-5 text-purple-400" />
              </div>
              <div className="text-left">
                <p className="text-white font-semibold">Invite to Speak</p>
                <p className="text-zinc-500 text-xs">Send an invitation to join as a speaker</p>
              </div>
            </button>
          )}

          {isSpeakerOrCoHost && (
            <button
              onClick={() => {
                onDemoteToListener(speaker.user_id);
                onClose();
              }}
              className="w-full flex items-center gap-4 p-4 rounded-xl hover:bg-zinc-800 transition-colors"
            >
              <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center">
                <UserMinus className="w-5 h-5 text-red-400" />
              </div>
              <div className="text-left">
                <p className="text-red-400 font-semibold">Move to Listener</p>
                <p className="text-zinc-500 text-xs">Demote back to listener role</p>
              </div>
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
};
