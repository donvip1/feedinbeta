import { useState, useRef, useEffect } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { X, RotateCw, Circle, Square, Wand2, Type, Sticker as StickerIcon, Mic, RotateCcw, ArrowRight, Scissors, ZoomIn, RefreshCw, Check } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { VoiceOverRecorder } from './VoiceOverRecorder';
import { ImageCropper } from './ImageCropper';
import { applyImageEffects } from '@/lib/media-processor';

interface CameraCaptureProps {
  open: boolean;
  onClose: () => void;
  onCapture: (file: File, mediaType: 'image' | 'video', effects?: any) => void;
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

export function CameraCapture({ open, onClose, onCapture }: CameraCaptureProps) {
  const { toast } = useToast();
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  
  // Camera states
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [mode, setMode] = useState<'photo' | 'video'>('photo');
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
  const [textPosition, setTextPosition] = useState(50);
  const [textSize, setTextSize] = useState(48);
  const [stickers, setStickers] = useState<StickerData[]>([]);
  const [voiceOverBlob, setVoiceOverBlob] = useState<Blob | null>(null);
  const [croppedImageUrl, setCroppedImageUrl] = useState<string>('');
  
  // UI overlay states - all can be open at once
  const [showFiltersOverlay, setShowFiltersOverlay] = useState(false);
  const [showTextOverlay, setShowTextOverlay] = useState(false);
  const [showStickersOverlay, setShowStickersOverlay] = useState(false);
  const [showVoiceoverOverlay, setShowVoiceoverOverlay] = useState(false);
  const [showCropper, setShowCropper] = useState(false);
  const [draggedStickerIndex, setDraggedStickerIndex] = useState<number | null>(null);

  useEffect(() => {
    if (open) {
      startCamera();
    } else {
      stopCamera();
    }
    return () => stopCamera();
  }, [open, facingMode]);

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

    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(videoRef.current, 0, 0);
    canvas.toBlob((blob) => {
      if (blob) {
        const url = URL.createObjectURL(blob);
        setCapturedMediaUrl(url);
        setCapturedMediaType('image');
        setCroppedImageUrl(url);
        stopCamera();
      }
    }, 'image/jpeg');
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
    setTextPosition(50);
    setTextSize(48);
    setStickers([]);
    setVoiceOverBlob(null);
    setCroppedImageUrl(capturedMediaUrl || '');
  };

  const getFilterStyle = () => {
    const filterObj = selectedFilter !== 'None' ? FILTERS[filterCategory].find(f => f.name === selectedFilter) : null;
    return {
      filter: `${filterObj?.filter || ''} brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%)`,
    };
  };

  const getTextPositionStyle = () => {
    return {
      top: `${textPosition}%`,
      transform: 'translateY(-50%)',
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
    setDraggedStickerIndex(index);
  };

  const handleStickerTouchMove = (e: React.TouchEvent) => {
    if (draggedStickerIndex === null || !previewRef.current) return;
    e.preventDefault();
    
    const touch = e.touches[0];
    const rect = previewRef.current.getBoundingClientRect();
    const x = ((touch.clientX - rect.left) / rect.width) * 100;
    const y = ((touch.clientY - rect.top) / rect.height) * 100;
    
    setStickers(stickers.map((sticker, i) => 
      i === draggedStickerIndex ? { ...sticker, x: Math.max(0, Math.min(95, x)), y: Math.max(0, Math.min(95, y)) } : sticker
    ));
  };

  const handleStickerTouchEnd = () => {
    setDraggedStickerIndex(null);
  };

  const handleNext = async () => {
    if (!capturedMediaUrl) return;
    
    if (capturedMediaType === 'image') {
      try {
        const filterObj = selectedFilter !== 'None' ? FILTERS[filterCategory].find(f => f.name === selectedFilter) : null;
        const processedBlob = await applyImageEffects(croppedImageUrl, {
          filter: filterObj?.filter,
          brightness,
          contrast,
          saturation,
          textOverlay,
          textPosition,
          textSize,
          stickers,
        });
        const file = new File([processedBlob], `photo-${Date.now()}.jpg`, { type: 'image/jpeg' });
        onCapture(file, 'image', { voiceOverBlob });
        handleClose();
      } catch (error) {
        toast({ title: 'Processing failed', variant: 'destructive' });
      }
    } else {
      const response = await fetch(capturedMediaUrl);
      const blob = await response.blob();
      const file = new File([blob], `video-${Date.now()}.webm`, { type: 'video/webm' });
      onCapture(file, 'video', { voiceOverBlob });
      handleClose();
    }
  };

  const handleClose = () => {
    setCapturedMediaUrl(null);
    setCapturedMediaType('image');
    setShowFiltersOverlay(false);
    setShowTextOverlay(false);
    setShowStickersOverlay(false);
    setShowVoiceoverOverlay(false);
    setZoom(1);
    setShowZoomControl(false);
    resetAllEdits();
    onClose();
  };

  return (
    <>
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-w-full h-screen p-0 bg-black">
          <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
            {!capturedMediaUrl ? (
              // Camera View
              <>
                {/* Top Controls */}
                <div className="absolute top-0 left-0 right-0 z-30 bg-gradient-to-b from-black/80 via-black/50 to-transparent pt-4 pb-6">
                  <div className="flex items-center justify-between px-4">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={handleClose}
                      className="text-white hover:bg-white/20 bg-black/40 backdrop-blur-sm"
                    >
                      <X className="w-6 h-6 drop-shadow-lg" />
                    </Button>
                    
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={toggleFacingMode}
                      className="text-white hover:bg-white/20 bg-black/40 backdrop-blur-sm"
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
                    style={{ transform: `scale(${zoom})` }}
                  />
                </div>

                {/* Zoom Control */}
                {showZoomControl && (
                  <div className="absolute left-8 top-1/2 -translate-y-1/2 z-30">
                    <div className="bg-black/60 backdrop-blur-md rounded-full p-3 flex flex-col items-center space-y-2">
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
                <div className="absolute bottom-0 left-0 right-0 z-30 bg-gradient-to-t from-black/80 to-transparent p-6">
                  <div className="flex items-center justify-around">
                    {/* Zoom Toggle */}
                    <button
                      onClick={() => setShowZoomControl(!showZoomControl)}
                      className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${
                        showZoomControl ? 'bg-white text-black' : 'bg-white/20 text-white hover:bg-white/30'
                      }`}
                    >
                      <ZoomIn className="w-6 h-6" />
                    </button>

                    {/* Mode Selector */}
                    <div className="flex flex-col items-center gap-3">
                      <div className="flex gap-2 bg-black/50 rounded-full px-3 py-1.5">
                        <button
                          onClick={() => setMode('photo')}
                          className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${
                            mode === 'photo' ? 'bg-white text-black' : 'text-white hover:bg-white/20'
                          }`}
                        >
                          PHOTO
                        </button>
                        <button
                          onClick={() => setMode('video')}
                          className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${
                            mode === 'video' ? 'bg-white text-black' : 'text-white hover:bg-white/20'
                          }`}
                        >
                          VIDEO
                        </button>
                      </div>

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
                    </div>

                    {/* Placeholder for alignment */}
                    <div className="w-14"></div>
                  </div>
                </div>
              </>
            ) : (
              // Preview & Edit View with Transparent Overlays
              <>
                {/* Top Controls - Keep Aspect Ratio Visible */}
                <div className="absolute top-0 left-0 right-0 z-40 bg-gradient-to-b from-black/80 via-black/50 to-transparent pt-4 pb-6">
                  <div className="flex items-center justify-between px-4">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => {
                        setCapturedMediaUrl(null);
                        startCamera();
                      }}
                      className="text-white hover:bg-white/20 bg-black/40 backdrop-blur-sm"
                    >
                      <X className="w-6 h-6 drop-shadow-lg" />
                    </Button>
                    
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={resetAllEdits}
                      className="text-white hover:bg-white/20 bg-black/40 backdrop-blur-sm"
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
                <div className="absolute right-4 top-1/2 -translate-y-1/2 z-40 flex flex-col gap-4">
                  <button
                    onClick={() => setShowFiltersOverlay(!showFiltersOverlay)}
                    className={`w-14 h-14 rounded-full backdrop-blur-md shadow-xl flex items-center justify-center transition-all ${
                      showFiltersOverlay ? 'bg-white text-black' : 'bg-white/20 text-white hover:bg-white/30'
                    }`}
                  >
                    <Wand2 className="w-6 h-6 drop-shadow-lg" />
                  </button>
                  <button
                    onClick={() => setShowTextOverlay(!showTextOverlay)}
                    className={`w-14 h-14 rounded-full backdrop-blur-md shadow-xl flex items-center justify-center transition-all ${
                      showTextOverlay ? 'bg-white text-black' : 'bg-white/20 text-white hover:bg-white/30'
                    }`}
                  >
                    <Type className="w-6 h-6 drop-shadow-lg" />
                  </button>
                  <button
                    onClick={() => setShowStickersOverlay(!showStickersOverlay)}
                    className={`w-14 h-14 rounded-full backdrop-blur-md shadow-xl flex items-center justify-center transition-all ${
                      showStickersOverlay ? 'bg-white text-black' : 'bg-white/20 text-white hover:bg-white/30'
                    }`}
                  >
                    <StickerIcon className="w-6 h-6 drop-shadow-lg" />
                  </button>
                  <button
                    onClick={() => setShowVoiceoverOverlay(!showVoiceoverOverlay)}
                    className={`w-14 h-14 rounded-full backdrop-blur-md shadow-xl flex items-center justify-center transition-all ${
                      showVoiceoverOverlay ? 'bg-white text-black' : 'bg-white/20 text-white hover:bg-white/30'
                    }`}
                  >
                    <Mic className="w-6 h-6 drop-shadow-lg" />
                  </button>
                  {capturedMediaType === 'image' && (
                    <button
                      onClick={() => setShowCropper(true)}
                      className="w-14 h-14 rounded-full bg-white/20 backdrop-blur-md shadow-xl flex items-center justify-center text-white hover:bg-white/30 transition-all"
                    >
                      <Scissors className="w-6 h-6 drop-shadow-lg" />
                    </button>
                  )}
                </div>

                {/* Media Preview */}
                <div 
                  ref={previewRef}
                  className="w-full h-full flex items-center justify-center bg-black relative touch-none"
                  onTouchMove={handleStickerTouchMove}
                  onTouchEnd={handleStickerTouchEnd}
                >
                  {capturedMediaType === 'image' ? (
                    <img 
                      src={croppedImageUrl || capturedMediaUrl} 
                      alt="Preview" 
                      className="max-h-full max-w-full object-contain" 
                      style={getFilterStyle()} 
                    />
                  ) : (
                    <video 
                      src={capturedMediaUrl} 
                      className="max-h-full max-w-full object-contain" 
                      style={getFilterStyle()} 
                      controls 
                    />
                  )}

                  {/* Text Overlay */}
                  {textOverlay && (
                    <div className="absolute left-0 right-0 flex justify-center px-4 pointer-events-none" style={getTextPositionStyle()}>
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
                      className="absolute pointer-events-auto"
                      style={{
                        left: `${sticker.x}%`,
                        top: `${sticker.y}%`,
                        transform: `translate(-50%, -50%) scale(${sticker.scale})`,
                        touchAction: 'none',
                      }}
                      onTouchStart={(e) => handleStickerTouchStart(e, index)}
                    >
                      <div className="relative">
                        <span className="text-6xl drop-shadow-[0_4px_12px_rgba(0,0,0,0.6)] select-none">
                          {sticker.emoji}
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            removeSticker(index);
                          }}
                          className="absolute -top-2 -right-2 w-7 h-7 bg-red-500 rounded-full flex items-center justify-center shadow-lg"
                        >
                          <X className="w-4 h-4 text-white" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Filters Overlay - Bottom Left */}
                {showFiltersOverlay && (
                  <div className="absolute bottom-20 left-4 z-50 bg-black/80 backdrop-blur-xl rounded-2xl p-4 max-w-xs shadow-2xl border border-white/10">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-white font-bold text-sm drop-shadow-lg">Filters</h3>
                      <button onClick={() => setShowFiltersOverlay(false)} className="text-white/70 hover:text-white">
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                    
                    {/* Filter Categories */}
                    <div className="flex gap-2 mb-3 overflow-x-auto">
                      {(Object.keys(FILTERS) as Array<keyof typeof FILTERS>).map((cat) => (
                        <button
                          key={cat}
                          onClick={() => setFilterCategory(cat)}
                          className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
                            filterCategory === cat ? 'bg-white text-black' : 'bg-white/20 text-white hover:bg-white/30'
                          }`}
                        >
                          {cat === 'hotVibes' ? 'Hot' : cat === 'everyday' ? 'Daily' : cat === 'culinary' ? 'Food' : 'Fit'}
                        </button>
                      ))}
                    </div>

                    {/* Filter Options */}
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {FILTERS[filterCategory].map((filter) => (
                        <button
                          key={filter.name}
                          onClick={() => setSelectedFilter(filter.name)}
                          className={`w-full px-4 py-2.5 rounded-xl text-sm font-medium transition-all text-left flex items-center justify-between ${
                            selectedFilter === filter.name 
                              ? 'bg-white text-black' 
                              : 'bg-white/10 text-white hover:bg-white/20'
                          }`}
                        >
                          {filter.name}
                          {selectedFilter === filter.name && <Check className="w-4 h-4" />}
                        </button>
                      ))}
                    </div>

                    {/* Adjustment Sliders */}
                    <div className="space-y-3 mt-4 pt-4 border-t border-white/10">
                      <div className="space-y-1.5">
                        <label className="text-white text-xs font-medium drop-shadow-lg">Brightness</label>
                        <Slider 
                          value={[brightness]} 
                          onValueChange={([v]) => setBrightness(v)} 
                          min={50} 
                          max={150} 
                          className="[&_[role=slider]]:bg-white [&_[role=slider]]:border-2 [&_[role=slider]]:border-black"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-white text-xs font-medium drop-shadow-lg">Contrast</label>
                        <Slider 
                          value={[contrast]} 
                          onValueChange={([v]) => setContrast(v)} 
                          min={50} 
                          max={150}
                          className="[&_[role=slider]]:bg-white [&_[role=slider]]:border-2 [&_[role=slider]]:border-black"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-white text-xs font-medium drop-shadow-lg">Saturation</label>
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

                {/* Text Overlay Control - Bottom Left */}
                {showTextOverlay && (
                  <div className="absolute bottom-20 left-4 z-50 bg-black/80 backdrop-blur-xl rounded-2xl p-4 w-72 shadow-2xl border border-white/10">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-white font-bold text-sm drop-shadow-lg">Text Overlay</h3>
                      <button onClick={() => setShowTextOverlay(false)} className="text-white/70 hover:text-white">
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                    
                    <div className="space-y-3">
                      <Input
                        placeholder="Add text..."
                        value={textOverlay}
                        onChange={(e) => setTextOverlay(e.target.value)}
                        className="bg-white/10 border-white/20 text-white placeholder:text-white/50"
                      />
                      
                      <div className="space-y-1.5">
                        <label className="text-white text-xs font-medium drop-shadow-lg">Size: {textSize}px</label>
                        <Slider 
                          value={[textSize]} 
                          onValueChange={([v]) => setTextSize(v)} 
                          min={20} 
                          max={100}
                          className="[&_[role=slider]]:bg-white [&_[role=slider]]:border-2 [&_[role=slider]]:border-black"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-white text-xs font-medium drop-shadow-lg">Position</label>
                        <div className="flex gap-2 mb-2">
                          <Button size="sm" variant="outline" onClick={() => setTextPosition(20)} className="flex-1 bg-white/10 border-white/20 text-white hover:bg-white/20">Top</Button>
                          <Button size="sm" variant="outline" onClick={() => setTextPosition(50)} className="flex-1 bg-white/10 border-white/20 text-white hover:bg-white/20">Center</Button>
                          <Button size="sm" variant="outline" onClick={() => setTextPosition(80)} className="flex-1 bg-white/10 border-white/20 text-white hover:bg-white/20">Bottom</Button>
                        </div>
                        <Slider 
                          value={[textPosition]} 
                          onValueChange={([v]) => setTextPosition(v)} 
                          min={5} 
                          max={95}
                          className="[&_[role=slider]]:bg-white [&_[role=slider]]:border-2 [&_[role=slider]]:border-black"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Stickers Overlay - Bottom Left */}
                {showStickersOverlay && (
                  <div className="absolute bottom-20 left-4 z-50 bg-black/80 backdrop-blur-xl rounded-2xl p-4 max-w-xs shadow-2xl border border-white/10">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-white font-bold text-sm drop-shadow-lg">Stickers</h3>
                      <button onClick={() => setShowStickersOverlay(false)} className="text-white/70 hover:text-white">
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                    <p className="text-white/70 text-xs mb-3">Tap to add, drag to move</p>
                    
                    <div className="grid grid-cols-4 gap-2">
                      {STICKERS.map((emoji) => (
                        <button
                          key={emoji}
                          onClick={() => addSticker(emoji)}
                          className="text-4xl hover:scale-110 transition-transform p-2 bg-white/10 rounded-xl hover:bg-white/20"
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Voiceover Overlay - Bottom Left */}
                {showVoiceoverOverlay && (
                  <div className="absolute bottom-20 left-4 z-50 bg-black/80 backdrop-blur-xl rounded-2xl p-4 w-72 shadow-2xl border border-white/10">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-white font-bold text-sm drop-shadow-lg">Voice Over</h3>
                      <button onClick={() => setShowVoiceoverOverlay(false)} className="text-white/70 hover:text-white">
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                    
                    {!voiceOverBlob ? (
                      <VoiceOverRecorder 
                        onRecordingComplete={(blob) => setVoiceOverBlob(blob)} 
                        maxDuration={capturedMediaType === 'image' ? 60 : 120}
                      />
                    ) : (
                      <div className="space-y-3">
                        <div className="p-3 bg-white/10 rounded-xl">
                          <p className="text-sm font-medium text-white">Voice over recorded</p>
                          <p className="text-xs text-white/70">Ready to add</p>
                        </div>
                        <Button
                          variant="destructive"
                          className="w-full"
                          onClick={() => setVoiceOverBlob(null)}
                        >
                          Remove Voice Over
                        </Button>
                      </div>
                    )}
                  </div>
                )}

                {/* Next Button */}
                <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-40">
                  <Button
                    size="lg"
                    onClick={handleNext}
                    className="bg-white text-black hover:bg-white/90 rounded-full px-10 py-6 text-lg font-bold shadow-2xl"
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
    </>
  );
}
