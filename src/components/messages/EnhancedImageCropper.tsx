import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Crop, X, Check, Move, ZoomIn, ZoomOut } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface EnhancedImageCropperProps {
  open: boolean;
  onClose: () => void;
  imageFile: File;
  onSave: (blob: Blob) => void;
}

const ASPECT_RATIOS = [
  { name: 'Free', ratio: null },
  { name: '1:1', ratio: 1 },
  { name: '4:5', ratio: 4 / 5 },
  { name: '16:9', ratio: 16 / 9 },
  { name: '9:16', ratio: 9 / 16 },
];

export const EnhancedImageCropper = ({
  open,
  onClose,
  imageFile,
  onSave,
}: EnhancedImageCropperProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  
  const [selectedRatio, setSelectedRatio] = useState(0);
  const [cropArea, setCropArea] = useState({ x: 0, y: 0, width: 200, height: 200 });
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [scale, setScale] = useState(1);
  const [imagePos, setImagePos] = useState({ x: 0, y: 0 });
  const [isPinching, setIsPinching] = useState(false);
  const [lastPinchDistance, setLastPinchDistance] = useState(0);

  useEffect(() => {
    if (imageFile && canvasRef.current && containerRef.current) {
      const img = new Image();
      img.onload = () => {
        imageRef.current = img;
        const container = containerRef.current!;
        const containerWidth = container.clientWidth;
        const containerHeight = container.clientHeight;
        
        // Calculate initial scale to fit image
        const scaleX = containerWidth / img.width;
        const scaleY = containerHeight / img.height;
        const initialScale = Math.min(scaleX, scaleY, 1);
        
        setScale(initialScale);
        
        // Center the image
        const scaledWidth = img.width * initialScale;
        const scaledHeight = img.height * initialScale;
        setImagePos({
          x: (containerWidth - scaledWidth) / 2,
          y: (containerHeight - scaledHeight) / 2,
        });

        // Set initial crop area to center
        setCropArea({
          x: containerWidth / 2 - 100,
          y: containerHeight / 2 - 100,
          width: 200,
          height: 200,
        });

        drawCanvas();
      };
      img.src = URL.createObjectURL(imageFile);
      return () => URL.revokeObjectURL(img.src);
    }
  }, [imageFile]);

  useEffect(() => {
    drawCanvas();
  }, [scale, imagePos, cropArea]);

  const drawCanvas = () => {
    const canvas = canvasRef.current;
    const img = imageRef.current;
    if (!canvas || !img) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const container = containerRef.current;
    if (!container) return;

    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw image
    ctx.drawImage(
      img,
      imagePos.x,
      imagePos.y,
      img.width * scale,
      img.height * scale
    );

    // Draw overlay (darkened areas outside crop)
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.clearRect(cropArea.x, cropArea.y, cropArea.width, cropArea.height);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.strokeRect(cropArea.x, cropArea.y, cropArea.width, cropArea.height);

    // Draw corner handles
    const handleSize = 20;
    ctx.fillStyle = '#fff';
    // Top-left
    ctx.fillRect(cropArea.x - handleSize / 2, cropArea.y - handleSize / 2, handleSize, handleSize);
    // Top-right
    ctx.fillRect(cropArea.x + cropArea.width - handleSize / 2, cropArea.y - handleSize / 2, handleSize, handleSize);
    // Bottom-left
    ctx.fillRect(cropArea.x - handleSize / 2, cropArea.y + cropArea.height - handleSize / 2, handleSize, handleSize);
    // Bottom-right
    ctx.fillRect(cropArea.x + cropArea.width - handleSize / 2, cropArea.y + cropArea.height - handleSize / 2, handleSize, handleSize);
  };

  const getTouchDistance = (touches: React.TouchList) => {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      // Pinch to zoom
      setIsPinching(true);
      setLastPinchDistance(getTouchDistance(e.touches));
    } else if (e.touches.length === 1) {
      const touch = e.touches[0];
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;

      const x = touch.clientX - rect.left;
      const y = touch.clientY - rect.top;

      // Check if touching crop area
      if (
        x >= cropArea.x &&
        x <= cropArea.x + cropArea.width &&
        y >= cropArea.y &&
        y <= cropArea.y + cropArea.height
      ) {
        setIsDragging(true);
        setDragStart({ x: x - cropArea.x, y: y - cropArea.y });
      }
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    e.preventDefault();

    if (isPinching && e.touches.length === 2) {
      const distance = getTouchDistance(e.touches);
      const scaleChange = distance / lastPinchDistance;
      setScale((prev) => Math.max(0.5, Math.min(3, prev * scaleChange)));
      setLastPinchDistance(distance);
    } else if (isDragging && e.touches.length === 1) {
      const touch = e.touches[0];
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;

      const x = touch.clientX - rect.left;
      const y = touch.clientY - rect.top;

      setCropArea((prev) => ({
        ...prev,
        x: Math.max(0, Math.min(rect.width - prev.width, x - dragStart.x)),
        y: Math.max(0, Math.min(rect.height - prev.height, y - dragStart.y)),
      }));
    }
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
    setIsPinching(false);
    setIsResizing(false);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (
      x >= cropArea.x &&
      x <= cropArea.x + cropArea.width &&
      y >= cropArea.y &&
      y <= cropArea.y + cropArea.height
    ) {
      setIsDragging(true);
      setDragStart({ x: x - cropArea.x, y: y - cropArea.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;

    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setCropArea((prev) => ({
      ...prev,
      x: Math.max(0, Math.min(rect.width - prev.width, x - dragStart.x)),
      y: Math.max(0, Math.min(rect.height - prev.height, y - dragStart.y)),
    }));
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleCrop = () => {
    const canvas = canvasRef.current;
    const img = imageRef.current;
    if (!canvas || !img) return;

    // Create a new canvas for the cropped image
    const cropCanvas = document.createElement('canvas');
    const ctx = cropCanvas.getContext('2d');
    if (!ctx) return;

    // Calculate the crop area in the original image coordinates
    const scaleRatio = 1 / scale;
    const cropX = (cropArea.x - imagePos.x) * scaleRatio;
    const cropY = (cropArea.y - imagePos.y) * scaleRatio;
    const cropWidth = cropArea.width * scaleRatio;
    const cropHeight = cropArea.height * scaleRatio;

    cropCanvas.width = cropWidth;
    cropCanvas.height = cropHeight;

    ctx.drawImage(
      img,
      cropX,
      cropY,
      cropWidth,
      cropHeight,
      0,
      0,
      cropWidth,
      cropHeight
    );

    cropCanvas.toBlob((blob) => {
      if (blob) {
        onSave(blob);
        toast({ title: 'Image cropped successfully' });
      }
    }, 'image/jpeg', 0.95);
  };

  const setAspectRatio = (index: number) => {
    setSelectedRatio(index);
    const ratio = ASPECT_RATIOS[index].ratio;
    
    if (ratio) {
      setCropArea((prev) => ({
        ...prev,
        height: prev.width / ratio,
      }));
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
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setScale((s) => Math.max(0.5, s - 0.1))}
              className="text-white hover:bg-white/10"
            >
              <ZoomOut className="w-5 h-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setScale((s) => Math.min(3, s + 0.1))}
              className="text-white hover:bg-white/10"
            >
              <ZoomIn className="w-5 h-5" />
            </Button>
          </div>
          <Button
            onClick={handleCrop}
            className="bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            <Check className="w-4 h-4 mr-2" />
            Done
          </Button>
        </div>

        {/* Canvas */}
        <div 
          ref={containerRef}
          className="flex-1 relative overflow-hidden"
        >
          <canvas
            ref={canvasRef}
            className="w-full h-full"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            style={{ touchAction: 'none' }}
          />
          <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-background/80 backdrop-blur px-3 py-1 rounded-full text-xs text-white">
            <Move className="w-3 h-3 inline mr-1" />
            Drag to move crop area
          </div>
        </div>

        {/* Controls */}
        <div className="bg-background/95 backdrop-blur p-4 space-y-4 border-t border-border shrink-0">
          <div>
            <label className="text-xs mb-2 block font-medium">Aspect Ratio</label>
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
              {ASPECT_RATIOS.map((ratio, idx) => (
                <Button
                  key={ratio.name}
                  variant={selectedRatio === idx ? 'default' : 'outline'}
                  size="sm"
                  className="whitespace-nowrap"
                  onClick={() => setAspectRatio(idx)}
                >
                  {ratio.name}
                </Button>
              ))}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
