import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, MapPin, Clock, Globe, Users, UserCheck, Lock, Loader2, Calendar, ChevronRight, MessageCircle } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { extractHashtags } from '@/lib/hashtag-utils';
import { useUploadProgress } from '@/hooks/useUploadProgress';
import { ProgressBar } from '@/components/shared/ProgressBar';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

interface InstagramStylePostDetailsProps {
  open: boolean;
  onClose: () => void;
  onBack: () => void;
  mediaUrl: string;
  mediaType: 'text' | 'image' | 'video';
  effects: any;
  mediaFile: File | null;
  onSuccess: () => void;
  quotePost?: {
    id: string;
    content: string | null;
    media_url: string | null;
    media_type: string | null;
    user_id: string;
    user: {
      display_name: string | null;
      username: string | null;
      avatar_url: string | null;
    };
  } | null;
}

export function InstagramStylePostDetails({
  open,
  onClose,
  onBack,
  mediaUrl,
  mediaType,
  effects,
  mediaFile,
  onSuccess,
  quotePost
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
  const [shareToStory, setShareToStory] = useState(false);
  const [showScheduling, setShowScheduling] = useState(false);
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleHour, setScheduleHour] = useState('12');
  const [scheduleMinute, setScheduleMinute] = useState('00');
  const [schedulePeriod, setSchedulePeriod] = useState<'AM' | 'PM'>('PM');
  const [locationSuggestions, setLocationSuggestions] = useState<string[]>([]);
  const [isDetectingLocation, setIsDetectingLocation] = useState(false);

  const privacyOptions = [
    { value: 'everyone', label: 'Everyone', icon: Globe },
    { value: 'friends', label: 'Friends', icon: Users },
    { value: 'followers', label: 'Followers', icon: UserCheck },
    { value: 'only_me', label: 'Only Me', icon: Lock },
  ];

  const detectLocation = async () => {
    if (!navigator.geolocation) {
      toast({
        title: 'Location not supported',
        description: 'Your browser does not support location detection',
        variant: 'destructive',
      });
      return;
    }

    setIsDetectingLocation(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude } = position.coords;
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`
          );
          const data = await response.json();
          const locationName = data.display_name?.split(',').slice(0, 3).join(',') || '';
          setLocation(locationName);
          setIsDetectingLocation(false);
        } catch (error) {
          console.error('Error getting location:', error);
          setIsDetectingLocation(false);
        }
      },
      (error) => {
        toast({
          title: 'Location access denied',
          description: 'Please allow location access to use this feature',
          variant: 'destructive',
        });
        setIsDetectingLocation(false);
      }
    );
  };

  const searchLocation = async (query: string) => {
    if (query.length < 3) {
      setLocationSuggestions([]);
      return;
    }

    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5`
      );
      const data = await response.json();
      const suggestions = data.map((item: any) => item.display_name);
      setLocationSuggestions(suggestions);
    } catch (error) {
      console.error('Error searching location:', error);
    }
  };

  const handlePost = async (postNow: boolean = true) => {
    if (!user) return;

    // Validate scheduling if not posting now
    if (!postNow && (!scheduleDate || !scheduleHour || !scheduleMinute)) {
      toast({
        title: 'Schedule time required',
        description: 'Please select a date and time for your scheduled post',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    startUpload();

    try {
      let finalMediaUrl = mediaUrl;
      let finalMediaType = mediaType;

      // Handle media upload
      if (mediaType !== 'text') {
        updateProgress(20);
        
        // Check for cropped image or processed media
        const mediaToUpload = effects?.croppedUrl || effects?.processedBlob;
        
        if (mediaToUpload) {
          // Convert blob URL to File
          const response = await fetch(mediaToUpload);
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
        status: scheduleTime ? 'scheduled' : 'active',
        original_post_id: quotePost?.id || null,
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
        title: scheduleTime ? "Post scheduled!" : quotePost ? "Quote feed posted!" : "Post created!",
        description: scheduleTime ? "Your post will be published at the scheduled time" : quotePost ? "Your quote feed is now live" : "Your post is now live",
      });

      onSuccess();
      onClose();
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
      <div className="hidden md:flex md:w-1/2 bg-black items-center justify-center border-r border-border p-4">
        <div className="flex flex-col gap-4 max-w-md w-full">
          {mediaType === 'text' ? (
            <div className="p-8 text-white text-2xl text-center">
              {mediaUrl}
            </div>
          ) : mediaType === 'image' ? (
            <div className="relative w-full h-full flex items-center justify-center">
              <img
                src={effects?.croppedUrl || effects?.processedBlob || mediaUrl}
                alt="Preview"
                className="max-w-full max-h-full object-contain rounded-xl"
                style={{
                  filter: effects?.filter ? 
                    `brightness(${effects.brightness / 100}) contrast(${effects.contrast / 100}) saturate(${effects.saturation / 100})` 
                    : undefined
                }}
              />
              {/* Text Overlays Preview */}
              {effects?.textOverlays && effects.textOverlays.length > 0 && (
                <div className="absolute inset-0">
                  {effects.textOverlays.map((overlay: any, index: number) => (
                    <div
                      key={index}
                      className="absolute font-bold whitespace-nowrap pointer-events-none"
                      style={{
                        left: `${overlay.x}px`,
                        top: `${overlay.y}px`,
                        fontSize: `${overlay.fontSize}px`,
                        color: overlay.color,
                        backgroundColor: overlay.backgroundColor,
                        padding: overlay.backgroundColor !== 'transparent' ? '4px 8px' : '0',
                        borderRadius: overlay.backgroundColor !== 'transparent' ? '4px' : '0',
                        textShadow: overlay.hasOutline ? '2px 2px 4px rgba(0,0,0,0.8)' : 'none',
                        WebkitTextStroke: overlay.hasOutline ? '1px rgba(0,0,0,0.5)' : 'none',
                      }}
                    >
                      {overlay.text}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <video
              src={mediaUrl}
              className="max-w-full max-h-full object-contain rounded-xl"
              controls
              playsInline
            />
          )}
          
          {/* Quoted Post Preview */}
          {quotePost && (
            <div className="border border-border rounded-xl p-3 bg-muted/30 w-full">
              <div className="flex items-center gap-2 mb-2">
                <Avatar className="w-5 h-5">
                  <AvatarImage src={quotePost.user.avatar_url || undefined} />
                  <AvatarFallback className="text-xs">
                    {quotePost.user.display_name?.[0] || quotePost.user.username?.[0] || '?'}
                  </AvatarFallback>
                </Avatar>
                <span className="text-sm font-semibold text-foreground">
                  {quotePost.user.display_name || quotePost.user.username || 'Unknown'}
                </span>
              </div>
              {quotePost.content && (
                <p className="text-sm text-foreground mb-2 line-clamp-2">
                  {quotePost.content}
                </p>
              )}
              {quotePost.media_url && (
                <div className="rounded-lg overflow-hidden">
                  {quotePost.media_type === 'image' ? (
                    <img 
                      src={quotePost.media_url} 
                      alt="Quoted post" 
                      className="w-full max-h-32 object-cover"
                    />
                  ) : (
                    <video 
                      src={quotePost.media_url} 
                      className="w-full max-h-32 object-cover"
                    />
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Right: Post Details */}
      <div className="flex-1 flex flex-col h-screen md:h-full overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border flex-shrink-0">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-xl font-semibold text-foreground">New Post</h1>
          <div className="flex gap-2">
            {showScheduling ? (
              <Button 
                onClick={() => handlePost(false)}
                disabled={loading}
                className="bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Schedule'}
              </Button>
            ) : (
              <Button 
                onClick={() => handlePost(true)}
                disabled={loading}
                className="bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Share'}
              </Button>
            )}
          </div>
        </div>

        {/* Progress Bar */}
        <ProgressBar progress={progress} isVisible={isUploading} />

        {/* Form - Scrollable */}
        <div className="flex-1 overflow-y-auto overscroll-contain pb-32 md:pb-8">
          <div className="p-4 space-y-6">
          {/* Caption */}
          <div className="space-y-2">
            <Label>{quotePost ? "Add Your Comment" : "Caption"}</Label>
            <Textarea
              placeholder={quotePost ? "Share your thoughts on this post..." : "Write a caption..."}
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              className="min-h-[100px] resize-none"
            />
            <p className="text-xs text-muted-foreground">
              Use # for hashtags and @ to mention people
            </p>
          </div>

          {/* Quote Feed Preview */}
          {quotePost && (
            <div className="space-y-2">
              <Label className="text-sm font-medium flex items-center gap-2">
                <MessageCircle className="w-4 h-4" />
                Quote Feeding
              </Label>
              <div className="border border-border rounded-xl p-4 bg-muted/30 hover:bg-muted/40 transition-colors">
                <div className="flex items-start gap-3">
                  <Avatar className="w-10 h-10 flex-shrink-0">
                    <AvatarImage src={quotePost.user.avatar_url || ''} />
                    <AvatarFallback className="bg-gradient-to-br from-pink-500 to-blue-500 text-white text-sm">
                      {quotePost.user.display_name?.[0] || quotePost.user.username?.[0] || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-sm truncate">
                        {quotePost.user.display_name || quotePost.user.username || 'User'}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        @{quotePost.user.username || 'user'}
                      </span>
                    </div>
                    {quotePost.content && (
                      <p className="text-sm text-foreground/80 mb-2 line-clamp-3 leading-relaxed">
                        {quotePost.content}
                      </p>
                    )}
                    {quotePost.media_url && (
                      <div className="rounded-lg overflow-hidden mt-2 border border-border/50">
                        {quotePost.media_type === 'video' ? (
                          <video src={quotePost.media_url} className="w-full max-h-48 object-cover" />
                        ) : (
                          <img src={quotePost.media_url} alt="Quote" className="w-full max-h-48 object-cover" />
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                This post will appear in your quote feed with your comment above
              </p>
            </div>
          )}

          {/* Location */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-2">
                <MapPin className="w-4 h-4" />
                Add Location
              </Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={detectLocation}
                disabled={isDetectingLocation}
                className="text-primary"
              >
                {isDetectingLocation ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                    Detecting...
                  </>
                ) : (
                  'Detect'
                )}
              </Button>
            </div>
            <div className="relative">
              <Input
                placeholder="Where was this?"
                value={location}
                onChange={(e) => {
                  setLocation(e.target.value);
                  searchLocation(e.target.value);
                }}
              />
              {locationSuggestions.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-card border border-border rounded-md shadow-lg max-h-48 overflow-y-auto">
                  {locationSuggestions.map((suggestion, index) => (
                    <button
                      key={index}
                      type="button"
                      className="w-full px-4 py-2 text-left hover:bg-secondary transition-colors text-sm"
                      onClick={() => {
                        setLocation(suggestion);
                        setLocationSuggestions([]);
                      }}
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              )}
            </div>
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

          {/* Share to Story */}
          <div className="flex items-center justify-between p-4 border-b border-border">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 via-pink-500 to-orange-500 flex items-center justify-center">
                <span className="text-white text-sm font-bold">S</span>
              </div>
              <span className="text-base font-medium">Also share to Story</span>
            </div>
            <Switch
              checked={shareToStory}
              onCheckedChange={setShareToStory}
            />
          </div>

          {/* Schedule Post */}
          <button
            onClick={() => setShowScheduling(!showScheduling)}
            className="flex items-center justify-between w-full p-4 hover:bg-accent/50 transition-colors border-b border-border"
          >
            <div className="flex items-center gap-3">
              <Calendar className="w-5 h-5 text-muted-foreground" />
              <span className="text-base font-medium">Schedule Post</span>
            </div>
            <ChevronRight className={`w-5 h-5 transition-transform ${showScheduling ? 'rotate-90' : ''}`} />
          </button>

          {showScheduling && (
            <div className="p-4 bg-accent/30 border-b border-border space-y-4">
              <div>
                <Label className="text-sm text-muted-foreground mb-2 block">Date</Label>
                <Input
                  type="date"
                  value={scheduleDate}
                  onChange={(e) => setScheduleDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  className="bg-background"
                />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <Label className="text-sm text-muted-foreground mb-2 block">Hour</Label>
                  <Select value={scheduleHour} onValueChange={setScheduleHour}>
                    <SelectTrigger className="bg-background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 12 }, (_, i) => (i + 1).toString().padStart(2, '0')).map((hour) => (
                        <SelectItem key={hour} value={hour}>{hour}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-sm text-muted-foreground mb-2 block">Minute</Label>
                  <Select value={scheduleMinute} onValueChange={setScheduleMinute}>
                    <SelectTrigger className="bg-background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {['00', '15', '30', '45'].map((min) => (
                        <SelectItem key={min} value={min}>{min}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-sm text-muted-foreground mb-2 block">Period</Label>
                  <Select value={schedulePeriod} onValueChange={(val) => setSchedulePeriod(val as 'AM' | 'PM')}>
                    <SelectTrigger className="bg-background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="AM">AM</SelectItem>
                      <SelectItem value="PM">PM</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}

          {/* Advanced Settings Toggle */}
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center justify-between w-full p-4 hover:bg-accent/50 transition-colors"
          >
            <span className="text-base font-medium">Advanced Settings</span>
            <ChevronRight className={`w-5 h-5 transition-transform ${showAdvanced ? 'rotate-90' : ''}`} />
          </button>

          {/* Advanced Settings */}
          {showAdvanced && (
            <div className="space-y-4 p-4 bg-accent/30">
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
    </div>
  );
}
