import { useState } from 'react';
import { Globe, Users, UserCheck, Lock, Loader2, MapPin, Hash, X } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface PostDetailsProps {
  media: { url: string; type: 'image' | 'video'; file: File };
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
      // Upload media to storage
      const fileExt = media.file.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;
      const bucketName = media.type === 'image' ? 'post-images' : 'post-videos';

      const { error: uploadError, data: uploadData } = await supabase.storage
        .from(bucketName)
        .upload(fileName, media.file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from(bucketName)
        .getPublicUrl(fileName);

      // Create post
      const { error: postError } = await supabase
        .from('posts')
        .insert({
          user_id: user.id,
          feed_id: crypto.randomUUID(),
          content: caption,
          media_url: publicUrl,
          media_type: media.type,
          location: location || null,
          privacy,
          post_type: 'public',
          status: 'active',
        });

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

      <div className="w-full mb-4">
        {media.type === 'image' ? (
          <img src={media.url} className="w-full rounded-lg object-cover max-h-48" alt="Preview" />
        ) : (
          <video src={media.url} className="w-full rounded-lg max-h-48" controls />
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

      <div className="w-full mb-6">
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
