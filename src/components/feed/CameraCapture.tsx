import { useState, useRef, useEffect } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { X, RotateCw, Circle, Square, Wand2, Type, Sticker as StickerIcon, RotateCcw, ArrowRight, Crop, ZoomIn, RefreshCw, Check, Pencil, Droplet, Music, Gauge, Rewind, Image as ImageIcon } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { ImageCropper } from './ImageCropper';
import { MusicLibrary } from './MusicLibrary';
import { VideoTrimmer } from './VideoTrimmer';
import { applyImageEffects } from '@/lib/media-processor';

interface CameraCaptureProps {
  open: boolean;
  onClose: () => void;
  onCapture: (file: File, mediaType: 'image' | 'video', effects?: any, postToStory?: boolean) => void;
  onSwitchToGallery?: () => void;
  onTextPost?: () => void;
}

interface StickerData {
  emoji: string;
  x: number;
  y: number;
  scale: number;
}

const FILTERS = {
  hotVibes: [
    { name: 'None', filter: '' },
    { name: 'Fire', filter: 'contrast(1.3) saturate(1.5) hue-rotate(350deg)' },
    { name: 'Sunset Glow', filter: 'sepia(0.4) saturate(1.4) brightness(1.1)' },
    { name: 'Electric', filter: 'saturate(1.6) brightness(1.2) hue-rotate(180deg)' },
  ],
  everyday: [
    { name: 'None', filter: '' },
    { name: 'Clean', filter: 'brightness(1.05) contrast(1.1)' },
    { name: 'Natural', filter: 'saturate(0.95) brightness(1.05)' },
  ],
  culinary: [
    { name: 'None', filter: '' },
    { name: 'Appetizing', filter: 'saturate(1.3) contrast(1.2) brightness(1.05)' },
  ],
  active: [
    { name: 'None', filter: '' },
    { name: 'Energetic', filter: 'saturate(1.4) contrast(1.3) brightness(1.1)' },
  ],
};

const STICKERS = ['❤️', '🔥', '✨', '🎉', '😍', '👍', '💯', '⭐', '💪', '😂', '🎵', '🌟'];

export function CameraCapture({ open, onClose, onCapture, onSwitchToGallery, onTextPost }: CameraCaptureProps) {
  const { toast } = useToast();
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  
  // Camera states
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [mode, setMode] = useState<'photo' | 'video' | 'text'>('photo');
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const [aspectRatio, setAspectRatio] = useState<'9:16' | '1:1' | '4:3' | '16:9'>('9:16');
  const [zoom, setZoom] = useState(1);
  const [showZoomControl, setShowZoomControl] = useState(false);
  
  // Captured media states
  const [capturedMediaUrl, setCapturedMediaUrl] = useState<string | null>(null);
  const [capturedMediaType, setCapturedMediaType] = useState<'image' | 'video'>('image');
  
  // Editing states
  const [selectedFilter, setSelectedFilter] = useState<string>('None');
  const [filterCategory, setFilterCategory] = useState<keyof typeof FILTERS>('hotVibes');
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [saturation, setSaturation] = useState(100);
  const [textOverlay, setTextOverlay] = useState('');
  const [textPosition, setTextPosition] = useState({ x: 50, y: 50 });
  const [textSize, setTextSize] = useState(48);
  const [isDraggingText, setIsDraggingText] = useState(false);
  const [dragTextStart, setDragTextStart] = useState<{ x: number; y: number } | null>(null);
  const [stickers, setStickers] = useState<StickerData[]>([]);
  const [voiceOverBlob, setVoiceOverBlob] = useState<Blob | null>(null);
  const [croppedImageUrl, setCroppedImageUrl] = useState<string>('');
  
  // UI overlay states - all can be open at once
  const [showFiltersOverlay, setShowFiltersOverlay] = useState(false);
  const [showTextOverlay, setShowTextOverlay] = useState(false);
  const [showStickersOverlay, setShowStickersOverlay] = useState(false);
  const [showCropper, setShowCropper] = useState(false);
  const [showDrawing, setShowDrawing] = useState(false);
  const [showVideoTrimmer, setShowVideoTrimmer] = useState(false);
  const [showBlur, setShowBlur] = useState(false);
  const [draggedStickerIndex, setDraggedStickerIndex] = useState<number | null>(null);
  const [stickerPinchStart, setStickerPinchStart] = useState<{ distance: number; scale: number } | null>(null);
  const [blurAmount, setBlurAmount] = useState(0);
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawingPaths, setDrawingPaths] = useState<Array<{x: number, y: number}[]>>([]);
  const [currentPath, setCurrentPath] = useState<Array<{x: number, y: number}>>([]);
  const [drawColor, setDrawColor] = useState('#ffffff');
  const [drawSize, setDrawSize] = useState(3);
  const [videoTrimStart, setVideoTrimStart] = useState(0);
  const [videoTrimEnd, setVideoTrimEnd] = useState(0);
  const [videoDuration, setVideoDuration] = useState(0);
  const trimVideoRef = useRef<HTMLVideoElement>(null);
  const [videoPlaybackSpeed, setVideoPlaybackSpeed] = useState(1);
  const [videoReversed, setVideoReversed] = useState(false);
  const [showMusicLibrary, setShowMusicLibrary] = useState(false);
  const [selectedMusic, setSelectedMusic] = useState<{ name: string; artist: string; url: string; duration: number } | null>(null);
  const [showPreCaptureFilters, setShowPreCaptureFilters] = useState(false);
  const [preCaptureFilter, setPreCaptureFilter] = useState<string>('None');

  useEffect(() => {
    if (open) {
      startCamera();
    } else {
      stopCamera();
    }
    return () => stopCamera();
  }, [open, facingMode]);

  const handleGalleryClick = () => {
    if (onSwitchToGallery) {
      stopCamera();
      onSwitchToGallery();
    }
  };

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode },
        audio: mode === 'video',
      });
      setStream(mediaStream);
      
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (error) {
      toast({
        title: 'Camera access denied',
        description: 'Please allow camera access to use this feature',
        variant: 'destructive',
      });
      onClose();
    }
  };

  // Apply zoom to camera
  useEffect(() => {
    if (stream && zoom !== 1) {
      const videoTrack = stream.getVideoTracks()[0];
      const capabilities = videoTrack.getCapabilities?.() as any;
      
      if (capabilities?.zoom) {
        videoTrack.applyConstraints({
          advanced: [{ zoom } as any]
        }).catch(console.error);
      }
    }
  }, [zoom, stream]);

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
  };

  const capturePhoto = () => {
    if (!videoRef.current) return;

    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    
    // Calculate dimensions based on selected aspect ratio
    let targetWidth = video.videoWidth;
    let targetHeight = video.videoHeight;
    
    const aspectRatios = {
      '9:16': 9/16,
      '1:1': 1,
      '4:3': 4/3,
      '16:9': 16/9
    };
    
    const targetRatio = aspectRatios[aspectRatio];
    const currentRatio = targetWidth / targetHeight;
    
    // Crop to match selected aspect ratio
    if (currentRatio > targetRatio) {
      // Video is wider than target - crop width
      targetWidth = targetHeight * targetRatio;
    } else if (currentRatio < targetRatio) {
      // Video is taller than target - crop height
      targetHeight = targetWidth / targetRatio;
    }
    
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Center the crop
    const sx = (video.videoWidth - targetWidth) / 2;
    const sy = (video.videoHeight - targetHeight) / 2;
    
    ctx.drawImage(video, sx, sy, targetWidth, targetHeight, 0, 0, targetWidth, targetHeight);
    
    canvas.toBlob((blob) => {
      if (blob) {
        const url = URL.createObjectURL(blob);
        setCapturedMediaUrl(url);
        setCapturedMediaType('image');
        setCroppedImageUrl(url);
        stopCamera();
      }
    }, 'image/jpeg', 0.95);
  };

  const startRecording = () => {
    if (!stream) return;

    const mediaRecorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
    mediaRecorderRef.current = mediaRecorder;
    const chunks: Blob[] = [];

    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        chunks.push(event.data);
      }
    };

    mediaRecorder.onstop = () => {
      const blob = new Blob(chunks, { type: 'video/webm' });
      const url = URL.createObjectURL(blob);
      setCapturedMediaUrl(url);
      setCapturedMediaType('video');
      stopCamera();
    };

    mediaRecorder.start();
    setIsRecording(true);
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const toggleFacingMode = () => {
    setFacingMode((prev) => (prev === 'user' ? 'environment' : 'user'));
  };

  const getAspectRatioClass = () => {
    switch (aspectRatio) {
      case '1:1': return 'aspect-square';
      case '4:3': return 'aspect-[4/3]';
      case '16:9': return 'aspect-[16/9]';
      case '9:16': return 'aspect-[9/16]';
      default: return 'aspect-[9/16]';
    }
  };

  const resetAllEdits = () => {
    setSelectedFilter('None');
    setBrightness(100);
    setContrast(100);
    setSaturation(100);
    setTextOverlay('');
    setTextPosition({ x: 50, y: 50 });
    setTextSize(48);
    setStickers([]);
    setCroppedImageUrl(capturedMediaUrl || '');
    setBlurAmount(0);
    setDrawingPaths([]);
    setCurrentPath([]);
    setDrawColor('#ffffff');
    setDrawSize(3);
    setVideoPlaybackSpeed(1);
    setVideoReversed(false);
    setSelectedMusic(null);
  };

  const getFilterStyle = () => {
    const filterObj = selectedFilter !== 'None' ? FILTERS[filterCategory].find(f => f.name === selectedFilter) : null;
    const blurFilter = blurAmount > 0 ? `blur(${blurAmount}px)` : '';
    return {
      filter: `${filterObj?.filter || ''} brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%) ${blurFilter}`,
    };
  };

  const getTextPositionStyle = () => {
    return {
      left: `${textPosition.x}%`,
      top: `${textPosition.y}%`,
      transform: 'translate(-50%, -50%)',
    };
  };

  const addSticker = (emoji: string) => {
    const positions = [
      { x: 20, y: 20 },
      { x: 80, y: 20 },
      { x: 20, y: 80 },
      { x: 80, y: 80 },
    ];
    const randomPos = positions[Math.floor(Math.random() * positions.length)];
    setStickers([...stickers, { emoji, x: randomPos.x, y: randomPos.y, scale: 1 }]);
  };

  const removeSticker = (index: number) => {
    setStickers(stickers.filter((_, i) => i !== index));
  };

  const handleStickerTouchStart = (e: React.TouchEvent, index: number) => {
    e.stopPropagation();
    
    // Check for pinch gesture (two fingers)
    if (e.touches.length === 2) {
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      const distance = Math.hypot(
        touch2.clientX - touch1.clientX,
        touch2.clientY - touch1.clientY
      );
      setStickerPinchStart({ distance, scale: stickers[index].scale });
      setDraggedStickerIndex(index);
    } else if (e.touches.length === 1) {
      setDraggedStickerIndex(index);
    }
  };

  const handleStickerTouchMove = (e: React.TouchEvent, index: number) => {
    if (draggedStickerIndex !== index || !previewRef.current) return;
    e.preventDefault();

    // Handle pinch-to-zoom (two fingers)
    if (e.touches.length === 2 && stickerPinchStart) {
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      const currentDistance = Math.hypot(
        touch2.clientX - touch1.clientX,
        touch2.clientY - touch1.clientY
      );
      const scale = stickerPinchStart.scale * (currentDistance / stickerPinchStart.distance);
      const clampedScale = Math.max(0.5, Math.min(3, scale));
      
      setStickers(stickers.map((s, i) => 
        i === index ? { ...s, scale: clampedScale } : s
      ));
    } 
    // Handle drag (one finger)
    else if (e.touches.length === 1) {
      const touch = e.touches[0];
      const rect = previewRef.current.getBoundingClientRect();
      const x = ((touch.clientX - rect.left) / rect.width) * 100;
      const y = ((touch.clientY - rect.top) / rect.height) * 100;
      setStickers(stickers.map((s, i) => 
        i === index ? { ...s, x: Math.max(5, Math.min(95, x)), y: Math.max(5, Math.min(95, y)) } : s
      ));
    }
  };

  const handleStickerTouchEnd = () => {
    setDraggedStickerIndex(null);
    setStickerPinchStart(null);
  };

  const handleNext = async (postToStory: boolean = false) => {
    if (!capturedMediaUrl) return;
    
    if (capturedMediaType === 'image') {
      try {
        const filterObj = selectedFilter !== 'None' ? FILTERS[filterCategory].find(f => f.name === selectedFilter) : null;
        
        // If has music, convert to video
        const hasMusic = selectedMusic !== null;
        let finalFile: File;
        let effects: any = {
          filter: filterObj?.filter,
          brightness,
          contrast,
          saturation,
          textOverlay,
          textPosition: textPosition.y,
          textSize,
          stickers,
          blur: blurAmount,
          drawingPaths,
          drawColor,
          drawSize,
        };

        // Add music metadata to effects
        if (hasMusic && selectedMusic) {
          effects.musicTitle = selectedMusic.name;
          effects.musicArtist = selectedMusic.artist;
          effects.musicUrl = selectedMusic.url;
        }
        
        if (hasMusic && selectedMusic) {
          // Convert image + music to video
          const processedBlob = await applyImageEffects(croppedImageUrl || capturedMediaUrl, effects);
          
          // Fetch the music file
          const musicResponse = await fetch(selectedMusic.url);
          const musicBlob = await musicResponse.blob();
          
          const videoBlob = await convertImageWithAudioToVideo(processedBlob, musicBlob);
          finalFile = new File([videoBlob], `video-${Date.now()}.mp4`, { type: 'video/mp4' });
          onCapture(finalFile, 'video', effects, postToStory);
        } else {
          // Regular image processing
          const processedBlob = await applyImageEffects(croppedImageUrl || capturedMediaUrl, effects);
          finalFile = new File([processedBlob], `photo-${Date.now()}.jpg`, { type: 'image/jpeg' });
          onCapture(finalFile, 'image', effects, postToStory);
        }
        
        handleClose();
      } catch (error) {
        toast({ title: 'Processing failed', variant: 'destructive' });
      }
    } else {
      const response = await fetch(capturedMediaUrl);
      const blob = await response.blob();
      const file = new File([blob], `video-${Date.now()}.webm`, { type: 'video/webm' });
      const effects = selectedMusic ? {
        musicTitle: selectedMusic.name,
        musicArtist: selectedMusic.artist,
        musicUrl: selectedMusic.url,
      } : undefined;
      onCapture(file, 'video', effects, postToStory);
      handleClose();
    }
  };

  const convertImageWithAudioToVideo = async (imageBlob: Blob, audioBlob: Blob): Promise<Blob> => {
    return new Promise(async (resolve, reject) => {
      try {
        const img = new Image();
        const imageUrl = URL.createObjectURL(imageBlob);
        
        img.onload = async () => {
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d');
          
          if (!ctx) {
            reject(new Error('Could not get canvas context'));
            return;
          }
          
          // Draw image
          ctx.drawImage(img, 0, 0);
          
          // Get audio duration
          const audioContext = new AudioContext();
          const audioArrayBuffer = await audioBlob.arrayBuffer();
          const audioBuffer = await audioContext.decodeAudioData(audioArrayBuffer);
          const duration = audioBuffer.duration * 1000; // Convert to ms
          
          // Create video stream from canvas
          const canvasStream = canvas.captureStream(30);
          
          // Create audio stream from blob
          const audioElement = new Audio(URL.createObjectURL(audioBlob));
          const audioDestination = audioContext.createMediaStreamDestination();
          const audioSource = audioContext.createMediaElementSource(audioElement);
          audioSource.connect(audioDestination);
          
          // Combine streams
          const combinedStream = new MediaStream([
            ...canvasStream.getVideoTracks(),
            ...audioDestination.stream.getAudioTracks()
          ]);
          
          // Record combined stream
          const mediaRecorder = new MediaRecorder(combinedStream, { mimeType: 'video/webm' });
          const chunks: Blob[] = [];
          
          mediaRecorder.ondataavailable = (e) => {
            if (e.data.size > 0) chunks.push(e.data);
          };
          
          mediaRecorder.onstop = () => {
            const videoBlob = new Blob(chunks, { type: 'video/webm' });
            audioElement.pause();
            resolve(videoBlob);
          };
          
          // Start recording
          mediaRecorder.start();
          audioElement.play();
          
          // Stop after audio duration
          setTimeout(() => {
            mediaRecorder.stop();
          }, duration);
        };
        
        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = imageUrl;
      } catch (error) {
        reject(error);
      }
    });
  };

  const handleVideoTrim = () => {
    if (!capturedMediaUrl || !capturedMediaType || capturedMediaType !== 'video') return;
    setShowVideoTrimmer(true);
    
    // Load video to get duration
    const video = document.createElement('video');
    video.src = capturedMediaUrl;
    video.onloadedmetadata = () => {
      setVideoDuration(video.duration);
      setVideoTrimEnd(video.duration);
    };
  };

  const handleClose = () => {
    setCapturedMediaUrl(null);
    setCapturedMediaType('image');
    setShowFiltersOverlay(false);
    setShowTextOverlay(false);
    setShowStickersOverlay(false);
    setShowDrawing(false);
    setShowBlur(false);
    setShowMusicLibrary(false);
    setShowPreCaptureFilters(false);
    setPreCaptureFilter('None');
    setZoom(1);
    setShowZoomControl(false);
    resetAllEdits();
    onClose();
  };

  return (
    <>
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-w-full h-screen p-0 bg-black z-[100]">
          <div className="relative w-full h-full flex items-center justify-center overflow-hidden z-[100]">
            {!capturedMediaUrl ? (
              // Camera View
              <>
                {/* Top Controls */}
                <div className="absolute top-0 left-0 right-0 z-[110] bg-gradient-to-b from-black/80 via-black/50 to-transparent pt-4 pb-6">
                  <div className="flex items-center justify-between px-4">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={handleClose}
                      className="text-white hover:bg-white/20 bg-black/60 backdrop-blur-md"
                    >
                      <X className="w-6 h-6 drop-shadow-lg" />
                    </Button>
                    
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={toggleFacingMode}
                      className="text-white hover:bg-white/20 bg-black/60 backdrop-blur-md"
                    >
                      <RefreshCw className="w-6 h-6 drop-shadow-lg" />
                    </Button>
                  </div>

                  {/* Aspect Ratio Selector - More Prominent */}
                  <div className="flex justify-center mt-4 gap-3 px-4">
                    {(['9:16', '1:1', '4:3', '16:9'] as const).map((ratio) => (
                      <button
                        key={ratio}
                        onClick={() => setAspectRatio(ratio)}
                        className={`px-5 py-2.5 rounded-full text-sm font-black transition-all shadow-lg ${
                          aspectRatio === ratio 
                            ? 'bg-white text-black scale-110' 
                            : 'bg-black/50 backdrop-blur-md text-white border-2 border-white/30 hover:bg-white/20 hover:scale-105'
                        }`}
                      >
                        {ratio}
                      </button>
                    ))}
                  </div>
                  
                  {/* Ratio Label */}
                  <div className="text-center mt-2">
                    <span className="text-white/80 text-xs font-medium drop-shadow-lg">
                      Screen Ratio: {aspectRatio}
                    </span>
                  </div>
                </div>

                {/* Camera Video */}
                <div className={`relative ${getAspectRatioClass()} w-full max-h-full bg-black`}>
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                    style={{ 
                      transform: `scale(${zoom})`,
                      filter: preCaptureFilter !== 'None' ? FILTERS[filterCategory].find(f => f.name === preCaptureFilter)?.filter || '' : ''
                    }}
                  />
                  
                  {/* Pre-Capture Filter Preview */}
                  {showPreCaptureFilters && (
                    <div className="absolute bottom-4 left-0 right-0 z-[115] px-4">
                      <div className="flex gap-3 pb-2 overflow-x-auto">
                        {FILTERS[filterCategory].map((filter) => (
                          <button
                            key={filter.name}
                            onClick={() => setPreCaptureFilter(filter.name)}
                            className="flex-shrink-0 flex flex-col items-center gap-2"
                          >
                            <div className={`w-16 h-16 rounded-xl border-2 bg-black/40 backdrop-blur-sm flex items-center justify-center ${
                              preCaptureFilter === filter.name ? 'border-white scale-110' : 'border-white/30'
                            }`}>
                              <span className="text-white text-2xl">🎨</span>
                            </div>
                            <span className="text-white text-xs font-medium drop-shadow-lg">{filter.name}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Zoom Control */}
                {showZoomControl && (
                  <div className="absolute left-8 top-1/2 -translate-y-1/2 z-[120]">
                    <div className="bg-black/80 backdrop-blur-xl rounded-full p-3 flex flex-col items-center space-y-2 border border-white/10">
                      <button
                        onClick={() => setZoom(Math.min(3, zoom + 0.2))}
                        className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-white hover:bg-white/30"
                      >
                        +
                      </button>
                      <div className="text-white text-xs font-bold">{zoom.toFixed(1)}x</div>
                      <button
                        onClick={() => setZoom(Math.max(1, zoom - 0.2))}
                        className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-white hover:bg-white/30"
                      >
                        -
                      </button>
                    </div>
                  </div>
                )}

                {/* Bottom Controls */}
                <div className="absolute bottom-0 left-0 right-0 z-[110] bg-gradient-to-t from-black/80 to-transparent p-6">
                  <div className="flex items-end justify-between px-4">
                    {/* Pre-Capture Filters Toggle */}
                    <button
                      onClick={() => setShowPreCaptureFilters(!showPreCaptureFilters)}
                      className={`w-14 h-14 rounded-full flex items-center justify-center transition-all backdrop-blur-md border ${
                        showPreCaptureFilters ? 'bg-white text-black border-white shadow-2xl' : 'bg-black/60 text-white hover:bg-black/80 border-white/10'
                      }`}
                    >
                      <Wand2 className="w-6 h-6" />
                    </button>

                    {/* Center: Mode Selector & Shutter with Gallery */}
                    <div className="flex flex-col items-center gap-3">
                      <div className="flex gap-2 bg-black/60 backdrop-blur-md rounded-full px-3 py-1.5 border border-white/10">
                        <button
                          onClick={() => setMode('photo')}
                          className={`px-6 py-2 rounded-full text-sm font-bold transition-all ${
                            mode === 'photo' ? 'bg-white text-black shadow-xl' : 'text-white hover:bg-white/20'
                          }`}
                        >
                          PHOTO
                        </button>
                        <button
                          onClick={() => setMode('video')}
                          className={`px-6 py-2 rounded-full text-sm font-bold transition-all ${
                            mode === 'video' ? 'bg-white text-black shadow-xl' : 'text-white hover:bg-white/20'
                          }`}
                        >
                          VIDEO
                        </button>
                        <button
                          onClick={() => {
                            setMode('text');
                            if (onTextPost) {
                              stopCamera();
                              onTextPost();
                            }
                          }}
                          className={`px-6 py-2 rounded-full text-sm font-bold transition-all ${
                            mode === 'text' ? 'bg-white text-black shadow-xl' : 'text-white hover:bg-white/20'
                          }`}
                        >
                          TEXT
                        </button>
                      </div>

                      {/* Shutter and Gallery Row */}
                      <div className="flex items-center gap-4">
                        {/* Shutter Button */}
                        <button
                          onClick={mode === 'photo' ? capturePhoto : isRecording ? stopRecording : startRecording}
                          className={`w-20 h-20 rounded-full flex items-center justify-center transition-all hover:scale-110 active:scale-95 ${
                            isRecording 
                              ? 'bg-red-500 border-4 border-white' 
                              : 'bg-white border-4 border-white'
                          }`}
                        >
                          {mode === 'photo' ? (
                            <Circle className="w-16 h-16 text-black" strokeWidth={3} />
                          ) : isRecording ? (
                            <Square className="w-8 h-8 fill-white" />
                          ) : (
                            <Circle className="w-16 h-16 fill-red-500 text-red-500" />
                          )}
                        </button>

                        {/* Gallery Quick Access with Thumbnail */}
                        <button
                          onClick={handleGalleryClick}
                          className="w-16 h-16 rounded-xl flex items-center justify-center border-2 border-white/50 hover:border-white hover:scale-105 transition-all backdrop-blur-md bg-black/40 shadow-lg"
                        >
                          <ImageIcon className="w-7 h-7 text-white" />
                        </button>
                      </div>
                    </div>

                    {/* Spacer to balance layout */}
                    <div className="w-14"></div>
                  </div>
                </div>
              </>
            ) : (
              // Preview & Edit View with Transparent Overlays
              <>
                {/* Top Controls - Keep Aspect Ratio Visible */}
                <div className="absolute top-0 left-0 right-0 z-[110] bg-gradient-to-b from-black/80 via-black/50 to-transparent pt-4 pb-6">
                  <div className="flex items-center justify-between px-4">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => {
                        setCapturedMediaUrl(null);
                        startCamera();
                      }}
                      className="text-white hover:bg-white/20 bg-black/60 backdrop-blur-md"
                    >
                      <X className="w-6 h-6 drop-shadow-lg" />
                    </Button>
                    
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={resetAllEdits}
                      className="text-white hover:bg-white/20 bg-black/60 backdrop-blur-md"
                    >
                      <RotateCcw className="w-5 h-5 mr-2 drop-shadow-lg" />
                      Reset
                    </Button>
                  </div>

                  {/* Show Selected Aspect Ratio */}
                  <div className="text-center mt-3">
                    <div className="inline-flex items-center gap-2 bg-black/50 backdrop-blur-md px-4 py-2 rounded-full border-2 border-white/30">
                      <span className="text-white/80 text-xs font-medium">Ratio:</span>
                      <span className="text-white text-sm font-black">{aspectRatio}</span>
                    </div>
                  </div>
                </div>

                {/* Right-side Tool Icons */}
                <div className="absolute right-4 top-1/2 -translate-y-1/2 z-[110] flex flex-col gap-4">
                  <button
                    onClick={() => {
                      setShowFiltersOverlay(!showFiltersOverlay);
                      setShowTextOverlay(false);
                      setShowStickersOverlay(false);
                    }}
                    className={`w-14 h-14 rounded-full backdrop-blur-md shadow-xl flex items-center justify-center transition-all border-2 ${
                      showFiltersOverlay ? 'bg-white text-black border-white scale-110' : 'bg-black/60 text-white hover:bg-black/80 border-white/10'
                    }`}
                  >
                    <Wand2 className="w-6 h-6 drop-shadow-lg" />
                  </button>
                  <button
                    onClick={() => {
                      setShowTextOverlay(!showTextOverlay);
                      setShowFiltersOverlay(false);
                      setShowStickersOverlay(false);
                    }}
                    className={`w-14 h-14 rounded-full backdrop-blur-md shadow-xl flex items-center justify-center transition-all border-2 ${
                      showTextOverlay ? 'bg-white text-black border-white scale-110' : 'bg-black/60 text-white hover:bg-black/80 border-white/10'
                    }`}
                  >
                    <Type className="w-6 h-6 drop-shadow-lg" />
                  </button>
                  <button
                    onClick={() => {
                      setShowStickersOverlay(!showStickersOverlay);
                      setShowFiltersOverlay(false);
                      setShowTextOverlay(false);
                    }}
                    className={`w-14 h-14 rounded-full backdrop-blur-md shadow-xl flex items-center justify-center transition-all border-2 ${
                      showStickersOverlay ? 'bg-white text-black border-white scale-110' : 'bg-black/60 text-white hover:bg-black/80 border-white/10'
                    }`}
                  >
                    <StickerIcon className="w-6 h-6 drop-shadow-lg" />
                  </button>
                  <button
                    onClick={() => {
                      if (capturedMediaType === 'video') {
                        handleVideoTrim();
                        setShowFiltersOverlay(false);
                        setShowTextOverlay(false);
                        setShowStickersOverlay(false);
                        setShowDrawing(false);
                        setShowBlur(false);
                        setShowCropper(false);
                      } else {
                        setShowCropper(true);
                        setShowFiltersOverlay(false);
                        setShowTextOverlay(false);
                        setShowStickersOverlay(false);
                        setShowDrawing(false);
                        setShowBlur(false);
                      }
                    }}
                    className={`w-14 h-14 rounded-full backdrop-blur-md shadow-xl flex items-center justify-center transition-all border-2 ${
                      (capturedMediaType === 'video' ? showVideoTrimmer : showCropper) ? 'bg-white text-black border-white scale-110' : 'bg-black/60 text-white hover:bg-black/80 border-white/10'
                    }`}
                  >
                    <Crop className="w-6 h-6 drop-shadow-lg" />
                  </button>
                  {capturedMediaType === 'image' && (
                    <>
                      <button
                        onClick={() => {
                        setShowDrawing(!showDrawing);
                        setShowFiltersOverlay(false);
                        setShowTextOverlay(false);
                        setShowStickersOverlay(false);
                        setShowBlur(false);
                      }}
                        className={`w-14 h-14 rounded-full backdrop-blur-md shadow-xl flex items-center justify-center transition-all border-2 ${
                          showDrawing ? 'bg-white text-black border-white scale-110' : 'bg-black/60 text-white hover:bg-black/80 border-white/10'
                        }`}
                      >
                        <Pencil className="w-6 h-6 drop-shadow-lg" />
                      </button>
                      <button
                        onClick={() => {
                        setShowBlur(!showBlur);
                        setShowFiltersOverlay(false);
                        setShowTextOverlay(false);
                        setShowStickersOverlay(false);
                        setShowDrawing(false);
                      }}
                        className={`w-14 h-14 rounded-full backdrop-blur-md shadow-xl flex items-center justify-center transition-all border-2 ${
                          showBlur ? 'bg-white text-black border-white scale-110' : 'bg-black/60 text-white hover:bg-black/80 border-white/10'
                        }`}
                      >
                        <Droplet className="w-6 h-6 drop-shadow-lg" />
                      </button>
                    </>
                  )}
                  
                  {/* Music Library - Available for both image and video */}
                  <button
                    onClick={() => setShowMusicLibrary(true)}
                    className={`w-14 h-14 rounded-full backdrop-blur-md shadow-xl flex items-center justify-center transition-all border-2 ${
                      selectedMusic ? 'bg-gradient-primary text-white border-white scale-110' : 'bg-black/60 text-white hover:bg-black/80 border-white/10'
                    }`}
                  >
                    <Music className="w-6 h-6 drop-shadow-lg" />
                  </button>
                  
                  {/* Video Speed Controls - Only for videos */}
                  {capturedMediaType === 'video' && (
                    <button
                      onClick={() => {
                        const speeds = [0.5, 1, 1.5, 2];
                        const currentIndex = speeds.indexOf(videoPlaybackSpeed);
                        const nextSpeed = speeds[(currentIndex + 1) % speeds.length];
                        setVideoPlaybackSpeed(nextSpeed);
                        toast({
                          title: 'Playback speed',
                          description: `${nextSpeed}x speed`,
                        });
                      }}
                      className="w-14 h-14 rounded-full backdrop-blur-md shadow-xl flex items-center justify-center transition-all border-2 bg-black/60 text-white hover:bg-black/80 border-white/10"
                    >
                      <div className="flex flex-col items-center">
                        <Gauge className="w-5 h-5 drop-shadow-lg" />
                        <span className="text-[10px] font-bold drop-shadow-lg">{videoPlaybackSpeed}x</span>
                      </div>
                    </button>
                  )}
                </div>

                {/* Media Preview - Maintains Selected Aspect Ratio */}
                <div 
                  ref={previewRef}
                  className={`relative ${getAspectRatioClass()} w-full max-h-full bg-black touch-none overflow-hidden`}
                >
                  {capturedMediaType === 'image' ? (
                    <img 
                      src={croppedImageUrl || capturedMediaUrl} 
                      alt="Preview" 
                      className="w-full h-full object-cover" 
                      style={getFilterStyle()} 
                    />
                  ) : (
                    <video 
                      src={capturedMediaUrl} 
                      className="w-full h-full object-cover" 
                      style={getFilterStyle()} 
                      controls 
                    />
                  )}

                  {/* Text Overlay - Draggable */}
                  {textOverlay && (
                    <div 
                      className="absolute cursor-move pointer-events-auto"
                      style={{
                        left: `${textPosition.x}%`,
                        top: `${textPosition.y}%`,
                        transform: 'translate(-50%, -50%)',
                        touchAction: 'none',
                        zIndex: isDraggingText ? 50 : 10,
                      }}
                      onTouchStart={(e) => {
                        const touch = e.touches[0];
                        const rect = previewRef.current?.getBoundingClientRect();
                        if (!rect) return;
                        setIsDraggingText(true);
                        setDragTextStart({
                          x: (touch.clientX - rect.left) / rect.width * 100 - textPosition.x,
                          y: (touch.clientY - rect.top) / rect.height * 100 - textPosition.y,
                        });
                      }}
                      onTouchMove={(e) => {
                        if (!isDraggingText || !dragTextStart) return;
                        const touch = e.touches[0];
                        const rect = previewRef.current?.getBoundingClientRect();
                        if (!rect) return;
                        const newX = Math.max(10, Math.min(90, (touch.clientX - rect.left) / rect.width * 100 - dragTextStart.x));
                        const newY = Math.max(10, Math.min(90, (touch.clientY - rect.top) / rect.height * 100 - dragTextStart.y));
                        setTextPosition({ x: newX, y: newY });
                      }}
                      onTouchEnd={() => {
                        setIsDraggingText(false);
                        setDragTextStart(null);
                      }}
                    >
                      <p 
                        className="text-white font-bold drop-shadow-[0_4px_8px_rgba(0,0,0,0.9)] text-center px-6 py-3 bg-black/40 rounded-xl backdrop-blur-sm"
                        style={{ fontSize: `${textSize}px`, textShadow: '2px 2px 4px rgba(0,0,0,0.8)' }}
                      >
                        {textOverlay}
                      </p>
                    </div>
                  )}
                  
                  {/* Stickers */}
                  {stickers.map((sticker, index) => (
                    <div
                      key={index}
                      className="absolute pointer-events-auto cursor-move"
                      style={{
                        left: `${sticker.x}%`,
                        top: `${sticker.y}%`,
                        transform: `translate(-50%, -50%) scale(${sticker.scale})`,
                        touchAction: 'none',
                        zIndex: draggedStickerIndex === index ? 50 : 10,
                      }}
                      onTouchStart={(e) => {
                        handleStickerTouchStart(e, index);
                      }}
                      onTouchMove={(e) => {
                        handleStickerTouchMove(e, index);
                      }}
                      onTouchEnd={handleStickerTouchEnd}
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        setDraggedStickerIndex(index);
                      }}
                      onMouseMove={(e) => {
                        if (!previewRef.current || draggedStickerIndex !== index || e.buttons !== 1) return;
                        e.preventDefault();
                        const rect = previewRef.current.getBoundingClientRect();
                        const x = ((e.clientX - rect.left) / rect.width) * 100;
                        const y = ((e.clientY - rect.top) / rect.height) * 100;
                        setStickers(stickers.map((s, i) => 
                          i === index ? { ...s, x: Math.max(5, Math.min(95, x)), y: Math.max(5, Math.min(95, y)) } : s
                        ));
                      }}
                      onMouseUp={handleStickerTouchEnd}
                    >
                      <div className="relative">
                        <span className="text-6xl drop-shadow-[0_4px_12px_rgba(0,0,0,0.6)] select-none pointer-events-none">
                          {sticker.emoji}
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            removeSticker(index);
                          }}
                          className="absolute -top-2 -right-2 w-7 h-7 bg-red-500 rounded-full flex items-center justify-center shadow-lg hover:bg-red-600 transition-colors"
                        >
                          <X className="w-4 h-4 text-white" />
                        </button>
                      </div>
                    </div>
                  ))}
                  
                  {/* Drawing Canvas - Always visible to show paths, interactive only when drawing mode */}
                  <svg 
                    className="absolute inset-0 w-full h-full"
                    style={{ 
                      touchAction: showDrawing ? 'none' : 'auto',
                      pointerEvents: showDrawing ? 'auto' : 'none',
                      zIndex: 15
                    }}
                    onTouchStart={(e) => {
                      if (!showDrawing || !previewRef.current) return;
                      e.preventDefault();
                      const touch = e.touches[0];
                      const rect = previewRef.current.getBoundingClientRect();
                      const x = ((touch.clientX - rect.left) / rect.width) * 100;
                      const y = ((touch.clientY - rect.top) / rect.height) * 100;
                      setCurrentPath([{ x, y }]);
                      setIsDrawing(true);
                    }}
                    onTouchMove={(e) => {
                      if (!showDrawing || !isDrawing || !previewRef.current) return;
                      e.preventDefault();
                      const touch = e.touches[0];
                      const rect = previewRef.current.getBoundingClientRect();
                      const x = ((touch.clientX - rect.left) / rect.width) * 100;
                      const y = ((touch.clientY - rect.top) / rect.height) * 100;
                      setCurrentPath([...currentPath, { x, y }]);
                    }}
                    onTouchEnd={() => {
                      if (showDrawing && isDrawing && currentPath.length > 0) {
                        setDrawingPaths([...drawingPaths, currentPath]);
                        setCurrentPath([]);
                        setIsDrawing(false);
                      }
                    }}
                  >
                    {/* Render completed paths - always visible */}
                    {drawingPaths.map((path, pathIndex) => (
                      <polyline
                        key={pathIndex}
                        points={path.map(p => `${p.x},${p.y}`).join(' ')}
                        fill="none"
                        stroke={drawColor}
                        strokeWidth={drawSize / 2}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    ))}
                    {/* Render current path being drawn */}
                    {currentPath.length > 0 && (
                      <polyline
                        points={currentPath.map(p => `${p.x},${p.y}`).join(' ')}
                        fill="none"
                        stroke={drawColor}
                        strokeWidth={drawSize / 2}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    )}
                  </svg>
                </div>

                {/* Filters Overlay - Bottom Transparent */}
                {showFiltersOverlay && (
                  <div className="absolute bottom-24 left-4 right-20 z-[120] bg-black/40 backdrop-blur-md rounded-2xl p-4 shadow-2xl border border-white/20 max-h-[45vh] overflow-y-auto">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-white font-bold text-sm drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">Filters</h3>
                      <button onClick={() => setShowFiltersOverlay(false)} className="text-white/80 hover:text-white">
                        <X className="w-5 h-5 drop-shadow-lg" />
                      </button>
                    </div>
                    
                    {/* Filter Categories */}
                    <div className="flex gap-2 mb-3 overflow-x-auto">
                      {(Object.keys(FILTERS) as Array<keyof typeof FILTERS>).map((cat) => (
                        <button
                          key={cat}
                          onClick={() => setFilterCategory(cat)}
                          className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all drop-shadow-lg ${
                            filterCategory === cat ? 'bg-white text-black' : 'bg-white/30 text-white hover:bg-white/40'
                          }`}
                        >
                          {cat === 'hotVibes' ? 'Hot' : cat === 'everyday' ? 'Daily' : cat === 'culinary' ? 'Food' : 'Fit'}
                        </button>
                      ))}
                    </div>

                    {/* Filter Options */}
                    <div className="space-y-2">
                      {FILTERS[filterCategory].map((filter) => (
                        <button
                          key={filter.name}
                          onClick={() => setSelectedFilter(filter.name)}
                          className={`w-full px-4 py-2.5 rounded-xl text-sm font-medium transition-all text-left flex items-center justify-between drop-shadow-lg ${
                            selectedFilter === filter.name 
                              ? 'bg-white text-black' 
                              : 'bg-white/20 text-white hover:bg-white/30'
                          }`}
                        >
                          {filter.name}
                          {selectedFilter === filter.name && <Check className="w-4 h-4" />}
                        </button>
                      ))}
                    </div>

                    {/* Adjustment Sliders */}
                    <div className="space-y-3 mt-4 pt-4 border-t border-white/20">
                      <div className="space-y-1.5">
                        <label className="text-white text-xs font-medium drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">Brightness</label>
                        <Slider 
                          value={[brightness]} 
                          onValueChange={([v]) => setBrightness(v)} 
                          min={50} 
                          max={150} 
                          className="[&_[role=slider]]:bg-white [&_[role=slider]]:border-2 [&_[role=slider]]:border-black"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-white text-xs font-medium drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">Contrast</label>
                        <Slider 
                          value={[contrast]} 
                          onValueChange={([v]) => setContrast(v)} 
                          min={50} 
                          max={150}
                          className="[&_[role=slider]]:bg-white [&_[role=slider]]:border-2 [&_[role=slider]]:border-black"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-white text-xs font-medium drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">Saturation</label>
                        <Slider 
                          value={[saturation]} 
                          onValueChange={([v]) => setSaturation(v)} 
                          min={0} 
                          max={200}
                          className="[&_[role=slider]]:bg-white [&_[role=slider]]:border-2 [&_[role=slider]]:border-black"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Text Overlay Control - Bottom Transparent */}
                {showTextOverlay && (
                  <div className="absolute bottom-24 left-4 right-20 z-[120] bg-black/40 backdrop-blur-md rounded-2xl p-4 shadow-2xl border border-white/20 max-h-[45vh] overflow-y-auto">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-white font-bold text-sm drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">Text Overlay</h3>
                      <button onClick={() => setShowTextOverlay(false)} className="text-white/80 hover:text-white">
                        <X className="w-5 h-5 drop-shadow-lg" />
                      </button>
                    </div>
                    
                    <div className="space-y-3">
                      <Input
                        placeholder="Add text..."
                        value={textOverlay}
                        onChange={(e) => setTextOverlay(e.target.value)}
                        className="bg-white/20 border-white/30 text-white placeholder:text-white/60 drop-shadow-lg"
                      />
                      
                      <div className="space-y-1.5">
                        <label className="text-white text-xs font-medium drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">Size: {textSize}px</label>
                        <Slider 
                          value={[textSize]} 
                          onValueChange={([v]) => setTextSize(v)} 
                          min={20} 
                          max={100}
                          className="[&_[role=slider]]:bg-white [&_[role=slider]]:border-2 [&_[role=slider]]:border-black"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Stickers Overlay - Bottom Transparent */}
                {showStickersOverlay && (
                  <div className="absolute bottom-24 left-4 right-20 z-[120] bg-black/40 backdrop-blur-md rounded-2xl p-4 shadow-2xl border border-white/20 max-h-[45vh] overflow-y-auto">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-white font-bold text-sm drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">Stickers</h3>
                      <button onClick={() => setShowStickersOverlay(false)} className="text-white/80 hover:text-white">
                        <X className="w-5 h-5 drop-shadow-lg" />
                      </button>
                    </div>
                    <p className="text-white/80 text-xs mb-3 drop-shadow-lg">Tap to add, drag to move</p>
                    
                    <div className="grid grid-cols-4 gap-2">
                      {STICKERS.map((emoji) => (
                        <button
                          key={emoji}
                          onClick={() => addSticker(emoji)}
                          className="text-4xl hover:scale-110 transition-transform p-2 bg-white/20 rounded-xl hover:bg-white/30 drop-shadow-lg"
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Drawing Overlay - Bottom Transparent */}
                {showDrawing && (
                  <div className="absolute bottom-24 left-4 right-20 z-[120] bg-black/40 backdrop-blur-md rounded-2xl p-4 shadow-2xl border border-white/20 max-h-[45vh] overflow-y-auto">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-white font-bold text-sm drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">Draw</h3>
                      <button onClick={() => setShowDrawing(false)} className="text-white/80 hover:text-white">
                        <X className="w-5 h-5 drop-shadow-lg" />
                      </button>
                    </div>
                    
                    <div className="space-y-3">
                      <div className="space-y-1.5">
                        <label className="text-white text-xs font-medium drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">Color</label>
                        <div className="flex gap-2">
                          {['#ffffff', '#000000', '#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff'].map((color) => (
                            <button
                              key={color}
                              onClick={() => setDrawColor(color)}
                              className={`w-10 h-10 rounded-full border-2 transition-all ${
                                drawColor === color ? 'border-white scale-110' : 'border-white/30'
                              }`}
                              style={{ backgroundColor: color }}
                            />
                          ))}
                        </div>
                      </div>
                      
                      <div className="space-y-1.5">
                        <label className="text-white text-xs font-medium drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">Size: {drawSize}px</label>
                        <Slider 
                          value={[drawSize]} 
                          onValueChange={([v]) => setDrawSize(v)} 
                          min={1} 
                          max={20}
                          className="[&_[role=slider]]:bg-white [&_[role=slider]]:border-2 [&_[role=slider]]:border-black"
                        />
                      </div>

                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setDrawingPaths([]);
                            setCurrentPath([]);
                          }}
                          className="flex-1 bg-white/20 border-white/30 text-white hover:bg-white/30 drop-shadow-lg"
                        >
                          Clear All
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            if (drawingPaths.length > 0) {
                              setDrawingPaths(drawingPaths.slice(0, -1));
                            }
                          }}
                          className="flex-1 bg-white/20 border-white/30 text-white hover:bg-white/30 drop-shadow-lg"
                        >
                          Undo
                        </Button>
                      </div>

                      <p className="text-white/70 text-xs drop-shadow-lg">Touch and drag on the image to draw</p>
                    </div>
                  </div>
                )}

                {/* Blur Overlay - Bottom Transparent */}
                {showBlur && (
                  <div className="absolute bottom-24 left-4 right-20 z-[120] bg-black/40 backdrop-blur-md rounded-2xl p-4 shadow-2xl border border-white/20">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-white font-bold text-sm drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">Blur</h3>
                      <button onClick={() => setShowBlur(false)} className="text-white/80 hover:text-white">
                        <X className="w-5 h-5 drop-shadow-lg" />
                      </button>
                    </div>
                    
                    <div className="space-y-3">
                      <div className="space-y-1.5">
                        <label className="text-white text-xs font-medium drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">Blur Amount: {blurAmount}px</label>
                        <Slider 
                          value={[blurAmount]} 
                          onValueChange={([v]) => setBlurAmount(v)} 
                          min={0} 
                          max={20}
                          className="[&_[role=slider]]:bg-white [&_[role=slider]]:border-2 [&_[role=slider]]:border-black"
                        />
                      </div>

                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setBlurAmount(0)}
                        className="w-full bg-white/20 border-white/30 text-white hover:bg-white/30 drop-shadow-lg"
                      >
                        Remove Blur
                      </Button>
                    </div>
                  </div>
                )}

                {/* Video Trimmer */}
                {showVideoTrimmer && capturedMediaUrl && capturedMediaType === 'video' && (
                  <div className="absolute bottom-24 left-4 right-20 bg-black/40 backdrop-blur-sm rounded-2xl p-4 space-y-3 max-h-[45vh] overflow-y-auto z-[120]">
                    <div className="flex items-center justify-between text-white mb-2">
                      <span className="text-sm font-semibold drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">Trim Video</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setShowVideoTrimmer(false)}
                        className="h-6 w-6 text-white/70 hover:text-white hover:bg-white/10"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>

                    <div className="space-y-2">
                      <video
                        ref={trimVideoRef}
                        src={capturedMediaUrl}
                        className="w-full rounded-lg"
                        controls
                      />
                      
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-white text-xs">
                          <span>Start: {videoTrimStart.toFixed(1)}s</span>
                          <span>End: {videoTrimEnd.toFixed(1)}s</span>
                          <span>Duration: {(videoTrimEnd - videoTrimStart).toFixed(1)}s</span>
                        </div>
                        
                        <div className="space-y-1">
                          <label className="text-white text-xs font-medium drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">Start Point</label>
                          <Slider
                            value={[videoTrimStart]}
                            onValueChange={([value]) => setVideoTrimStart(Math.min(value, videoTrimEnd - 0.1))}
                            max={videoDuration}
                            step={0.1}
                            className="w-full [&_[role=slider]]:bg-white [&_[role=slider]]:border-2 [&_[role=slider]]:border-black"
                          />
                        </div>
                        
                        <div className="space-y-1">
                          <label className="text-white text-xs font-medium drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">End Point</label>
                          <Slider
                            value={[videoTrimEnd]}
                            onValueChange={([value]) => setVideoTrimEnd(Math.max(value, videoTrimStart + 0.1))}
                            max={videoDuration}
                            step={0.1}
                            className="w-full [&_[role=slider]]:bg-white [&_[role=slider]]:border-2 [&_[role=slider]]:border-black"
                          />
                        </div>
                      </div>

                      <Button
                        onClick={() => {
                          if (trimVideoRef.current) {
                            trimVideoRef.current.currentTime = videoTrimStart;
                            trimVideoRef.current.play();
                            setTimeout(() => {
                              trimVideoRef.current?.pause();
                            }, (videoTrimEnd - videoTrimStart) * 1000);
                          }
                        }}
                        className="w-full bg-white/10 hover:bg-white/20 text-white drop-shadow-lg"
                      >
                        Preview Trim
                      </Button>
                    </div>
                  </div>
                )}

                {/* Post/Story Buttons - Positioned higher to not hide video controls */}
                <div className="absolute bottom-20 left-1/2 -translate-x-1/2 z-[130] flex gap-3">
                  <Button
                    size="lg"
                    onClick={() => handleNext(true)}
                    variant="outline"
                    className="bg-black/60 backdrop-blur-md text-white hover:bg-black/80 rounded-full px-8 py-7 text-base font-bold shadow-2xl border-2 border-white/30"
                  >
                    Story
                  </Button>
                  <Button
                    size="lg"
                    onClick={() => handleNext(false)}
                    className="bg-gradient-to-r from-blue-500 to-purple-600 text-white hover:opacity-90 rounded-full px-12 py-7 text-lg font-bold shadow-2xl border-2 border-white/20"
                  >
                    Next
                    <ArrowRight className="w-6 h-6 ml-2" />
                  </Button>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Image Cropper (Full Screen) */}
      {showCropper && capturedMediaUrl && (
        <ImageCropper 
          imageUrl={croppedImageUrl || capturedMediaUrl} 
          onCropComplete={(url) => { 
            setCroppedImageUrl(url); 
            setShowCropper(false); 
          }} 
          onClose={() => setShowCropper(false)} 
        />
      )}
      
      {/* Music Library */}
      <MusicLibrary
        open={showMusicLibrary}
        onClose={() => setShowMusicLibrary(false)}
        onSelectMusic={(music) => {
          setSelectedMusic(music);
          toast({
            title: 'Music added',
            description: `${music.name} by ${music.artist}`,
          });
        }}
      />
    </>
  );
}
