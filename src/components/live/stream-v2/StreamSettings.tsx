import { motion, AnimatePresence } from 'framer-motion';
import {
  Mic, MicOff, Video, VideoOff, RotateCcw, Users, UserPlus, Swords,
  Settings, FileText, MessageSquare, Gift, Flag, LogOut, X, Search,
  Link as LinkIcon, Share2, Coins,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { shareUrls } from '@/lib/url-utils';
import { toast } from 'sonner';

// ---- SHARE SHEET ----
interface ShareSheetProps {
  isOpen: boolean;
  onClose: () => void;
  stream: any;
  streamId: string;
}

export const ShareSheet = ({ isOpen, onClose, stream, streamId }: ShareSheetProps) => (
  <AnimatePresence>
    {isOpen && (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/60" onClick={onClose}>
        <motion.div initial={{ y: 100 }} animate={{ y: 0 }} exit={{ y: 100 }}
          className="fixed bottom-0 left-0 right-0 bg-[#0F1119] rounded-t-[2rem] p-6 pb-safe border-t border-white/5"
          onClick={e => e.stopPropagation()}>
          <div className="w-12 h-1 bg-white/10 rounded-full mx-auto mb-4" />
          {stream?.cover_image_url && (
            <div className="mb-4 rounded-2xl overflow-hidden border border-white/5">
              <img src={stream.cover_image_url} alt={stream?.title} className="w-full h-28 object-cover" />
            </div>
          )}
          <p className="text-white font-bold mb-4">{stream?.title || 'Live Stream'}</p>
          <div className="space-y-2">
            <button onClick={() => { navigator.clipboard.writeText(shareUrls.liveStream(streamId)); toast.success('Link copied!'); onClose(); }}
              className="w-full flex items-center justify-between p-4 hover:bg-white/5 rounded-2xl transition-colors">
              <span className="text-white font-medium">Copy Link</span>
              <LinkIcon className="w-5 h-5 text-white/30" />
            </button>
            <button onClick={() => { if (navigator.share) navigator.share({ title: stream?.title, text: `Watch: ${stream?.title}`, url: shareUrls.liveStream(streamId) }); onClose(); }}
              className="w-full flex items-center justify-between p-4 hover:bg-white/5 rounded-2xl transition-colors">
              <span className="text-white font-medium">Share via...</span>
              <Share2 className="w-5 h-5 text-white/30" />
            </button>
          </div>
        </motion.div>
      </motion.div>
    )}
  </AnimatePresence>
);

// ---- SETTINGS SHEET ----
interface SettingsSheetProps {
  isOpen: boolean;
  onClose: () => void;
  isHost: boolean;
  isMicOn: boolean;
  isCameraOn: boolean;
  isPKMode: boolean;
  viewerCount: number;
  onMicToggle: () => void;
  onCameraToggle: () => void;
  onCameraFlip: () => void;
  onViewGuests: () => void;
  onInvite: () => void;
  onAudioSettings: () => void;
  onRules: () => void;
  onFullGiftStore: () => void;
  onFeedback: () => void;
  onReport: () => void;
  onEndStream: () => void;
  onLeave: () => void;
}

export const SettingsSheet = ({
  isOpen, onClose, isHost, isMicOn, isCameraOn, isPKMode, viewerCount,
  onMicToggle, onCameraToggle, onCameraFlip, onViewGuests, onInvite,
  onAudioSettings, onRules, onFullGiftStore, onFeedback, onReport,
  onEndStream, onLeave,
}: SettingsSheetProps) => (
  <AnimatePresence>
    {isOpen && (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/60" onClick={onClose}>
        <motion.div initial={{ y: 100 }} animate={{ y: 0 }} exit={{ y: 100 }}
          className="fixed bottom-0 left-0 right-0 bg-[#0F1119] rounded-t-[2rem] p-6 pb-safe border-t border-white/5"
          onClick={e => e.stopPropagation()}>
          <div className="w-12 h-1 bg-white/10 rounded-full mx-auto mb-6" />
          <div className="space-y-1">
            {isHost ? (
              <>
                <SheetBtn onClick={() => { onClose(); onMicToggle(); }} label={isMicOn ? 'Mute Mic' : 'Unmute Mic'} icon={isMicOn ? Mic : MicOff} />
                <SheetBtn onClick={() => { onClose(); onCameraToggle(); }} label={isCameraOn ? 'Turn Off Camera' : 'Turn On Camera'} icon={isCameraOn ? Video : VideoOff} />
                <SheetBtn onClick={() => { onClose(); onCameraFlip(); }} label="Flip Camera" icon={RotateCcw} />
                <SheetBtn onClick={() => { onClose(); onViewGuests(); }} label={`Manage Guests (${viewerCount + 1})`} icon={Users} />
                <SheetBtn onClick={() => { onClose(); onInvite(); }} label={isPKMode ? 'Invite PK Challenger' : 'Invite to Stream'} icon={isPKMode ? Swords : UserPlus} />
                <SheetBtn onClick={() => { onClose(); onAudioSettings(); }} label="Stream Settings" icon={Settings} />
                <SheetBtn onClick={() => { onClose(); onRules(); }} label="View Rules" icon={FileText} />
                <div className="my-2 border-t border-white/5" />
                <button onClick={() => { onClose(); onEndStream(); }}
                  className="w-full flex items-center justify-between p-4 hover:bg-rose-500/10 rounded-2xl transition-colors">
                  <span className="text-rose-500 font-bold">End Stream</span>
                  <X className="w-5 h-5 text-rose-500/60" />
                </button>
              </>
            ) : (
              <>
                <SheetBtn onClick={() => { onClose(); onViewGuests(); }} label={`View Guests (${viewerCount + 1})`} icon={Users} />
                <SheetBtn onClick={() => { onClose(); onFullGiftStore(); }} label="Full Gift Store" icon={Gift} />
                <SheetBtn onClick={() => { onClose(); onAudioSettings(); }} label="Audio Settings" icon={Settings} />
                <SheetBtn onClick={() => { onClose(); onFeedback(); }} label="Share Feedback" icon={MessageSquare} />
                <SheetBtn onClick={() => { onClose(); onRules(); }} label="View Rules" icon={FileText} />
                <div className="my-2 border-t border-white/5" />
                <button onClick={() => { onClose(); onReport(); }}
                  className="w-full flex items-center justify-between p-4 hover:bg-white/5 rounded-2xl transition-colors">
                  <span className="text-rose-400 font-medium">Report Stream</span>
                  <Flag className="w-5 h-5 text-rose-400/50" />
                </button>
                <button onClick={() => { onClose(); onLeave(); }}
                  className="w-full flex items-center justify-between p-4 hover:bg-white/5 rounded-2xl transition-colors">
                  <span className="text-rose-400 font-medium">Leave Stream</span>
                  <LogOut className="w-5 h-5 text-rose-400/50" />
                </button>
              </>
            )}
          </div>
        </motion.div>
      </motion.div>
    )}
  </AnimatePresence>
);

const SheetBtn = ({ onClick, label, icon: Icon }: { onClick: () => void; label: string; icon: any }) => (
  <button onClick={onClick} className="w-full flex items-center justify-between p-4 hover:bg-white/5 rounded-2xl transition-colors">
    <span className="text-white font-medium">{label}</span>
    <Icon className="w-5 h-5 text-white/30" />
  </button>
);

// ---- REACTION PICKER ----
const REACTION_EMOJIS = ['😂', '😮', '😢', '💜', '💯', '👏', '✊', '👍', '👎', '👋'];

interface ReactionPickerProps {
  isOpen: boolean;
  onClose: () => void;
  onReact: (emoji: string) => void;
}

export const ReactionPicker = ({ isOpen, onClose, onReact }: ReactionPickerProps) => (
  <AnimatePresence>
    {isOpen && (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/60" onClick={onClose}>
        <motion.div initial={{ y: 100 }} animate={{ y: 0 }} exit={{ y: 100 }}
          className="fixed bottom-0 left-0 right-0 bg-[#0F1119] rounded-t-[2rem] p-6 pb-safe border-t border-white/5"
          onClick={e => e.stopPropagation()}>
          <div className="w-12 h-1 bg-white/10 rounded-full mx-auto mb-6" />
          <div className="grid grid-cols-5 gap-4">
            {REACTION_EMOJIS.map(emoji => (
              <button key={emoji} onClick={() => onReact(emoji)}
                className="text-4xl aspect-square flex items-center justify-center hover:scale-125 transition-transform active:scale-90 rounded-2xl hover:bg-white/5">
                {emoji}
              </button>
            ))}
          </div>
        </motion.div>
      </motion.div>
    )}
  </AnimatePresence>
);

// ---- IN-STREAM GIFT SHEET ----
const STREAM_GIFTS = [
  { id: 'rose', name: 'Rose', icon: '🌹', cost: 10 },
  { id: 'coffee', name: 'Coffee', icon: '☕', cost: 50 },
  { id: 'heart', name: 'Heart', icon: '💖', cost: 100 },
  { id: 'rocket', name: 'Rocket', icon: '🚀', cost: 1000 },
];

interface InStreamGiftSheetProps {
  isOpen: boolean;
  onClose: () => void;
  targetName: string;
  userCredits: number;
  onSendGift: (gift: typeof STREAM_GIFTS[0]) => void;
}

export const InStreamGiftSheet = ({ isOpen, onClose, targetName, userCredits, onSendGift }: InStreamGiftSheetProps) => (
  <AnimatePresence>
    {isOpen && (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/70 flex items-end justify-center" onClick={onClose}>
        <motion.div initial={{ y: 300 }} animate={{ y: 0 }} exit={{ y: 300 }}
          className="w-full max-w-md bg-[#0F1119] rounded-t-[2rem] p-6 pb-safe border-t border-white/5"
          onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-white font-black text-lg">Send Gift</h3>
            <button onClick={onClose} className="p-2 bg-white/5 rounded-full"><X className="w-4 h-4 text-white/60" /></button>
          </div>
          <div className="mb-4 flex items-center gap-2">
            <Coins className="w-4 h-4 text-amber-400" />
            <span className="text-sm text-white/60">
              Sending to: <span className="text-white font-bold">{targetName}</span>
            </span>
            <span className="ml-auto text-xs text-amber-400 font-bold">{userCredits.toLocaleString()} credits</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {STREAM_GIFTS.map(gift => (
              <button key={gift.id} onClick={() => onSendGift(gift)} disabled={userCredits < gift.cost}
                className={cn("flex flex-col items-center gap-2 bg-black/20 p-4 rounded-xl hover:bg-white/5 transition", userCredits < gift.cost && "opacity-40 pointer-events-none")}>
                <span className="text-3xl">{gift.icon}</span>
                <span className="text-[10px] font-bold text-white/60">{gift.cost}</span>
              </button>
            ))}
          </div>
        </motion.div>
      </motion.div>
    )}
  </AnimatePresence>
);

// ---- INVITE MODAL ----
interface InviteModalProps {
  isOpen: boolean;
  onClose: () => void;
  isPKMode: boolean;
  host: any;
  viewers: any[];
  battleParticipants: any[];
  pkMaxSlots: number;
  inviteUsername: string;
  setInviteUsername: (v: string) => void;
  inviteSearchResults: any[];
  inviteSearching: boolean;
  onSearch: (val: string) => void;
  onInviteCreator: (id: string) => void;
  onInviteExternal: (profile: any) => void;
}

export const InviteModal = ({
  isOpen, onClose, isPKMode, host, viewers, battleParticipants, pkMaxSlots,
  inviteUsername, setInviteUsername, inviteSearchResults, inviteSearching,
  onSearch, onInviteCreator, onInviteExternal,
}: InviteModalProps) => (
  <AnimatePresence>
    {isOpen && (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/70 flex items-end justify-center" onClick={onClose}>
        <motion.div initial={{ y: 300 }} animate={{ y: 0 }} exit={{ y: 300 }}
          className="w-full max-w-md bg-[#0F1119] rounded-t-[2rem] p-6 pb-safe border-t border-white/5 max-h-[70vh] flex flex-col"
          onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-white font-black text-lg flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-purple-400" /> Invite to Stream
            </h3>
            <button onClick={onClose} className="p-2 bg-white/5 rounded-full"><X className="w-4 h-4 text-white/60" /></button>
          </div>
          <div className="flex items-center bg-white/5 rounded-2xl px-4 py-3 border border-white/5 mb-4">
            <Search className="w-4 h-4 text-white/30" />
            <input type="text" value={inviteUsername}
              onChange={(e) => { setInviteUsername(e.target.value); onSearch(e.target.value); }}
              placeholder="Search by username..." className="flex-1 bg-transparent text-white placeholder-white/30 outline-none ml-3 text-sm" />
          </div>
          <div className="flex-1 overflow-y-auto space-y-2 scrollbar-hide">
            {inviteUsername.length >= 2 ? (
              <>
                {inviteSearching && <p className="text-center text-white/30 text-sm py-4">Searching...</p>}
                {!inviteSearching && inviteSearchResults.map((profile: any) => {
                  const isJoined = battleParticipants.some((p: any) => p.id === profile.id);
                  return (
                    <div key={profile.id} className="flex items-center justify-between p-3 rounded-2xl bg-white/[0.03] border border-white/5">
                      <div className="flex items-center gap-3 min-w-0">
                        <img src={profile.avatar_url || ''} alt={profile.display_name} className="w-10 h-10 rounded-full" />
                        <div className="min-w-0">
                          <p className="text-white font-bold text-sm truncate">{profile.display_name}</p>
                          <p className="text-white/40 text-xs">@{profile.username}</p>
                        </div>
                      </div>
                      <button onClick={() => isPKMode ? onInviteCreator(profile.id) : onInviteExternal(profile)}
                        disabled={isJoined}
                        className={cn("px-4 py-1.5 rounded-full text-xs font-bold", isJoined ? 'bg-gray-800 text-gray-500' : 'bg-pink-600 hover:bg-pink-500 text-white')}>
                        {isJoined ? 'On Stage' : 'Invite'}
                      </button>
                    </div>
                  );
                })}
              </>
            ) : (
              <>
                <p className="text-white/30 text-xs font-bold uppercase tracking-wider mb-2">Current Viewers</p>
                {viewers.filter((v: any) => v.user_id !== host?.id).map((viewer: any) => {
                  const isJoined = battleParticipants.some((p: any) => p.id === viewer.user_id);
                  return (
                    <div key={viewer.user_id} className="flex items-center justify-between p-3 rounded-2xl bg-white/[0.03] border border-white/5">
                      <div className="flex items-center gap-3 min-w-0">
                        <img src={viewer.profile?.avatar_url || ''} alt={viewer.profile?.display_name} className="w-10 h-10 rounded-full" />
                        <div className="min-w-0">
                          <p className="text-white font-bold text-sm truncate">{viewer.profile?.display_name}</p>
                          <p className="text-white/40 text-xs">@{viewer.profile?.username}</p>
                        </div>
                      </div>
                      <button onClick={() => onInviteCreator(viewer.user_id)}
                        disabled={isJoined || (isPKMode && battleParticipants.length >= pkMaxSlots)}
                        className={cn("px-4 py-1.5 rounded-full text-xs font-bold", isJoined ? 'bg-gray-800 text-gray-500' : 'bg-pink-600 hover:bg-pink-500 text-white')}>
                        {isJoined ? 'On Stage' : 'Invite'}
                      </button>
                    </div>
                  );
                })}
              </>
            )}
          </div>
        </motion.div>
      </motion.div>
    )}
  </AnimatePresence>
);
