import { useState, useEffect } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { 
  Mic, Lock, Globe, Calendar, Hash, X, Radio, ChevronRight,
  ImagePlus, Shield, Sparkles
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { useNavigation } from '@/context/NavigationContext';
import { CoverImageUpload } from '@/components/live/shared/CoverImageUpload';

interface CreateSpaceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSpaceCreated: (spaceId: string) => void;
}

const SPACE_CATEGORIES = [
  { value: 'music', label: 'Music', icon: '🎵' },
  { value: 'gaming', label: 'Gaming', icon: '🎮' },
  { value: 'chat', label: 'Chat', icon: '💬' },
  { value: 'talk_show', label: 'Talk Show', icon: '🎙️' },
  { value: 'education', label: 'Education', icon: '📚' },
  { value: 'sports', label: 'Sports', icon: '⚽' },
  { value: 'business', label: 'Business', icon: '💼' },
  { value: 'tech', label: 'Tech', icon: '💻' },
  { value: 'news', label: 'News', icon: '📰' },
  { value: 'lifestyle', label: 'Lifestyle', icon: '🌟' },
  { value: 'entertainment', label: 'Entertainment', icon: '🎬' },
  { value: 'other', label: 'Other', icon: '✨' },
];

const MAX_HASHTAGS = 5;

export const CreateSpaceModal = ({ isOpen, onClose, onSpaceCreated }: CreateSpaceModalProps) => {
  const { user } = useAuth();
  const { setHideBottomNav } = useNavigation();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [topicCategory, setTopicCategory] = useState('');
  const [hashtags, setHashtags] = useState<string[]>([]);
  const [hashtagInput, setHashtagInput] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [isScheduled, setIsScheduled] = useState(false);
  const [scheduledStart, setScheduledStart] = useState('');
  const [isRecordingEnabled, setIsRecordingEnabled] = useState(true);
  const [loading, setLoading] = useState(false);
  const [coverImageUrl, setCoverImageUrl] = useState<string | null>(null);

  const addHashtag = (raw: string) => {
    const tag = raw.trim().replace(/^#/, '').replace(/[^a-zA-Z0-9_]/g, '').toLowerCase();
    if (tag && !hashtags.includes(tag) && hashtags.length < MAX_HASHTAGS) {
      setHashtags([...hashtags, tag]);
    }
  };

  const handleHashtagChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    // Check if user typed a space or comma — treat as separator
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

  const handleCreate = async () => {
    if (!title.trim()) {
      toast.error('Please enter a title for your space');
      return;
    }
    if (!user) {
      toast.error('You must be logged in to create a space');
      return;
    }

    setLoading(true);
    try {
      const shareLink = Math.floor(100000 + Math.random() * 900000).toString();
      
      const { data, error } = await supabase
        .from('live_spaces')
        .insert({
          user_id: user.id,
          title: title.trim(),
          description: description.trim() || null,
          topic_category: topicCategory || null,
          hashtags: hashtags.length > 0 ? hashtags : null,
          is_private: isPrivate,
          is_recording_enabled: isRecordingEnabled,
          status: isScheduled ? 'scheduled' : 'live',
          scheduled_start: isScheduled && scheduledStart ? new Date(scheduledStart).toISOString() : null,
          started_at: isScheduled ? null : new Date().toISOString(),
          share_link: shareLink,
          allow_mic_for_all: true,
          cover_image_url: coverImageUrl,
        })
        .select()
        .single();

      if (error) throw error;

      const { error: hostError } = await supabase
        .from('live_space_speakers')
        .insert({
          space_id: data.id,
          user_id: user.id,
          role: 'host',
          is_muted: false,
          host_muted: false,
          mic_allowed: true,
        });

      if (hostError) {
        console.error('[CreateSpace] Error adding host:', hostError);
      }

      toast.success(isScheduled ? 'Space scheduled!' : 'Space started!');
      onSpaceCreated(data.id);
      onClose();
      
      setTitle('');
      setDescription('');
      setTopicCategory('');
      setHashtags([]);
      setHashtagInput('');
      setIsPrivate(false);
      setIsScheduled(false);
      setScheduledStart('');
      setCoverImageUrl(null);
    } catch (error: any) {
      console.error('Error creating space:', error);
      toast.error(error.message || 'Failed to create space');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md max-h-[90vh] p-0 bg-[#0F1119] border border-white/5 rounded-[2.5rem] overflow-hidden gap-0">
        {/* Accent top line */}
        <div className="h-1 bg-gradient-to-r from-transparent via-purple-500 to-transparent opacity-50" />

        {/* Header */}
        <div className="px-6 pt-6 pb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-purple-600 to-pink-600 flex items-center justify-center shadow-lg shadow-purple-500/20">
              <Radio className="w-6 h-6 text-white animate-pulse" />
            </div>
            <div>
              <h2 className="text-lg font-black text-white tracking-tight">Start a Space</h2>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Configure your room</p>
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
          {/* Title */}
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Space Title *</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What's this space about?"
              maxLength={100}
              className="w-full bg-white/5 border border-white/5 rounded-2xl px-4 py-3.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-purple-500/40 focus:ring-1 focus:ring-purple-500/20 transition-all"
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Tell people what to expect..."
              maxLength={500}
              rows={3}
              className="w-full bg-white/5 border border-white/5 rounded-2xl px-4 py-3.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-purple-500/40 focus:ring-1 focus:ring-purple-500/20 transition-all resize-none"
            />
          </div>

          {/* Category Selection */}
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Topic Category</label>
            <div className="flex flex-wrap gap-2">
              {SPACE_CATEGORIES.map((cat) => (
                <button
                  key={cat.value}
                  type="button"
                  onClick={() => setTopicCategory(topicCategory === cat.value ? '' : cat.value)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-2xl text-xs font-bold transition-all active:scale-95 ${
                    topicCategory === cat.value
                      ? 'bg-purple-500/20 border border-purple-500/40 text-purple-300'
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
                  className="inline-flex items-center gap-1 px-2.5 py-1 bg-purple-500/15 text-purple-300 text-xs font-bold rounded-xl"
                >
                  #{tag}
                  <button
                    type="button"
                    onClick={() => removeHashtag(tag)}
                    className="hover:bg-purple-500/20 rounded-full p-0.5"
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
                  <p className="text-sm font-bold text-white">Private Space</p>
                  <p className="text-[10px] text-slate-500">Only invited users can join</p>
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
              <div className="px-4 py-3 bg-white/[0.03] rounded-2xl border border-white/5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Start Time</label>
                <input
                  type="datetime-local"
                  value={scheduledStart}
                  onChange={(e) => setScheduledStart(e.target.value)}
                  min={new Date().toISOString().slice(0, 16)}
                  className="w-full bg-white/5 border border-white/5 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-purple-500/40 transition-all [color-scheme:dark]"
                />
              </div>
            )}

            {/* Recording */}
            <div className="flex items-center justify-between py-3.5 px-4 bg-white/[0.03] rounded-2xl border border-white/5">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center">
                  <Mic className="w-4 h-4 text-slate-400" />
                </div>
                <div>
                  <p className="text-sm font-bold text-white">Enable Recording</p>
                  <p className="text-[10px] text-slate-500">Save space for replay</p>
                </div>
              </div>
              <Switch checked={isRecordingEnabled} onCheckedChange={setIsRecordingEnabled} />
            </div>
          </div>

          {/* Security Notice */}
          <div className="bg-white/[0.03] rounded-2xl p-4 flex items-center gap-3 border border-white/5">
            <div className="w-9 h-9 rounded-xl bg-purple-500/15 flex items-center justify-center flex-shrink-0">
              <Shield className="w-4 h-4 text-purple-400" />
            </div>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest leading-relaxed">
              Secure broadcasting enabled. All spaces are monitored for community safety.
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
            disabled={loading || !title.trim()}
            className="flex-1 py-3.5 bg-white text-black rounded-2xl text-sm font-black flex items-center justify-center gap-2 hover:bg-purple-50 transition-all active:scale-95 disabled:opacity-40 disabled:pointer-events-none shadow-lg shadow-white/10"
          >
            {loading ? (
              <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                {isScheduled ? 'Schedule Space' : 'Go Live'}
              </>
            )}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
