import { useState } from 'react';
import {
  X,
  Sparkles,
  ImagePlus,
  Globe,
  Users,
  UserCheck,
  Lock,
  Loader2,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { extractHashtags } from '@/lib/hashtag-utils';
import { useUploadProgress } from '@/hooks/useUploadProgress';
import { ProgressBar } from '@/components/shared/ProgressBar';

type Privacy = 'everyone' | 'friends' | 'followers' | 'only_me';

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
  const [hashtags, setHashtags] = useState('');
  const [location, setLocation] = useState('');
  const [privacy, setPrivacy] = useState<Privacy>('everyone');
  const [detectFaces, setDetectFaces] = useState(false);

  const privacyOptions = [
    { value: 'everyone', label: 'Everyone', icon: Globe },
    { value: 'friends', label: 'Friends', icon: Users },
    { value: 'followers', label: 'Followers', icon: UserCheck },
    { value: 'only_me', label: 'Only Me', icon: Lock },
  ];

  const parsedHashtags = hashtags
    .split(/[,\s]+/)
    .map((tag) => tag.replace(/^#/, '').trim())
    .filter((tag) => tag.length > 0);

  const handlePost = async () => {
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
        privacy: privacy,
        allow_comments: true,
        allow_refeed: true,
        scheduled_at: null,
        status: 'active' as const,
        original_post_id: quotePost?.id || null,
        post_type: quotePost ? 'quote' as const : 'public' as const,
      };

      const { data: post, error: postError } = await supabase
        .from('posts')
        .insert(postData)
        .select()
        .single();

      if (postError) throw postError;
      updateProgress(90);

      // Process hashtags from both caption and hashtags input
      const allHashtags = [
        ...extractHashtags(caption),
        ...parsedHashtags
      ];
      const uniqueHashtags = [...new Set(allHashtags)];
      
      for (const tag of uniqueHashtags) {
        const { data: hashtag, error: hashtagError } = await supabase
          .from('hashtags')
          .upsert({ name: tag.toLowerCase() }, { onConflict: 'name' })
          .select()
          .single();

        if (!hashtagError && hashtag) {
          await supabase
            .from('post_hashtags')
            .insert({ post_id: post.id, hashtag_id: hashtag.id });
        }
      }

      completeUpload();
      
      toast({
        title: 'Post shared!',
        description: 'Your post has been shared successfully',
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

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-background">
      <div className="w-full h-full max-w-md mx-auto flex flex-col p-4 overflow-y-auto">
        <ProgressBar progress={progress} isVisible={isUploading} />
      
        {/* Header */}
        <div className="w-full flex items-center justify-between mb-4 shrink-0">
          <h2 className="text-lg font-bold text-foreground">
            {quotePost ? 'Quote Feeds' : 'Post Details'}
          </h2>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Caption */}
        <textarea
          placeholder="Write a caption..."
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          className="w-full p-3 border border-border rounded-lg text-sm resize-none mb-3 focus:outline-none focus:ring-2 focus:ring-primary"
          rows={3}
        />

        {/* Hashtags */}
        <input
          type="text"
          placeholder="Add hashtags (e.g. #style #vibes)"
          value={hashtags}
          onChange={(e) => setHashtags(e.target.value)}
          className="w-full p-3 border border-border rounded-lg text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-primary"
        />
        {parsedHashtags.length > 0 && (
          <div className="w-full mb-3 flex flex-wrap gap-2">
            {parsedHashtags.map((tag) => (
              <span key={tag} className="px-2 py-1 text-xs rounded-full bg-muted text-foreground">
                #{tag}
              </span>
            ))}
          </div>
        )}

        {/* Location */}
        <input
          type="text"
          placeholder="Add location (optional)"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          className="w-full p-3 border border-border rounded-lg text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-primary"
        />

        {/* Privacy */}
        <div className="w-full mb-3">
          <label className="text-xs font-medium text-muted-foreground mb-2 block">Visibility</label>
          <div className="flex flex-wrap gap-2">
            {privacyOptions.map((opt) => {
              const IconComponent = opt.icon;
              return (
                <button
                  key={opt.value}
                  onClick={() => setPrivacy(opt.value as Privacy)}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-semibold transition ${
                    privacy === opt.value
                      ? 'bg-primary text-white'
                      : 'bg-muted text-foreground hover:bg-muted/80'
                  }`}
                >
                  <IconComponent className="w-3 h-3" />
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Detect Faces Toggle */}
        <button
          onClick={() => setDetectFaces(!detectFaces)}
          className={`w-full flex items-center justify-between p-2.5 rounded-lg border transition ${
            detectFaces ? 'border-primary bg-primary/10' : 'border-border hover:border-primary'
          } mb-3`}
        >
          <span className="text-sm font-medium text-foreground">Detect Faces</span>
          <Sparkles className="w-4 h-4 text-muted-foreground" />
        </button>

        {/* Add from Gallery */}
        <button
          onClick={() => console.log('Open gallery')}
          className="w-full flex items-center justify-between p-2.5 rounded-lg border border-border hover:border-primary transition mb-4"
        >
          <span className="text-sm font-medium text-foreground">Add from Gallery</span>
          <ImagePlus className="w-4 h-4 text-muted-foreground" />
        </button>

        {/* Post Button */}
        <button
          onClick={handlePost}
          disabled={loading}
          className="w-full py-3 rounded-full bg-primary text-white font-semibold text-sm hover:bg-primary/90 transition disabled:opacity-50 disabled:cursor-not-allowed mb-4"
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin mx-auto" />
          ) : (
            'Post'
          )}
        </button>

        {/* Safe area padding for mobile */}
        <div className="h-4" />
      </div>
    </div>
  );
}
