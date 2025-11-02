import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MapPin, Hash, AtSign, Globe, Users, UserCheck, Lock, Clock, Loader2, ArrowLeft } from 'lucide-react';
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
  effects: any;
  onSuccess: () => void;
}

export function PostDetailsModal({ open, onClose, onBack, mediaUrl, mediaType, effects, onSuccess }: PostDetailsModalProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [privacy, setPrivacy] = useState<'everyone' | 'friends' | 'followers' | 'only_me'>('everyone');
  const [allowComments, setAllowComments] = useState(true);
  const [allowRefeed, setAllowRefeed] = useState(true);
  const [scheduleTime, setScheduleTime] = useState<string>('');

  const handlePost = async (action: 'post' | 'draft' | 'schedule') => {
    if (!user) return;

    setLoading(true);
    try {
      const postData = {
        user_id: user.id,
        content: description.trim() || null,
        media_url: mediaUrl || null,
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
                <div className="relative mt-2">
                  <MapPin className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="location"
                    placeholder="Add location"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    className="pl-10"
                  />
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
