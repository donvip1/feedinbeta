import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, Scissors, Check, X, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface CreateStickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl: string;
  onStickerCreated?: (stickerUrl: string) => void;
}

export const CreateStickerModal = ({
  isOpen,
  onClose,
  imageUrl,
  onStickerCreated
}: CreateStickerModalProps) => {
  const [status, setStatus] = useState<'loading' | 'processing' | 'done' | 'error'>('loading');
  const [stickerUrl, setStickerUrl] = useState<string | null>(null);
  const [originalImage, setOriginalImage] = useState<HTMLImageElement | null>(null);

  useEffect(() => {
    if (!isOpen || !imageUrl) return;
    
    setStatus('loading');
    setStickerUrl(null);
    
    // Load the image first
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      setOriginalImage(img);
      setStatus('processing');
      processImage(img);
    };
    img.onerror = () => {
      setStatus('error');
    };
    img.src = imageUrl;

    return () => {
      if (stickerUrl) {
        URL.revokeObjectURL(stickerUrl);
      }
    };
  }, [isOpen, imageUrl]);

  const processImage = async (img: HTMLImageElement) => {
    try {
      // Simple background removal using canvas
      // For a more advanced approach, you'd use the Hugging Face transformers
      // But this gives a quick outline-based sticker effect
      
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas not supported');

      // Resize if needed (max 512px for stickers)
      const maxSize = 512;
      let width = img.naturalWidth;
      let height = img.naturalHeight;
      
      if (width > maxSize || height > maxSize) {
        if (width > height) {
          height = Math.round((height * maxSize) / width);
          width = maxSize;
        } else {
          width = Math.round((width * maxSize) / height);
          height = maxSize;
        }
      }

      canvas.width = width;
      canvas.height = height;
      ctx.drawImage(img, 0, 0, width, height);

      // Get image data
      const imageData = ctx.getImageData(0, 0, width, height);
      const data = imageData.data;

      // Simple edge detection + background removal
      // Remove near-white and near-black backgrounds
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        
        // Calculate if pixel is close to white or near-gray background
        const brightness = (r + g + b) / 3;
        const isNearWhite = brightness > 240 && Math.abs(r - g) < 15 && Math.abs(g - b) < 15;
        const isNearBlack = brightness < 20 && Math.abs(r - g) < 10 && Math.abs(g - b) < 10;
        
        // Check if at edges
        const x = (i / 4) % width;
        const y = Math.floor((i / 4) / width);
        const isEdge = x < 5 || x > width - 5 || y < 5 || y > height - 5;
        
        if ((isNearWhite || isNearBlack) && isEdge) {
          // Make edge backgrounds transparent
          data[i + 3] = 0;
        }
      }

      ctx.putImageData(imageData, 0, 0);

      // Add white outline for sticker effect
      const outlineCanvas = document.createElement('canvas');
      outlineCanvas.width = width + 20;
      outlineCanvas.height = height + 20;
      const outlineCtx = outlineCanvas.getContext('2d');
      
      if (outlineCtx) {
        // Draw white outline
        outlineCtx.shadowColor = 'white';
        outlineCtx.shadowBlur = 5;
        outlineCtx.shadowOffsetX = 0;
        outlineCtx.shadowOffsetY = 0;
        
        // Draw multiple times for thicker outline
        for (let i = 0; i < 5; i++) {
          outlineCtx.drawImage(canvas, 10, 10);
        }
        
        // Reset shadow and draw original
        outlineCtx.shadowColor = 'transparent';
        outlineCtx.shadowBlur = 0;
        outlineCtx.drawImage(canvas, 10, 10);
      }

      // Convert to blob
      const finalCanvas = outlineCanvas;
      finalCanvas.toBlob((blob) => {
        if (blob) {
          const url = URL.createObjectURL(blob);
          setStickerUrl(url);
          setStatus('done');
        } else {
          setStatus('error');
        }
      }, 'image/png');

    } catch (error) {
      console.error('Error creating sticker:', error);
      setStatus('error');
    }
  };

  const handleSave = () => {
    if (stickerUrl) {
      onStickerCreated?.(stickerUrl);
      toast.success('Sticker created!');
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Scissors className="w-5 h-5" />
            Create Sticker
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col items-center gap-4 py-4">
          {/* Preview Area */}
          <div className={cn(
            "w-64 h-64 rounded-xl flex items-center justify-center overflow-hidden",
            "bg-[repeating-conic-gradient(hsl(var(--muted))_0%_25%,transparent_0%_50%)]",
            "bg-[length:20px_20px] border border-border"
          )}>
            {status === 'loading' && (
              <div className="flex flex-col items-center gap-2">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Loading image...</p>
              </div>
            )}
            
            {status === 'processing' && (
              <div className="flex flex-col items-center gap-2">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Creating sticker...</p>
              </div>
            )}
            
            {status === 'done' && stickerUrl && (
              <img 
                src={stickerUrl} 
                alt="Sticker preview" 
                className="max-w-full max-h-full object-contain"
              />
            )}
            
            {status === 'error' && (
              <div className="flex flex-col items-center gap-2 text-destructive">
                <AlertCircle className="w-8 h-8" />
                <p className="text-sm">Failed to create sticker</p>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-3 w-full">
            <Button
              variant="outline"
              className="flex-1"
              onClick={onClose}
            >
              <X className="w-4 h-4 mr-2" />
              Cancel
            </Button>
            <Button
              className="flex-1"
              onClick={handleSave}
              disabled={status !== 'done'}
            >
              <Check className="w-4 h-4 mr-2" />
              Save Sticker
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
