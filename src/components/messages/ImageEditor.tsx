import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { RotateCw, Crop, X } from 'lucide-react';
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
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Image</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Preview */}
          <div className="relative bg-muted rounded-lg overflow-hidden flex items-center justify-center" style={{ minHeight: '400px' }}>
            <img
              ref={imageRef}
              src={imageUrl}
              alt="Preview"
              className="max-w-full max-h-[400px] object-contain"
              style={{
                transform: `rotate(${rotation}deg)`,
                filter: applyFilters(),
              }}
            />
            <canvas ref={canvasRef} className="hidden" />
          </div>

          {/* Filters */}
          <div>
            <p className="text-sm font-medium mb-2">Filters</p>
            <div className="flex gap-2 overflow-x-auto pb-2">
              {FILTERS.map((filter) => (
                <button
                  key={filter.name}
                  onClick={() => setSelectedFilter(filter.filter)}
                  className={`flex-shrink-0 px-4 py-2 rounded-lg text-xs font-medium transition-colors ${
                    selectedFilter === filter.filter
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-accent hover:bg-accent/80'
                  }`}
                >
                  {filter.name}
                </button>
              ))}
            </div>
          </div>

          {/* Adjustments */}
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Brightness: {brightness}%</label>
              <Slider
                value={[brightness]}
                onValueChange={(value) => setBrightness(value[0])}
                min={50}
                max={150}
                step={1}
                className="mt-2"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Contrast: {contrast}%</label>
              <Slider
                value={[contrast]}
                onValueChange={(value) => setContrast(value[0])}
                min={50}
                max={150}
                step={1}
                className="mt-2"
              />
            </div>
          </div>

          {/* Tools */}
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleRotate}>
              <RotateCw className="w-4 h-4 mr-2" />
              Rotate
            </Button>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave}>
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
