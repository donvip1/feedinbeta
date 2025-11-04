import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MapPin, Hash, AtSign, Globe, Users, UserCheck, Lock, Clock, Loader2, ArrowLeft, Navigation } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { extractHashtags } from '@/lib/hashtag-utils';

interface PostDetailsModalProps {
  open: boolean;
  onClose: () => void;
  onBack?: () => void;
  mediaUrl: string;
  mediaType: 'text' | 'image' | 'video';
  effects: any; // Contains processedBlob for images
  onSuccess: () => void;
  mediaFile?: File | null; // Original media file for fallback
}

export function PostDetailsModal({ open, onClose, onBack, mediaUrl, mediaType, effects, onSuccess, mediaFile }: PostDetailsModalProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [privacy, setPrivacy] = useState<'everyone' | 'friends' | 'followers' | 'only_me'>('everyone');
  const [allowComments, setAllowComments] = useState(true);
  const [allowRefeed, setAllowRefeed] = useState(true);
  const [scheduleTime, setScheduleTime] = useState<string>('');
  const [locationOpen, setLocationOpen] = useState(false);
  const [gettingLocation, setGettingLocation] = useState(false);

  const POPULAR_LOCATIONS = [
    'New York, USA', 'London, UK', 'Paris, France', 'Tokyo, Japan', 'Dubai, UAE',
    'Los Angeles, USA', 'Sydney, Australia', 'Berlin, Germany', 'Singapore',
    'Toronto, Canada', 'Mumbai, India', 'Barcelona, Spain', 'Amsterdam, Netherlands',
    'Hong Kong', 'Istanbul, Turkey', 'Bangkok, Thailand', 'Rome, Italy', 'Seoul, South Korea'
  ];

  const filteredLocations = location
    ? POPULAR_LOCATIONS.filter(loc => loc.toLowerCase().includes(location.toLowerCase()))
    : POPULAR_LOCATIONS;

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('#location') && !target.closest('.location-suggestions')) {
        setLocationOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getCurrentLocation = () => {
    setGettingLocation(true);
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          try {
            const response = await fetch(
              `https://nominatim.openstreetmap.org/reverse?lat=${position.coords.latitude}&lon=${position.coords.longitude}&format=json`
            );
            const data = await response.json();
            const locationStr = data.address.city || data.address.town || data.address.village;
            const country = data.address.country;
            setLocation(`${locationStr}, ${country}`);
            toast({ title: 'Location detected', description: `${locationStr}, ${country}` });
          } catch (error) {
            toast({ title: 'Error', description: 'Could not fetch location name', variant: 'destructive' });
          } finally {
            setGettingLocation(false);
          }
        },
        (error) => {
          toast({ title: 'Error', description: 'Could not get your location', variant: 'destructive' });
          setGettingLocation(false);
        }
      );
    } else {
      toast({ title: 'Error', description: 'Geolocation not supported', variant: 'destructive' });
      setGettingLocation(false);
    }
  };

  const handlePost = async (action: 'post' | 'draft' | 'schedule') => {
    if (!user) return;

    setLoading(true);
    try {
      let finalMediaUrl = mediaUrl;

      // Upload processed media if we have a blob from effects
      if (mediaType !== 'text' && effects?.processedBlob) {
        const fileExt = mediaType === 'image' ? 'jpg' : 'mp4';
        const fileName = `${user.id}/${Date.now()}.${fileExt}`;
        const bucketName = mediaType === 'image' ? 'post-images' : 'posts';

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from(bucketName)
          .upload(fileName, effects.processedBlob, {
            contentType: mediaType === 'image' ? 'image/jpeg' : 'video/mp4',
            upsert: false,
          });

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from(bucketName)
          .getPublicUrl(uploadData.path);

        finalMediaUrl = publicUrl;
      } else if (mediaType !== 'text' && mediaFile) {
        // Fallback: upload original file if no processed blob
        const fileExt = mediaFile.name.split('.').pop();
        const fileName = `${user.id}/${Date.now()}.${fileExt}`;
        const bucketName = mediaType === 'image' ? 'post-images' : 'posts';

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from(bucketName)
          .upload(fileName, mediaFile, {
            contentType: mediaFile.type,
            upsert: false,
          });

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from(bucketName)
          .getPublicUrl(uploadData.path);

        finalMediaUrl = publicUrl;
      }

      const postData = {
        user_id: user.id,
        content: description.trim() || null,
        media_url: finalMediaUrl || null,
        media_type: mediaType,
        location: location || null,
        privacy,
        allow_comments: allowComments,
        allow_refeed: allowRefeed,
        status: action === 'draft' ? 'draft' : 'active',
        scheduled_at: action === 'schedule' && scheduleTime ? new Date(scheduleTime).toISOString() : null,
        feed_id: '',
      };

      const { data: postResult, error } = await supabase
        .from('posts')
        .insert(postData)
        .select()
        .single();

      if (error) throw error;

      // Process hashtags
      if (description && extractHashtags(description).length > 0) {
        try {
          await supabase.functions.invoke('process-hashtags', {
            body: { postId: postResult.id, content: description },
          });
        } catch (err) {
          console.error('Hashtag processing error:', err);
        }
      }

      toast({
        title: action === 'draft' ? 'Draft saved!' : action === 'schedule' ? 'Post scheduled!' : 'Post created!',
        description: action === 'draft' 
          ? 'Your post has been saved as a draft' 
          : action === 'schedule'
          ? `Your post will be published ${scheduleTime}`
          : 'Your post is now live on your feed',
      });

      onSuccess();
      onClose();
    } catch (error: any) {
      toast({
        title: 'Error creating post',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSchedule = () => {
    const now = new Date();
    const scheduleDate = new Date(scheduleTime);
    
    if (scheduleDate <= now) {
      toast({
        title: 'Invalid schedule time',
        description: 'Please select a future time',
        variant: 'destructive',
      });
      return;
    }

    handlePost('schedule');
  };

  const getQuickScheduleTime = (minutes: number) => {
    const time = new Date(Date.now() + minutes * 60000);
    return time.toISOString().slice(0, 16);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="fixed left-1/2 top-2 bottom-16 -translate-x-1/2 translate-y-0 max-w-2xl w-[95vw] p-0 z-[55] overflow-hidden flex flex-col">
        <div className="flex flex-col flex-1 min-h-0">
          <DialogHeader className="px-6 py-4 border-b sticky top-0 bg-background z-10 shrink-0">
            <div className="flex items-center justify-between">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={onBack ?? onClose} 
                className="h-8 w-8 p-0"
                aria-label="Back"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <DialogTitle>Post Details</DialogTitle>
              <div className="w-8" />
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-6 min-h-0">
            <div className="space-y-6 py-6 pb-6">
              {/* Media Preview */}
              {mediaUrl && (
                <div className="rounded-lg overflow-hidden border">
                  {mediaType === 'image' ? (
                    <img src={mediaUrl} alt="Post" className="w-full max-h-60 object-cover" />
                  ) : mediaType === 'video' ? (
                    <video src={mediaUrl} className="w-full max-h-60" controls />
                  ) : null}
                </div>
              )}

              {/* Description */}
              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  placeholder="What's on your mind? Use #hashtags and @mentions"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                  className="mt-2"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Use # for hashtags and @ to mention friends
                </p>
              </div>

              {/* Location */}
              <div>
                <Label htmlFor="location">Location</Label>
                <div className="flex gap-2 mt-2">
                  <div className="relative flex-1">
                    <MapPin className="absolute left-3 top-3 w-4 h-4 text-muted-foreground z-10" />
                    <Input
                      id="location"
                      placeholder="Enter or select location"
                      value={location}
                      onChange={(e) => {
                        setLocation(e.target.value);
                        if (e.target.value) setLocationOpen(true);
                      }}
                      onFocus={() => setLocationOpen(true)}
                      className="pl-10"
                    />
                    {locationOpen && filteredLocations.length > 0 && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-popover border rounded-md shadow-md max-h-48 overflow-y-auto z-50">
                        {filteredLocations.map((loc) => (
                          <button
                            key={loc}
                            type="button"
                            className="w-full px-3 py-2 text-left hover:bg-accent flex items-center gap-2 text-sm"
                            onClick={() => {
                              setLocation(loc);
                              setLocationOpen(false);
                            }}
                          >
                            <MapPin className="w-4 h-4 text-muted-foreground" />
                            {loc}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={getCurrentLocation}
                    disabled={gettingLocation}
                  >
                    {gettingLocation ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Navigation className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>

              {/* Privacy */}
              <div>
                <Label>Who can view this post?</Label>
                <Select value={privacy} onValueChange={(v: any) => setPrivacy(v)}>
                  <SelectTrigger className="mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="everyone">
                      <div className="flex items-center">
                        <Globe className="w-4 h-4 mr-2" />
                        Everyone
                      </div>
                    </SelectItem>
                    <SelectItem value="friends">
                      <div className="flex items-center">
                        <Users className="w-4 h-4 mr-2" />
                        Friends Only
                      </div>
                    </SelectItem>
                    <SelectItem value="followers">
                      <div className="flex items-center">
                        <UserCheck className="w-4 h-4 mr-2" />
                        Followers
                      </div>
                    </SelectItem>
                    <SelectItem value="only_me">
                      <div className="flex items-center">
                        <Lock className="w-4 h-4 mr-2" />
                        Only Me
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Settings */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label htmlFor="comments">Allow Comments</Label>
                  <Switch
                    id="comments"
                    checked={allowComments}
                    onCheckedChange={setAllowComments}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label htmlFor="refeed">Allow Refeed (Repost)</Label>
                  <Switch
                    id="refeed"
                    checked={allowRefeed}
                    onCheckedChange={setAllowRefeed}
                  />
                </div>
              </div>

              {/* Schedule Options */}
              <div className="space-y-3">
                <Label>Quick Schedule</Label>
                <div className="grid grid-cols-3 gap-2">
                  <Button variant="outline" size="sm" onClick={() => setScheduleTime(getQuickScheduleTime(10))}>
                    10 min
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setScheduleTime(getQuickScheduleTime(60))}>
                    1 hour
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setScheduleTime(getQuickScheduleTime(360))}>
                    6 hours
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setScheduleTime(getQuickScheduleTime(720))}>
                    12 hours
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setScheduleTime(getQuickScheduleTime(1440))}>
                    24 hours
                  </Button>
                </div>
                
                <div className="mt-3">
                  <Label htmlFor="custom-schedule">Custom Schedule</Label>
                  <Input
                    id="custom-schedule"
                    type="datetime-local"
                    value={scheduleTime}
                    onChange={(e) => setScheduleTime(e.target.value)}
                    className="mt-2"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="sticky bottom-0 px-6 py-4 border-t bg-background flex gap-2 shrink-0">
          <Button variant="outline" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button
            variant="outline"
            onClick={() => handlePost('draft')}
            disabled={loading}
            className="flex-1"
          >
            Save Draft
          </Button>
          {scheduleTime && (
            <Button
              onClick={handleSchedule}
              disabled={loading}
              className="flex-1 bg-blue-600 hover:bg-blue-700"
            >
              <Clock className="w-4 h-4 mr-2" />
              Schedule
            </Button>
          )}
          <Button
            onClick={() => handlePost('post')}
            disabled={loading}
            className="flex-1 bg-gradient-primary"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Post Now'}
          </Button>
        </div>
      </div>
    </DialogContent>
    </Dialog>
  );
}
