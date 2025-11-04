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
      <DialogContent className="max-w-4xl w-[95vw] p-0 max-h-[95vh] md:h-[90vh] flex flex-col">
        <DialogHeader className="px-3 py-2 border-b shrink-0">
          <div className="flex items-center justify-between">
            <Button variant="ghost" size="sm" onClick={onBack ?? onClose}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <DialogTitle className="text-sm md:text-base">Edit Your Post</DialogTitle>
            <div className="w-8" />
          </div>
        </DialogHeader>

        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
          {/* Image/Video Preview - Top on mobile, left on desktop */}
          <div className="w-full md:flex-1 bg-black flex items-center justify-center p-2 md:p-4 h-48 md:h-auto shrink-0">
            {mediaType === 'image' ? (
              <img src={croppedImageUrl} alt="Preview" className="max-h-full max-w-full object-contain" style={getFilterStyle()} />
            ) : (
              <video src={mediaUrl} className="max-h-full max-w-full object-contain" style={getFilterStyle()} controls muted={isMuted} />
            )}
          </div>

          {/* Editing Tools - Scrollable below preview on mobile, sidebar on desktop */}
          <div className="w-full md:w-80 border-t md:border-t-0 md:border-l overflow-y-auto p-3 space-y-4 flex-1 md:flex-initial">
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

            <Tabs value={filterCategory} onValueChange={(v) => setFilterCategory(v as any)} className="w-full">
              <TabsList className="grid grid-cols-4 w-full">
                <TabsTrigger value="hotVibes" className="text-xs">Hot</TabsTrigger>
                <TabsTrigger value="everyday" className="text-xs">Daily</TabsTrigger>
                <TabsTrigger value="culinary" className="text-xs">Food</TabsTrigger>
                <TabsTrigger value="active" className="text-xs">Fit</TabsTrigger>
              </TabsList>
              {Object.entries(FILTERS).map(([category, filters]) => (
                <TabsContent key={category} value={category} className="space-y-2">
                  {filters.map((filter) => (
                    <Button key={filter.name} variant={selectedFilter === filter.name ? "default" : "outline"} className="w-full text-sm" onClick={() => setSelectedFilter(filter.name)}>
                      {filter.name}
                    </Button>
                  ))}
                </TabsContent>
              ))}
            </Tabs>

            <div className="space-y-2">
              <label className="text-xs font-medium">Brightness</label>
              <Slider value={[brightness]} onValueChange={([v]) => setBrightness(v)} min={50} max={150} />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium">Contrast</label>
              <Slider value={[contrast]} onValueChange={([v]) => setContrast(v)} min={50} max={150} />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium">Saturation</label>
              <Slider value={[saturation]} onValueChange={([v]) => setSaturation(v)} min={0} max={200} />
            </div>

            {mediaType === 'image' && (
              <>
                <div className="space-y-2">
                  <label className="text-xs font-medium flex items-center gap-2">
                    <Type className="w-4 h-4" />
                    Text Overlay
                  </label>
                  <Input
                    placeholder="Add text..."
                    value={textOverlay}
                    onChange={(e) => setTextOverlay(e.target.value)}
                    className="text-sm"
                  />
                  <div className="flex gap-2">
                    {(['top', 'center', 'bottom'] as const).map((pos) => (
                      <Button
                        key={pos}
                        size="sm"
                        variant={textPosition === pos ? "default" : "outline"}
                        onClick={() => setTextPosition(pos)}
                        className="flex-1 text-xs capitalize"
                      >
                        {pos}
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-medium flex items-center gap-2">
                    <Sticker className="w-4 h-4" />
                    Add Sticker
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {STICKERS.map((sticker) => (
                      <Button
                        key={sticker}
                        variant={selectedSticker === sticker ? "default" : "outline"}
                        onClick={() => setSelectedSticker(selectedSticker === sticker ? '' : sticker)}
                        className="text-2xl h-12"
                      >
                        {sticker}
                      </Button>
                    ))}
                  </div>
                </div>
              </>
            )}

            {mediaType === 'video' && (
              <Button
                variant="outline"
                className="w-full"
                onClick={() => setIsMuted(!isMuted)}
              >
                {isMuted ? <VolumeX className="w-4 h-4 mr-2" /> : <Volume2 className="w-4 h-4 mr-2" />}
                {isMuted ? 'Unmute' : 'Mute'}
              </Button>
            )}
          </div>
        </div>

        <div className="border-t p-3 pb-20 md:pb-3 flex gap-2 shrink-0 bg-background">
          <Button variant="outline" onClick={onClose} disabled={processing} className="flex-1 md:flex-initial">Cancel</Button>
          <Button onClick={handleNext} className="flex-1" disabled={processing}>{processing ? 'Processing...' : 'Next'}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
