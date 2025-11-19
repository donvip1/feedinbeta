import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { X, Globe, Users, UserCheck, Lock, Loader2, Heart, MessageCircle, Eye } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { extractHashtags } from '@/lib/hashtag-utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

interface QuotePostComposerProps {
  quotePost: {
    id: string;
    content: string | null;
    media_url: string | null;
    media_type: string | null;
    user_id: string;
    likes_count: number;
    comments_count: number;
    views_count: number;
    profiles: {
      display_name: string | null;
      username: string | null;
      avatar_url: string | null;
    };
  };
  onClose: () => void;
  onSuccess: () => void;
}

export function QuotePostComposer({ quotePost, onClose, onSuccess }: QuotePostComposerProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [comment, setComment] = useState('');
  const [privacy, setPrivacy] = useState<'everyone' | 'friends' | 'followers' | 'only_me'>('everyone');

  const privacyOptions = [
    { value: 'everyone', label: 'Everyone', icon: Globe },
    { value: 'friends', label: 'Friends', icon: Users },
    { value: 'followers', label: 'Followers', icon: UserCheck },
    { value: 'only_me', label: 'Only Me', icon: Lock },
  ];

  const handlePost = async () => {
    if (!user) return;

    try {
      setLoading(true);

      // Create the quote post
      const { data: newPost, error: postError } = await supabase
        .from('posts')
        .insert({
          user_id: user.id,
          feed_id: crypto.randomUUID(),
          content: comment,
          original_post_id: quotePost.id,
          privacy,
          post_type: 'public',
          allow_comments: true,
          allow_refeed: true,
          status: 'active'
        })
        .select()
        .single();

      if (postError) throw postError;

      // Extract and save hashtags
      if (comment) {
        const hashtags = extractHashtags(comment);
        if (hashtags.length > 0) {
          const hashtagPromises = hashtags.map(async (tag) => {
            const { data: existingHashtag } = await supabase
              .from('hashtags')
              .select('id')
              .eq('name', tag)
              .single();

            let hashtagId = existingHashtag?.id;

            if (!hashtagId) {
              const { data: newHashtag } = await supabase
                .from('hashtags')
                .insert({ name: tag })
                .select('id')
                .single();
              hashtagId = newHashtag?.id;
            }

            if (hashtagId) {
              await supabase
                .from('post_hashtags')
                .insert({ post_id: newPost.id, hashtag_id: hashtagId });
            }
          });

          await Promise.all(hashtagPromises);
        }
      }

      // Increment refeed count on original post
      const { data: originalPost } = await supabase
        .from('posts')
        .select('refeeds_count')
        .eq('id', quotePost.id)
        .single();

      if (originalPost) {
        await supabase
          .from('posts')
          .update({ refeeds_count: (originalPost.refeeds_count || 0) + 1 })
          .eq('id', quotePost.id);
      }

      // Create notification for original poster
      if (quotePost.user_id !== user.id) {
        await supabase.from('notifications').insert({
          user_id: quotePost.user_id,
          from_user_id: user.id,
          type: 'quote',
          title: 'Your post was quoted',
          message: `${user.user_metadata?.display_name || 'Someone'} quoted your post`,
          related_id: newPost.id,
          related_type: 'post'
        });
      }

      toast({ title: 'Post quoted successfully!' });
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error creating quote post:', error);
      toast({
        title: 'Error',
        description: 'Failed to create quote post',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const SelectedPrivacyIcon = privacyOptions.find(opt => opt.value === privacy)?.icon || Globe;

  return (
    <div className="fixed inset-0 z-[100] bg-background animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <Button variant="ghost" size="icon" onClick={onClose} disabled={loading}>
          <X className="w-5 h-5" />
        </Button>
        <h2 className="text-lg font-semibold">Quote Post</h2>
        <Button 
          onClick={handlePost} 
          disabled={loading || !comment.trim()}
          className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-full px-6 font-semibold"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Post'}
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 max-w-2xl mx-auto space-y-4">
        {/* Privacy Selector */}
        <Select value={privacy} onValueChange={(value: any) => setPrivacy(value)}>
          <SelectTrigger className="w-[160px] border-primary/30 hover:border-primary/50 transition-colors rounded-full">
            <div className="flex items-center gap-2">
              <SelectedPrivacyIcon className="w-4 h-4 text-primary" />
              <SelectValue />
            </div>
          </SelectTrigger>
          <SelectContent>
            {privacyOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                <div className="flex items-center gap-2">
                  <option.icon className="w-4 h-4" />
                  <span>{option.label}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Comment Text Area */}
        <Textarea
          placeholder="Add your thoughts..."
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          className="min-h-[120px] border-0 focus-visible:ring-0 resize-none text-lg placeholder:text-muted-foreground/50"
          autoFocus
        />

        {/* Quoted Post Card */}
        <div className="border border-border rounded-2xl p-4 bg-muted/30">
          {/* Original Poster Info */}
          <div className="flex items-center gap-3 mb-3">
            <Avatar className="w-10 h-10">
              <AvatarImage src={quotePost.profiles.avatar_url || ''} />
              <AvatarFallback className="text-sm font-semibold">
                {quotePost.profiles.display_name?.[0] || quotePost.profiles.username?.[0] || '?'}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-foreground">
                {quotePost.profiles.display_name || quotePost.profiles.username || 'Unknown'}
              </span>
              <span className="text-xs text-muted-foreground">
                @{quotePost.profiles.username || 'unknown'}
              </span>
            </div>
          </div>
          
          {/* Original Post Content */}
          {quotePost.content && (
            <p className="text-sm text-foreground mb-3 whitespace-pre-wrap">
              {quotePost.content}
            </p>
          )}
          
          {/* Original Post Media */}
          {quotePost.media_url && (
            <div className="rounded-xl overflow-hidden mb-3">
              {quotePost.media_type === 'image' ? (
                <img 
                  src={quotePost.media_url} 
                  alt="Quoted post" 
                  className="w-full max-h-80 object-cover"
                />
              ) : quotePost.media_type === 'video' ? (
                <video 
                  src={quotePost.media_url} 
                  className="w-full max-h-80 object-cover"
                  controls={false}
                />
              ) : null}
            </div>
          )}
          
          {/* Engagement Metrics */}
          <div className="flex items-center gap-6 text-sm text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <Heart className="w-4 h-4" />
              <span>{quotePost.likes_count > 999 ? `${(quotePost.likes_count / 1000).toFixed(1)}K` : quotePost.likes_count}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <MessageCircle className="w-4 h-4" />
              <span>{quotePost.comments_count > 999 ? `${(quotePost.comments_count / 1000).toFixed(1)}K` : quotePost.comments_count}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Eye className="w-4 h-4" />
              <span>{quotePost.views_count > 999 ? `${(quotePost.views_count / 1000).toFixed(1)}K` : quotePost.views_count}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
