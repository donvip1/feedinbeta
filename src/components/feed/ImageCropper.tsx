import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Crop, RotateCw, X } from 'lucide-react';

interface ImageCropperProps {
  imageUrl: string;
  onCropComplete: (croppedImage: string) => void;
  onClose: () => void;
}

const ASPECT_RATIOS = [
  { name: 'Original', value: 0 },
  { name: 'Freeform', value: 0 },
  { name: '3:4', value: 3 / 4 },
  { name: '9:16', value: 9 / 16 },
  { name: '1:1', value: 1 },
  { name: 'Post', value: 4 / 5 },
  { name: 'Story', value: 9 / 16 },
];

interface ImageCropperPropsWithOpen extends ImageCropperProps {
  open?: boolean;
}

export function ImageCropper({ imageUrl, onCropComplete, onClose, open = true }: ImageCropperPropsWithOpen) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [rotation, setRotation] = useState(0);
  const [selectedRatio, setSelectedRatio] = useState(0);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    drawImage();
  }, [rotation, scale]);

  const drawImage = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = imageUrl;
    
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.save();
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate((rotation * Math.PI) / 180);
      ctx.scale(scale, scale);
      ctx.drawImage(img, -img.width / 2, -img.height / 2);
      ctx.restore();
    };
  };

  const handleCrop = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.toBlob((blob) => {
      if (blob) {
        const url = URL.createObjectURL(blob);
        onCropComplete(url);
      }
    }, 'image/jpeg', 0.95);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="h-screen w-screen max-w-none m-0 p-0 bg-black border-0 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 text-white">
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="text-white hover:bg-white/10"
          >
            <X className="w-6 h-6" />
          </Button>
          <Button
            onClick={handleCrop}
            className="bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            <Crop className="w-4 h-4 mr-2" />
            Done
          </Button>
        </div>

        {/* Image preview - takes most of the screen */}
        <div className="flex-1 flex items-center justify-center overflow-hidden p-4">
          <canvas 
            ref={canvasRef} 
            className="max-w-full max-h-full object-contain"
            style={{ touchAction: 'none' }}
          />
        </div>

        {/* Controls - fixed at bottom */}
        <div className="bg-background/95 backdrop-blur p-4 space-y-4 border-t border-border">
          <div>
            <label className="text-xs mb-2 block font-medium">Aspect Ratio</label>
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
              {ASPECT_RATIOS.map((ratio, idx) => (
                <Button
                  key={ratio.name}
                  variant={selectedRatio === idx ? 'default' : 'outline'}
                  size="sm"
                  className="whitespace-nowrap"
                  onClick={() => setSelectedRatio(idx)}
                >
                  {ratio.name}
                </Button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs mb-2 block font-medium flex items-center gap-2">
              <RotateCw className="w-3 h-3" />
              Rotation: {rotation}°
            </label>
            <Slider
              value={[rotation]}
              onValueChange={([v]) => setRotation(v)}
              min={0}
              max={360}
              step={15}
              className="touch-none"
            />
          </div>

          <div>
            <label className="text-xs mb-2 block font-medium">Zoom: {scale.toFixed(1)}x</label>
            <Slider
              value={[scale]}
              onValueChange={([v]) => setScale(v)}
              min={0.5}
              max={3}
              step={0.1}
              className="touch-none"
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
