import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { X, ArrowLeft, Sparkles, Type, Smile, Crop, Volume2, VolumeX, Music } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { ImageCropper } from './ImageCropper';
import { MusicLibrary } from './MusicLibrary';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface InstagramStyleEditorProps {
  open: boolean;
  onClose: () => void;
  onBack: () => void;
  mediaUrl: string;
  mediaType: 'image' | 'video';
  mediaFile: File | null;
  onNext: (effects: any) => void;
}

const FILTERS = {
  normal: 'none',
  clarendon: 'contrast(1.2) saturate(1.35)',
  gingham: 'brightness(1.05) hue-rotate(-10deg)',
  moon: 'grayscale(1) contrast(1.1) brightness(1.1)',
  lark: 'contrast(0.9) saturate(1.1) brightness(1.1)',
  reyes: 'sepia(0.22) brightness(1.1) contrast(0.85)',
  juno: 'contrast(1.2) saturate(1.4) brightness(1.1)',
  slumber: 'saturate(0.66) brightness(1.05)',
  crema: 'sepia(0.5) contrast(1.25)',
  ludwig: 'brightness(1.05) saturate(2)',
  aden: 'hue-rotate(-20deg) contrast(0.9) saturate(0.85) brightness(1.2)',
  perpetua: 'contrast(1.1) saturate(1.1)',
};

export function InstagramStyleEditor({ 
  open, 
  onClose, 
  onBack, 
  mediaUrl, 
  mediaType,
  mediaFile,
  onNext 
}: InstagramStyleEditorProps) {
  const { toast } = useToast();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [activeFilter, setActiveFilter] = useState<keyof typeof FILTERS>('normal');
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [saturation, setSaturation] = useState(100);
  const [textOverlay, setTextOverlay] = useState('');
  const [showTextInput, setShowTextInput] = useState(false);
  const [textColor, setTextColor] = useState('#ffffff');
  const [isMuted, setIsMuted] = useState(false);
  const [showCrop, setShowCrop] = useState(false);
  const [croppedImage, setCroppedImage] = useState<string>('');
  const [showMusic, setShowMusic] = useState(false);
  const [selectedMusic, setSelectedMusic] = useState<{url: string; title: string; artist: string} | null>(null);

  const getFilterStyle = () => {
    const filters = [
      FILTERS[activeFilter],
      `brightness(${brightness}%)`,
      `contrast(${contrast}%)`,
      `saturate(${saturation}%)`
    ].filter(f => f !== 'none').join(' ');
    
    return { filter: filters || 'none' };
  };

  const handleNext = () => {
    const effects = {
      filter: activeFilter,
      brightness,
      contrast,
      saturation,
      textOverlay,
      textColor,
      music: selectedMusic,
      processedBlob: croppedImage ? croppedImage : mediaUrl,
    };
    onNext(effects);
  };

  const handleCropComplete = (croppedImageUrl: string) => {
    setCroppedImage(croppedImageUrl);
    setShowCrop(false);
  };


  if (showCrop && mediaType === 'image') {
    return (
      <div className="fixed inset-0 z-50 bg-background">
        <ImageCropper
          imageUrl={croppedImage || mediaUrl}
          onCropComplete={handleCropComplete}
          onClose={() => setShowCrop(false)}
        />
      </div>
    );
  }

  if (showMusic) {
    return (
      <MusicLibrary
        open={true}
        onClose={() => setShowMusic(false)}
        onSelectMusic={(music) => {
          setSelectedMusic({ url: music.url, title: music.name, artist: music.artist });
          setShowMusic(false);
          toast({
            title: "Music added",
            description: `${music.name} by ${music.artist}`,
          });
        }}
      />
    );
  }

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h2 className="text-lg font-semibold">Edit</h2>
        <Button onClick={handleNext} className="font-semibold">
          Next
        </Button>
      </div>

      {/* Media Preview */}
      <div className="flex-1 relative bg-black flex items-center justify-center overflow-hidden">
        {mediaType === 'image' ? (
          <div className="relative w-full h-full flex items-center justify-center">
            <img
              src={croppedImage || mediaUrl}
              alt="Preview"
              className="max-w-full max-h-full object-contain"
              style={getFilterStyle()}
            />
            {textOverlay && (
              <div
                className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-4xl font-bold px-4 py-2 text-center max-w-full"
                style={{ color: textColor, textShadow: '2px 2px 4px rgba(0,0,0,0.5)' }}
              >
                {textOverlay}
              </div>
            )}
          </div>
        ) : (
          <div className="relative w-full h-full">
            <video
              ref={videoRef}
              src={mediaUrl}
              className="w-full h-full object-contain"
              style={getFilterStyle()}
              controls
              muted={isMuted}
              playsInline
            />
            {textOverlay && (
              <div
                className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-4xl font-bold px-4 py-2 text-center max-w-full pointer-events-none"
                style={{ color: textColor, textShadow: '2px 2px 4px rgba(0,0,0,0.5)' }}
              >
                {textOverlay}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom Tools */}
      <div className="border-t border-border bg-background">
        {/* Quick Actions */}
        <div className="flex items-center justify-around p-4 border-b border-border">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowTextInput(!showTextInput)}
            className="flex flex-col gap-1"
          >
            <Type className="w-5 h-5" />
            <span className="text-xs">Text</span>
          </Button>
          
          {mediaType === 'image' && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowCrop(true)}
              className="flex flex-col gap-1"
            >
              <Crop className="w-5 h-5" />
              <span className="text-xs">Crop</span>
            </Button>
          )}

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowMusic(true)}
            className="flex flex-col gap-1"
          >
            <Music className="w-5 h-5" />
            <span className="text-xs">Music</span>
          </Button>

          {mediaType === 'video' && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsMuted(!isMuted)}
              className="flex flex-col gap-1"
            >
              {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
              <span className="text-xs">{isMuted ? 'Unmute' : 'Mute'}</span>
            </Button>
          )}
        </div>

        {/* Text Input */}
        {showTextInput && (
          <div className="p-4 border-b border-border space-y-3">
            <Input
              placeholder="Add text..."
              value={textOverlay}
              onChange={(e) => setTextOverlay(e.target.value)}
              className="text-center"
            />
            <div className="flex items-center gap-2">
              <span className="text-sm">Color:</span>
              <input
                type="color"
                value={textColor}
                onChange={(e) => setTextColor(e.target.value)}
                className="w-10 h-10 rounded cursor-pointer"
              />
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="p-4 border-b border-border">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-4 h-4" />
            <span className="text-sm font-medium">Filters</span>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
            {Object.keys(FILTERS).map((filter) => (
              <button
                key={filter}
                onClick={() => setActiveFilter(filter as keyof typeof FILTERS)}
                className="flex flex-col items-center gap-2 min-w-[70px]"
              >
                <div
                  className={cn(
                    "w-16 h-16 rounded-lg overflow-hidden border-2",
                    activeFilter === filter ? "border-primary" : "border-border"
                  )}
                  style={{ filter: FILTERS[filter as keyof typeof FILTERS] }}
                >
                  <img
                    src={croppedImage || mediaUrl}
                    alt={filter}
                    className="w-full h-full object-cover"
                  />
                </div>
                <span className="text-xs capitalize">{filter}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Adjustments */}
        <div className="p-4 space-y-4 max-h-48 overflow-y-auto">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span>Brightness</span>
              <span className="text-muted-foreground">{brightness}%</span>
            </div>
            <Slider
              value={[brightness]}
              onValueChange={(v) => setBrightness(v[0])}
              min={0}
              max={200}
              step={1}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span>Contrast</span>
              <span className="text-muted-foreground">{contrast}%</span>
            </div>
            <Slider
              value={[contrast]}
              onValueChange={(v) => setContrast(v[0])}
              min={0}
              max={200}
              step={1}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span>Saturation</span>
              <span className="text-muted-foreground">{saturation}%</span>
            </div>
            <Slider
              value={[saturation]}
              onValueChange={(v) => setSaturation(v[0])}
              min={0}
              max={200}
              step={1}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
