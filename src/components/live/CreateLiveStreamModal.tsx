import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Video, Sparkles, Crown, Unlock, Calendar, Radio, Clock, Swords, Hash, X } from "lucide-react";
import { CoverImageUpload } from "@/components/live/shared/CoverImageUpload";

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
import { usePremiumStatus } from "@/hooks/usePremiumStatus";
import { useNavigation } from "@/context/NavigationContext";
import { cn } from "@/lib/utils";

// ADMIN CONFIG: Set to true to restrict live streaming to premium users only
// When false, all users can create live streams (current default for launch)
const REQUIRE_PREMIUM_FOR_STREAMING = false;

type RoomType = 'video_broadcast' | 'pk_battle';

interface CreateLiveStreamModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStreamCreated: (streamId: string) => void;
}

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
  const [coverImageUrl, setCoverImageUrl] = useState<string | null>(null);
  const { isPremium: userIsPremium, loading: premiumLoading } = usePremiumStatus();

  const MAX_HASHTAGS = 5;

  const handleHashtagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if ((e.key === ' ' || e.key === 'Enter') && hashtagInput.trim()) {
      e.preventDefault();
      const tag = hashtagInput.trim().replace(/^#/, '').toLowerCase();
      if (tag && !hashtags.includes(tag) && hashtags.length < MAX_HASHTAGS) {
        setHashtags([...hashtags, tag]);
        setHashtagInput("");
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

  // Check if user can create streams
  const canCreateStream = !REQUIRE_PREMIUM_FOR_STREAMING || userIsPremium;

  const handleCreate = async () => {
    if (!title.trim()) {
      toast.error("Please enter a title");
      return;
    }

    // Validate scheduled date/time if scheduling
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

    // Check premium requirement if enabled
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

      // Generate stream key
      const { data: streamKeyData } = await supabase.rpc('generate_stream_key');
      
      // Build scheduled_start if scheduling
      let scheduledStart = null;
      if (isScheduled && scheduledDate && scheduledTime) {
        scheduledStart = new Date(`${scheduledDate}T${scheduledTime}`).toISOString();
      }

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
          room_type: roomType,
          cover_image_url: coverImageUrl,
        })
        .select()
        .single();

      if (error) throw error;

      toast.success(isScheduled ? "Stream scheduled!" : "Starting live stream...");
      onStreamCreated(data.id);
      onClose();
      
      // Reset form
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
      setCoverImageUrl(null);
    } catch (error: any) {
      console.error("Error creating stream:", error);
      toast.error(error.message || "Failed to create stream");
    } finally {
      setLoading(false);
    }
  };

  // Show premium required message if streaming is restricted
  if (REQUIRE_PREMIUM_FOR_STREAMING && !userIsPremium && !premiumLoading) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Crown className="w-5 h-5 text-yellow-500" />
              Premium Feature
            </DialogTitle>
            <DialogDescription>
              Live streaming is currently available for premium subscribers only.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="p-4 bg-gradient-to-r from-yellow-500/10 to-orange-500/10 border border-yellow-500/20 rounded-lg text-center">
              <Crown className="w-12 h-12 mx-auto text-yellow-500 mb-3" />
              <h3 className="font-semibold mb-2">Upgrade to Premium</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Get access to live streaming, exclusive content, and more!
              </p>
              <Button className="bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600">
                View Plans
              </Button>
            </div>
          </div>
          
          <Button variant="outline" onClick={onClose} className="w-full">
            Maybe Later
          </Button>
        </DialogContent>
      </Dialog>
    );
  }

  // Get min date (today) for scheduling
  const today = new Date().toISOString().split('T')[0];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md max-h-[90vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Video className="w-5 h-5 text-primary" />
            Create Live Stream
          </DialogTitle>
          {!REQUIRE_PREMIUM_FOR_STREAMING && (
            <DialogDescription className="flex items-center gap-1 text-green-500">
              <Unlock className="w-3 h-3" />
              Live streaming is currently open for everyone!
            </DialogDescription>
          )}
        </DialogHeader>
        
        <div className="space-y-4 overflow-y-auto flex-1 pr-1">
          {/* Room Type Selection */}
          <div>
            <Label className="text-xs text-muted-foreground mb-2 block">Stream Type</Label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setRoomType('video_broadcast')}
                className={cn(
                  "flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all",
                  roomType === 'video_broadcast' 
                    ? "border-primary bg-primary/10 text-primary" 
                    : "border-muted hover:border-muted-foreground/50"
                )}
              >
                <Video className="w-5 h-5" />
                <span className="font-medium text-xs">Video</span>
              </button>
              <button
                type="button"
                onClick={() => setRoomType('pk_battle')}
                className={cn(
                  "flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all",
                  roomType === 'pk_battle' 
                    ? "border-purple-500 bg-purple-500/10 text-purple-500" 
                    : "border-muted hover:border-muted-foreground/50"
                )}
              >
                <Swords className="w-5 h-5" />
                <span className="font-medium text-xs">PK Battle</span>
              </button>
            </div>
          </div>

          {/* Stream Schedule Toggle */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setIsScheduled(false)}
              className={cn(
                "flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all",
                !isScheduled 
                  ? "border-red-500 bg-red-500/10 text-red-500" 
                  : "border-muted hover:border-muted-foreground/50"
              )}
            >
              <Radio className="w-6 h-6" />
              <span className="font-medium text-sm">Go Live Now</span>
            </button>
            <button
              type="button"
              onClick={() => setIsScheduled(true)}
              className={cn(
                "flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all",
                isScheduled 
                  ? "border-blue-500 bg-blue-500/10 text-blue-500" 
                  : "border-muted hover:border-muted-foreground/50"
              )}
            >
              <Calendar className="w-6 h-6" />
              <span className="font-medium text-sm">Schedule</span>
            </button>
          </div>

          <div>
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              placeholder="What's your stream about?"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={100}
            />
          </div>

          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="Tell viewers what to expect..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              maxLength={500}
            />
          </div>

          <div>
            <Label>Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a category" />
              </SelectTrigger>
              <SelectContent className="bg-background border border-border z-50">
                {STREAM_CATEGORIES.map((cat) => (
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
          <div>
            <Label className="flex items-center justify-between">
              <span className="flex items-center gap-1">
                <Hash className="w-3 h-3" />
                Hashtags
              </span>
              <span className="text-xs text-muted-foreground">{hashtags.length}/{MAX_HASHTAGS}</span>
            </Label>
            <div className="mt-1.5 flex flex-wrap gap-1.5 p-2 border border-input rounded-md bg-background min-h-[42px]">
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
            <p className="text-xs text-muted-foreground mt-1">Press space or enter to add</p>
          </div>

          {/* Cover Image Upload */}
          <CoverImageUpload
            value={coverImageUrl}
            onChange={setCoverImageUrl}
          />
          {isScheduled && (
            <div className="space-y-3 p-3 bg-blue-500/5 border border-blue-500/20 rounded-lg">
              <div className="flex items-center gap-2 text-blue-500">
                <Clock className="w-4 h-4" />
                <span className="text-sm font-medium">Schedule Time</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label htmlFor="scheduled-date" className="text-xs">Date</Label>
                  <Input
                    id="scheduled-date"
                    type="date"
                    min={today}
                    value={scheduledDate}
                    onChange={(e) => setScheduledDate(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="scheduled-time" className="text-xs">Time</Label>
                  <Input
                    id="scheduled-time"
                    type="time"
                    value={scheduledTime}
                    onChange={(e) => setScheduledTime(e.target.value)}
                  />
                </div>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              <Label htmlFor="premium" className="cursor-pointer">Premium Stream</Label>
            </div>
            <Switch
              id="premium"
              checked={isPremium}
              onCheckedChange={setIsPremium}
            />
          </div>
          {isPremium && (
            <p className="text-xs text-muted-foreground">
              Only subscribers can view this stream
            </p>
          )}

          <div className="flex gap-2 pt-4 flex-shrink-0 sticky bottom-0 bg-background pb-1">
            <Button variant="outline" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button 
              onClick={handleCreate} 
              disabled={loading || premiumLoading} 
              className={cn(
                "flex-1",
                !isScheduled && "bg-red-600 hover:bg-red-700"
              )}
            >
              {loading ? "Creating..." : isScheduled ? "Schedule Stream" : "Go Live"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};