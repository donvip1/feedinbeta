import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  X, Send, Crop, RotateCw, Scissors, Sparkles, 
  ImageIcon, Video, FileText, CheckCircle, AlertCircle,
  ZoomIn, ZoomOut, FlipHorizontal, FlipVertical
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import Cropper from 'react-easy-crop';
import { cn } from '@/lib/utils';

interface MediaUploadModalProps {
  open: boolean;
  onClose: () => void;
  file: File | null;
  fileType: 'image' | 'video' | 'file';
  onSend: (file: File, caption: string, thumbnail?: Blob) => void;
  uploading: boolean;
  uploadProgress: number;
}

interface CropArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

const QUALITY_OPTIONS = [
  { label: 'Original', value: 1, description: 'Best quality, larger size' },
  { label: 'High (HD)', value: 0.9, description: 'Great quality, moderate size' },
  { label: 'Medium', value: 0.7, description: 'Good quality, smaller size' },
  { label: 'Low', value: 0.5, description: 'Reduced quality, fast upload' },
];

export const MediaUploadModal = ({
  open,
  onClose,
  file,
  fileType,
  onSend,
  uploading,
  uploadProgress,
}: MediaUploadModalProps) => {
  const [caption, setCaption] = useState('');
  const [showCropper, setShowCropper] = useState(false);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<CropArea | null>(null);
  const [imagePreview, setImagePreview] = useState<string>('');
  const [processedFile, setProcessedFile] = useState<File | null>(null);
  
  // Video controls
  const [videoPreview, setVideoPreview] = useState<string>('');
  const [videoDuration, setVideoDuration] = useState(0);
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(0);
  const [videoQuality, setVideoQuality] = useState(0.9);
  const videoRef = useRef<HTMLVideoElement>(null);
  
  const [flipH, setFlipH] = useState(false);
  const [flipV, setFlipV] = useState(false);

  // Generate preview when file changes
  useEffect(() => {
    if (!file) return;
    
    const url = URL.createObjectURL(file);
    if (fileType === 'image') {
      setImagePreview(url);
    } else if (fileType === 'video') {
      setVideoPreview(url);
    }
    
    setProcessedFile(file);
    setCaption('');
    setRotation(0);
    setZoom(1);
    setCrop({ x: 0, y: 0 });
    setFlipH(false);
    setFlipV(false);
    
    return () => URL.revokeObjectURL(url);
  }, [file, fileType]);

  // Video duration
  useEffect(() => {
    if (videoRef.current && fileType === 'video') {
      const handleLoadedMetadata = () => {
        const duration = videoRef.current?.duration || 0;
        setVideoDuration(duration);
        setTrimEnd(duration);
      };
      videoRef.current.addEventListener('loadedmetadata', handleLoadedMetadata);
      return () => {
        videoRef.current?.removeEventListener('loadedmetadata', handleLoadedMetadata);
      };
    }
  }, [fileType, videoPreview]);

  const onCropComplete = useCallback((croppedArea: any, croppedAreaPixels: CropArea) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const createImage = (url: string): Promise<HTMLImageElement> =>
    new Promise((resolve, reject) => {
      const image = new Image();
      image.addEventListener('load', () => resolve(image));
      image.addEventListener('error', (error) => reject(error));
      image.src = url;
    });

  const getCroppedImg = async (): Promise<Blob | null> => {
    if (!croppedAreaPixels || !imagePreview) return null;
    
    try {
      const image = await createImage(imagePreview);
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      if (!ctx) return null;
      
      canvas.width = croppedAreaPixels.width;
      canvas.height = croppedAreaPixels.height;
      
      // Apply transformations
      ctx.save();
      
      if (flipH || flipV) {
        ctx.translate(
          flipH ? canvas.width : 0,
          flipV ? canvas.height : 0
        );
        ctx.scale(flipH ? -1 : 1, flipV ? -1 : 1);
      }
      
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate((rotation * Math.PI) / 180);
      ctx.translate(-canvas.width / 2, -canvas.height / 2);
      
      ctx.drawImage(
        image,
        croppedAreaPixels.x,
        croppedAreaPixels.y,
        croppedAreaPixels.width,
        croppedAreaPixels.height,
        0,
        0,
        croppedAreaPixels.width,
        croppedAreaPixels.height
      );
      
      ctx.restore();
      
      return new Promise((resolve) => {
        canvas.toBlob((blob) => resolve(blob), 'image/jpeg', 0.92);
      });
    } catch (e) {
      console.error('Error cropping image:', e);
      return null;
    }
  };

  const handleApplyCrop = async () => {
    const croppedBlob = await getCroppedImg();
    if (croppedBlob && file) {
      const croppedFile = new File([croppedBlob], file.name, { type: 'image/jpeg' });
      setProcessedFile(croppedFile);
      setImagePreview(URL.createObjectURL(croppedBlob));
      setShowCropper(false);
      toast({ title: 'Image cropped successfully' });
    }
  };

  const handleSend = () => {
    if (!processedFile) return;
    onSend(processedFile, caption);
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getFileSize = (size: number) => {
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (!file) return null;

  return (
    <Dialog open={open} onOpenChange={() => !uploading && onClose()}>
      <DialogContent className="max-w-lg p-0 overflow-hidden rounded-2xl max-h-[90vh] flex flex-col">
        <DialogHeader className="p-4 border-b shrink-0">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              {fileType === 'image' && <ImageIcon className="w-5 h-5 text-primary" />}
              {fileType === 'video' && <Video className="w-5 h-5 text-primary" />}
              {fileType === 'file' && <FileText className="w-5 h-5 text-primary" />}
              {fileType === 'image' ? 'Send Image' : fileType === 'video' ? 'Send Video' : 'Send File'}
            </DialogTitle>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              disabled={uploading}
            >
              <X className="w-5 h-5" />
            </Button>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto">
          {/* Image Preview & Cropper */}
          {fileType === 'image' && (
            <div className="relative">
              {showCropper ? (
                <div className="h-[300px] relative bg-black">
                  <Cropper
                    image={imagePreview}
                    crop={crop}
                    zoom={zoom}
                    rotation={rotation}
                    aspect={undefined}
                    onCropChange={setCrop}
                    onCropComplete={onCropComplete}
                    onZoomChange={setZoom}
                  />
                  
                  {/* Crop Controls */}
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
                    <div className="flex items-center gap-3 mb-3">
                      <ZoomOut className="w-4 h-4 text-white" />
                      <Slider
                        value={[zoom]}
                        min={1}
                        max={3}
                        step={0.1}
                        onValueChange={([val]) => setZoom(val)}
                        className="flex-1"
                      />
                      <ZoomIn className="w-4 h-4 text-white" />
                    </div>
                    
                    <div className="flex items-center justify-center gap-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => setRotation((r) => (r + 90) % 360)}
                      >
                        <RotateCw className="w-4 h-4 mr-1" />
                        Rotate
                      </Button>
                      <Button
                        size="sm"
                        variant={flipH ? 'default' : 'secondary'}
                        onClick={() => setFlipH(!flipH)}
                      >
                        <FlipHorizontal className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant={flipV ? 'default' : 'secondary'}
                        onClick={() => setFlipV(!flipV)}
                      >
                        <FlipVertical className="w-4 h-4" />
                      </Button>
                    </div>
                    
                    <div className="flex items-center justify-center gap-2 mt-3">
                      <Button variant="outline" onClick={() => setShowCropper(false)}>
                        Cancel
                      </Button>
                      <Button onClick={handleApplyCrop}>
                        <CheckCircle className="w-4 h-4 mr-1" />
                        Apply
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="relative bg-muted/30">
                  <img
                    src={imagePreview}
                    alt="Preview"
                    className="w-full max-h-[300px] object-contain"
                    style={{
                      transform: `rotate(${rotation}deg) scaleX(${flipH ? -1 : 1}) scaleY(${flipV ? -1 : 1})`,
                    }}
                  />
                  
                  {/* Image Edit Controls */}
                  <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-black/60 rounded-full p-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-white hover:bg-white/20"
                      onClick={() => setShowCropper(true)}
                    >
                      <Crop className="w-4 h-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-white hover:bg-white/20"
                      onClick={() => setRotation((r) => (r + 90) % 360)}
                    >
                      <RotateCw className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Video Preview & Trimmer */}
          {fileType === 'video' && (
            <div className="relative bg-black">
              <video
                ref={videoRef}
                src={videoPreview}
                className="w-full max-h-[250px] object-contain"
                controls
              />
              
              {/* Video Trim Controls */}
              <div className="p-4 bg-muted/30 space-y-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium flex items-center gap-2">
                    <Scissors className="w-4 h-4" />
                    Trim Video
                  </Label>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{formatDuration(trimStart)}</span>
                    <div className="flex-1 relative h-2">
                      <div className="absolute inset-0 bg-muted rounded-full" />
                      <div
                        className="absolute h-full bg-primary rounded-full"
                        style={{
                          left: `${(trimStart / videoDuration) * 100}%`,
                          width: `${((trimEnd - trimStart) / videoDuration) * 100}%`,
                        }}
                      />
                    </div>
                    <span>{formatDuration(trimEnd)}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs text-muted-foreground">Start</Label>
                      <Slider
                        value={[trimStart]}
                        min={0}
                        max={trimEnd - 1}
                        step={0.1}
                        onValueChange={([val]) => setTrimStart(val)}
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">End</Label>
                      <Slider
                        value={[trimEnd]}
                        min={trimStart + 1}
                        max={videoDuration}
                        step={0.1}
                        onValueChange={([val]) => setTrimEnd(val)}
                      />
                    </div>
                  </div>
                </div>
                
                {/* Quality Selection */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium flex items-center gap-2">
                    <Sparkles className="w-4 h-4" />
                    Quality
                  </Label>
                  <div className="grid grid-cols-2 gap-2">
                    {QUALITY_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        onClick={() => setVideoQuality(option.value)}
                        className={cn(
                          'p-2 rounded-lg text-left transition-all border',
                          videoQuality === option.value
                            ? 'border-primary bg-primary/10'
                            : 'border-border hover:bg-muted/50'
                        )}
                      >
                        <p className="text-sm font-medium">{option.label}</p>
                        <p className="text-xs text-muted-foreground">{option.description}</p>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* File Preview */}
          {fileType === 'file' && (
            <div className="p-6">
              <div className="flex items-center gap-4 p-4 bg-muted/30 rounded-xl">
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                  <FileText className="w-6 h-6 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{file.name}</p>
                  <p className="text-sm text-muted-foreground">{getFileSize(file.size)}</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Upload Progress */}
        {uploading && (
          <div className="px-4 py-2 bg-muted/30">
            <div className="flex items-center gap-3">
              <Progress value={uploadProgress} className="flex-1 h-2" />
              <span className="text-sm font-medium">{uploadProgress}%</span>
            </div>
          </div>
        )}

        {/* Caption & Send */}
        <div className="p-4 border-t bg-background shrink-0">
          <div className="flex items-center gap-2">
            <Input
              placeholder="Add a caption..."
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              disabled={uploading}
              className="flex-1"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
            />
            <Button
              onClick={handleSend}
              disabled={uploading}
              className="shrink-0"
            >
              <Send className="w-4 h-4 mr-2" />
              Send
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
