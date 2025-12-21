import React, { useEffect, useRef, useState } from 'react';
import {
  Camera as CameraIcon,
  RefreshCw,
  Play,
  Pause,
  Check,
  Sparkles,
  ImagePlus,
  Globe,
  Users,
  UserCheck,
  Lock,
  Hash,
  MapPin,
  X,
  Music,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { MusicPicker } from './MusicPicker';
import { MusicUploader } from './MusicUploader';

type Stage = 'camera' | 'filters' | 'details';
type MediaType = 'image' | 'video';

type Privacy = 'everyone' | 'friends' | 'followers' | 'only_me';

interface FinalPostData {
  caption: string;
  hashtags: string[];
  location?: string | null;
  privacy: Privacy;
  detectFaces: boolean;
  mediaUrl?: string | null;
  mediaType?: MediaType | null;
}

export default function TikTokPortraitPostFlow({
  onClose,
  onSubmit,
}: {
  onClose?: () => void;
  onSubmit?: (data: FinalPostData) => void;
}) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [stage, setStage] = useState<Stage>('camera');
  const [uploading, setUploading] = useState(false);

  // Camera/recording
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const [recording, setRecording] = useState(false);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');

  // Captured media
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<MediaType | null>(null);

  // Filters
  const [activeFilter, setActiveFilter] = useState<string>('none');

  // Text overlay
  const [overlayText, setOverlayText] = useState('');
  const [showTextInput, setShowTextInput] = useState(false);
  const [textColor, setTextColor] = useState('#ffffff');
  const [textPosition, setTextPosition] = useState<'top' | 'center' | 'bottom'>('center');

  // Music selection
  const [selectedMusic, setSelectedMusic] = useState<{
    id: string;
    title: string;
    artist: string | null;
    audio_url: string;
    duration_seconds: number | null;
  } | null>(null);
  const [showMusicPicker, setShowMusicPicker] = useState(false);
  const [showMusicUploader, setShowMusicUploader] = useState(false);
  const [faceDetected, setFaceDetected] = useState(false);
  const [detectingFace, setDetectingFace] = useState(false);
  const musicAudioRef = useRef<HTMLAudioElement | null>(null);

  // Post details
  const [caption, setCaption] = useState('');
  const [hashtagsInput, setHashtagsInput] = useState('');
  const [location, setLocation] = useState('');
  const [privacy, setPrivacy] = useState<Privacy>('everyone');
  const [detectFaces, setDetectFaces] = useState(false);

  const parsedHashtags = hashtagsInput
    .split(/[,\s]+/)
    .map((tag) => tag.replace(/^#/, '').trim())
    .filter((tag) => tag.length > 0);

  const privacyOptions = [
    { value: 'everyone', label: 'Everyone', icon: Globe },
    { value: 'friends', label: 'Friends', icon: Users },
    { value: 'followers', label: 'Followers', icon: UserCheck },
    { value: 'only_me', label: 'Only Me', icon: Lock },
  ];

  // Portrait-only container classes
  const containerCls =
    'fixed inset-0 z-[100] bg-background flex flex-col items-center justify-start p-4 overflow-y-auto max-w-sm mx-auto';

  // Initialize camera stream
  useEffect(() => {
    if (stage !== 'camera') return;

    const startStream = async () => {
      stopStream();
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode,
            width: { ideal: 1080 },
            height: { ideal: 1920 },
            aspectRatio: 9 / 16,
          },
          audio: true,
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
      } catch (e) {
        console.error('Camera error:', e);
        toast({
          title: 'Camera Error',
          description: 'Unable to access camera. Please check permissions.',
          variant: 'destructive',
        });
      }
    };
    startStream();
    return () => {
      // Do nothing here; we stop when leaving stage
    };
  }, [stage, facingMode, toast]);

  const stopStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  };

  // Face detection function
  const detectFacesInImage = async (imageUrl: string) => {
    setDetectingFace(true);
    try {
      const img = new Image();
      img.src = imageUrl;
      await new Promise((resolve) => { img.onload = resolve; });

      // Use FaceDetector API if available
      if ('FaceDetector' in window) {
        const faceDetector = new (window as any).FaceDetector();
        const faces = await faceDetector.detect(img);
        setFaceDetected(faces.length > 0);
        if (faces.length > 0) {
          toast({
            title: "Face Detected",
            description: `${faces.length} face(s) detected in the image`,
          });
        }
      } else {
        // Fallback: basic detection using canvas and image analysis
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = img.width;
        canvas.height = img.height;
        ctx?.drawImage(img, 0, 0);
        
        // Simple heuristic: check for skin-tone colors in upper portion
        const imageData = ctx?.getImageData(0, 0, canvas.width, canvas.height / 3);
        if (imageData) {
          let skinTonePixels = 0;
          for (let i = 0; i < imageData.data.length; i += 4) {
            const r = imageData.data[i];
            const g = imageData.data[i + 1];
            const b = imageData.data[i + 2];
            // Rough skin tone detection
            if (r > 95 && g > 40 && b > 20 && r > g && r > b) {
              skinTonePixels++;
            }
          }
          const hasLikelyFace = skinTonePixels > (imageData.data.length / 4) * 0.02;
          setFaceDetected(hasLikelyFace);
        }
      }
    } catch (error) {
      console.error('Face detection error:', error);
    } finally {
      setDetectingFace(false);
    }
  };

  // Capture photo
  const handleCapturePhoto = async () => {
    if (!videoRef.current) return;
    const canvas = document.createElement('canvas');
    const vw = videoRef.current.videoWidth || 1080;
    const vh = videoRef.current.videoHeight || 1920;
    canvas.width = vw;
    canvas.height = vh;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.filter = cssFilterFor(activeFilter);
    ctx.drawImage(videoRef.current, 0, 0, vw, vh);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
    setMediaUrl(dataUrl);
    setMediaType('image');
    
    // Detect faces in the captured image
    await detectFacesInImage(dataUrl);
    
    // Move to filters stage (with preview)
    setStage('filters');
    stopStream();
  };

  // Start/stop recording video
  const handleToggleRecording = () => {
    if (!recording) {
      if (!streamRef.current) return;
      recordedChunksRef.current = [];
      try {
        const mr = new MediaRecorder(streamRef.current, { mimeType: 'video/webm;codecs=vp9' });
        mediaRecorderRef.current = mr;
        mr.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) {
            recordedChunksRef.current.push(e.data);
          }
        };
        mr.onstop = () => {
          const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
          const url = URL.createObjectURL(blob);
          setMediaUrl(url);
          setMediaType('video');
          setStage('filters');
          stopStream();
        };
        mr.start();
        setRecording(true);
      } catch (e) {
        console.error('MediaRecorder error:', e);
        toast({
          title: 'Recording Error',
          description: 'Unable to record video.',
          variant: 'destructive',
        });
      }
    } else {
      mediaRecorderRef.current?.stop();
      setRecording(false);
    }
  };

  const handleFlipCamera = () => {
    setFacingMode((m) => (m === 'user' ? 'environment' : 'user'));
  };

  const handleRetake = () => {
    // Clear current capture and go back to camera
    if (mediaUrl && mediaType === 'video') {
      URL.revokeObjectURL(mediaUrl);
    }
    setMediaUrl(null);
    setMediaType(null);
    setActiveFilter('none');
    setStage('camera');
  };

  const handleNextToDetails = () => {
    setStage('details');
  };

  const handlePost = async () => {
    if (!user || !mediaUrl || !mediaType) return;

    setUploading(true);
    try {
      // Convert dataURL/objectURL to blob
      let blob: Blob;
      if (mediaUrl.startsWith('data:')) {
        const res = await fetch(mediaUrl);
        blob = await res.blob();
      } else {
        const res = await fetch(mediaUrl);
        blob = await res.blob();
      }

      const fileExt = mediaType === 'image' ? 'jpg' : 'webm';
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;
      const bucketName = mediaType === 'image' ? 'post-images' : 'post-videos';

      // Upload to Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from(bucketName)
        .upload(fileName, blob);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from(bucketName)
        .getPublicUrl(fileName);

      // Create post with music
      const { error: postError } = await supabase.from('posts').insert({
        user_id: user.id,
        feed_id: crypto.randomUUID(),
        content: caption,
        media_url: publicUrl,
        media_type: mediaType,
        location: location || null,
        privacy: privacy,
        post_type: 'public',
        status: 'active',
        // Music data
        music_title: selectedMusic?.title || null,
        music_artist: selectedMusic?.artist || null,
        music_url: selectedMusic?.audio_url || null,
      });

      if (postError) throw postError;

      toast({
        title: 'Post created!',
        description: 'Your post has been shared.',
      });

      onSubmit?.({
        caption,
        hashtags: parsedHashtags,
        location: location || null,
        privacy,
        detectFaces,
        mediaUrl: publicUrl,
        mediaType,
      });

      // Reset
      setCaption('');
      setHashtagsInput('');
      setLocation('');
      setPrivacy('everyone');
      setDetectFaces(false);
      setMediaUrl(null);
      setMediaType(null);
      setActiveFilter('none');
      setStage('camera');
      onClose?.();
    } catch (error) {
      console.error('Error creating post:', error);
      toast({
        title: 'Error',
        description: 'Failed to create post. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
    }
  };

  // Simple CSS filters
  const filters = [
    { id: 'none', name: 'None' },
    { id: 'warm', name: 'Warm' },
    { id: 'cool', name: 'Cool' },
    { id: 'vivid', name: 'Vivid' },
    { id: 'mono', name: 'Mono' },
    { id: 'film', name: 'Film' },
  ];

  function cssFilterFor(id: string) {
    switch (id) {
      case 'warm':
        return 'contrast(1.1) saturate(1.2) sepia(0.2)';
      case 'cool':
        return 'contrast(1.1) saturate(1.1) hue-rotate(200deg)';
      case 'vivid':
        return 'contrast(1.2) saturate(1.4)';
      case 'mono':
        return 'grayscale(1) contrast(1.1)';
      case 'film':
        return 'contrast(1.05) saturate(1.1) sepia(0.15)';
      default:
        return 'none';
    }
  }

  // Render by stage
  return (
    <div className={containerCls}>
      {/* Header */}
      <div className="w-full flex items-center justify-between mb-3">
        <h2 className="text-base font-semibold text-foreground">Create post</h2>
        <button
          onClick={() => {
            stopStream();
            onClose?.();
          }}
          className="rounded-full p-2 text-muted-foreground hover:bg-muted"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* CAMERA STAGE */}
      {stage === 'camera' && (
        <div className="w-full flex flex-col items-center">
          <div className="relative w-full rounded-lg overflow-hidden bg-black mb-4">
            <video
              ref={videoRef}
              playsInline
              muted
              className="w-full h-[60vh] object-cover"
              style={{ filter: cssFilterFor(activeFilter) }}
            />
            {/* Overlay controls */}
            <div className="absolute bottom-3 left-0 right-0 px-4 flex items-center justify-between">
              <button
                onClick={handleFlipCamera}
                className="rounded-full bg-white/20 text-white px-3 py-2 text-xs font-semibold"
              >
                Flip
              </button>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCapturePhoto}
                  className="rounded-full bg-primary text-primary-foreground px-4 py-2 text-sm font-semibold"
                >
                  Snap
                </button>
                <button
                  onClick={handleToggleRecording}
                  className={`rounded-full ${
                    recording ? 'bg-red-600 text-white' : 'bg-white text-black'
                  } px-4 py-2 text-sm font-semibold flex items-center gap-1`}
                >
                  {recording ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                  {recording ? 'Stop' : 'Record'}
                </button>
              </div>
            </div>
          </div>

          {/* Quick filter thumbnails (live preview) */}
          <div className="w-full flex items-center gap-2 overflow-x-auto pb-2">
            {filters.map((f) => (
              <button
                key={f.id}
                onClick={() => setActiveFilter(f.id)}
                className={`flex-shrink-0 rounded-lg border ${
                  activeFilter === f.id ? 'border-primary' : 'border-border'
                }`}
              >
                <div
                  className="w-20 h-28 rounded-lg"
                  style={{ filter: cssFilterFor(f.id), background: 'linear-gradient(180deg,#888,#222)' }}
                />
                <span className="block text-center text-xs py-1">{f.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* FILTERS STAGE (preview + actions) */}
      {stage === 'filters' && (
        <div className="w-full flex flex-col items-center">
          <div className="relative w-full rounded-lg overflow-hidden bg-black mb-4">
            {mediaType === 'image' ? (
              <img
                src={mediaUrl ?? ''}
                alt="Preview"
                className="w-full h-[60vh] object-cover"
                style={{ filter: cssFilterFor(activeFilter) }}
              />
            ) : (
              <video
                src={mediaUrl ?? ''}
                className="w-full h-[60vh] object-cover"
                style={{ filter: cssFilterFor(activeFilter) }}
                controls
                playsInline
              />
            )}
            
            {/* Text overlay preview */}
            {overlayText && (
              <div 
                className={`absolute left-0 right-0 px-4 ${
                  textPosition === 'top' ? 'top-4' : textPosition === 'bottom' ? 'bottom-4' : 'top-1/2 -translate-y-1/2'
                }`}
              >
                <p 
                  className="text-center font-bold text-2xl drop-shadow-lg"
                  style={{ color: textColor }}
                >
                  {overlayText}
                </p>
              </div>
            )}
          </div>

          {/* Enhancement options */}
          <div className="w-full space-y-3 mb-3">
            {/* Text overlay controls */}
            <div className="flex items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant={showTextInput ? 'default' : 'outline'}
                onClick={() => setShowTextInput(!showTextInput)}
                className="flex-1"
              >
                <ImagePlus className="w-4 h-4 mr-2" />
                Add Text
              </Button>
              <Button
                type="button"
                size="sm"
                variant={selectedMusic ? 'default' : 'outline'}
                onClick={() => setShowMusicPicker(true)}
                className="flex-1"
              >
                <Music className="w-4 h-4 mr-2" />
                {selectedMusic ? selectedMusic.title : 'Add Music'}
              </Button>
            </div>
            
            {/* Selected music preview */}
            {selectedMusic && (
              <div className="p-3 border border-primary/50 rounded-lg bg-primary/5 flex items-center gap-3">
                <button
                  onClick={() => {
                    if (musicAudioRef.current) {
                      if (musicAudioRef.current.paused) {
                        musicAudioRef.current.play();
                      } else {
                        musicAudioRef.current.pause();
                      }
                    } else {
                      musicAudioRef.current = new Audio(selectedMusic.audio_url);
                      musicAudioRef.current.play();
                    }
                  }}
                  className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center"
                >
                  <Play className="w-4 h-4 text-primary" />
                </button>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{selectedMusic.title}</p>
                  <p className="text-xs text-muted-foreground truncate">{selectedMusic.artist || 'Unknown Artist'}</p>
                </div>
                <button
                  onClick={() => {
                    if (musicAudioRef.current) {
                      musicAudioRef.current.pause();
                      musicAudioRef.current = null;
                    }
                    setSelectedMusic(null);
                  }}
                  className="p-1 rounded-full hover:bg-muted"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
            
            {/* Face detection indicator */}
            {detectingFace && (
              <div className="text-xs text-muted-foreground text-center">
                Detecting faces...
              </div>
            )}
            {faceDetected && (
              <div className="text-xs text-green-600 flex items-center justify-center gap-1">
                <span>✓</span> Face detected
              </div>
            )}

            {/* Text input panel */}
            {showTextInput && (
              <div className="p-3 border border-border rounded-lg bg-muted/50 space-y-2">
                <input
                  type="text"
                  placeholder="Enter text..."
                  value={overlayText}
                  onChange={(e) => setOverlayText(e.target.value)}
                  className="w-full p-2 border border-border rounded-lg text-sm bg-background"
                />
                <div className="flex gap-2">
                  <select
                    value={textPosition}
                    onChange={(e) => setTextPosition(e.target.value as any)}
                    className="flex-1 p-2 border border-border rounded-lg text-sm bg-background"
                  >
                    <option value="top">Top</option>
                    <option value="center">Center</option>
                    <option value="bottom">Bottom</option>
                  </select>
                  <input
                    type="color"
                    value={textColor}
                    onChange={(e) => setTextColor(e.target.value)}
                    className="w-12 h-9 border border-border rounded-lg cursor-pointer"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Filter selector */}
          <div className="w-full flex items-center gap-2 overflow-x-auto pb-2">
            {filters.map((f) => (
              <button
                key={f.id}
                onClick={() => setActiveFilter(f.id)}
                className={`flex-shrink-0 rounded-lg border ${
                  activeFilter === f.id ? 'border-primary' : 'border-border'
                }`}
              >
                <div
                  className="w-20 h-28 rounded-lg"
                  style={{ filter: cssFilterFor(f.id), background: 'linear-gradient(180deg,#888,#222)' }}
                />
                <span className="block text-center text-xs py-1">{f.name}</span>
              </button>
            ))}
          </div>

          {/* Actions */}
          <div className="w-full flex justify-between mt-4">
            <button
              onClick={handleRetake}
              className="px-4 py-2 rounded-full bg-muted text-foreground font-semibold flex items-center gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Retake
            </button>
            <button
              onClick={handleNextToDetails}
              className="px-4 py-2 rounded-full bg-primary text-primary-foreground font-semibold flex items-center gap-2"
            >
              <Check className="h-4 w-4" />
              Next
            </button>
          </div>
        </div>
      )}

      {/* DETAILS STAGE */}
      {stage === 'details' && (
        <div className="w-full flex flex-col items-center">
          {/* Optional micro preview strip */}
          {mediaUrl && (
            <div className="w-full rounded-lg overflow-hidden border border-border mb-3">
              {mediaType === 'image' ? (
                <img
                  src={mediaUrl}
                  alt="thumb"
                  className="w-full h-32 object-cover"
                  style={{ filter: cssFilterFor(activeFilter) }}
                />
              ) : (
                <video
                  src={mediaUrl}
                  className="w-full h-32 object-cover"
                  style={{ filter: cssFilterFor(activeFilter) }}
                  controls
                  playsInline
                />
              )}
            </div>
          )}

          {/* Caption */}
          <label className="mb-1 text-xs font-medium text-muted-foreground w-full">Caption</label>
          <textarea
            placeholder="Write a caption..."
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            rows={4}
            className="mb-3 w-full resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          />

          {/* Hashtags */}
          <label className="mb-1 flex items-center gap-2 text-xs font-medium text-muted-foreground w-full">
            <Hash className="h-4 w-4" /> Hashtags
          </label>
          <input
            type="text"
            placeholder="e.g. #fashion #vibes"
            value={hashtagsInput}
            onChange={(e) => setHashtagsInput(e.target.value)}
            className="mb-3 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          />
          {parsedHashtags.length > 0 && (
            <div className="mb-3 w-full flex flex-wrap gap-2">
              {parsedHashtags.map((h) => (
                <span key={h} className="rounded-full bg-muted px-3 py-1 text-xs font-medium">
                  #{h}
                </span>
              ))}
            </div>
          )}

          {/* Location */}
          <label className="mb-1 flex items-center gap-2 text-xs font-medium text-muted-foreground w-full">
            <MapPin className="h-4 w-4" /> Location
          </label>
          <input
            type="text"
            placeholder="Add a location (optional)"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            className="mb-3 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          />

          {/* Privacy */}
          <label className="mb-1 text-xs font-medium text-muted-foreground w-full">Visibility</label>
          <div className="mb-3 w-full flex flex-wrap gap-2">
            {privacyOptions.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setPrivacy(opt.value as Privacy)}
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  privacy === (opt.value as Privacy)
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-foreground'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Detect faces toggle */}
          <button
            onClick={() => setDetectFaces((v) => !v)}
            className={`mb-4 flex w-full items-center justify-between rounded-lg border p-3 transition ${
              detectFaces ? 'border-primary bg-primary/10' : 'border-border'
            }`}
          >
            <span className="text-sm font-medium text-foreground">Detect faces</span>
            <Sparkles className="h-5 w-5 text-muted-foreground" />
          </button>

          {/* Submit */}
          <button
            onClick={handlePost}
            disabled={uploading}
            className="w-full rounded-full bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50"
          >
            {uploading ? 'Posting...' : 'Post'}
          </button>

          {/* Safe area */}
          <div className="h-6" />
        </div>
      )}

      {/* Music Picker Modal */}
      <MusicPicker
        isOpen={showMusicPicker}
        onClose={() => setShowMusicPicker(false)}
        onSelect={(track) => {
          setSelectedMusic({
            id: track.id,
            title: track.title,
            artist: track.artist,
            audio_url: track.audio_url,
            duration_seconds: track.duration_seconds,
          });
          setShowMusicPicker(false);
        }}
        onUpload={() => {
          setShowMusicPicker(false);
          setShowMusicUploader(true);
        }}
      />

      {/* Music Uploader Modal */}
      <MusicUploader
        isOpen={showMusicUploader}
        onClose={() => setShowMusicUploader(false)}
        onUploadComplete={(track) => {
          setSelectedMusic({
            id: track.id,
            title: track.title,
            artist: track.artist,
            audio_url: track.audio_url,
            duration_seconds: track.duration_seconds,
          });
          setShowMusicUploader(false);
        }}
      />
    </div>
  );
}
