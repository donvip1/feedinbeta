import { useState } from 'react';
import { X, ImagePlus, Sparkles, Loader2 } from 'lucide-react';
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
  const [detectFaces, setDetectFaces] = useState(false);

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
        location: null,
        privacy: 'everyone' as const,
        allow_comments: true,
        allow_refeed: true,
        scheduled_at: null,
        status: 'published' as const,
        original_post_id: quotePost?.id || null,
        post_type: quotePost ? 'quote' as const : 'original' as const,
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
    <div className="fixed inset-0 z-[100] bg-background flex flex-col items-start justify-start p-4 overflow-y-auto max-w-sm mx-auto">
      <ProgressBar progress={progress} isVisible={isUploading} />
      
      {/* Header */}
      <div className="w-full flex items-center justify-between mb-4">
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

      {/* Caption Input */}
      <textarea
        placeholder="Write a caption..."
        value={caption}
        onChange={(e) => setCaption(e.target.value)}
        className="w-full p-3 border border-border rounded-lg text-sm resize-none mb-4 focus:outline-none focus:ring-2 focus:ring-primary"
        rows={4}
      />

      {/* Post Options */}
      <div className="w-full space-y-3">
        {/* Detect Faces Toggle */}
        <button
          onClick={() => setDetectFaces(!detectFaces)}
          className={`w-full flex items-center justify-between p-3 rounded-lg border ${
            detectFaces ? 'border-primary bg-primary/10' : 'border-border'
          } transition`}
        >
          <span className="text-sm font-medium text-foreground">Detect Faces</span>
          <Sparkles className="w-5 h-5 text-muted-foreground" />
        </button>

        {/* Add from Gallery */}
        <button
          onClick={() => console.log('Open gallery')}
          className="w-full flex items-center justify-between p-3 rounded-lg border border-border hover:border-primary transition"
        >
          <span className="text-sm font-medium text-foreground">Add from Gallery</span>
          <ImagePlus className="w-5 h-5 text-muted-foreground" />
        </button>
      </div>

      {/* Post Button */}
      <button
        onClick={handlePost}
        disabled={loading}
        className="mt-6 w-full py-3 rounded-full bg-primary text-white font-semibold text-sm hover:bg-primary/90 transition disabled:opacity-50"
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Post'}
      </button>

      {/* Safe area padding for mobile */}
      <div className="h-6" />
    </div>
  );
}
