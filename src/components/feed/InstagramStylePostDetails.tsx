import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, MapPin, Clock, Globe, Users, UserCheck, Lock, Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { extractHashtags } from '@/lib/hashtag-utils';
import { useUploadProgress } from '@/hooks/useUploadProgress';
import { ProgressBar } from '@/components/shared/ProgressBar';

interface InstagramStylePostDetailsProps {
  open: boolean;
  onClose: () => void;
  onBack: () => void;
  mediaUrl: string;
  mediaType: 'text' | 'image' | 'video';
  effects: any;
  mediaFile: File | null;
  onSuccess: () => void;
}

export function InstagramStylePostDetails({
  open,
  onClose,
  onBack,
  mediaUrl,
  mediaType,
  effects,
  mediaFile,
  onSuccess
}: InstagramStylePostDetailsProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const { progress, isUploading, startUpload, updateProgress, completeUpload, failUpload } = useUploadProgress();
  const [loading, setLoading] = useState(false);
  const [caption, setCaption] = useState('');
  const [location, setLocation] = useState('');
  const [privacy, setPrivacy] = useState<'everyone' | 'friends' | 'followers' | 'only_me'>('everyone');
  const [allowComments, setAllowComments] = useState(true);
  const [allowRefeed, setAllowRefeed] = useState(true);
  const [scheduleTime, setScheduleTime] = useState<string>('');
  const [showAdvanced, setShowAdvanced] = useState(false);

  const privacyOptions = [
    { value: 'everyone', label: 'Everyone', icon: Globe },
    { value: 'friends', label: 'Friends', icon: Users },
    { value: 'followers', label: 'Followers', icon: UserCheck },
    { value: 'only_me', label: 'Only Me', icon: Lock },
  ];

  const handlePost = async () => {
    if (!user) return;

    setLoading(true);
    startUpload();

    try {
      let finalMediaUrl = mediaUrl;
      let finalMediaType = mediaType;

      // Handle media upload
      if (mediaType !== 'text') {
        updateProgress(20);
        
        if (effects?.processedBlob) {
          // Convert blob URL to File
          const response = await fetch(effects.processedBlob);
          const blob = await response.blob();
          const filename = `${Date.now()}.${mediaType === 'image' ? 'jpg' : 'mp4'}`;
          const file = new File([blob], filename, { type: blob.type });
          
          updateProgress(40);
          
          const filePath = `${user.id}/${Date.now()}_${filename}`;
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from(mediaType === 'image' ? 'post-images' : 'post-videos')
            .upload(filePath, file);

          if (uploadError) throw uploadError;

          const { data: { publicUrl } } = supabase.storage
            .from(mediaType === 'image' ? 'post-images' : 'post-videos')
            .getPublicUrl(filePath);

          finalMediaUrl = publicUrl;
        } else if (mediaFile) {
          updateProgress(40);
          
          const filePath = `${user.id}/${Date.now()}_${mediaFile.name}`;
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from(mediaType === 'image' ? 'post-images' : 'post-videos')
            .upload(filePath, mediaFile);

          if (uploadError) throw uploadError;

          const { data: { publicUrl } } = supabase.storage
            .from(mediaType === 'image' ? 'post-images' : 'post-videos')
            .getPublicUrl(filePath);

          finalMediaUrl = publicUrl;
        }
      }

      updateProgress(70);

      // Create post
      const postData = {
        user_id: user.id,
        feed_id: crypto.randomUUID(),
        content: mediaType === 'text' ? mediaUrl : caption,
        media_url: mediaType === 'text' ? null : finalMediaUrl,
        media_type: mediaType === 'text' ? null : finalMediaType,
        music_url: effects?.music?.url || null,
        music_title: effects?.music?.title || null,
        music_artist: effects?.music?.artist || null,
        location: location || null,
        privacy,
        allow_comments: allowComments,
        allow_refeed: allowRefeed,
        scheduled_at: scheduleTime || null,
        status: scheduleTime ? 'scheduled' : 'published',
      };

      const { data: post, error: postError } = await supabase
        .from('posts')
        .insert(postData)
        .select()
        .single();

      if (postError) throw postError;

      updateProgress(90);

      // Process hashtags
      const content = mediaType === 'text' ? mediaUrl : caption;
      const hashtags = extractHashtags(content);
      
      if (hashtags.length > 0) {
        // Manually process hashtags
        for (const hashtag of hashtags) {
          // Upsert hashtag
          const { data: hashtagData } = await supabase
            .from('hashtags')
            .upsert({ name: hashtag }, { onConflict: 'name' })
            .select()
            .single();

          if (hashtagData) {
            // Link hashtag to post
            await supabase
              .from('post_hashtags')
              .insert({ post_id: post.id, hashtag_id: hashtagData.id });
          }
        }
      }

      completeUpload();
      
      toast({
        title: scheduleTime ? "Post scheduled!" : "Post created!",
        description: scheduleTime ? "Your post will be published at the scheduled time" : "Your post is now live",
      });

      onSuccess();
    } catch (error: any) {
      console.error('Error creating post:', error);
      failUpload(error.message);
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
    <div className="flex flex-col md:flex-row h-full bg-background">
      {/* Left: Media Preview */}
      <div className="hidden md:flex md:w-1/2 bg-black items-center justify-center border-r border-border">
        {mediaType === 'text' ? (
          <div className="p-8 text-white text-2xl text-center">
            {mediaUrl}
          </div>
        ) : mediaType === 'image' ? (
          <img
            src={effects?.processedBlob || mediaUrl}
            alt="Preview"
            className="max-w-full max-h-full object-contain"
          />
        ) : (
          <video
            src={mediaUrl}
            className="max-w-full max-h-full object-contain"
            controls
            playsInline
          />
        )}
      </div>

      {/* Right: Post Details */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h2 className="text-lg font-semibold">New Post</h2>
          <Button 
            onClick={handlePost} 
            disabled={loading}
            className="font-semibold"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : scheduleTime ? 'Schedule' : 'Share'}
          </Button>
        </div>

        {/* Progress Bar */}
        <ProgressBar progress={progress} isVisible={isUploading} />

        {/* Form */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {/* Caption */}
          <div className="space-y-2">
            <Label>Caption</Label>
            <Textarea
              placeholder="Write a caption..."
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              className="min-h-[100px] resize-none"
            />
            <p className="text-xs text-muted-foreground">
              Use # for hashtags and @ to mention people
            </p>
          </div>

          {/* Location */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <MapPin className="w-4 h-4" />
              Add Location
            </Label>
            <Input
              placeholder="Where was this?"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            />
          </div>

          {/* Privacy */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Globe className="w-4 h-4" />
              Privacy
            </Label>
            <Select value={privacy} onValueChange={(v: any) => setPrivacy(v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {privacyOptions.map(option => {
                  const Icon = option.icon;
                  return (
                    <SelectItem key={option.value} value={option.value}>
                      <div className="flex items-center gap-2">
                        <Icon className="w-4 h-4" />
                        {option.label}
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          {/* Advanced Settings Toggle */}
          <Button
            variant="ghost"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="w-full justify-between"
          >
            <span>Advanced Settings</span>
            <span className="text-xs">{showAdvanced ? '▼' : '▶'}</span>
          </Button>

          {/* Advanced Settings */}
          {showAdvanced && (
            <div className="space-y-4 pl-4 border-l-2 border-border">
              {/* Schedule */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  Schedule Post
                </Label>
                <Input
                  type="datetime-local"
                  value={scheduleTime}
                  onChange={(e) => setScheduleTime(e.target.value)}
                />
              </div>

              {/* Comments */}
              <div className="flex items-center justify-between">
                <Label htmlFor="comments">Allow Comments</Label>
                <Switch
                  id="comments"
                  checked={allowComments}
                  onCheckedChange={setAllowComments}
                />
              </div>

              {/* Refeed */}
              <div className="flex items-center justify-between">
                <Label htmlFor="refeed">Allow Refeed</Label>
                <Switch
                  id="refeed"
                  checked={allowRefeed}
                  onCheckedChange={setAllowRefeed}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
