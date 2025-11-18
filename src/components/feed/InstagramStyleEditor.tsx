import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { 
  ArrowLeft, 
  Check, 
  Music, 
  Type, 
  Crop,
  Sparkles,
  Sun,
  Contrast,
  Droplet,
  Volume2,
  VolumeX
} from 'lucide-react';
import { ImageCropper } from './ImageCropper';
import { MusicLibrary } from './MusicLibrary';

interface InstagramStyleEditorProps {
  open: boolean;
  onClose: () => void;
  onBack: () => void;
  mediaUrl: string;
  mediaType: 'image' | 'video';
  mediaFile: File | null;
  onNext: (effects: any) => void;
}

const FILTERS = [
  { name: 'Normal', filter: '' },
  { name: 'Vivid', filter: 'saturate(1.3) contrast(1.1)' },
  { name: 'Warm', filter: 'sepia(0.3) brightness(1.1)' },
  { name: 'Cool', filter: 'hue-rotate(20deg) saturate(1.2)' },
  { name: 'B&W', filter: 'grayscale(1) contrast(1.2)' },
  { name: 'Retro', filter: 'sepia(0.5) contrast(1.1) saturate(1.3)' },
  { name: 'Bright', filter: 'brightness(1.2) saturate(1.2)' },
  { name: 'Moody', filter: 'brightness(0.9) contrast(1.3) saturate(0.8)' },
];

export function InstagramStyleEditor({
  open,
  onClose,
  onBack,
  mediaUrl,
  mediaType,
  mediaFile,
  onNext
}: InstagramStyleEditorProps) {
  const [activeFilter, setActiveFilter] = useState('Normal');
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [saturation, setSaturation] = useState(100);
  const [textOverlays, setTextOverlays] = useState<Array<{ text: string; x: number; y: number }>>([]);
  const [showTextInput, setShowTextInput] = useState(false);
  const [currentText, setCurrentText] = useState('');
  const [isMuted, setIsMuted] = useState(false);
  const [showCropper, setShowCropper] = useState(false);
  const [showMusicLibrary, setShowMusicLibrary] = useState(false);
  const [selectedMusic, setSelectedMusic] = useState<any>(null);
  const [croppedImageUrl, setCroppedImageUrl] = useState('');
  const [activeTab, setActiveTab] = useState<'filters' | 'adjust'>('filters');
  const videoRef = useRef<HTMLVideoElement>(null);

  const getFilterStyle = () => {
    const filterObj = FILTERS.find(f => f.name === activeFilter);
    const baseFilter = filterObj?.filter || '';
    const adjustments = `brightness(${brightness / 100}) contrast(${contrast / 100}) saturate(${saturation / 100})`;
    return `${baseFilter} ${adjustments}`.trim();
  };

  const handleAddText = () => {
    if (currentText.trim()) {
      setTextOverlays([...textOverlays, { text: currentText, x: 50, y: 50 }]);
      setCurrentText('');
      setShowTextInput(false);
    }
  };

  const handleCropComplete = (croppedUrl: string) => {
    setCroppedImageUrl(croppedUrl);
    setShowCropper(false);
  };

  const handleMusicSelect = (music: any) => {
    setSelectedMusic(music);
    setShowMusicLibrary(false);
  };

  const handleNext = () => {
    onNext({
      filter: activeFilter,
      brightness,
      contrast,
      saturation,
      textOverlays,
      isMuted,
      music: selectedMusic,
      croppedUrl: croppedImageUrl,
    });
  };

  if (!open) return null;

  if (showCropper && mediaType === 'image') {
    return (
      <ImageCropper
        imageUrl={mediaUrl}
        onCropComplete={handleCropComplete}
        onClose={() => setShowCropper(false)}
      />
    );
  }

  if (showMusicLibrary) {
    return (
      <MusicLibrary
        open={true}
        onClose={() => setShowMusicLibrary(false)}
        onSelectMusic={handleMusicSelect}
      />
    );
  }

  return (
    <div className="fixed inset-0 bg-background z-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h2 className="text-lg font-semibold">Edit</h2>
        <Button 
          onClick={handleNext}
          className="bg-primary hover:bg-primary/90 text-primary-foreground px-6"
        >
          Next
        </Button>
      </div>

      {/* Media Preview */}
      <div className="flex-1 relative bg-black overflow-hidden">
        {mediaType === 'image' ? (
          <img
            src={croppedImageUrl || mediaUrl}
            alt="Preview"
            className="w-full h-full object-contain"
            style={{ filter: getFilterStyle() }}
          />
        ) : (
          <video
            ref={videoRef}
            src={mediaUrl}
            className="w-full h-full object-contain"
            style={{ filter: getFilterStyle() }}
            controls
            muted={isMuted}
            autoPlay
            loop
          />
        )}

        {/* Text Overlays */}
        {textOverlays.map((overlay, index) => (
          <div
            key={index}
            className="absolute text-white font-bold text-2xl shadow-lg"
            style={{
              left: `${overlay.x}%`,
              top: `${overlay.y}%`,
              transform: 'translate(-50%, -50%)',
              textShadow: '2px 2px 4px rgba(0,0,0,0.8)',
            }}
          >
            {overlay.text}
          </div>
        ))}

        {/* Right Side Tools */}
        <div className="absolute right-4 top-1/2 -translate-y-1/2 flex flex-col gap-4">
          <button
            onClick={() => setShowTextInput(true)}
            className="w-12 h-12 rounded-full bg-background/80 backdrop-blur-sm flex items-center justify-center hover:bg-background/90 transition-colors"
          >
            <Type className="w-5 h-5" />
          </button>

          {mediaType === 'image' && (
            <button
              onClick={() => setShowCropper(true)}
              className="w-12 h-12 rounded-full bg-background/80 backdrop-blur-sm flex items-center justify-center hover:bg-background/90 transition-colors"
            >
              <Crop className="w-5 h-5" />
            </button>
          )}

          <button
            onClick={() => setShowMusicLibrary(true)}
            className="w-12 h-12 rounded-full bg-background/80 backdrop-blur-sm flex items-center justify-center hover:bg-background/90 transition-colors"
          >
            <Music className="w-5 h-5" />
          </button>

          {mediaType === 'video' && (
            <button
              onClick={() => setIsMuted(!isMuted)}
              className="w-12 h-12 rounded-full bg-background/80 backdrop-blur-sm flex items-center justify-center hover:bg-background/90 transition-colors"
            >
              {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
            </button>
          )}
        </div>
      </div>

      {/* Text Input Overlay */}
      {showTextInput && (
        <div className="absolute inset-0 bg-black/80 z-10 flex items-center justify-center p-6">
          <div className="bg-background rounded-2xl p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Add Text</h3>
            <Input
              value={currentText}
              onChange={(e) => setCurrentText(e.target.value)}
              placeholder="Type your text..."
              className="mb-4"
              autoFocus
            />
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  setShowTextInput(false);
                  setCurrentText('');
                }}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button onClick={handleAddText} className="flex-1">
                Add
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Controls */}
      <div className="border-t border-border bg-background">
        {/* Tabs */}
        <div className="flex border-b border-border">
          <button
            onClick={() => setActiveTab('filters')}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${
              activeTab === 'filters'
                ? 'text-foreground border-b-2 border-primary'
                : 'text-muted-foreground'
            }`}
          >
            Filters
          </button>
          <button
            onClick={() => setActiveTab('adjust')}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${
              activeTab === 'adjust'
                ? 'text-foreground border-b-2 border-primary'
                : 'text-muted-foreground'
            }`}
          >
            Adjust
          </button>
        </div>

        {/* Filters Tab */}
        {activeTab === 'filters' && (
          <div className="p-4">
            <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
              {FILTERS.map((filter) => (
                <button
                  key={filter.name}
                  onClick={() => setActiveFilter(filter.name)}
                  className="flex flex-col items-center gap-2 flex-shrink-0"
                >
                  <div
                    className={`w-16 h-16 rounded-xl overflow-hidden border-2 transition-all ${
                      activeFilter === filter.name
                        ? 'border-primary scale-95'
                        : 'border-border'
                    }`}
                  >
                    {mediaType === 'image' ? (
                      <img
                        src={mediaUrl}
                        alt={filter.name}
                        className="w-full h-full object-cover"
                        style={{ filter: filter.filter }}
                      />
                    ) : (
                      <div 
                        className="w-full h-full bg-gradient-to-br from-primary/20 to-primary/40"
                        style={{ filter: filter.filter }}
                      />
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground">{filter.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Adjust Tab */}
        {activeTab === 'adjust' && (
          <div className="p-4 space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sun className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm">Brightness</span>
                </div>
                <span className="text-sm text-muted-foreground">{brightness}%</span>
              </div>
              <Slider
                value={[brightness]}
                onValueChange={([value]) => setBrightness(value)}
                min={50}
                max={150}
                step={1}
                className="w-full"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Contrast className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm">Contrast</span>
                </div>
                <span className="text-sm text-muted-foreground">{contrast}%</span>
              </div>
              <Slider
                value={[contrast]}
                onValueChange={([value]) => setContrast(value)}
                min={50}
                max={150}
                step={1}
                className="w-full"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Droplet className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm">Saturation</span>
                </div>
                <span className="text-sm text-muted-foreground">{saturation}%</span>
              </div>
              <Slider
                value={[saturation]}
                onValueChange={([value]) => setSaturation(value)}
                min={50}
                max={150}
                step={1}
                className="w-full"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
