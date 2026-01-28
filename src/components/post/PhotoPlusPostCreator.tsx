import { useState, useRef, useCallback, useEffect } from 'react';
import { X, Image as ImageIcon, ChevronLeft, Hash } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';

interface PhotoPlusPostCreatorProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const MAX_IMAGES = 4;
const MAX_CHARS = 1000;

interface UserProfile {
  avatar_url: string | null;
  display_name: string | null;
  username: string | null;
}

export default function PhotoPlusPostCreator({ open, onClose, onSuccess }: PhotoPlusPostCreatorProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  
  const [text, setText] = useState('');
  const [hashtags, setHashtags] = useState('');
  const [images, setImages] = useState<{ file: File; preview: string }[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch user profile
  useEffect(() => {
    const fetchProfile = async () => {
      if (!user) return;
      const { data } = await supabase
        .from('profiles')
        .select('avatar_url, display_name, username')
        .eq('id', user.id)
        .single();
      if (data) setProfile(data);
    };
    fetchProfile();
  }, [user]);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (images.length + files.length > MAX_IMAGES) {
      toast({
        title: 'Maximum 4 images',
        description: 'You can only attach up to 4 images per post.',
        variant: 'destructive'
      });
      return;
    }

    files.forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImages(prev => [...prev, { file, preview: reader.result as string }].slice(0, MAX_IMAGES));
      };
      reader.readAsDataURL(file);
    });

    // Clear input so same file can be selected again if removed
    if (e.target) e.target.value = '';
  }, [images.length, toast]);

  const removeImage = useCallback((index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index));
  }, []);

  const handleSubmit = async () => {
    if (!text.trim() && images.length === 0) {
      toast({
        title: 'Empty post',
        description: 'Please add some text or an image.',
        variant: 'destructive'
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // Get fresh session to ensure auth is valid
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !sessionData.session?.user) {
        toast({
          title: 'Session expired',
          description: 'Please sign in again to create posts.',
          variant: 'destructive'
        });
        setIsSubmitting(false);
        return;
      }

      const authenticatedUserId = sessionData.session.user.id;

      // Upload images if any
      const mediaUrls: string[] = [];
      const mediaTypes: string[] = [];

      for (const img of images) {
        const fileName = `${authenticatedUserId}/${Date.now()}-${Math.random().toString(36).substring(7)}.jpg`;
        const { data, error } = await supabase.storage
          .from('post-media')
          .upload(fileName, img.file, { contentType: img.file.type });

        if (error) throw error;

        const { data: urlData } = supabase.storage.from('post-media').getPublicUrl(fileName);
        mediaUrls.push(urlData.publicUrl);
        mediaTypes.push('image');
      }

      // Combine text with hashtags
      const fullContent = hashtags.trim() 
        ? `${text.trim()}\n\n${hashtags.trim()}`
        : text.trim();

      // Determine media_type
      let mediaType: string = 'text_plain';
      if (images.length > 0) {
        mediaType = 'image';
      }

      // Create the post using authenticated user ID from session
      const { data: newPost, error: postError } = await supabase
        .from('posts')
        .insert({
          user_id: authenticatedUserId,
          content: fullContent || null,
          media_url: mediaUrls[0] || null,
          media_urls: mediaUrls.length > 0 ? mediaUrls : null,
          media_type: mediaType,
          media_types: mediaTypes.length > 0 ? mediaTypes : null,
        } as any)
        .select('id')
        .single();

      if (postError) throw postError;

      // Process hashtags
      if (hashtags.trim()) {
        try {
          await supabase.functions.invoke('process-hashtags', {
            body: { postId: newPost.id, content: fullContent }
          });
        } catch (hashtagError) {
          console.warn('Hashtag processing failed:', hashtagError);
        }
      }

      toast({
        title: 'Post created!',
        description: 'Your post has been shared.',
      });

      // Reset state
      setText('');
      setHashtags('');
      setImages([]);
      
      onSuccess?.();
      onClose();
      // Navigate directly to the created post for instant visibility
      navigate(`/feed/post/${newPost.id}`);
    } catch (error: any) {
      console.error('Post creation error:', error);
      toast({
        title: 'Failed to create post',
        description: error.message || 'Please try again.',
        variant: 'destructive'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const canPost = (text.trim().length > 0 || images.length > 0) && !isSubmitting;
  const charsRemaining = MAX_CHARS - text.length;

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: '100%' }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="fixed inset-0 z-[100] bg-background flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <button
            onClick={onClose}
            className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
            <span>Cancel</span>
          </button>
          
          <h2 className="font-semibold text-foreground">New Post</h2>
          
          <Button
            onClick={handleSubmit}
            disabled={!canPost}
            size="sm"
            className="bg-primary text-primary-foreground rounded-full px-5"
          >
            {isSubmitting ? 'Posting...' : 'Post'}
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="flex gap-4">
            {/* Avatar */}
            <Avatar className="w-10 h-10 flex-shrink-0">
              <AvatarImage src={profile?.avatar_url || ''} />
              <AvatarFallback className="bg-primary/10 text-primary">
                {profile?.display_name?.[0] || profile?.username?.[0] || 'U'}
              </AvatarFallback>
            </Avatar>

            {/* Input Area */}
            <div className="flex-1 space-y-4">
              <textarea
                autoFocus
                value={text}
                onChange={(e) => setText(e.target.value.slice(0, MAX_CHARS))}
                placeholder="What's on your mind?"
                className={cn(
                  "w-full bg-transparent text-foreground text-lg outline-none border-none resize-none min-h-[120px]",
                  "placeholder:text-muted-foreground"
                )}
              />

              {/* Character count */}
              {text.length > MAX_CHARS * 0.8 && (
                <div className={cn(
                  "text-sm",
                  charsRemaining < 50 ? 'text-destructive' : 'text-muted-foreground'
                )}>
                  {charsRemaining} characters remaining
                </div>
              )}

              {/* Image Previews - 2x2 grid for 3-4 images */}
              {images.length > 0 && (
                <div className={cn(
                  "grid gap-2",
                  images.length === 1 ? "grid-cols-1" : "grid-cols-2"
                )}>
                  {images.map((img, idx) => (
                    <div
                      key={idx}
                      className={cn(
                        "relative rounded-xl overflow-hidden border border-border",
                        images.length === 1 ? "aspect-video" : "aspect-square"
                      )}
                    >
                      <img
                        src={img.preview}
                        className="w-full h-full object-cover"
                        alt={`Preview ${idx + 1}`}
                      />
                      <button
                        onClick={() => removeImage(idx)}
                        className="absolute top-2 right-2 p-1.5 bg-black/60 rounded-full text-white hover:bg-black transition-colors"
                      >
                        <X size={16} />
                      </button>
                      <div className="absolute bottom-2 left-2 px-2 py-1 bg-black/60 rounded text-white text-xs">
                        {idx + 1} / {images.length}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Hashtags Input */}
              <div className="flex items-center gap-2 pt-4 border-t border-border">
                <Hash className="w-5 h-5 text-muted-foreground" />
                <input
                  type="text"
                  value={hashtags}
                  onChange={(e) => setHashtags(e.target.value)}
                  placeholder="Add hashtags (e.g., #trending #viral)"
                  className="flex-1 bg-transparent text-foreground outline-none placeholder:text-muted-foreground text-sm"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Footer - Image Picker */}
        <div className="p-4 border-t border-border flex items-center gap-4 safe-area-bottom">
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={images.length >= MAX_IMAGES}
            className={cn(
              "p-2 rounded-full transition-colors",
              images.length >= MAX_IMAGES
                ? "text-muted-foreground/30 cursor-not-allowed"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            )}
          >
            <ImageIcon size={24} />
          </button>
          
          {images.length >= MAX_IMAGES && (
            <span className="text-xs text-muted-foreground">
              Maximum {MAX_IMAGES} images reached
            </span>
          )}
          
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            hidden
            multiple
            accept="image/*"
          />
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
