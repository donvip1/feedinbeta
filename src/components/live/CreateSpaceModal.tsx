import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Mic, Lock, Globe, Calendar, Hash, X } from 'lucide-react';
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

  const MAX_HASHTAGS = 5;

  const handleHashtagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if ((e.key === ' ' || e.key === 'Enter') && hashtagInput.trim()) {
      e.preventDefault();
      const tag = hashtagInput.trim().replace(/^#/, '').toLowerCase();
      if (tag && !hashtags.includes(tag) && hashtags.length < MAX_HASHTAGS) {
        setHashtags([...hashtags, tag]);
        setHashtagInput('');
      }
    } else if (e.key === 'Backspace' && !hashtagInput && hashtags.length > 0) {
      setHashtags(hashtags.slice(0, -1));
    }
  };

  const removeHashtag = (tagToRemove: string) => {
    setHashtags(hashtags.filter(tag => tag !== tagToRemove));
  };

  // Hide bottom navigation when modal is open
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
      // Generate short numeric share ID (6 digits)
      const shareLink = Math.floor(100000 + Math.random() * 900000).toString();
      
      console.log('[CreateSpace] Creating space with share link:', shareLink);
      
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

      if (error) {
        console.error('[CreateSpace] Error creating space:', error);
        throw error;
      }

      console.log('[CreateSpace] Space created:', data.id, 'Adding host to speakers...');

      // Add creator as host
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
        console.error('[CreateSpace] Error adding host to speakers:', hostError);
        // Don't throw - space was created, we can add host on join
      } else {
        console.log('[CreateSpace] Host added to speakers successfully');
      }

      toast.success(isScheduled ? 'Space scheduled!' : 'Space started!');
      onSpaceCreated(data.id);
      onClose();
      
      // Reset form
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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mic className="w-5 h-5 text-primary" />
            Start a Space
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="title">Space Title *</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What's this space about?"
              maxLength={100}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description (optional)</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Tell people what to expect..."
              maxLength={500}
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label>Topic Category</Label>
            <Select value={topicCategory} onValueChange={setTopicCategory}>
              <SelectTrigger>
                <SelectValue placeholder="Select a category" />
              </SelectTrigger>
              <SelectContent className="bg-background border border-border z-50">
                {SPACE_CATEGORIES.map((cat) => (
                  <SelectItem key={cat.value} value={cat.value}>
                    <span className="flex items-center gap-2">
                      <span>{cat.icon}</span>
                      <span>{cat.label}</span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Hashtags Input */}
          <div className="space-y-2">
            <Label className="flex items-center justify-between">
              <span className="flex items-center gap-1">
                <Hash className="w-3 h-3" />
                Hashtags
              </span>
              <span className="text-xs text-muted-foreground">{hashtags.length}/{MAX_HASHTAGS}</span>
            </Label>
            <div className="flex flex-wrap gap-1.5 p-2 border border-input rounded-md bg-background min-h-[42px]">
              {hashtags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 px-2 py-0.5 bg-primary/10 text-primary text-sm rounded-full"
                >
                  #{tag}
                  <button
                    type="button"
                    onClick={() => removeHashtag(tag)}
                    className="hover:bg-primary/20 rounded-full p-0.5"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
              {hashtags.length < MAX_HASHTAGS && (
                <input
                  type="text"
                  value={hashtagInput}
                  onChange={(e) => setHashtagInput(e.target.value.replace(/\s/g, ''))}
                  onKeyDown={handleHashtagKeyDown}
                  placeholder={hashtags.length === 0 ? "Add hashtags..." : ""}
                  className="flex-1 min-w-[80px] bg-transparent outline-none text-sm placeholder:text-muted-foreground"
                />
              )}
            </div>
            <p className="text-xs text-muted-foreground">Press space or enter to add</p>
          </div>

          {/* Cover Image Upload */}
          <CoverImageUpload
            value={coverImageUrl}
            onChange={setCoverImageUrl}
          />

          <div className="flex items-center justify-between py-2">
            <div className="flex items-center gap-2">
              {isPrivate ? <Lock className="w-4 h-4" /> : <Globe className="w-4 h-4" />}
              <div>
                <p className="text-sm font-medium">Private Space</p>
                <p className="text-xs text-muted-foreground">Only invited users can join</p>
              </div>
            </div>
            <Switch checked={isPrivate} onCheckedChange={setIsPrivate} />
          </div>

          <div className="flex items-center justify-between py-2">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              <div>
                <p className="text-sm font-medium">Schedule for Later</p>
                <p className="text-xs text-muted-foreground">Set a start time</p>
              </div>
            </div>
            <Switch checked={isScheduled} onCheckedChange={setIsScheduled} />
          </div>

          {isScheduled && (
            <div className="space-y-2">
              <Label htmlFor="scheduledStart">Start Time</Label>
              <Input
                id="scheduledStart"
                type="datetime-local"
                value={scheduledStart}
                onChange={(e) => setScheduledStart(e.target.value)}
                min={new Date().toISOString().slice(0, 16)}
              />
            </div>
          )}

          <div className="flex items-center justify-between py-2">
            <div className="flex items-center gap-2">
              <Mic className="w-4 h-4" />
              <div>
                <p className="text-sm font-medium">Enable Recording</p>
                <p className="text-xs text-muted-foreground">Save space for replay</p>
              </div>
            </div>
            <Switch checked={isRecordingEnabled} onCheckedChange={setIsRecordingEnabled} />
          </div>
        </div>

        <div className="flex gap-3">
          <Button variant="outline" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button 
            onClick={handleCreate} 
            disabled={loading || !title.trim()}
            className="flex-1 bg-primary"
          >
            {loading ? 'Creating...' : isScheduled ? 'Schedule Space' : 'Start Space'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
