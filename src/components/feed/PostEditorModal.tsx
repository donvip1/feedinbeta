import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Wand2, Type, Music, Sticker, Scissors, Volume2, VolumeX, ArrowLeft, Mic } from 'lucide-react';
import { ImageCropper } from './ImageCropper';
import { VoiceOverRecorder } from './VoiceOverRecorder';
import { AIMusicSuggester } from './AIMusicSuggester';
import { applyImageEffects } from '@/lib/media-processor';
import { useToast } from '@/hooks/use-toast';

interface PostEditorModalProps {
  open: boolean;
  onClose: () => void;
  onBack?: () => void;
  mediaUrl: string;
  mediaType: 'image' | 'video';
  onNext: (editedMedia: string, effects: any) => void;
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
  scenic: [
    { name: 'Lush Green', filter: 'saturate(1.3) hue-rotate(10deg) brightness(1.05)' },
  ],
  throwback: [
    { name: 'Old Film', filter: 'sepia(0.6) contrast(1.25) brightness(0.95)' },
  ],
  portrait: [
    { name: 'Glow Up', filter: 'brightness(1.12) saturate(1.1) blur(0.2px)' },
  ],
  magic: [
    { name: 'Neon Dreams', filter: 'saturate(1.7) contrast(1.3) hue-rotate(270deg)' },
  ],
};

export function PostEditorModal({ open, onClose, onBack, mediaUrl, mediaType, onNext }: PostEditorModalProps) {
  const { toast } = useToast();
  const [selectedFilter, setSelectedFilter] = useState<string | null>(null);
  const [filterCategory, setFilterCategory] = useState<keyof typeof FILTERS>('hotVibes');
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [saturation, setSaturation] = useState(100);
  const [isMuted, setIsMuted] = useState(false);
  const [textOverlay, setTextOverlay] = useState('');
  const [textPosition, setTextPosition] = useState<'top' | 'center' | 'bottom'>('center');
  const [selectedSticker, setSelectedSticker] = useState<string>('');
  const [overlayAudioFile, setOverlayAudioFile] = useState<File | null>(null);
  const [croppedImageUrl, setCroppedImageUrl] = useState<string>(mediaUrl);
  const [showCropper, setShowCropper] = useState(false);
  const [voiceOverBlob, setVoiceOverBlob] = useState<Blob | null>(null);
  const [showMusicSuggester, setShowMusicSuggester] = useState(true);
  const [processing, setProcessing] = useState(false);

  const STICKERS = ['❤️', '🔥', '✨', '🎉', '😍', '👍', '💯', '⭐'];

  const getFilterStyle = () => {
    const filterObj = selectedFilter ? FILTERS[filterCategory].find(f => f.name === selectedFilter) : null;
    return {
      filter: `${filterObj?.filter || ''} brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%)`,
    };
  };

  const handleNext = async () => {
    if (mediaType === 'image') {
      setProcessing(true);
      try {
        const filterObj = selectedFilter ? FILTERS[filterCategory].find(f => f.name === selectedFilter) : null;
        const processedBlob = await applyImageEffects(croppedImageUrl, {
          filter: filterObj?.filter,
          brightness,
          contrast,
          saturation,
          textOverlay,
          textPosition,
          selectedSticker,
        });
        const processedUrl = URL.createObjectURL(processedBlob);
        onNext(processedUrl, { processedBlob, filter: selectedFilter, brightness, contrast, saturation, textOverlay, selectedSticker, overlayAudioFile, voiceOverBlob });
      } catch (error) {
        toast({ title: 'Processing failed', variant: 'destructive' });
      } finally {
        setProcessing(false);
      }
    } else {
      onNext(mediaUrl, { filter: selectedFilter, brightness, contrast, saturation, textOverlay, selectedSticker, overlayAudioFile, voiceOverBlob });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl w-[95vw] p-0 h-[90vh] flex flex-col">
        <DialogHeader className="px-3 py-2 border-b">
          <div className="flex items-center justify-between">
            <Button variant="ghost" size="sm" onClick={onBack ?? onClose}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <DialogTitle>Edit Your Post</DialogTitle>
            <div className="w-8" />
          </div>
        </DialogHeader>

        <div className="flex-1 flex overflow-hidden">
          <div className="flex-1 bg-black flex items-center justify-center p-4">
            {mediaType === 'image' ? (
              <img src={croppedImageUrl} alt="Preview" className="max-h-full object-contain" style={getFilterStyle()} />
            ) : (
              <video src={mediaUrl} className="max-h-full object-contain" style={getFilterStyle()} controls muted={isMuted} />
            )}
          </div>

          <div className="w-80 border-l overflow-y-auto p-3 space-y-4">
            {showMusicSuggester && (
              <AIMusicSuggester mediaUrl={croppedImageUrl} mediaType={mediaType} onSuggestionAccept={() => {}} onDismiss={() => setShowMusicSuggester(false)} />
            )}

            {mediaType === 'image' && !showCropper && (
              <Button variant="outline" className="w-full" onClick={() => setShowCropper(true)}>
                <Scissors className="w-4 h-4 mr-2" />
                Crop Image
              </Button>
            )}

            {showCropper && (
              <ImageCropper imageUrl={croppedImageUrl} onCropComplete={(url) => { setCroppedImageUrl(url); setShowCropper(false); }} onClose={() => setShowCropper(false)} />
            )}

            {!voiceOverBlob && (
              <VoiceOverRecorder onRecordingComplete={(blob) => setVoiceOverBlob(blob)} />
            )}

            <Tabs value={filterCategory} onValueChange={(v) => setFilterCategory(v as any)}>
              <TabsList className="grid grid-cols-4">
                <TabsTrigger value="hotVibes">Hot</TabsTrigger>
                <TabsTrigger value="everyday">Daily</TabsTrigger>
                <TabsTrigger value="culinary">Food</TabsTrigger>
                <TabsTrigger value="active">Fit</TabsTrigger>
              </TabsList>
              {Object.entries(FILTERS).map(([category, filters]) => (
                <TabsContent key={category} value={category}>
                  {filters.map((filter) => (
                    <Button key={filter.name} variant={selectedFilter === filter.name ? "default" : "outline"} className="w-full mb-1" onClick={() => setSelectedFilter(filter.name)}>
                      {filter.name}
                    </Button>
                  ))}
                </TabsContent>
              ))}
            </Tabs>

            <div>
              <label className="text-xs">Brightness</label>
              <Slider value={[brightness]} onValueChange={([v]) => setBrightness(v)} min={50} max={150} />
            </div>
          </div>
        </div>

        <div className="border-t p-3 flex gap-2">
          <Button variant="outline" onClick={onClose} disabled={processing}>Cancel</Button>
          <Button onClick={handleNext} className="flex-1" disabled={processing}>{processing ? 'Processing...' : 'Next'}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
