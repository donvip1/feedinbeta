import { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { X, ArrowLeft, Image as ImageIcon, Video, Type, Camera as CameraIcon } from 'lucide-react';
import { CameraCapture } from './CameraCapture';
import { MediaGalleryPicker } from './MediaGalleryPicker';
import { TextPostCreator } from './TextPostCreator';
import { InstagramStyleEditor } from './InstagramStyleEditor';
import { InstagramStylePostDetails } from './InstagramStylePostDetails';

interface InstagramStylePostCreatorProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  defaultTab?: 'camera' | 'gallery' | 'text';
  initialImageUrl?: string;
}

export function InstagramStylePostCreator({ 
  open, 
  onClose, 
  onSuccess,
  defaultTab = 'camera',
  initialImageUrl
}: InstagramStylePostCreatorProps) {
  // Determine initial step based on props immediately
  const getInitialStep = () => {
    if (initialImageUrl) return 'edit';
    return 'select';
  };

  const getInitialMediaType = (): 'image' | 'video' | 'text' => {
    if (initialImageUrl) return 'image';
    return 'image';
  };

  const getInitialMediaPreview = (): string => {
    if (initialImageUrl) return initialImageUrl;
    return '';
  };

  const [step, setStep] = useState<'select' | 'capture' | 'gallery' | 'text' | 'edit' | 'details'>(getInitialStep);
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string>(getInitialMediaPreview);
  const [mediaType, setMediaType] = useState<'image' | 'video' | 'text'>(getInitialMediaType);
  const [editedEffects, setEditedEffects] = useState<any>(null);

  // Synchronously update state when dialog opens with new props using useLayoutEffect
  // This runs synchronously before the browser paints, ensuring instant updates
  useLayoutEffect(() => {
    if (open) {
      if (initialImageUrl) {
        setMediaPreview(initialImageUrl);
        setMediaType('image');
        setStep('edit');
      } else {
        setStep('select');
      }
    }
  }, [open, initialImageUrl]);

  const handleClose = () => {
    setStep('select');
    setMediaFile(null);
    setMediaPreview('');
    setEditedEffects(null);
    onClose();
  };

  const handleMethodSelect = (method: 'camera' | 'gallery' | 'text') => {
    if (method === 'camera') {
      setStep('capture');
    } else if (method === 'gallery') {
      setStep('gallery');
    } else {
      setStep('text');
    }
  };

  const handleCameraCapture = (file: File, preview: string, type: 'image' | 'video') => {
    setMediaFile(file);
    setMediaPreview(preview);
    setMediaType(type);
    setStep('edit');
  };

  const handleGallerySelect = (files: File[]) => {
    if (files.length > 0) {
      const file = files[0];
      const type = file.type.startsWith('video/') ? 'video' : 'image';
      setMediaFile(file);
      setMediaPreview(URL.createObjectURL(file));
      setMediaType(type);
      setStep('edit');
    }
  };


  const handleEditComplete = (effects: any) => {
    setEditedEffects(effects);
    setStep('details');
  };

  const handleBack = () => {
    if (step === 'details') {
      if (mediaType === 'text') {
        handleClose();
      } else {
        setStep('edit');
      }
    } else if (step === 'edit' || step === 'text') {
      setStep('select');
    } else if (step === 'capture' || step === 'gallery') {
      setStep('select');
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose} modal={true}>
      <DialogContent 
        className="fixed inset-0 w-screen h-screen max-w-none m-0 p-0 gap-0 bg-background border-0 rounded-none [&>button]:hidden data-[state=open]:animate-none data-[state=closed]:animate-none" 
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        {/* Method Selection */}
        {step === 'select' && (
          <div className="flex flex-col h-full">
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h2 className="text-lg font-semibold">Create Post</h2>
              <Button variant="ghost" size="icon" onClick={handleClose}>
                <X className="w-5 h-5" />
              </Button>
            </div>
            
            <div className="flex-1 overflow-y-auto">
              <div className="space-y-2 p-3">
                {/* Camera */}
                <button
                  onClick={() => handleMethodSelect('camera')}
                  className="w-full flex items-center gap-3 p-4 bg-card hover:bg-accent transition-colors active:scale-[0.98]"
                >
                  <div className="flex-shrink-0">
                    <CameraIcon className="w-8 h-8 text-primary" />
                  </div>
                  <div className="flex-1 text-left">
                    <div className="font-semibold">Camera</div>
                    <div className="text-sm text-muted-foreground">Take photo or video</div>
                  </div>
                </button>

                {/* Gallery */}
                <button
                  onClick={() => handleMethodSelect('gallery')}
                  className="w-full flex items-center gap-3 p-4 bg-card hover:bg-accent transition-colors active:scale-[0.98]"
                >
                  <div className="flex-shrink-0">
                    <ImageIcon className="w-8 h-8 text-primary" />
                  </div>
                  <div className="flex-1 text-left">
                    <div className="font-semibold">Gallery</div>
                    <div className="text-sm text-muted-foreground">Choose from device</div>
                  </div>
                </button>

                {/* Text */}
                <button
                  onClick={() => handleMethodSelect('text')}
                  className="w-full flex items-center gap-3 p-4 bg-card hover:bg-accent transition-colors active:scale-[0.98]"
                >
                  <div className="flex-shrink-0">
                    <Type className="w-8 h-8 text-primary" />
                  </div>
                  <div className="flex-1 text-left">
                    <div className="font-semibold">Text</div>
                    <div className="text-sm text-muted-foreground">Write a post</div>
                  </div>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Camera Capture */}
        {step === 'capture' && (
          <CameraCapture
            open={true}
            onClose={handleClose}
            onCapture={handleCameraCapture}
            onSwitchToGallery={() => setStep('gallery')}
            onTextPost={() => setStep('text')}
          />
        )}

        {/* Gallery Picker */}
        {step === 'gallery' && (
          <MediaGalleryPicker
            open={true}
            onClose={handleClose}
            onSelect={handleGallerySelect}
          />
        )}

        {/* Text Post Creator */}
        {step === 'text' && (
          <TextPostCreator
            open={true}
            onClose={handleClose}
            onCreate={(content) => {
              setMediaPreview(content);
              setMediaType('text');
              setStep('details');
            }}
          />
        )}

        {/* Edit Step */}
        {step === 'edit' && mediaPreview && mediaType !== 'text' && (
          <InstagramStyleEditor
            open={true}
            onClose={handleClose}
            onBack={handleBack}
            mediaUrl={mediaPreview}
            mediaType={mediaType}
            mediaFile={mediaFile}
            onNext={handleEditComplete}
          />
        )}

        {/* Post Details Step */}
        {step === 'details' && (mediaPreview || mediaType === 'text') && (
          <InstagramStylePostDetails
            open={true}
            onClose={handleClose}
            onBack={handleBack}
            mediaUrl={mediaPreview}
            mediaType={mediaType}
            effects={editedEffects}
            mediaFile={mediaFile}
            quotePost={null}
            onSuccess={() => {
              onSuccess();
              handleClose();
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
