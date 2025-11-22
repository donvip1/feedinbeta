import { useState } from 'react';
import { Globe, Users, UserCheck, Lock, Loader2, MapPin, Hash, X, Calendar, Clock } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';

interface PostDetailsProps {
  media: { url: string; type: 'image' | 'video'; file: File }[];
  onSubmit: () => void;
  onClose: () => void;
}

export default function PostDetails({ media, onSubmit, onClose }: PostDetailsProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [caption, setCaption] = useState('');
  const [location, setLocation] = useState('');
  const [privacy, setPrivacy] = useState<'everyone' | 'friends' | 'followers' | 'only_me'>('everyone');
  const [loading, setLoading] = useState(false);
  const [showSchedule, setShowSchedule] = useState(false);
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  const [currentPreviewIndex, setCurrentPreviewIndex] = useState(0);

  const privacyOptions = [
    { value: 'everyone' as const, label: 'Everyone', icon: Globe },
    { value: 'friends' as const, label: 'Friends', icon: Users },
    { value: 'followers' as const, label: 'Followers', icon: UserCheck },
    { value: 'only_me' as const, label: 'Only Me', icon: Lock },
  ];

  const handleSubmit = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      // Upload all media files to storage
      const uploadedMedia: { url: string; type: string }[] = [];
      
      for (const mediaItem of media) {
        const fileExt = mediaItem.file.name.split('.').pop();
        const fileName = `${user.id}/${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${fileExt}`;
        const bucketName = mediaItem.type === 'image' ? 'post-images' : 'post-videos';

        const { error: uploadError } = await supabase.storage
          .from(bucketName)
          .upload(fileName, mediaItem.file);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from(bucketName)
          .getPublicUrl(fileName);

        uploadedMedia.push({ url: publicUrl, type: mediaItem.type });
      }

      // Prepare scheduled time if set
      let scheduledAt = null;
      if (scheduledDate && scheduledTime) {
        scheduledAt = new Date(`${scheduledDate}T${scheduledTime}`).toISOString();
      }

      // Create post with multiple media
      const postData: any = {
        user_id: user.id,
        feed_id: crypto.randomUUID(),
        content: caption,
        location: location || null,
        privacy,
        post_type: 'public',
        status: scheduledAt ? 'scheduled' : 'active',
        scheduled_at: scheduledAt,
      };

      // For multiple media, only use arrays. For single media, use both single and array fields
      if (uploadedMedia.length > 1) {
        postData.media_urls = uploadedMedia.map(m => m.url);
        postData.media_types = uploadedMedia.map(m => m.type);
        postData.media_url = null;
        postData.media_type = null;
      } else if (uploadedMedia.length === 1) {
        postData.media_url = uploadedMedia[0].url;
        postData.media_type = uploadedMedia[0].type;
        postData.media_urls = [uploadedMedia[0].url];
        postData.media_types = [uploadedMedia[0].type];
      }

      const { error: postError } = await supabase
        .from('posts')
        .insert(postData);

      if (postError) throw postError;

      toast({
        title: 'Post created!',
        description: 'Your post has been published successfully.',
      });

      onSubmit();
    } catch (error: any) {
      console.error('Error creating post:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to create post',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-background flex flex-col items-center justify-start p-4 overflow-y-auto max-w-sm mx-auto">
      <div className="w-full flex items-center justify-between mb-4">
        <button onClick={onClose} className="text-foreground">
          <X className="w-6 h-6" />
        </button>
        <h2 className="text-lg font-semibold">Post Details</h2>
        <div className="w-6" />
      </div>

      {/* Media Preview with Counter */}
      <div className="w-full mb-4 relative">
        {media[currentPreviewIndex].type === 'image' ? (
          <img src={media[currentPreviewIndex].url} className="w-full rounded-lg object-cover max-h-48" alt="Preview" />
        ) : (
          <video src={media[currentPreviewIndex].url} className="w-full rounded-lg max-h-48" controls />
        )}
        
        {media.length > 1 && (
          <>
            {/* Counter */}
            <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-sm text-white text-xs px-2 py-1 rounded-full">
              {currentPreviewIndex + 1}/{media.length}
            </div>
            
            {/* Navigation Dots */}
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
              {media.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentPreviewIndex(index)}
                  className={`w-1.5 h-1.5 rounded-full transition-all ${
                    index === currentPreviewIndex ? 'bg-white w-4' : 'bg-white/50'
                  }`}
                />
              ))}
            </div>
            
            {/* Swipe Navigation */}
            {currentPreviewIndex > 0 && (
              <button
                onClick={() => setCurrentPreviewIndex(prev => prev - 1)}
                className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 backdrop-blur-sm text-white rounded-full p-2 hover:bg-black/70 transition"
              >
                <X className="w-4 h-4 rotate-90" />
              </button>
            )}
            {currentPreviewIndex < media.length - 1 && (
              <button
                onClick={() => setCurrentPreviewIndex(prev => prev + 1)}
                className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 backdrop-blur-sm text-white rounded-full p-2 hover:bg-black/70 transition"
              >
                <X className="w-4 h-4 -rotate-90" />
              </button>
            )}
          </>
        )}
      </div>

      <div className="w-full mb-4">
        <div className="flex items-center gap-2 mb-2">
          <Hash className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium">Caption</span>
        </div>
        <textarea
          placeholder="Write a caption..."
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          className="w-full p-3 border border-border rounded-lg text-sm resize-none bg-background"
          rows={3}
        />
      </div>

      <div className="w-full mb-4">
        <div className="flex items-center gap-2 mb-2">
          <MapPin className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium">Location (optional)</span>
        </div>
        <input
          type="text"
          placeholder="Add location..."
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          className="w-full p-3 border border-border rounded-lg text-sm bg-background"
        />
      </div>

      <div className="w-full mb-4">
        <label className="text-sm font-medium mb-2 block">Privacy</label>
        <div className="flex flex-wrap gap-2">
          {privacyOptions.map((opt) => {
            const Icon = opt.icon;
            return (
              <button
                key={opt.value}
                onClick={() => setPrivacy(opt.value)}
                className={`px-3 py-2 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                  privacy === opt.value
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Schedule Post */}
      <div className="w-full mb-6">
        <Button
          type="button"
          variant="outline"
          onClick={() => setShowSchedule(!showSchedule)}
          className="w-full mb-3"
        >
          <Calendar className="w-4 h-4 mr-2" />
          {showSchedule ? 'Remove Schedule' : 'Schedule Post'}
        </Button>

        {showSchedule && (
          <div className="space-y-3 p-4 border border-border rounded-lg bg-muted/50">
            <div>
              <label className="text-xs font-medium mb-1.5 block flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                Date
              </label>
              <input
                type="date"
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
                min={format(new Date(), 'yyyy-MM-dd')}
                className="w-full p-2 border border-border rounded-lg text-sm bg-background"
              />
            </div>
            <div>
              <label className="text-xs font-medium mb-1.5 block flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                Time
              </label>
              <input
                type="time"
                value={scheduledTime}
                onChange={(e) => setScheduledTime(e.target.value)}
                className="w-full p-2 border border-border rounded-lg text-sm bg-background"
              />
            </div>
            {scheduledDate && scheduledTime && (
              <p className="text-xs text-muted-foreground">
                Will be posted on {format(new Date(`${scheduledDate}T${scheduledTime}`), 'PPp')}
              </p>
            )}
          </div>
        )}
      </div>

      <button
        onClick={handleSubmit}
        disabled={loading || !caption.trim()}
        className="w-full py-3 rounded-full bg-primary text-primary-foreground font-semibold text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {loading && <Loader2 className="w-4 h-4 animate-spin" />}
        {loading ? 'Posting...' : 'Post'}
      </button>
    </div>
  );
}
