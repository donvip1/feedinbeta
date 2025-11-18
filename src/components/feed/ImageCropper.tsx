import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Crop, Check, X } from 'lucide-react';

interface ImageCropperProps {
  imageUrl: string;
  onCropComplete: (croppedImage: string) => void;
  onClose: () => void;
}

export function ImageCropper({ imageUrl, onCropComplete, onClose }: ImageCropperProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const [cropArea, setCropArea] = useState({ x: 0, y: 0, width: 100, height: 100 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [isResizing, setIsResizing] = useState<'tl' | 'tr' | 'bl' | 'br' | false>(false);
  const [imageLoaded, setImageLoaded] = useState(false);

  useEffect(() => {
    const img = imageRef.current;
    if (img) {
      img.onload = () => {
        setImageLoaded(true);
        const container = containerRef.current;
        if (container) {
          const rect = container.getBoundingClientRect();
          const centerX = rect.width * 0.1;
          const centerY = rect.height * 0.1;
          const size = Math.min(rect.width, rect.height) * 0.8;
          setCropArea({ x: centerX, y: centerY, width: size, height: size });
        }
      };
    }
  }, []);

  const handleMouseDown = (e: React.MouseEvent, type: 'move' | 'tl' | 'tr' | 'bl' | 'br') => {
    e.preventDefault();
    if (type === 'move') {
      setIsDragging(true);
      setDragStart({ x: e.clientX - cropArea.x, y: e.clientY - cropArea.y });
    } else {
      setIsResizing(type);
      setDragStart({ x: e.clientX, y: e.clientY });
    }
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    if (isDragging) {
      const newX = Math.max(0, Math.min(e.clientX - dragStart.x, rect.width - cropArea.width));
      const newY = Math.max(0, Math.min(e.clientY - dragStart.y, rect.height - cropArea.height));
      setCropArea(prev => ({ ...prev, x: newX, y: newY }));
    } else if (isResizing) {
      const deltaX = e.clientX - dragStart.x;
      const deltaY = e.clientY - dragStart.y;
      
      let newX = cropArea.x;
      let newY = cropArea.y;
      let newWidth = cropArea.width;
      let newHeight = cropArea.height;

      if (isResizing === 'br') {
        newWidth = Math.max(50, Math.min(cropArea.width + deltaX, rect.width - cropArea.x));
        newHeight = Math.max(50, Math.min(cropArea.height + deltaY, rect.height - cropArea.y));
      } else if (isResizing === 'bl') {
        newX = Math.max(0, Math.min(cropArea.x + deltaX, cropArea.x + cropArea.width - 50));
        newWidth = cropArea.width - (newX - cropArea.x);
        newHeight = Math.max(50, Math.min(cropArea.height + deltaY, rect.height - cropArea.y));
      } else if (isResizing === 'tr') {
        newY = Math.max(0, Math.min(cropArea.y + deltaY, cropArea.y + cropArea.height - 50));
        newWidth = Math.max(50, Math.min(cropArea.width + deltaX, rect.width - cropArea.x));
        newHeight = cropArea.height - (newY - cropArea.y);
      } else if (isResizing === 'tl') {
        newX = Math.max(0, Math.min(cropArea.x + deltaX, cropArea.x + cropArea.width - 50));
        newY = Math.max(0, Math.min(cropArea.y + deltaY, cropArea.y + cropArea.height - 50));
        newWidth = cropArea.width - (newX - cropArea.x);
        newHeight = cropArea.height - (newY - cropArea.y);
      }

      setCropArea({ x: newX, y: newY, width: newWidth, height: newHeight });
      setDragStart({ x: e.clientX, y: e.clientY });
    }
  }, [isDragging, isResizing, dragStart, cropArea]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    setIsResizing(false);
  }, []);

  useEffect(() => {
    if (isDragging || isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, isResizing, handleMouseMove, handleMouseUp]);

  const handleCrop = () => {
    const canvas = canvasRef.current;
    const img = imageRef.current;
    const container = containerRef.current;
    if (!canvas || !img || !container) return;

    const rect = container.getBoundingClientRect();
    const scaleX = img.naturalWidth / rect.width;
    const scaleY = img.naturalHeight / rect.height;

    canvas.width = cropArea.width * scaleX;
    canvas.height = cropArea.height * scaleY;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(img, cropArea.x * scaleX, cropArea.y * scaleY, cropArea.width * scaleX, cropArea.height * scaleY, 0, 0, canvas.width, canvas.height);

    canvas.toBlob((blob) => {
      if (blob) onCropComplete(URL.createObjectURL(blob));
    }, 'image/jpeg', 0.95);
  };

  return (
    <div className="fixed inset-0 z-[200] bg-black flex flex-col">
      <div className="flex items-center justify-between p-4 border-b border-white/10">
        <button onClick={onClose} className="text-white"><X className="w-6 h-6" /></button>
        <h3 className="text-white font-semibold">Crop Image</h3>
        <Button onClick={handleCrop} variant="ghost" className="text-white"><Check className="w-5 h-5 mr-2" />Apply</Button>
      </div>

      <div className="flex-1 flex items-center justify-center p-4">
        <div ref={containerRef} className="relative max-w-full max-h-full" style={{ touchAction: 'none' }}>
          <img ref={imageRef} src={imageUrl} alt="Crop" className="max-w-full max-h-[70vh] select-none" draggable={false} />
          
          {imageLoaded && (
            <>
              <div className="absolute inset-0 bg-black/50 pointer-events-none" />
              <div className="absolute border-2 border-white cursor-move" style={{ left: `${cropArea.x}px`, top: `${cropArea.y}px`, width: `${cropArea.width}px`, height: `${cropArea.height}px`, boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.5)' }} onMouseDown={(e) => handleMouseDown(e, 'move')}>
                <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 pointer-events-none">
                  {[...Array(9)].map((_, i) => <div key={i} className="border border-white/30" />)}
                </div>
                {/* Corner resize handles */}
                <div className="absolute -top-2 -left-2 w-6 h-6 bg-white rounded-full cursor-nwse-resize" onMouseDown={(e) => { e.stopPropagation(); handleMouseDown(e, 'tl'); }} />
                <div className="absolute -top-2 -right-2 w-6 h-6 bg-white rounded-full cursor-nesw-resize" onMouseDown={(e) => { e.stopPropagation(); handleMouseDown(e, 'tr'); }} />
                <div className="absolute -bottom-2 -left-2 w-6 h-6 bg-white rounded-full cursor-nesw-resize" onMouseDown={(e) => { e.stopPropagation(); handleMouseDown(e, 'bl'); }} />
                <div className="absolute -bottom-2 -right-2 w-6 h-6 bg-white rounded-full cursor-nwse-resize" onMouseDown={(e) => { e.stopPropagation(); handleMouseDown(e, 'br'); }} />
              </div>
            </>
          )}
        </div>
      </div>

      <canvas ref={canvasRef} className="hidden" />
      <div className="p-4 bg-black/80 backdrop-blur"><p className="text-white/70 text-sm text-center">Drag to reposition • Drag corner to resize</p></div>
    </div>
  );
}
