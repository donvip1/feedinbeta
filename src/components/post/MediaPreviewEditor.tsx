import React, { useState, useCallback } from 'react';
import Cropper from 'react-easy-crop';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { 
  X, 
  Check, 
  RotateCw, 
  FlipHorizontal, 
  FlipVertical,
  Crop,
  ZoomIn,
  Sparkles
} from 'lucide-react';

interface MediaPreviewEditorProps {
  mediaUrl: string;
  mediaType: 'image' | 'video';
  onConfirm: (editedUrl: string) => void;
  onCancel: () => void;
}

const FILTERS = [
  { id: 'none', name: 'Normal', filter: 'none' },
  { id: 'warm', name: 'Warm', filter: 'contrast(1.1) saturate(1.2) sepia(0.15)' },
  { id: 'cool', name: 'Cool', filter: 'contrast(1.1) saturate(1.1) hue-rotate(20deg)' },
  { id: 'vivid', name: 'Vivid', filter: 'contrast(1.2) saturate(1.4)' },
  { id: 'mono', name: 'B&W', filter: 'grayscale(1) contrast(1.1)' },
  { id: 'vintage', name: 'Vintage', filter: 'sepia(0.4) contrast(1.1) brightness(0.9)' },
  { id: 'dramatic', name: 'Drama', filter: 'contrast(1.3) brightness(0.95) saturate(1.2)' },
];

export const MediaPreviewEditor = ({ mediaUrl, mediaType, onConfirm, onCancel }: MediaPreviewEditorProps) => {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [flipH, setFlipH] = useState(false);
  const [flipV, setFlipV] = useState(false);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);
  const [selectedFilter, setSelectedFilter] = useState('none');
  const [showCropper, setShowCropper] = useState(false);

  const onCropComplete = useCallback((croppedArea: any, croppedAreaPixels: any) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const handleRotate = () => {
    setRotation((prev) => (prev + 90) % 360);
  };

  const getFilterStyle = (filterId: string) => {
    const filter = FILTERS.find(f => f.id === filterId);
    return filter?.filter || 'none';
  };

  const createEditedImage = async (): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(mediaUrl);
          return;
        }

        // Set canvas size based on rotation
        const isRotated90or270 = rotation === 90 || rotation === 270;
        canvas.width = isRotated90or270 ? img.height : img.width;
        canvas.height = isRotated90or270 ? img.width : img.height;

        // Apply transformations
        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.rotate((rotation * Math.PI) / 180);
        ctx.scale(flipH ? -1 : 1, flipV ? -1 : 1);
        
        // Apply filter
        ctx.filter = getFilterStyle(selectedFilter);
        
        ctx.drawImage(img, -img.width / 2, -img.height / 2);

        resolve(canvas.toDataURL('image/jpeg', 0.9));
      };
      img.src = mediaUrl;
    });
  };

  const handleConfirm = async () => {
    if (mediaType === 'video') {
      onConfirm(mediaUrl);
      return;
    }
    
    const editedUrl = await createEditedImage();
    onConfirm(editedUrl);
  };

  const transformStyle = `
    ${flipH ? 'scaleX(-1)' : ''} 
    ${flipV ? 'scaleY(-1)' : ''} 
    rotate(${rotation}deg)
  `.trim();

  return (
    <div className="fixed inset-0 z-[100] bg-background flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <Button variant="ghost" size="icon" onClick={onCancel}>
          <X className="w-5 h-5" />
        </Button>
        <h2 className="text-lg font-semibold">Edit Media</h2>
        <Button variant="ghost" size="icon" onClick={handleConfirm}>
          <Check className="w-5 h-5 text-primary" />
        </Button>
      </div>

      {/* Preview Area */}
      <div className="flex-1 relative bg-black overflow-hidden">
        {showCropper && mediaType === 'image' ? (
          <Cropper
            image={mediaUrl}
            crop={crop}
            zoom={zoom}
            aspect={9 / 16}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
          />
        ) : mediaType === 'image' ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <img
              src={mediaUrl}
              alt="Preview"
              className="max-w-full max-h-full object-contain transition-all duration-200"
              style={{ 
                transform: transformStyle,
                filter: getFilterStyle(selectedFilter)
              }}
            />
          </div>
        ) : (
          <video
            src={mediaUrl}
            className="w-full h-full object-contain"
            style={{ 
              transform: transformStyle,
              filter: getFilterStyle(selectedFilter)
            }}
            controls
            playsInline
          />
        )}
      </div>

      {/* Edit Tools */}
      {mediaType === 'image' && (
        <div className="p-4 space-y-4 border-t border-border bg-card">
          {/* Quick Actions */}
          <div className="flex justify-center gap-6">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowCropper(!showCropper)}
              className={showCropper ? 'text-primary' : ''}
            >
              <Crop className="w-4 h-4 mr-2" />
              Crop
            </Button>
            <Button variant="ghost" size="sm" onClick={handleRotate}>
              <RotateCw className="w-4 h-4 mr-2" />
              Rotate
            </Button>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => setFlipH(!flipH)}
              className={flipH ? 'text-primary' : ''}
            >
              <FlipHorizontal className="w-4 h-4 mr-2" />
              Flip
            </Button>
          </div>

          {/* Zoom Slider (when cropping) */}
          {showCropper && (
            <div className="flex items-center gap-4 px-4">
              <ZoomIn className="w-4 h-4 text-muted-foreground" />
              <Slider
                value={[zoom]}
                min={1}
                max={3}
                step={0.1}
                onValueChange={([val]) => setZoom(val)}
                className="flex-1"
              />
            </div>
          )}

          {/* Filter Selection */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 px-2">
              <Sparkles className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium">Filters</span>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-2 px-2">
              {FILTERS.map((filter) => (
                <button
                  key={filter.id}
                  onClick={() => setSelectedFilter(filter.id)}
                  className={`flex-shrink-0 rounded-lg overflow-hidden border-2 transition-all ${
                    selectedFilter === filter.id 
                      ? 'border-primary ring-2 ring-primary/30' 
                      : 'border-border'
                  }`}
                >
                  <div 
                    className="w-16 h-16 bg-cover bg-center"
                    style={{ 
                      backgroundImage: `url(${mediaUrl})`,
                      filter: filter.filter
                    }}
                  />
                  <span className="block text-[10px] py-1 text-center bg-secondary/50">
                    {filter.name}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Confirm Button */}
      <div className="p-4 border-t border-border bg-card">
        <Button onClick={handleConfirm} className="w-full" size="lg">
          Continue to Post Details
        </Button>
      </div>
    </div>
  );
};

export default MediaPreviewEditor;
