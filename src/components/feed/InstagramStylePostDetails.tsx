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
  onSuccess: (postId?: string) => void;
  quotePost?: {
    id: string;
    content: string | null;
    media_url: string | null;
    media_type: string | null;
    user_id: string;
    likes_count: number;
    comments_count: number;
    views_count: number;
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
          console.error('Location detection error:', error);
          setIsDetectingLocation(false);
          toast({
            title: 'Location detection failed',
            description: 'Could not detect your location',
            variant: 'destructive',
          });
        }
      },
      (error) => {
        setIsDetectingLocation(false);
        toast({
          title: 'Location permission denied',
          description: 'Please enable location access in your browser settings',
          variant: 'destructive',
        });
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
      console.error('Location search error:', error);
    }
  };

  const handlePost = async (postNow: boolean = true) => {
    if (!user) return;

    try {
      setLoading(true);
      startUpload();

      let finalMediaUrl = mediaUrl;
      let finalMediaType = mediaType;

      if (mediaFile && (mediaType === 'image' || mediaType === 'video')) {
        updateProgress(20);
        const fileExt = mediaFile.name.split('.').pop();
        const fileName = `${user.id}-${Date.now()}.${fileExt}`;
        const filePath = `${mediaType}s/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('posts')
          .upload(filePath, mediaFile);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('posts')
          .getPublicUrl(filePath);

        finalMediaUrl = publicUrl;
        updateProgress(50);
      }

      const scheduledAt = showScheduling && scheduleDate && scheduleHour && scheduleMinute
        ? (() => {
            const date = new Date(scheduleDate);
            let hour = parseInt(scheduleHour);
            if (schedulePeriod === 'PM' && hour !== 12) hour += 12;
            if (schedulePeriod === 'AM' && hour === 12) hour = 0;
            date.setHours(hour, parseInt(scheduleMinute), 0, 0);
            return date.toISOString();
          })()
        : null;

      updateProgress(70);

      const postData = {
        user_id: user.id,
        feed_id: user.id,
        content: caption || null,
        media_url: finalMediaUrl || null,
        media_type: finalMediaType !== 'text' ? finalMediaType : null,
        music_url: effects?.selectedMusic?.url || null,
        music_title: effects?.selectedMusic?.title || null,
        music_artist: effects?.selectedMusic?.artist || null,
        location: location || null,
        privacy,
        allow_comments: allowComments,
        allow_refeed: allowRefeed,
        scheduled_at: scheduledAt,
        status: scheduledAt ? 'scheduled' : 'published',
        original_post_id: quotePost?.id || null,
        post_type: quotePost ? 'quote' : 'original',
      };

      const { data: post, error: postError } = await supabase
        .from('posts')
        .insert(postData)
        .select()
        .single();

      if (postError) throw postError;
      updateProgress(90);

      // Process hashtags
      if (caption) {
        const hashtags = extractHashtags(caption);
        
        for (const tag of hashtags) {
          // Insert or get hashtag
          const { data: hashtag, error: hashtagError } = await supabase
            .from('hashtags')
            .upsert({ name: tag.toLowerCase() }, { onConflict: 'name' })
            .select()
            .single();

          if (!hashtagError && hashtag) {
            // Link hashtag to post
            await supabase
              .from('post_hashtags')
              .insert({ post_id: post.id, hashtag_id: hashtag.id });
          }
        }
      }

      if (shareToStory && finalMediaUrl && mediaType !== 'text') {
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + 24);

        await supabase.from('stories').insert({
          user_id: user.id,
          media_url: finalMediaUrl,
          media_type: finalMediaType,
          expires_at: expiresAt.toISOString(),
        });
      }

      completeUpload();
      
      toast({
        title: scheduledAt ? 'Post scheduled!' : 'Post shared!',
        description: scheduledAt ? 'Your post will be published at the scheduled time' : 'Your post has been shared successfully',
      });

      onSuccess(post.id);
    } catch (error: any) {
      console.error('Error creating post:', error);
      failUpload(error.message || 'Failed to create post');
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
    <div className="flex flex-col h-full bg-background w-full">
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
          <Button variant="ghost" size="icon" onClick={onBack} className="h-9 w-9">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-lg font-semibold">{quotePost ? 'Quote Feeds' : 'New Post'}</h1>
          <Button 
            onClick={() => handlePost(!showScheduling)}
            disabled={loading}
            size="sm"
            className="h-9 px-4"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : (showScheduling ? 'Schedule' : 'Share')}
          </Button>
        </div>

        <ProgressBar progress={progress} isVisible={isUploading} />

        <div className="flex-1 overflow-y-auto">
          <div className="w-full max-w-md mx-auto px-4 py-4 space-y-4 pb-24">

            <div className="space-y-2">
              <Label className="text-base font-medium">{quotePost ? "Comment" : "Caption"}</Label>
              <Textarea 
                placeholder="Write a caption..." 
                value={caption} 
                onChange={(e) => setCaption(e.target.value)} 
                className="min-h-[100px] resize-none"
              />
            </div>

            {quotePost && (
              <div className="border rounded-lg p-3 bg-muted/30">
                <div className="flex items-center gap-2 mb-2">
                  <Avatar className="w-6 h-6">
                    <AvatarImage src={quotePost.user.avatar_url || undefined} />
                    <AvatarFallback className="text-xs">{quotePost.user.display_name?.[0] || '?'}</AvatarFallback>
                  </Avatar>
                  <span className="text-sm font-semibold">{quotePost.user.display_name || quotePost.user.username}</span>
                </div>
                {quotePost.content && <p className="text-sm mb-2 line-clamp-2">{quotePost.content}</p>}
                {quotePost.media_url && (
                  <div className="rounded overflow-hidden">
                    {quotePost.media_type === 'image' ? (
                      <img src={quotePost.media_url} alt="Quoted" className="w-full max-h-32 object-cover" />
                    ) : (
                      <video src={quotePost.media_url} className="w-full max-h-32 object-cover" />
                    )}
                  </div>
                )}
              </div>
            )}

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-base font-medium flex items-center gap-2">
                  <MapPin className="w-4 h-4" />
                  Location
                </Label>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={detectLocation} 
                  disabled={isDetectingLocation} 
                  className="h-8 px-3"
                >
                  {isDetectingLocation ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Detect'}
                </Button>
              </div>
              <Input 
                placeholder="Add location..." 
                value={location} 
                onChange={(e) => { 
                  setLocation(e.target.value); 
                  searchLocation(e.target.value); 
                }} 
                className="h-11"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-base font-medium flex items-center gap-2">
                <Globe className="w-4 h-4" />
                Privacy
              </Label>
              <Select value={privacy} onValueChange={(value: any) => setPrivacy(value)}>
                <SelectTrigger className="h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {privacyOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      <div className="flex items-center gap-2">
                        <option.icon className="w-4 h-4" />
                        {option.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {!quotePost && mediaType !== 'text' && (
              <div className="flex items-center justify-between py-3 border-y">
                <Label htmlFor="share-story" className="text-base font-medium cursor-pointer">
                  Share to Story
                </Label>
                <Switch id="share-story" checked={shareToStory} onCheckedChange={setShareToStory} />
              </div>
            )}

            <button 
              onClick={() => setShowScheduling(!showScheduling)} 
              className="w-full flex items-center justify-between p-3 rounded-lg border hover:bg-accent transition-colors"
            >
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5" />
                <span className="text-base font-medium">Schedule</span>
              </div>
              <ChevronRight className={`w-5 h-5 transition-transform ${showScheduling ? 'rotate-90' : ''}`} />
            </button>

            {showScheduling && (
              <div className="space-y-3 p-4 border rounded-lg bg-muted/30">
                <Input 
                  type="date" 
                  value={scheduleDate} 
                  onChange={(e) => setScheduleDate(e.target.value)} 
                  min={new Date().toISOString().split('T')[0]} 
                  className="h-11"
                />
                <div className="grid grid-cols-3 gap-2">
                  <Select value={scheduleHour} onValueChange={setScheduleHour}>
                    <SelectTrigger className="h-11">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 12 }, (_, i) => i + 1).map((h) => (
                        <SelectItem key={h} value={h.toString().padStart(2, '0')}>
                          {h.toString().padStart(2, '0')}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={scheduleMinute} onValueChange={setScheduleMinute}>
                    <SelectTrigger className="h-11">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {['00', '15', '30', '45'].map((m) => (
                        <SelectItem key={m} value={m}>{m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={schedulePeriod} onValueChange={(v: 'AM' | 'PM') => setSchedulePeriod(v)}>
                    <SelectTrigger className="h-11">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="AM">AM</SelectItem>
                      <SelectItem value="PM">PM</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            <button 
              onClick={() => setShowAdvanced(!showAdvanced)} 
              className="w-full flex items-center justify-between p-3 rounded-lg border hover:bg-accent transition-colors"
            >
              <span className="text-base font-medium">Advanced</span>
              <ChevronRight className={`w-5 h-5 transition-transform ${showAdvanced ? 'rotate-90' : ''}`} />
            </button>

            {showAdvanced && (
              <div className="space-y-3 p-4 border rounded-lg bg-muted/30">
                <div className="flex items-center justify-between">
                  <Label htmlFor="comments" className="text-base cursor-pointer">Allow Comments</Label>
                  <Switch id="comments" checked={allowComments} onCheckedChange={setAllowComments} />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="refeed" className="text-base cursor-pointer">Allow Refeed</Label>
                  <Switch id="refeed" checked={allowRefeed} onCheckedChange={setAllowRefeed} />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
