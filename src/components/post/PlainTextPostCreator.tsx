import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Hash, MapPin, Globe, Users, UserCheck, Lock } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

type Privacy = 'everyone' | 'friends' | 'followers' | 'only_me';

interface PlainTextPostCreatorProps {
  onClose: () => void;
  onSubmit: () => void;
}

export default function PlainTextPostCreator({ onClose, onSubmit }: PlainTextPostCreatorProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [text, setText] = useState('');
  const [hashtags, setHashtags] = useState('');
  const [location, setLocation] = useState('');
  const [privacy, setPrivacy] = useState<Privacy>('everyone');
  const [isPosting, setIsPosting] = useState(false);

  const parsedHashtags = hashtags
    .split(/[,\s]+/)
    .map((tag) => tag.replace(/^#/, '').trim())
    .filter((tag) => tag.length > 0);

  const privacyOptions = [
    { value: 'everyone', label: 'Everyone', icon: Globe },
    { value: 'friends', label: 'Friends', icon: Users },
    { value: 'followers', label: 'Followers', icon: UserCheck },
    { value: 'only_me', label: 'Only Me', icon: Lock },
  ];

  const handlePost = async () => {
    if (!user) {
      toast({
        title: 'Not authenticated',
        description: 'Please sign in to post',
        variant: 'destructive',
      });
      return;
    }

    if (!text.trim()) {
      toast({
        title: 'Empty post',
        description: 'Please write something first',
        variant: 'destructive',
      });
      return;
    }

    setIsPosting(true);

    try {
      // Build full content with hashtags appended
      const hashtagString = parsedHashtags.length > 0 
        ? `\n\n${parsedHashtags.map(tag => `#${tag}`).join(' ')}`
        : '';
      const fullContent = text + hashtagString;

      const { data: newPost, error } = await supabase.from('posts').insert({
        user_id: user.id,
        feed_id: crypto.randomUUID(),
        content: fullContent,
        post_type: 'public',
        privacy: privacy,
        location: location || null,
        status: 'active',
        media_url: null,
        media_type: 'text_plain',
      }).select('id').single();

      if (error) throw error;

      // Process hashtags for trending/search
      if (parsedHashtags.length > 0 && newPost?.id) {
        supabase.functions.invoke('process-hashtags', {
          body: { postId: newPost.id, content: fullContent }
        }).catch(err => console.error('Error processing hashtags:', err));
      }

      toast({
        title: 'Posted!',
        description: 'Your post has been shared',
      });

      onSubmit();
      
      // Navigate to the new post
      if (newPost?.id) {
        navigate(`/feed/post/${newPost.id}`);
      }
    } catch (error) {
      console.error('Error posting:', error);
      toast({
        title: 'Error',
        description: 'Failed to create post',
        variant: 'destructive',
      });
    } finally {
      setIsPosting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-background flex flex-col p-4 overflow-y-auto max-w-sm mx-auto">
      {/* Header */}
      <div className="w-full flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold text-foreground">What's on your mind?</h2>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Text Input */}
      <div className="flex-1 mb-4">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Share your thoughts..."
          maxLength={1000}
          className="w-full h-48 p-4 border border-input bg-background rounded-xl text-foreground text-base resize-none outline-none focus:border-primary focus:ring-1 focus:ring-primary placeholder:text-muted-foreground"
          autoFocus
        />
        <div className="text-xs text-muted-foreground text-right mt-1">
          {text.length}/1000
        </div>
      </div>

      {/* Hashtags */}
      <label className="flex items-center gap-2 text-xs font-medium text-muted-foreground mb-2">
        <Hash className="w-4 h-4" />
        Hashtags
      </label>
      <input
        type="text"
        placeholder="e.g. thoughts, inspiration"
        value={hashtags}
        onChange={(e) => setHashtags(e.target.value)}
        className="w-full p-3 border border-input bg-background rounded-lg text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary mb-2"
      />
      {parsedHashtags.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {parsedHashtags.map((h) => (
            <span key={h} className="rounded-full bg-muted px-3 py-1 text-xs font-medium">
              #{h}
            </span>
          ))}
        </div>
      )}

      {/* Location */}
      <label className="flex items-center gap-2 text-xs font-medium text-muted-foreground mb-2 mt-2">
        <MapPin className="w-4 h-4" />
        Location (optional)
      </label>
      <input
        type="text"
        placeholder="Add a location"
        value={location}
        onChange={(e) => setLocation(e.target.value)}
        className="w-full p-3 border border-input bg-background rounded-lg text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary mb-4"
      />

      {/* Privacy */}
      <label className="text-xs font-medium text-muted-foreground mb-2">Privacy</label>
      <div className="flex flex-wrap gap-2 mb-6">
        {privacyOptions.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setPrivacy(opt.value as Privacy)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition ${
              privacy === opt.value ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3">
        <button
          onClick={onClose}
          className="flex-1 py-3 rounded-full bg-muted text-foreground font-semibold text-sm"
        >
          Cancel
        </button>
        <button
          onClick={handlePost}
          disabled={!text.trim() || isPosting}
          className="flex-1 py-3 rounded-full bg-primary text-primary-foreground font-semibold text-sm disabled:opacity-50"
        >
          {isPosting ? 'Posting...' : 'Post'}
        </button>
      </div>

      <div className="h-6" />
    </div>
  );
}
