import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { RotateCw, Save, X } from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import { toast } from '@/hooks/use-toast';

const FILTERS = [
  { name: 'Normal', filter: 'none' },
  { name: 'Clarendon', filter: 'contrast(1.2) saturate(1.35)' },
  { name: 'Gingham', filter: 'brightness(1.05) hue-rotate(-10deg)' },
  { name: 'Moon', filter: 'grayscale(1) contrast(1.1) brightness(1.1)' },
  { name: 'Lark', filter: 'contrast(0.9) brightness(1.1)' },
  { name: 'Reyes', filter: 'sepia(0.22) brightness(1.1) contrast(0.85)' },
  { name: 'Juno', filter: 'contrast(1.2) brightness(1.1) saturate(1.4)' },
  { name: 'Slumber', filter: 'saturate(0.66) brightness(1.05)' },
  { name: 'Crema', filter: 'sepia(0.5) contrast(1.25) brightness(1.15)' },
  { name: 'Aden', filter: 'contrast(0.9) brightness(1.2) saturate(0.85) hue-rotate(-20deg)' },
];

interface ImageEditorProps {
  open: boolean;
  onClose: () => void;
  imageFile: File;
  onSave: (editedBlob: Blob) => void;
}

export const ImageEditor = ({ open, onClose, imageFile, onSave }: ImageEditorProps) => {
  const [rotation, setRotation] = useState(0);
  const [selectedFilter, setSelectedFilter] = useState('none');
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [isCropping, setIsCropping] = useState(false);
  const [cropArea, setCropArea] = useState({ x: 0, y: 0, width: 100, height: 100 });
  const [imageUrl, setImageUrl] = useState<string>('');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    if (imageFile) {
      const url = URL.createObjectURL(imageFile);
      setImageUrl(url);
      return () => URL.revokeObjectURL(url);
    }
  }, [imageFile]);

  const applyFilters = () => {
    return `${selectedFilter} brightness(${brightness}%) contrast(${contrast}%)`;
  };

  const handleRotate = () => {
    setRotation((prev) => (prev + 90) % 360);
  };

  const handleSave = async () => {
    try {
      const canvas = canvasRef.current;
      const img = imageRef.current;
      
      if (!canvas || !img) {
        toast({ title: 'Error', description: 'Image not loaded', variant: 'destructive' });
        return;
      }

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Set canvas size
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;

      // Apply rotation
      ctx.save();
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate((rotation * Math.PI) / 180);
      ctx.translate(-canvas.width / 2, -canvas.height / 2);

      // Apply filters
      ctx.filter = applyFilters();
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      ctx.restore();

      // Convert to blob
      canvas.toBlob((blob) => {
        if (blob) {
          onSave(blob);
          onClose();
          toast({ title: 'Image edited successfully' });
        }
      }, 'image/jpeg', 0.9);
    } catch (error) {
      console.error('Error saving image:', error);
      toast({ title: 'Error saving image', variant: 'destructive' });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="h-screen w-screen max-w-none m-0 p-0 bg-black border-0 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 text-white shrink-0">
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="text-white hover:bg-white/10"
          >
            <X className="w-6 h-6" />
          </Button>
          <Button
            onClick={handleSave}
            className="bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            <Save className="w-4 h-4 mr-2" />
            Done
          </Button>
        </div>

        {/* Image preview - takes most of the screen */}
        <div className="flex-1 flex items-center justify-center overflow-hidden p-4 min-h-0">
          <img
            ref={imageRef}
            src={imageUrl}
            alt="Preview"
            className="max-w-full max-h-full object-contain"
            style={{
              transform: `rotate(${rotation}deg)`,
              filter: applyFilters(),
              touchAction: 'none',
            }}
          />
          <canvas ref={canvasRef} className="hidden" />
        </div>

        {/* Controls - fixed at bottom */}
        <div className="bg-background/95 backdrop-blur p-4 space-y-4 border-t border-border shrink-0 max-h-[50vh] overflow-y-auto">
          {/* Filters */}
          <div>
            <p className="text-xs mb-2 font-medium">Filters</p>
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
              {FILTERS.map((filter) => (
                <Button
                  key={filter.name}
                  variant={selectedFilter === filter.filter ? 'default' : 'outline'}
                  size="sm"
                  className="whitespace-nowrap"
                  onClick={() => setSelectedFilter(filter.filter)}
                >
                  {filter.name}
                </Button>
              ))}
            </div>
          </div>

          {/* Brightness */}
          <div>
            <label className="text-xs mb-2 block font-medium">
              Brightness: {brightness}%
            </label>
            <Slider
              value={[brightness]}
              onValueChange={(value) => setBrightness(value[0])}
              min={50}
              max={150}
              step={1}
              className="touch-none"
            />
          </div>

          {/* Contrast */}
          <div>
            <label className="text-xs mb-2 block font-medium">
              Contrast: {contrast}%
            </label>
            <Slider
              value={[contrast]}
              onValueChange={(value) => setContrast(value[0])}
              min={50}
              max={150}
              step={1}
              className="touch-none"
            />
          </div>

          {/* Rotate */}
          <Button
            variant="outline"
            onClick={handleRotate}
            className="w-full"
            size="lg"
          >
            <RotateCw className="w-5 h-5 mr-2" />
            Rotate 90°
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
