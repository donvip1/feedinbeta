import { useState, useRef } from 'react';
import { Globe, Users, UserCheck, Lock, Loader2, MapPin, Hash, X, Calendar, Clock, CheckCircle2, Music, Play, Pause, Disc3 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { MusicPicker } from './MusicPicker';
import { MusicUploader } from './MusicUploader';

interface SelectedMusic {
  id: string;
  title: string;
  artist: string | null;
  audio_url: string;
  duration_seconds: number | null;
}

interface PostDetailsProps {
  media: { url: string; type: 'image' | 'video'; file: File }[];
  onSubmit: () => void;
  onClose: () => void;
}

export default function PostDetails({ media, onSubmit, onClose }: PostDetailsProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [caption, setCaption] = useState('');
  const [hashtagsInput, setHashtagsInput] = useState('');
  const [location, setLocation] = useState('');
  const [privacy, setPrivacy] = useState<'everyone' | 'friends' | 'followers' | 'only_me'>('everyone');
  const [loading, setLoading] = useState(false);
  const [showSchedule, setShowSchedule] = useState(false);
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  const [currentPreviewIndex, setCurrentPreviewIndex] = useState(0);
  const [locationSuggestions, setLocationSuggestions] = useState<string[]>([]);
  const [detectingLocation, setDetectingLocation] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStage, setUploadStage] = useState<'idle' | 'uploading' | 'creating' | 'done'>('idle');
  
  // Music state
  const [selectedMusic, setSelectedMusic] = useState<SelectedMusic | null>(null);
  const [showMusicPicker, setShowMusicPicker] = useState(false);
  const [showMusicUploader, setShowMusicUploader] = useState(false);
  const [isMusicPlaying, setIsMusicPlaying] = useState(false);
  const musicAudioRef = useRef<HTMLAudioElement | null>(null);

  const toggleMusicPreview = () => {
    if (!selectedMusic || !musicAudioRef.current) return;
    
    if (isMusicPlaying) {
      musicAudioRef.current.pause();
      setIsMusicPlaying(false);
    } else {
      musicAudioRef.current.play().catch(console.error);
      setIsMusicPlaying(true);
    }
  };

  const handleMusicSelect = (track: SelectedMusic) => {
    // Stop any playing preview
    if (musicAudioRef.current) {
      musicAudioRef.current.pause();
      setIsMusicPlaying(false);
    }
    setSelectedMusic(track);
    setShowMusicPicker(false);
  };

  const handleMusicUploadComplete = (track: {
    id: string;
    title: string;
    artist: string | null;
    audio_url: string;
    duration_seconds: number;
  }) => {
    setSelectedMusic({
      ...track,
      duration_seconds: track.duration_seconds,
    });
    setShowMusicUploader(false);
  };

  const removeMusic = () => {
    if (musicAudioRef.current) {
      musicAudioRef.current.pause();
    }
    setSelectedMusic(null);
    setIsMusicPlaying(false);
  };

  const privacyOptions = [
    { value: 'everyone' as const, label: 'Everyone', icon: Globe },
    { value: 'friends' as const, label: 'Friends', icon: Users },
    { value: 'followers' as const, label: 'Followers', icon: UserCheck },
    { value: 'only_me' as const, label: 'Only Me', icon: Lock },
  ];

  const detectLocation = async () => {
    setDetectingLocation(true);
    try {
      if ('geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition(
          async (position) => {
            const { latitude, longitude } = position.coords;
            // Use reverse geocoding API (here using OpenStreetMap Nominatim)
            const response = await fetch(
              `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`
            );
            const data = await response.json();
            
            if (data.display_name) {
              const locationName = data.address?.city || data.address?.town || data.address?.village || data.display_name;
              setLocation(locationName);
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

  const handleSubmit = async () => {
    if (!user) return;
    
    setLoading(true);
    setUploadStage('uploading');
    setUploadProgress(0);
    
    try {
      // Upload all media files to storage with progress tracking
      const uploadedMedia: { url: string; type: string }[] = [];
      const totalFiles = media.length;
      
      for (let i = 0; i < media.length; i++) {
        const mediaItem = media[i];
        const fileExt = mediaItem.file.name.split('.').pop();
        const fileName = `${user.id}/${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${fileExt}`;
        const bucketName = mediaItem.type === 'image' ? 'post-images' : 'post-videos';

        // Calculate progress based on file index
        const baseProgress = (i / totalFiles) * 80; // 80% for uploads
        setUploadProgress(Math.round(baseProgress));

        const { error: uploadError } = await supabase.storage
          .from(bucketName)
          .upload(fileName, mediaItem.file);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from(bucketName)
          .getPublicUrl(fileName);

        uploadedMedia.push({ url: publicUrl, type: mediaItem.type });
        
        // Update progress after each file
        const progressAfterFile = ((i + 1) / totalFiles) * 80;
        setUploadProgress(Math.round(progressAfterFile));
      }

      // Creating post stage
      setUploadStage('creating');
      setUploadProgress(85);

      // Prepare scheduled time if set
      let scheduledAt = null;
      if (scheduledDate && scheduledTime) {
        scheduledAt = new Date(`${scheduledDate}T${scheduledTime}`).toISOString();
      }

      // Parse hashtags from input
      const parsedHashtags = hashtagsInput
        .split(/[,\s]+/)
        .map((tag) => tag.replace(/^#/, '').trim().toLowerCase())
        .filter((tag) => tag.length > 0);
      
      // Combine caption with hashtags
      const fullContent = parsedHashtags.length > 0 
        ? `${caption}\n\n${parsedHashtags.map(tag => `#${tag}`).join(' ')}`
        : caption;

      // Determine effective media type - posts with music attached should be treated as video-type
      const baseMediaType = uploadedMedia.length > 0 ? uploadedMedia[0].type : 'image';
      const effectiveMediaType = selectedMusic ? 'video' : baseMediaType;

      // Create post with multiple media
      const postData: any = {
        user_id: user.id,
        feed_id: crypto.randomUUID(),
        content: fullContent,
        location: location || null,
        privacy,
        post_type: 'public',
        status: scheduledAt ? 'scheduled' : 'active',
        scheduled_at: scheduledAt,
        // Music data
        music_title: selectedMusic?.title || null,
        music_artist: selectedMusic?.artist || null,
        music_url: selectedMusic?.audio_url || null,
      };

      // For multiple media, only use arrays. For single media, use both single and array fields
      // If music is attached to images, treat as video-type for proper playback
      if (uploadedMedia.length > 1) {
        postData.media_urls = uploadedMedia.map(m => m.url);
        postData.media_types = selectedMusic 
          ? uploadedMedia.map(() => 'video') // Mark all as video if music attached
          : uploadedMedia.map(m => m.type);
        postData.media_url = uploadedMedia[0].url;
        postData.media_type = effectiveMediaType;
      } else if (uploadedMedia.length === 1) {
        postData.media_url = uploadedMedia[0].url;
        postData.media_type = effectiveMediaType;
        postData.media_urls = [uploadedMedia[0].url];
        postData.media_types = [effectiveMediaType];
      }

      setUploadProgress(90);

      const { data: newPost, error: postError } = await supabase
        .from('posts')
        .insert(postData)
        .select('id')
        .single();

      if (postError) {
        console.error('Post creation error:', postError);
        throw new Error(postError.message || 'Failed to save post to database');
      }

      if (!newPost?.id) {
        throw new Error('Post was created but no ID was returned');
      }

      // Process hashtags in background (don't wait)
      if (parsedHashtags.length > 0) {
        supabase.functions.invoke('process-hashtags', {
          body: { postId: newPost.id, content: fullContent }
        }).catch(err => console.error('Error processing hashtags:', err));
      }

      setUploadProgress(100);
      setUploadStage('done');

      toast({
        title: 'Post created!',
        description: 'Your post has been published successfully.',
      });

      // Short delay to show 100% then navigate to main feed
      setTimeout(() => {
        onSubmit();
        navigate('/feed');
      }, 500);
    } catch (error: any) {
      console.error('Error creating post:', error);
      setUploadStage('idle');
      setUploadProgress(0);
      
      // Provide more specific error messages
      let errorMessage = 'Failed to create post';
      if (error.message?.includes('violates row-level security')) {
        errorMessage = 'Permission denied. Please try logging out and back in.';
      } else if (error.message?.includes('storage')) {
        errorMessage = 'Failed to upload media. Please try again.';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
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

      {/* Media Preview with Counter */}
      <div className="w-full mb-4 relative">
        {media[currentPreviewIndex].type === 'image' ? (
          <img src={media[currentPreviewIndex].url} className="w-full rounded-lg object-cover max-h-48" alt="Preview" />
        ) : (
          <video src={media[currentPreviewIndex].url} className="w-full rounded-lg max-h-48" controls />
        )}
        
        {media.length > 1 && (
          <>
            {/* Counter */}
            <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-sm text-white text-xs px-2 py-1 rounded-full">
              {currentPreviewIndex + 1}/{media.length}
            </div>
            
            {/* Navigation Dots */}
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
              {media.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentPreviewIndex(index)}
                  className={`w-1.5 h-1.5 rounded-full transition-all ${
                    index === currentPreviewIndex ? 'bg-white w-4' : 'bg-white/50'
                  }`}
                />
              ))}
            </div>
            
            {/* Swipe Navigation */}
            {currentPreviewIndex > 0 && (
              <button
                onClick={() => setCurrentPreviewIndex(prev => prev - 1)}
                className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 backdrop-blur-sm text-white rounded-full p-2 hover:bg-black/70 transition"
              >
                <X className="w-4 h-4 rotate-90" />
              </button>
            )}
            {currentPreviewIndex < media.length - 1 && (
              <button
                onClick={() => setCurrentPreviewIndex(prev => prev + 1)}
                className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 backdrop-blur-sm text-white rounded-full p-2 hover:bg-black/70 transition"
              >
                <X className="w-4 h-4 -rotate-90" />
              </button>
            )}
          </>
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

      {/* Hashtags Input */}
      <div className="w-full mb-4">
        <div className="flex items-center gap-2 mb-2">
          <Hash className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium">Hashtags</span>
        </div>
        <input
          type="text"
          placeholder="#fashion #vibes #trending"
          value={hashtagsInput}
          onChange={(e) => setHashtagsInput(e.target.value)}
          className="w-full p-3 border border-border rounded-lg text-sm bg-background"
        />
        {hashtagsInput.trim() && (
          <div className="flex flex-wrap gap-2 mt-2">
            {hashtagsInput
              .split(/[,\s]+/)
              .map((tag) => tag.replace(/^#/, '').trim().toLowerCase())
              .filter((tag) => tag.length > 0)
              .map((tag, idx) => (
                <span key={idx} className="px-2 py-1 bg-primary/10 text-primary rounded-full text-xs">
                  #{tag}
                </span>
              ))}
          </div>
        )}
      </div>

      {/* Music Selection - TikTok/Instagram Style */}
      <div className="w-full mb-4">
        <div className="flex items-center gap-2 mb-2">
          <Music className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium">Add Music</span>
        </div>
        
        {selectedMusic ? (
          <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg border border-border">
            <button
              onClick={toggleMusicPreview}
              className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0"
            >
              {isMusicPlaying ? (
                <Pause className="w-4 h-4 text-primary" />
              ) : (
                <Play className="w-4 h-4 text-primary ml-0.5" />
              )}
            </button>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm truncate">{selectedMusic.title}</p>
              <p className="text-xs text-muted-foreground truncate">
                {selectedMusic.artist || 'Unknown Artist'}
              </p>
            </div>
            <Disc3 className={`w-5 h-5 text-primary ${isMusicPlaying ? 'animate-spin-slow' : ''}`} />
            <button
              onClick={removeMusic}
              className="p-1.5 rounded-full hover:bg-muted"
            >
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => setShowMusicPicker(true)}
            className="w-full p-3 border border-dashed border-border rounded-lg text-sm text-muted-foreground hover:bg-muted/50 hover:border-primary/50 transition-colors flex items-center justify-center gap-2"
          >
            <Music className="w-4 h-4" />
            Tap to add music to your post
          </button>
        )}
        
        {/* Hidden audio element for preview */}
        {selectedMusic && (
          <audio
            ref={musicAudioRef}
            src={selectedMusic.audio_url}
            onEnded={() => setIsMusicPlaying(false)}
            preload="metadata"
          />
        )}
      </div>

      <div className="w-full mb-4">
        <div className="flex items-center gap-2 mb-2">
          <MapPin className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium">Location (optional)</span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={detectLocation}
            disabled={detectingLocation}
            className="ml-auto text-xs"
          >
            {detectingLocation ? 'Detecting...' : 'Auto-detect'}
          </Button>
        </div>
        <div className="relative">
          <input
            type="text"
            placeholder="Add location..."
            value={location}
            onChange={(e) => {
              setLocation(e.target.value);
              fetchLocationSuggestions(e.target.value);
            }}
            className="w-full p-3 border border-border rounded-lg text-sm bg-background"
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
      </div>

      <div className="w-full mb-4">
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

      {/* Schedule Post */}
      <div className="w-full mb-6">
        <Button
          type="button"
          variant="outline"
          onClick={() => setShowSchedule(!showSchedule)}
          className="w-full mb-3"
        >
          <Calendar className="w-4 h-4 mr-2" />
          {showSchedule ? 'Remove Schedule' : 'Schedule Post'}
        </Button>

        {showSchedule && (
          <div className="space-y-3 p-4 border border-border rounded-lg bg-muted/50">
            <div>
              <label className="text-xs font-medium mb-1.5 block flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                Date
              </label>
              <input
                type="date"
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
                min={format(new Date(), 'yyyy-MM-dd')}
                className="w-full p-2 border border-border rounded-lg text-sm bg-background"
              />
            </div>
            <div>
              <label className="text-xs font-medium mb-1.5 block flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                Time
              </label>
              <input
                type="time"
                value={scheduledTime}
                onChange={(e) => setScheduledTime(e.target.value)}
                className="w-full p-2 border border-border rounded-lg text-sm bg-background"
              />
            </div>
            {scheduledDate && scheduledTime && (
              <p className="text-xs text-muted-foreground">
                Will be posted on {format(new Date(`${scheduledDate}T${scheduledTime}`), 'PPp')}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Upload Progress Overlay */}
      {loading && (
        <div className="fixed inset-0 z-[110] bg-background/95 backdrop-blur-sm flex flex-col items-center justify-center p-8">
          <div className="w-full max-w-xs space-y-6">
            {/* Progress Circle or Check */}
            <div className="flex justify-center">
              {uploadStage === 'done' ? (
                <div className="w-20 h-20 rounded-full bg-green-500/20 flex items-center justify-center animate-scale-in">
                  <CheckCircle2 className="w-12 h-12 text-green-500" />
                </div>
              ) : (
                <div className="relative w-20 h-20">
                  <svg className="w-20 h-20 -rotate-90" viewBox="0 0 80 80">
                    <circle
                      cx="40"
                      cy="40"
                      r="36"
                      fill="none"
                      stroke="hsl(var(--muted))"
                      strokeWidth="6"
                    />
                    <circle
                      cx="40"
                      cy="40"
                      r="36"
                      fill="none"
                      stroke="hsl(var(--primary))"
                      strokeWidth="6"
                      strokeLinecap="round"
                      strokeDasharray={`${2 * Math.PI * 36}`}
                      strokeDashoffset={`${2 * Math.PI * 36 * (1 - uploadProgress / 100)}`}
                      className="transition-all duration-300"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-lg font-bold">{uploadProgress}%</span>
                  </div>
                </div>
              )}
            </div>

            {/* Progress Bar */}
            <div className="space-y-2">
              <Progress value={uploadProgress} className="h-2" />
              <p className="text-center text-sm text-muted-foreground">
                {uploadStage === 'uploading' && 'Uploading media...'}
                {uploadStage === 'creating' && 'Creating your post...'}
                {uploadStage === 'done' && 'Post created successfully!'}
              </p>
            </div>
          </div>
        </div>
      )}

      <button
        onClick={handleSubmit}
        disabled={loading || !caption.trim()}
        className="w-full py-3 rounded-full bg-primary text-primary-foreground font-semibold text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {loading && <Loader2 className="w-4 h-4 animate-spin" />}
        {loading ? 'Posting...' : 'Post'}
      </button>

      {/* Music Picker Modal */}
      <MusicPicker
        isOpen={showMusicPicker}
        onClose={() => setShowMusicPicker(false)}
        onSelect={handleMusicSelect}
        onUpload={() => {
          setShowMusicPicker(false);
          setShowMusicUploader(true);
        }}
      />

      {/* Music Uploader Modal */}
      <MusicUploader
        isOpen={showMusicUploader}
        onClose={() => setShowMusicUploader(false)}
        onUploadComplete={handleMusicUploadComplete}
      />
    </div>
  );
}
