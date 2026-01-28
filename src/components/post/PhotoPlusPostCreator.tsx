import { useState, useRef, useCallback, useEffect } from 'react';
import { X, Plus, ChevronLeft, Hash, MapPin, Loader2 } from 'lucide-react';
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

const MAX_IMAGES = 2;
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
  const [location, setLocation] = useState('');
  const [locationSuggestions, setLocationSuggestions] = useState<string[]>([]);
  const [detectingLocation, setDetectingLocation] = useState(false);
  const fileInputRef1 = useRef<HTMLInputElement>(null);
  const fileInputRef2 = useRef<HTMLInputElement>(null);

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

  // Location detection
  const detectLocation = async () => {
    setDetectingLocation(true);
    try {
      if ('geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition(
          async (position) => {
            const { latitude, longitude } = position.coords;
            try {
              const response = await fetch(
                `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`
              );
              const data = await response.json();
              
              if (data.display_name) {
                const locationName = data.address?.city || data.address?.town || data.address?.village || data.display_name;
                setLocation(locationName);
              }
            } catch (error) {
              console.error('Geocoding error:', error);
            }
            setDetectingLocation(false);
          },
          (error) => {
            console.error('Location error:', error);
            toast({
              title: 'Location Error',
              description: 'Unable to detect your location. Please enter manually.',
              variant: 'destructive',
            });
            setDetectingLocation(false);
          }
        );
      } else {
        toast({
          title: 'Not Supported',
          description: 'Geolocation is not supported by your browser.',
          variant: 'destructive',
        });
        setDetectingLocation(false);
      }
    } catch (error) {
      console.error('Error detecting location:', error);
      setDetectingLocation(false);
    }
  };

  const fetchLocationSuggestions = async (query: string) => {
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
      console.error('Error fetching location suggestions:', error);
    }
  };

  const handleFileChange = useCallback((index: number) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      setImages(prev => {
        const newImages = [...prev];
        newImages[index] = { file, preview: reader.result as string };
        return newImages.filter(Boolean);
      });
    };
    reader.readAsDataURL(file);

    // Clear input so same file can be selected again if removed
    if (e.target) e.target.value = '';
  }, []);

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
          location: location || null,
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
      setLocation('');
      setLocationSuggestions([]);
      
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
                placeholder="Share your thoughts"
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

              {/* Image Picker Cards */}
              <div className="flex justify-center gap-3">
                {/* Card 1 */}
                <div
                  onClick={() => fileInputRef1.current?.click()}
                  className={cn(
                    "relative w-[calc(37.5%-6px)] aspect-square rounded-xl border-2 border-dashed border-border",
                    "flex items-center justify-center cursor-pointer",
                    "hover:border-primary/50 hover:bg-accent/50 transition-all",
                    images[0] && "border-solid border-primary/30"
                  )}
                >
                  {images[0] ? (
                    <>
                      <img
                        src={images[0].preview}
                        className="w-full h-full object-cover rounded-xl"
                        alt="Preview 1"
                      />
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removeImage(0);
                        }}
                        className="absolute top-2 right-2 p-1.5 bg-black/60 rounded-full text-white hover:bg-black transition-colors"
                      >
                        <X size={14} />
                      </button>
                    </>
                  ) : (
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <div className="w-10 h-10 rounded-full bg-accent flex items-center justify-center">
                        <Plus className="w-5 h-5" />
                      </div>
                      <span className="text-xs">Add Photo</span>
                    </div>
                  )}
                </div>

                {/* Card 2 */}
                <div
                  onClick={() => fileInputRef2.current?.click()}
                  className={cn(
                    "relative w-[calc(37.5%-6px)] aspect-square rounded-xl border-2 border-dashed border-border",
                    "flex items-center justify-center cursor-pointer",
                    "hover:border-primary/50 hover:bg-accent/50 transition-all",
                    images[1] && "border-solid border-primary/30"
                  )}
                >
                  {images[1] ? (
                    <>
                      <img
                        src={images[1].preview}
                        className="w-full h-full object-cover rounded-xl"
                        alt="Preview 2"
                      />
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removeImage(1);
                        }}
                        className="absolute top-2 right-2 p-1.5 bg-black/60 rounded-full text-white hover:bg-black transition-colors"
                      >
                        <X size={14} />
                      </button>
                    </>
                  ) : (
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <div className="w-10 h-10 rounded-full bg-accent flex items-center justify-center">
                        <Plus className="w-5 h-5" />
                      </div>
                      <span className="text-xs">Add Photo</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Hidden file inputs */}
              <input
                type="file"
                ref={fileInputRef1}
                onChange={handleFileChange(0)}
                hidden
                accept="image/*"
              />
              <input
                type="file"
                ref={fileInputRef2}
                onChange={handleFileChange(1)}
                hidden
                accept="image/*"
              />

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

              {/* Location Input */}
              <div className="pt-4 border-t border-border">
                <div className="flex items-center gap-2 mb-2">
                  <MapPin className="w-5 h-5 text-muted-foreground" />
                  <span className="text-sm font-medium text-muted-foreground">Location</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={detectLocation}
                    disabled={detectingLocation}
                    className="ml-auto text-xs h-7 px-2"
                  >
                    {detectingLocation ? (
                      <>
                        <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                        Detecting...
                      </>
                    ) : (
                      'Auto-detect'
                    )}
                  </Button>
                </div>
                <div className="relative">
                  <input
                    type="text"
                    value={location}
                    onChange={(e) => {
                      setLocation(e.target.value);
                      fetchLocationSuggestions(e.target.value);
                    }}
                    placeholder="Add location..."
                    className="w-full bg-transparent text-foreground outline-none placeholder:text-muted-foreground text-sm py-2"
                  />
                  {locationSuggestions.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-background border border-border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                      {locationSuggestions.map((suggestion, index) => (
                        <button
                          key={index}
                          type="button"
                          onClick={() => {
                            setLocation(suggestion);
                            setLocationSuggestions([]);
                          }}
                          className="w-full px-3 py-2 text-left text-sm hover:bg-accent transition-colors"
                        >
                          {suggestion}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {location && (
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-xs text-primary bg-primary/10 px-2 py-1 rounded-full flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {location.length > 40 ? location.slice(0, 40) + '...' : location}
                      <button
                        onClick={() => setLocation('')}
                        className="ml-1 hover:text-destructive"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Footer - simplified without gallery button */}
        <div className="p-4 border-t border-border safe-area-bottom">
          <p className="text-xs text-muted-foreground text-center">
            Tap the cards above to add up to 2 photos
          </p>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}