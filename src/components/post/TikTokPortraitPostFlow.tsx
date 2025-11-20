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
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

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

      // Create post
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
          <div className="w-full rounded-lg overflow-hidden bg-black mb-4">
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
    </div>
  );
}
