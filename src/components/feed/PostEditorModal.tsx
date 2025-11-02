import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ImageIcon, Video, Wand2, Type, Music, Sticker, Scissors, Volume2, VolumeX, ArrowLeft, X } from 'lucide-react';

interface PostEditorModalProps {
  open: boolean;
  onClose: () => void;
  onBack?: () => void;
  mediaUrl: string;
  mediaType: 'image' | 'video';
  onNext: (editedMedia: string, effects: any) => void;
}

const FILTERS = {
  trending: [
    { name: 'Vibrant', filter: 'contrast(1.2) saturate(1.3)' },
    { name: 'Cool', filter: 'hue-rotate(210deg) saturate(1.1)' },
    { name: 'Warm', filter: 'sepia(0.3) saturate(1.2)' },
  ],
  portrait: [
    { name: 'Soft', filter: 'brightness(1.1) contrast(0.9)' },
    { name: 'Sharp', filter: 'contrast(1.3) brightness(1.05)' },
    { name: 'Natural', filter: 'saturate(0.9) brightness(1.05)' },
  ],
  landscape: [
    { name: 'Dramatic', filter: 'contrast(1.3) saturate(1.2)' },
    { name: 'Misty', filter: 'brightness(1.1) saturate(0.8) blur(0.5px)' },
    { name: 'Golden', filter: 'sepia(0.2) saturate(1.3) brightness(1.1)' },
  ],
  vibe: [
    { name: 'Neon', filter: 'saturate(1.5) brightness(1.2) hue-rotate(90deg)' },
    { name: 'Vintage', filter: 'sepia(0.5) contrast(1.2) brightness(0.9)' },
    { name: 'Dreamy', filter: 'brightness(1.15) saturate(0.7) blur(1px)' },
  ],
  bw: [
    { name: 'Classic B&W', filter: 'grayscale(1)' },
    { name: 'High Contrast', filter: 'grayscale(1) contrast(1.4)' },
    { name: 'Soft B&W', filter: 'grayscale(1) brightness(1.1) contrast(0.9)' },
  ],
};

export function PostEditorModal({ open, onClose, onBack, mediaUrl, mediaType, onNext }: PostEditorModalProps) {
  const [selectedFilter, setSelectedFilter] = useState<string | null>(null);
  const [filterCategory, setFilterCategory] = useState<keyof typeof FILTERS>('trending');
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [saturation, setSaturation] = useState(100);
const [isMuted, setIsMuted] = useState(false);
const [showText, setShowText] = useState(false);
const [textOverlay, setTextOverlay] = useState('');
const [overlayAudioFile, setOverlayAudioFile] = useState<File | null>(null);

  const getFilterStyle = () => {
    const filterObj = selectedFilter 
      ? FILTERS[filterCategory].find(f => f.name === selectedFilter)
      : null;
    
    return {
      filter: `${filterObj?.filter || ''} brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%)`,
    };
  };

const handleNext = () => {
  onNext(mediaUrl, {
    filter: selectedFilter,
    brightness,
    contrast,
    saturation,
    muted: isMuted,
    textOverlay,
    overlayAudioFile,
  });
};

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl w-[95vw] h-[calc(100vh-8rem)] max-h-[calc(100vh-8rem)] p-0 mb-16">
        <div className="flex flex-col h-full">
          <DialogHeader className="px-3 py-2 border-b sticky top-0 bg-background z-10 shrink-0">
            <div className="flex items-center justify-between">
              <Button variant="ghost" size="sm" onClick={onBack ?? onClose} aria-label="Back" className="h-8 w-8 p-0">
                <ArrowLeft className="w-4 h-4" />
              </Button>
              <DialogTitle className="text-sm">Edit Your Post</DialogTitle>
              <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close" className="h-8 w-8 p-0">
                <X className="w-4 h-4" />
              </Button>
            </div>
          </DialogHeader>

          <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
            {/* Preview Section */}
            <div className="flex-1 bg-black flex items-center justify-center p-2 md:p-4 overflow-x-auto min-h-[200px] md:min-h-0">
              <div className="flex items-center justify-center min-w-full">
                {mediaType === 'image' ? (
                  <img 
                    src={mediaUrl} 
                    alt="Preview" 
                    className="max-w-full max-h-[200px] md:max-h-full object-contain"
                    style={getFilterStyle()}
                  />
                ) : (
                  <video 
                    src={mediaUrl} 
                    className="max-w-full max-h-[200px] md:max-h-full object-contain"
                    style={getFilterStyle()}
                    controls={!isMuted}
                    muted={isMuted}
                  />
                )}
              </div>
            </div>

            {/* Editor Panel */}
            <div className="w-full md:w-80 border-t md:border-t-0 md:border-l bg-background flex-shrink-0">
              <ScrollArea className="h-full max-h-[calc(100vh-20rem)] md:max-h-full">
                <div className="p-3 space-y-4">
                  {/* Filters */}
                  <div>
                    <h3 className="font-semibold mb-2 text-sm">Filters</h3>
                    <Tabs value={filterCategory} onValueChange={(v) => setFilterCategory(v as any)} className="w-full">
                      <TabsList className="grid w-full grid-cols-3 h-8">
                        <TabsTrigger value="trending" className="text-xs">Trend</TabsTrigger>
                        <TabsTrigger value="portrait" className="text-xs">Portrait</TabsTrigger>
                        <TabsTrigger value="landscape" className="text-xs">Land</TabsTrigger>
                      </TabsList>
                      <TabsList className="grid w-full grid-cols-2 mt-1 h-8">
                        <TabsTrigger value="vibe" className="text-xs">Vibe</TabsTrigger>
                        <TabsTrigger value="bw" className="text-xs">B&W</TabsTrigger>
                      </TabsList>
                      {Object.entries(FILTERS).map(([category, filters]) => (
                        <TabsContent key={category} value={category} className="space-y-1.5 mt-2">
                          {filters.map((filter) => (
                            <Button
                              key={filter.name}
                              variant={selectedFilter === filter.name ? "default" : "outline"}
                              className="w-full justify-start h-8 text-xs"
                              onClick={() => setSelectedFilter(filter.name)}
                            >
                              <Wand2 className="w-3 h-3 mr-2" />
                              {filter.name}
                            </Button>
                          ))}
                        </TabsContent>
                      ))}
                    </Tabs>
                  </div>

                  {/* Adjustments */}
                  <div className="space-y-3">
                    <h3 className="font-semibold text-sm">Adjustments</h3>
                    
                    <div>
                      <label className="text-xs mb-1 block">Brightness</label>
                      <Slider
                        value={[brightness]}
                        onValueChange={([v]) => setBrightness(v)}
                        min={50}
                        max={150}
                        step={1}
                      />
                    </div>

                    <div>
                      <label className="text-xs mb-1 block">Contrast</label>
                      <Slider
                        value={[contrast]}
                        onValueChange={([v]) => setContrast(v)}
                        min={50}
                        max={150}
                        step={1}
                      />
                    </div>

                    <div>
                      <label className="text-xs mb-1 block">Saturation</label>
                      <Slider
                        value={[saturation]}
                        onValueChange={([v]) => setSaturation(v)}
                        min={0}
                        max={200}
                        step={1}
                      />
                    </div>
                  </div>

                  {/* Quick Tools */}
                  <div className="space-y-1.5">
                    <h3 className="font-semibold mb-2 text-sm">Quick Tools</h3>
                    
                    {mediaType === 'video' && (
                      <Button
                        variant="outline"
                        className="w-full justify-start h-8 text-xs"
                        onClick={() => setIsMuted(!isMuted)}
                      >
                        {isMuted ? <VolumeX className="w-3 h-3 mr-2" /> : <Volume2 className="w-3 h-3 mr-2" />}
                        {isMuted ? 'Unmute' : 'Mute'} Audio
                      </Button>
                    )}

                    <Button variant="outline" className="w-full justify-start h-8 text-xs" disabled>
                      <Type className="w-3 h-3 mr-2" />
                      Add Text <Badge className="ml-auto text-[10px] h-4">Soon</Badge>
                    </Button>

                    <Button variant="outline" className="w-full justify-start h-8 text-xs" disabled>
                      <Sticker className="w-3 h-3 mr-2" />
                      Add Stickers <Badge className="ml-auto text-[10px] h-4">Soon</Badge>
                    </Button>

                    {mediaType === 'video' && (
                      <Button variant="outline" className="w-full justify-start h-8 text-xs" disabled>
                        <Scissors className="w-3 h-3 mr-2" />
                        Auto Cut (60s) <Badge className="ml-auto text-[10px] h-4">Soon</Badge>
                      </Button>
                    )}

                    <Button variant="outline" className="w-full justify-start h-8 text-xs" disabled>
                      <Music className="w-3 h-3 mr-2" />
                      Add Music <Badge className="ml-auto text-[10px] h-4">Soon</Badge>
                    </Button>
                  </div>
                </div>
              </ScrollArea>
            </div>
          </div>

          <div className="px-3 py-2 border-t flex justify-between shrink-0">
            <Button variant="outline" onClick={onClose} size="sm" className="h-8 text-xs">
              Cancel
            </Button>
            <Button onClick={handleNext} className="bg-gradient-primary h-8 text-xs" size="sm">
              Next
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
