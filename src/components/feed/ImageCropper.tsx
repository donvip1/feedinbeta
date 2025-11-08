import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Crop, RotateCw } from 'lucide-react';

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

export function ImageCropper({ imageUrl, onCropComplete, onClose }: ImageCropperProps) {
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
    <div className="space-y-4">
      <div className="bg-black rounded-lg overflow-hidden flex items-center justify-center">
        <canvas ref={canvasRef} className="max-w-full max-h-96" />
      </div>

      <div>
        <label className="text-xs mb-2 block font-medium">Aspect Ratio</label>
        <div className="grid grid-cols-4 gap-2">
          {ASPECT_RATIOS.map((ratio, idx) => (
            <Button
              key={ratio.name}
              variant={selectedRatio === idx ? 'default' : 'outline'}
              size="sm"
              className="h-8 text-xs"
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
        />
      </div>

      <div className="flex gap-2">
        <Button variant="outline" onClick={onClose} className="flex-1">
          Cancel
        </Button>
        <Button onClick={handleCrop} className="flex-1 bg-gradient-primary">
          <Crop className="w-4 h-4 mr-2" />
          Apply Crop
        </Button>
      </div>
    </div>
  );
}
