import { useState, useRef, useEffect } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { X, RotateCw, Circle, Square, Wand2, Type, Music, Sticker as StickerIcon, Mic, RotateCcw, ArrowRight, Scissors } from 'lucide-react';
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
    { name: 'Fire', filter: 'contrast(1.3) saturate(1.5) hue-rotate(350deg)' },
    { name: 'Sunset Glow', filter: 'sepia(0.4) saturate(1.4) brightness(1.1)' },
    { name: 'Electric', filter: 'saturate(1.6) brightness(1.2) hue-rotate(180deg)' },
  ],
  everyday: [
    { name: 'Clean', filter: 'brightness(1.05) contrast(1.1)' },
    { name: 'Natural', filter: 'saturate(0.95) brightness(1.05)' },
  ],
  culinary: [
    { name: 'Appetizing', filter: 'saturate(1.3) contrast(1.2) brightness(1.05)' },
  ],
  active: [
    { name: 'Energetic', filter: 'saturate(1.4) contrast(1.3) brightness(1.1)' },
  ],
};

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
  const [recordedChunks, setRecordedChunks] = useState<Blob[]>([]);
  
  // Captured media states
  const [capturedMediaUrl, setCapturedMediaUrl] = useState<string | null>(null);
  const [capturedMediaType, setCapturedMediaType] = useState<'image' | 'video'>('image');
  
  // Editing states
  const [selectedFilter, setSelectedFilter] = useState<string | null>(null);
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
  
  // UI states
  const [activeDrawer, setActiveDrawer] = useState<'filters' | 'text' | 'stickers' | 'music' | 'voiceover' | 'crop' | null>(null);
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
    setRecordedChunks(chunks);
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
    setSelectedFilter(null);
    setBrightness(100);
    setContrast(100);
    setSaturation(100);
    setTextOverlay('');
    setTextPosition(50);
    setTextSize(48);
    setStickers([]);
    setVoiceOverBlob(null);
    setCroppedImageUrl(capturedMediaUrl || '');
    toast({ title: 'Filters reset' });
  };

  const getFilterStyle = () => {
    const filterObj = selectedFilter ? FILTERS[filterCategory].find(f => f.name === selectedFilter) : null;
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
      { x: 10, y: 10 },
      { x: 85, y: 10 },
      { x: 10, y: 85 },
      { x: 85, y: 85 },
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
        const filterObj = selectedFilter ? FILTERS[filterCategory].find(f => f.name === selectedFilter) : null;
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
      // For video, convert URL back to file
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
    setActiveDrawer(null);
    resetAllEdits();
    onClose();
  };

  const STICKERS = ['❤️', '🔥', '✨', '🎉', '😍', '👍', '💯', '⭐', '💪', '😂', '🎵', '🌟'];

  return (
    <>
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-w-full h-screen p-0 bg-black">
          <div className="relative w-full h-full flex items-center justify-center">
            {!capturedMediaUrl ? (
              // Camera View
              <>
                <div className="absolute top-2 left-2 right-2 z-20 flex items-center justify-between px-2">
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={handleClose}
                    className="text-white hover:bg-white/20 bg-black/30 backdrop-blur-sm"
                  >
                    <X className="w-5 h-5" />
                  </Button>
                  
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={toggleFacingMode}
                    className="text-white hover:bg-white/20 bg-black/30 backdrop-blur-sm"
                  >
                    <RotateCw className="w-5 h-5" />
                  </Button>
                </div>

                <div className="absolute top-14 left-1/2 -translate-x-1/2 z-20 flex gap-2 bg-black/50 backdrop-blur-sm rounded-full px-3 py-1.5">
                  {(['9:16', '1:1', '4:3', '16:9'] as const).map((ratio) => (
                    <button
                      key={ratio}
                      onClick={() => setAspectRatio(ratio)}
                      className={`px-3 py-1 rounded-full text-xs font-semibold transition-all ${
                        aspectRatio === ratio 
                          ? 'bg-white text-black' 
                          : 'text-white hover:bg-white/20'
                      }`}
                    >
                      {ratio}
                    </button>
                  ))}
                </div>

                <div className={`relative ${getAspectRatioClass()} w-full max-h-full flex items-center justify-center bg-black`}>
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                  />

                  <div className="absolute inset-x-0 bottom-0 flex flex-col items-center gap-3 pb-6">
                    <div className="flex gap-3 bg-black/40 backdrop-blur-md rounded-full px-4 py-1.5">
                      <button
                        onClick={() => setMode('photo')}
                        className={`px-4 py-1.5 rounded-full font-semibold transition-all text-xs ${
                          mode === 'photo' 
                            ? 'bg-white text-black shadow-lg' 
                            : 'text-white hover:bg-white/20'
                        }`}
                      >
                        PHOTO
                      </button>
                      <button
                        onClick={() => setMode('video')}
                        className={`px-4 py-1.5 rounded-full font-semibold transition-all text-xs ${
                          mode === 'video' 
                            ? 'bg-white text-black shadow-lg' 
                            : 'text-white hover:bg-white/20'
                        }`}
                      >
                        VIDEO
                      </button>
                    </div>

                    <button
                      onClick={mode === 'photo' ? capturePhoto : isRecording ? stopRecording : startRecording}
                      className={`w-20 h-20 rounded-full flex items-center justify-center shadow-2xl transition-all hover:scale-110 active:scale-95 ${
                        isRecording 
                          ? 'bg-red-500/90 border-4 border-white' 
                          : 'bg-white/90 border-4 border-white'
                      }`}
                      style={{ backdropFilter: 'blur(8px)' }}
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
                </div>
              </>
            ) : (
              // Preview & Edit View
              <>
                <div className="absolute top-2 left-2 right-2 z-30 flex items-center justify-between px-2">
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => {
                      setCapturedMediaUrl(null);
                      startCamera();
                    }}
                    className="text-white hover:bg-white/20 bg-black/30 backdrop-blur-sm"
                  >
                    <X className="w-5 h-5" />
                  </Button>
                  
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={resetAllEdits}
                    className="text-white hover:bg-white/20 bg-black/30 backdrop-blur-sm"
                  >
                    <RotateCcw className="w-4 h-4 mr-2" />
                    Reset
                  </Button>
                </div>

                {/* Floating Tool Icons - Right Side */}
                <div className="absolute right-4 top-1/2 -translate-y-1/2 z-30 flex flex-col gap-3">
                  <button
                    onClick={() => setActiveDrawer('filters')}
                    className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-md shadow-lg flex items-center justify-center hover:bg-white/30 transition-all"
                  >
                    <Wand2 className="w-6 h-6 text-white drop-shadow-md" />
                  </button>
                  <button
                    onClick={() => setActiveDrawer('text')}
                    className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-md shadow-lg flex items-center justify-center hover:bg-white/30 transition-all"
                  >
                    <Type className="w-6 h-6 text-white drop-shadow-md" />
                  </button>
                  <button
                    onClick={() => setActiveDrawer('stickers')}
                    className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-md shadow-lg flex items-center justify-center hover:bg-white/30 transition-all"
                  >
                    <StickerIcon className="w-6 h-6 text-white drop-shadow-md" />
                  </button>
                  <button
                    onClick={() => setActiveDrawer('voiceover')}
                    className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-md shadow-lg flex items-center justify-center hover:bg-white/30 transition-all"
                  >
                    <Mic className="w-6 h-6 text-white drop-shadow-md" />
                  </button>
                  {capturedMediaType === 'image' && (
                    <button
                      onClick={() => setShowCropper(true)}
                      className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-md shadow-lg flex items-center justify-center hover:bg-white/30 transition-all"
                    >
                      <Scissors className="w-6 h-6 text-white drop-shadow-md" />
                    </button>
                  )}
                </div>

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

                  <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                    <div className="relative w-full h-full flex items-center justify-center">
                      {textOverlay && (
                        <div className="absolute left-0 right-0 flex justify-center px-4" style={getTextPositionStyle()}>
                          <p 
                            className="text-white font-bold drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] text-center px-4 py-2 bg-black/30 rounded-lg backdrop-blur-sm"
                            style={{ fontSize: `${textSize}px` }}
                          >
                            {textOverlay}
                          </p>
                        </div>
                      )}
                      
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
                            <span className="text-6xl md:text-8xl drop-shadow-[0_2px_8px_rgba(0,0,0,0.5)] select-none">
                              {sticker.emoji}
                            </span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                removeSticker(index);
                              }}
                              className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center"
                            >
                              <X className="w-4 h-4 text-white" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30">
                  <Button
                    size="lg"
                    onClick={handleNext}
                    className="bg-white text-black hover:bg-white/90 rounded-full px-8 shadow-2xl"
                  >
                    Next
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </Button>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Editing Drawers */}
      <Sheet open={activeDrawer === 'filters'} onOpenChange={() => setActiveDrawer(null)}>
        <SheetContent side="right" className="w-full sm:w-96 overflow-y-auto">
          <h3 className="text-lg font-semibold mb-4">Filters</h3>
          
          <Tabs value={filterCategory} onValueChange={(v) => setFilterCategory(v as any)} className="w-full">
            <TabsList className="grid grid-cols-4 w-full">
              <TabsTrigger value="hotVibes" className="text-xs">Hot</TabsTrigger>
              <TabsTrigger value="everyday" className="text-xs">Daily</TabsTrigger>
              <TabsTrigger value="culinary" className="text-xs">Food</TabsTrigger>
              <TabsTrigger value="active" className="text-xs">Fit</TabsTrigger>
            </TabsList>
            {Object.entries(FILTERS).map(([category, filters]) => (
              <TabsContent key={category} value={category} className="space-y-2 mt-4">
                {filters.map((filter) => (
                  <Button 
                    key={filter.name} 
                    variant={selectedFilter === filter.name ? "default" : "outline"} 
                    className="w-full" 
                    onClick={() => setSelectedFilter(filter.name)}
                  >
                    {filter.name}
                  </Button>
                ))}
              </TabsContent>
            ))}
          </Tabs>

          <div className="space-y-4 mt-6">
            <div className="space-y-2">
              <label className="text-sm font-medium">Brightness</label>
              <Slider value={[brightness]} onValueChange={([v]) => setBrightness(v)} min={50} max={150} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Contrast</label>
              <Slider value={[contrast]} onValueChange={([v]) => setContrast(v)} min={50} max={150} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Saturation</label>
              <Slider value={[saturation]} onValueChange={([v]) => setSaturation(v)} min={0} max={200} />
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <Sheet open={activeDrawer === 'text'} onOpenChange={() => setActiveDrawer(null)}>
        <SheetContent side="right" className="w-full sm:w-96 overflow-y-auto">
          <h3 className="text-lg font-semibold mb-4">Text Overlay</h3>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Text</label>
              <Input
                placeholder="Add text..."
                value={textOverlay}
                onChange={(e) => setTextOverlay(e.target.value)}
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Text Size: {textSize}px</label>
              <Slider 
                value={[textSize]} 
                onValueChange={([v]) => setTextSize(v)} 
                min={20} 
                max={100} 
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Position</label>
              <div className="flex gap-2 mb-2">
                <Button size="sm" variant="outline" onClick={() => setTextPosition(20)}>Top</Button>
                <Button size="sm" variant="outline" onClick={() => setTextPosition(50)}>Center</Button>
                <Button size="sm" variant="outline" onClick={() => setTextPosition(80)}>Bottom</Button>
              </div>
              <Slider 
                value={[textPosition]} 
                onValueChange={([v]) => setTextPosition(v)} 
                min={5} 
                max={95} 
              />
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <Sheet open={activeDrawer === 'stickers'} onOpenChange={() => setActiveDrawer(null)}>
        <SheetContent side="right" className="w-full sm:w-96">
          <h3 className="text-lg font-semibold mb-4">Stickers</h3>
          <p className="text-sm text-muted-foreground mb-4">Tap to add, drag to move</p>
          
          <div className="grid grid-cols-4 gap-3">
            {STICKERS.map((emoji) => (
              <button
                key={emoji}
                onClick={() => addSticker(emoji)}
                className="text-5xl hover:scale-110 transition-transform p-2"
              >
                {emoji}
              </button>
            ))}
          </div>
        </SheetContent>
      </Sheet>

      <Sheet open={activeDrawer === 'voiceover'} onOpenChange={() => setActiveDrawer(null)}>
        <SheetContent side="right" className="w-full sm:w-96">
          <h3 className="text-lg font-semibold mb-4">Voice Over</h3>
          
          {!voiceOverBlob ? (
            <VoiceOverRecorder 
              onRecordingComplete={(blob) => setVoiceOverBlob(blob)} 
              maxDuration={capturedMediaType === 'image' ? 60 : 120}
            />
          ) : (
            <div className="space-y-3">
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-sm font-medium">Voice over recorded</p>
                <p className="text-xs text-muted-foreground">Ready to add</p>
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
        </SheetContent>
      </Sheet>

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
