import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Mic, Users, Lock, Globe, Calendar } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { useNavigation } from '@/context/NavigationContext';

interface CreateSpaceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSpaceCreated: (spaceId: string) => void;
}

const TOPIC_CATEGORIES = [
  'Music', 'Tech', 'Business', 'Entertainment', 'Sports', 
  'Education', 'News', 'Lifestyle', 'Gaming', 'Other'
];

export const CreateSpaceModal = ({ isOpen, onClose, onSpaceCreated }: CreateSpaceModalProps) => {
  const { user } = useAuth();
  const { setHideBottomNav } = useNavigation();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [topicCategory, setTopicCategory] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [isScheduled, setIsScheduled] = useState(false);
  const [scheduledStart, setScheduledStart] = useState('');
  const [isRecordingEnabled, setIsRecordingEnabled] = useState(true);
  const [loading, setLoading] = useState(false);

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
      // Generate unique share link
      const shareLink = `${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 8)}`;
      
      const { data, error } = await supabase
        .from('live_spaces')
        .insert({
          user_id: user.id,
          title: title.trim(),
          description: description.trim() || null,
          topic_category: topicCategory || null,
          is_private: isPrivate,
          is_recording_enabled: isRecordingEnabled,
          status: isScheduled ? 'scheduled' : 'live',
          scheduled_start: isScheduled && scheduledStart ? new Date(scheduledStart).toISOString() : null,
          started_at: isScheduled ? null : new Date().toISOString(),
          share_link: shareLink,
        })
        .select()
        .single();

      if (error) throw error;

      // Add creator as host
      await supabase
        .from('live_space_speakers')
        .insert({
          space_id: data.id,
          user_id: user.id,
          role: 'host',
          is_muted: false,
        });

      toast.success(isScheduled ? 'Space scheduled!' : 'Space started!');
      onSpaceCreated(data.id);
      onClose();
      
      // Reset form
      setTitle('');
      setDescription('');
      setTopicCategory('');
      setIsPrivate(false);
      setIsScheduled(false);
      setScheduledStart('');
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
                <SelectValue placeholder="Select a topic" />
              </SelectTrigger>
              <SelectContent>
                {TOPIC_CATEGORIES.map((cat) => (
                  <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

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
