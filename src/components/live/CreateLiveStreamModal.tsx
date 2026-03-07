import { useState, useEffect } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Video, Sparkles, Crown, Calendar, Radio, Clock, Swords, Hash, X, Lock, Globe, Shield, Flame, Gamepad2, Zap, Heart } from "lucide-react";
import { CoverImageUpload } from "@/components/live/shared/CoverImageUpload";
import { usePremiumStatus } from "@/hooks/usePremiumStatus";
import { useNavigation } from "@/context/NavigationContext";

// Categories available for streams
const STREAM_CATEGORIES = [
  { value: 'music', label: 'Music', icon: '🎵' },
  { value: 'gaming', label: 'Gaming', icon: '🎮' },
  { value: 'chat', label: 'Chat', icon: '💬' },
  { value: 'talk_show', label: 'Talk Show', icon: '🎙️' },
  { value: 'education', label: 'Education', icon: '📚' },
  { value: 'sports', label: 'Sports', icon: '⚽' },
  { value: 'cooking', label: 'Cooking', icon: '🍳' },
  { value: 'art', label: 'Art & Creative', icon: '🎨' },
  { value: 'fitness', label: 'Fitness', icon: '💪' },
  { value: 'tech', label: 'Tech', icon: '💻' },
  { value: 'news', label: 'News', icon: '📰' },
  { value: 'other', label: 'Other', icon: '✨' },
];

// ADMIN CONFIG: Set to true to restrict live streaming to premium users only
const REQUIRE_PREMIUM_FOR_STREAMING = false;

type RoomType = 'video_broadcast' | 'pk_battle';
type StreamMode = 'solo' | 'pk-2' | 'pk-4';

interface CreateLiveStreamModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStreamCreated: (streamId: string) => void;
}

const MAX_HASHTAGS = 5;

export const CreateLiveStreamModal = ({ isOpen, onClose, onStreamCreated }: CreateLiveStreamModalProps) => {
  const { setHideBottomNav } = useNavigation();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [hashtags, setHashtags] = useState<string[]>([]);
  const [hashtagInput, setHashtagInput] = useState("");
  const [isPremium, setIsPremium] = useState(false);
  const [isScheduled, setIsScheduled] = useState(false);
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledTime, setScheduledTime] = useState("");
  const [loading, setLoading] = useState(false);
  const [roomType, setRoomType] = useState<RoomType>('video_broadcast');
  const [streamMode, setStreamMode] = useState<StreamMode>('solo');
  const [coverImageUrl, setCoverImageUrl] = useState<string | null>(null);
  const [isPrivate, setIsPrivate] = useState(false);
  const { isPremium: userIsPremium, loading: premiumLoading } = usePremiumStatus();

  // Feature toggles
  const [featureHype, setFeatureHype] = useState(true);
  const [featureCoPilot, setFeatureCoPilot] = useState(true);
  const [featureAIPulse, setFeatureAIPulse] = useState(true);
  const [featureChatReactions, setFeatureChatReactions] = useState(true);

  const addHashtag = (raw: string) => {
    const tag = raw.trim().replace(/^#/, '').replace(/[^a-zA-Z0-9_]/g, '').toLowerCase();
    if (tag && !hashtags.includes(tag) && hashtags.length < MAX_HASHTAGS) {
      setHashtags([...hashtags, tag]);
    }
  };

  const handleHashtagChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value.endsWith(' ') || value.endsWith(',')) {
      const raw = value.slice(0, -1);
      if (raw.trim()) {
        addHashtag(raw);
      }
      setHashtagInput('');
    } else {
      setHashtagInput(value);
    }
  };

  const handleHashtagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && hashtagInput.trim()) {
      e.preventDefault();
      addHashtag(hashtagInput);
      setHashtagInput('');
    } else if (e.key === 'Backspace' && !hashtagInput && hashtags.length > 0) {
      setHashtags(hashtags.slice(0, -1));
    }
  };

  const removeHashtag = (tagToRemove: string) => {
    setHashtags(hashtags.filter(tag => tag !== tagToRemove));
  };

  useEffect(() => {
    if (isOpen) {
      setHideBottomNav(true);
    } else {
      setHideBottomNav(false);
    }
    return () => setHideBottomNav(false);
  }, [isOpen, setHideBottomNav]);

  const canCreateStream = !REQUIRE_PREMIUM_FOR_STREAMING || userIsPremium;

  const handleCreate = async () => {
    if (!title.trim()) {
      toast.error("Please enter a title");
      return;
    }

    if (isScheduled) {
      if (!scheduledDate || !scheduledTime) {
        toast.error("Please select a date and time for the scheduled stream");
        return;
      }
      const scheduledDateTime = new Date(`${scheduledDate}T${scheduledTime}`);
      if (scheduledDateTime <= new Date()) {
        toast.error("Scheduled time must be in the future");
        return;
      }
    }

    if (REQUIRE_PREMIUM_FOR_STREAMING && !userIsPremium) {
      toast.error("Premium subscription required to create live streams");
      return;
    }

    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        toast.error("You must be logged in");
        return;
      }

      const { data: streamKeyData } = await supabase.rpc('generate_stream_key');
      
      let scheduledStart = null;
      if (isScheduled && scheduledDate && scheduledTime) {
        scheduledStart = new Date(`${scheduledDate}T${scheduledTime}`).toISOString();
      }

      const effectiveRoomType: RoomType = streamMode === 'solo' ? 'video_broadcast' : 'pk_battle';
      const pkMaxSlots = streamMode === 'pk-4' ? 4 : 2;

      const streamFeatures = {
        hype_system: featureHype,
        copilot_tools: featureCoPilot,
        ai_pulse: featureAIPulse,
        chat_reactions: featureChatReactions,
      };

      const { data, error } = await supabase
        .from("live_streams")
        .insert({
          user_id: user.id,
          title: title.trim(),
          description: description.trim() || null,
          category: category || null,
          hashtags: hashtags.length > 0 ? hashtags : null,
          is_premium: isPremium,
          stream_key: streamKeyData || `stream_${Date.now()}`,
          status: isScheduled ? 'scheduled' : 'live',
          scheduled_start: scheduledStart,
          started_at: isScheduled ? null : new Date().toISOString(),
          connection_state: 'idle',
          room_type: effectiveRoomType,
          pk_max_slots: pkMaxSlots,
          cover_image_url: coverImageUrl,
          is_private: isPrivate,
          share_link: Math.floor(100000 + Math.random() * 900000).toString(),
          stream_features: streamFeatures,
        } as any)
        .select()
        .single();

      if (error) throw error;

      toast.success(isScheduled ? "Stream scheduled!" : "Starting live stream...");
      onStreamCreated(data.id);
      onClose();
      
      setTitle("");
      setDescription("");
      setCategory("");
      setHashtags([]);
      setHashtagInput("");
      setIsPremium(false);
      setIsScheduled(false);
      setScheduledDate("");
      setScheduledTime("");
      setRoomType('video_broadcast');
      setStreamMode('solo');
      setCoverImageUrl(null);
      setIsPrivate(false);
      setFeatureHype(true);
      setFeatureCoPilot(true);
      setFeatureAIPulse(true);
      setFeatureChatReactions(true);
    } catch (error: any) {
      console.error("Error creating stream:", error);
      toast.error(error.message || "Failed to create stream");
    } finally {
      setLoading(false);
    }
  };

  // Premium gate
  if (REQUIRE_PREMIUM_FOR_STREAMING && !userIsPremium && !premiumLoading) {
    return (
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="sm:max-w-md p-0 bg-[#0F1119] border border-white/5 rounded-[2.5rem] overflow-hidden gap-0">
          <div className="h-1 bg-gradient-to-r from-transparent via-amber-500 to-transparent opacity-50" />
          <div className="p-8 text-center space-y-6">
            <div className="w-20 h-20 mx-auto rounded-3xl bg-gradient-to-tr from-amber-500 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/20">
              <Crown className="w-10 h-10 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-black text-white">Premium Feature</h2>
              <p className="text-sm text-slate-500 mt-2">Live streaming is currently available for premium subscribers only.</p>
            </div>
            <button className="w-full py-3.5 bg-gradient-to-r from-amber-500 to-orange-500 text-black rounded-2xl text-sm font-black">
              View Plans
            </button>
            <button onClick={onClose} className="w-full py-3.5 bg-white/5 text-slate-400 rounded-2xl text-sm font-bold hover:bg-white/10 transition-all">
              Maybe Later
            </button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const today = new Date().toISOString().split('T')[0];

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md max-h-[90vh] p-0 bg-[#0F1119] border border-white/5 rounded-[2.5rem] overflow-hidden gap-0">
        {/* Accent top line */}
        <div className="h-1 bg-gradient-to-r from-transparent via-rose-500 to-transparent opacity-50" />

        {/* Header */}
        <div className="px-6 pt-6 pb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-rose-600 to-pink-600 flex items-center justify-center shadow-lg shadow-rose-500/20">
              <Video className="w-6 h-6 text-white animate-pulse" />
            </div>
            <div>
              <h2 className="text-lg font-black text-white tracking-tight">Create Stream</h2>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Go live in HD</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="w-10 h-10 flex items-center justify-center rounded-2xl bg-white/5 hover:bg-white/10 transition-all"
          >
            <X className="w-5 h-5 text-white" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-6 pb-4 space-y-5 max-h-[60vh]">
          {/* Stream Mode */}
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Stream Mode</label>
            <div className="grid grid-cols-3 gap-2">
              {([
                { id: 'solo' as StreamMode, icon: <Video className="w-5 h-5" />, label: 'Solo', color: 'rose' },
                { id: 'pk-2' as StreamMode, icon: <Swords className="w-5 h-5" />, label: '2-Way PK', color: 'purple' },
                { id: 'pk-4' as StreamMode, icon: <Radio className="w-5 h-5" />, label: '4-Way PK', color: 'orange' },
              ]).map(opt => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setStreamMode(opt.id)}
                  className={`flex flex-col items-center gap-1.5 p-3 rounded-2xl border transition-all active:scale-95 ${
                    streamMode === opt.id
                      ? opt.color === 'rose' ? 'bg-rose-500/15 border-rose-500/40 text-rose-400'
                        : opt.color === 'purple' ? 'bg-purple-500/15 border-purple-500/40 text-purple-400'
                        : 'bg-orange-500/15 border-orange-500/40 text-orange-400'
                      : 'bg-white/[0.03] border-white/5 text-slate-400 hover:bg-white/[0.06]'
                  }`}
                >
                  {opt.icon}
                  <span className="font-black text-[10px] uppercase tracking-wider">{opt.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Title */}
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Stream Title *</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What's your stream about?"
              maxLength={100}
              className="w-full bg-white/5 border border-white/5 rounded-2xl px-4 py-3.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-rose-500/40 focus:ring-1 focus:ring-rose-500/20 transition-all"
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Tell viewers what to expect..."
              maxLength={500}
              rows={3}
              className="w-full bg-white/5 border border-white/5 rounded-2xl px-4 py-3.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-rose-500/40 focus:ring-1 focus:ring-rose-500/20 transition-all resize-none"
            />
          </div>

          {/* Category Selection */}
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Category</label>
            <div className="flex flex-wrap gap-2">
              {STREAM_CATEGORIES.map((cat) => (
                <button
                  key={cat.value}
                  type="button"
                  onClick={() => setCategory(category === cat.value ? '' : cat.value)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-2xl text-xs font-bold transition-all active:scale-95 ${
                    category === cat.value
                      ? 'bg-rose-500/20 border border-rose-500/40 text-rose-300'
                      : 'bg-white/5 border border-white/5 text-slate-400 hover:bg-white/[0.08]'
                  }`}
                >
                  <span>{cat.icon}</span>
                  <span>{cat.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Hashtags */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                <Hash className="w-3 h-3" /> Hashtags
              </label>
              <span className="text-[10px] text-slate-600 font-bold">{hashtags.length}/{MAX_HASHTAGS}</span>
            </div>
            <div className="flex flex-wrap gap-1.5 p-3 bg-white/5 border border-white/5 rounded-2xl min-h-[44px]">
              {hashtags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 px-2.5 py-1 bg-rose-500/15 text-rose-300 text-xs font-bold rounded-xl"
                >
                  #{tag}
                  <button
                    type="button"
                    onClick={() => removeHashtag(tag)}
                    className="hover:bg-rose-500/20 rounded-full p-0.5"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
              {hashtags.length < MAX_HASHTAGS && (
                <input
                  type="text"
                  value={hashtagInput}
                  onChange={handleHashtagChange}
                  onKeyDown={handleHashtagKeyDown}
                  placeholder={hashtags.length === 0 ? "Add hashtags..." : ""}
                  className="flex-1 min-w-[80px] bg-transparent outline-none text-sm text-white placeholder:text-slate-600"
                />
              )}
            </div>
            <p className="text-[10px] text-slate-600">Press space or enter to add</p>
          </div>

          {/* Cover Image */}
          <CoverImageUpload
            value={coverImageUrl}
            onChange={setCoverImageUrl}
          />

          {/* Toggle Settings */}
          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 block">Settings</label>
            
            {/* Private */}
            <div className="flex items-center justify-between py-3.5 px-4 bg-white/[0.03] rounded-2xl border border-white/5">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center">
                  {isPrivate ? <Lock className="w-4 h-4 text-amber-400" /> : <Globe className="w-4 h-4 text-slate-400" />}
                </div>
                <div>
                  <p className="text-sm font-bold text-white">Private Stream</p>
                  <p className="text-[10px] text-slate-500">Only people with the link can join</p>
                </div>
              </div>
              <Switch checked={isPrivate} onCheckedChange={setIsPrivate} />
            </div>

            {/* Schedule */}
            <div className="flex items-center justify-between py-3.5 px-4 bg-white/[0.03] rounded-2xl border border-white/5">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center">
                  <Calendar className="w-4 h-4 text-slate-400" />
                </div>
                <div>
                  <p className="text-sm font-bold text-white">Schedule for Later</p>
                  <p className="text-[10px] text-slate-500">Set a start time</p>
                </div>
              </div>
              <Switch checked={isScheduled} onCheckedChange={setIsScheduled} />
            </div>

            {isScheduled && (
              <div className="px-4 py-3 bg-white/[0.03] rounded-2xl border border-white/5 space-y-3">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Start Time</label>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="date"
                    min={today}
                    value={scheduledDate}
                    onChange={(e) => setScheduledDate(e.target.value)}
                    className="w-full bg-white/5 border border-white/5 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-rose-500/40 transition-all [color-scheme:dark]"
                  />
                  <input
                    type="time"
                    value={scheduledTime}
                    onChange={(e) => setScheduledTime(e.target.value)}
                    className="w-full bg-white/5 border border-white/5 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-rose-500/40 transition-all [color-scheme:dark]"
                  />
                </div>
              </div>
            )}

            {/* Premium */}
            <div className="flex items-center justify-between py-3.5 px-4 bg-white/[0.03] rounded-2xl border border-white/5">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                </div>
                <div>
                  <p className="text-sm font-bold text-white">Premium Stream</p>
                  <p className="text-[10px] text-slate-500">Only subscribers can view</p>
                </div>
              </div>
              <Switch checked={isPremium} onCheckedChange={setIsPremium} />
            </div>
          </div>

          {/* Stream Features */}
          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 block">Stream Features</label>

            <div className="flex items-center justify-between py-3 px-4 bg-white/[0.03] rounded-2xl border border-white/5">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-orange-500/10 flex items-center justify-center">
                  <Flame className="w-4 h-4 text-orange-400" />
                </div>
                <div>
                  <p className="text-sm font-bold text-white">Hype System</p>
                  <p className="text-[10px] text-slate-500">Particles, meter & event ticker</p>
                </div>
              </div>
              <Switch checked={featureHype} onCheckedChange={setFeatureHype} />
            </div>

            <div className="flex items-center justify-between py-3 px-4 bg-white/[0.03] rounded-2xl border border-white/5">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-cyan-500/10 flex items-center justify-center">
                  <Gamepad2 className="w-4 h-4 text-cyan-400" />
                </div>
                <div>
                  <p className="text-sm font-bold text-white">Co-Pilot Tools</p>
                  <p className="text-[10px] text-slate-500">Polls, light, sound & predictions</p>
                </div>
              </div>
              <Switch checked={featureCoPilot} onCheckedChange={setFeatureCoPilot} />
            </div>

            <div className="flex items-center justify-between py-3 px-4 bg-white/[0.03] rounded-2xl border border-white/5">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-yellow-500/10 flex items-center justify-center">
                  <Zap className="w-4 h-4 text-yellow-400" />
                </div>
                <div>
                  <p className="text-sm font-bold text-white">AI PULSE Panel</p>
                  <p className="text-[10px] text-slate-500">AI catch-up summaries & sentiment</p>
                </div>
              </div>
              <Switch checked={featureAIPulse} onCheckedChange={setFeatureAIPulse} />
            </div>

            <div className="flex items-center justify-between py-3 px-4 bg-white/[0.03] rounded-2xl border border-white/5">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-rose-500/10 flex items-center justify-center">
                  <Heart className="w-4 h-4 text-rose-400" />
                </div>
                <div>
                  <p className="text-sm font-bold text-white">Chat Reactions</p>
                  <p className="text-[10px] text-slate-500">Flying emoji reactions in chat</p>
                </div>
              </div>
              <Switch checked={featureChatReactions} onCheckedChange={setFeatureChatReactions} />
            </div>
          </div>

          {/* Security Notice */}
          <div className="bg-white/[0.03] rounded-2xl p-4 flex items-center gap-3 border border-white/5">
            <div className="w-9 h-9 rounded-xl bg-rose-500/15 flex items-center justify-center flex-shrink-0">
              <Shield className="w-4 h-4 text-rose-400" />
            </div>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest leading-relaxed">
              AI Moderation is active. By going live you agree to our content guidelines.
            </p>
          </div>
        </div>

        {/* Footer Buttons */}
        <div className="px-6 py-5 border-t border-white/5 flex gap-3 bg-[#0a0b12]">
          <button 
            onClick={onClose}
            className="flex-1 py-3.5 bg-white/5 text-slate-400 rounded-2xl text-sm font-bold hover:bg-white/10 transition-all active:scale-95"
          >
            Cancel
          </button>
          <button 
            onClick={handleCreate} 
            disabled={loading || premiumLoading || !title.trim()}
            className={`flex-1 py-3.5 rounded-2xl text-sm font-black flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-40 disabled:pointer-events-none shadow-lg ${
              streamMode !== 'solo'
                ? 'bg-gradient-to-r from-pink-500 to-violet-600 text-white shadow-pink-500/25'
                : 'bg-white text-black hover:bg-rose-50 shadow-white/10'
            }`}
          >
            {loading ? (
              <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                {isScheduled ? 'Schedule' : streamMode !== 'solo' ? 'Start PK Battle' : 'Go Live'}
              </>
            )}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
