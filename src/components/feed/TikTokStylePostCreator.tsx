import { useState, useEffect } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { X, ArrowLeft, Image as ImageIcon, Type } from 'lucide-react';
import { CameraCapture } from './CameraCapture';
import { MediaGalleryPicker } from './MediaGalleryPicker';
import { TextPostCreator } from './TextPostCreator';
import { InstagramStyleEditor } from './InstagramStyleEditor';
import { InstagramStylePostDetails } from './InstagramStylePostDetails';

interface TikTokStylePostCreatorProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

type Step = 'camera' | 'gallery' | 'text' | 'edit' | 'details';

export function TikTokStylePostCreator({ 
  open, 
  onClose, 
  onSuccess 
}: TikTokStylePostCreatorProps) {
  const [step, setStep] = useState<Step>('camera');
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string>('');
  const [mediaType, setMediaType] = useState<'image' | 'video' | 'text'>('image');
  const [editedEffects, setEditedEffects] = useState<any>(null);
  const [showSecondaryOptions, setShowSecondaryOptions] = useState(false);

  // Reset to camera when dialog opens
  useEffect(() => {
    if (open) {
      setStep('camera');
      setShowSecondaryOptions(false);
    }
  }, [open]);

  const handleClose = () => {
    setStep('camera');
    setMediaFile(null);
    setMediaPreview('');
    setEditedEffects(null);
    setShowSecondaryOptions(false);
    onClose();
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

  const handleTextCreate = (content: string) => {
    setMediaPreview(content);
    setMediaType('text');
    setStep('details');
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
    } else if (step === 'edit') {
      setStep('camera');
    } else if (step === 'gallery' || step === 'text') {
      setStep('camera');
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose} modal={true}>
      <DialogContent 
        className="fixed inset-0 w-screen h-screen max-w-none m-0 p-0 gap-0 bg-background border-0 rounded-none [&>button]:hidden data-[state=open]:animate-none data-[state=closed]:animate-none" 
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        {/* Camera Step - Direct to camera (TikTok style) */}
        {step === 'camera' && (
          <div className="relative h-full">
            <CameraCapture
              open={true}
              onClose={handleClose}
              onCapture={handleCameraCapture}
              onSwitchToGallery={() => {}}
              onTextPost={() => {}}
            />
            
            {/* Secondary Options Overlay */}
            {!showSecondaryOptions && (
              <div className="absolute bottom-24 right-6 flex flex-col gap-3">
                <Button
                  size="icon"
                  variant="secondary"
                  onClick={() => setShowSecondaryOptions(true)}
                  className="h-14 w-14 rounded-full bg-background/80 backdrop-blur-sm hover:bg-background"
                >
                  <ImageIcon className="h-6 w-6" />
                </Button>
              </div>
            )}

            {/* Secondary Options Menu */}
            {showSecondaryOptions && (
              <div className="absolute inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-end">
                <div className="w-full bg-background rounded-t-3xl p-6 space-y-3 animate-slide-up">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold">More Options</h3>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setShowSecondaryOptions(false)}
                    >
                      <X className="h-5 w-5" />
                    </Button>
                  </div>

                  <button
                    onClick={() => {
                      setShowSecondaryOptions(false);
                      setStep('gallery');
                    }}
                    className="w-full flex items-center gap-4 p-4 rounded-lg hover:bg-accent transition-colors"
                  >
                    <ImageIcon className="w-8 h-8 text-primary" />
                    <div className="flex-1 text-left">
                      <div className="font-semibold">Gallery</div>
                      <div className="text-sm text-muted-foreground">Choose from device</div>
                    </div>
                  </button>

                  <button
                    onClick={() => {
                      setShowSecondaryOptions(false);
                      setStep('text');
                    }}
                    className="w-full flex items-center gap-4 p-4 rounded-lg hover:bg-accent transition-colors"
                  >
                    <Type className="w-8 h-8 text-primary" />
                    <div className="flex-1 text-left">
                      <div className="font-semibold">Text</div>
                      <div className="text-sm text-muted-foreground">Write a post</div>
                    </div>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Gallery Step */}
        {step === 'gallery' && (
          <MediaGalleryPicker
            open={true}
            onClose={handleClose}
            onSelect={handleGallerySelect}
          />
        )}

        {/* Text Post Step */}
        {step === 'text' && (
          <TextPostCreator
            open={true}
            onClose={handleClose}
            onCreate={handleTextCreate}
          />
        )}

        {/* Edit Step - Filters, text overlay, music, trim/crop */}
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

        {/* Details Step - Caption, hashtags, location, etc. (after editing) */}
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
