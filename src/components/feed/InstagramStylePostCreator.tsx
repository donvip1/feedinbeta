import { useState, useRef, useEffect } from 'react';
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
  quotePost?: {
    id: string;
    content: string | null;
    media_url: string | null;
    media_type: string | null;
    user_id: string;
    likes_count: number;
    comments_count: number;
    views_count: number;
    user: {
      display_name: string | null;
      username: string | null;
      avatar_url: string | null;
    };
  } | null;
}

export function InstagramStylePostCreator({ 
  open, 
  onClose, 
  onSuccess,
  defaultTab = 'camera',
  initialImageUrl,
  quotePost 
}: InstagramStylePostCreatorProps) {
  // Determine initial step based on props immediately
  const getInitialStep = () => {
    if (quotePost) return 'details';
    if (initialImageUrl) return 'edit';
    return 'select';
  };

  const getInitialMediaType = () => {
    if (quotePost) return 'text';
    if (initialImageUrl) return 'image';
    return 'image';
  };

  const getInitialMediaPreview = () => {
    if (quotePost) return '';
    if (initialImageUrl) return initialImageUrl;
    return '';
  };

  const [step, setStep] = useState<'select' | 'capture' | 'gallery' | 'text' | 'edit' | 'details'>(getInitialStep());
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string>(getInitialMediaPreview());
  const [mediaType, setMediaType] = useState<'image' | 'video' | 'text'>(getInitialMediaType());
  const [editedEffects, setEditedEffects] = useState<any>(null);

  // Update state when props change (for reopening with different props)
  useEffect(() => {
    if (open) {
      if (quotePost) {
        setMediaType('text');
        setMediaPreview('');
        setStep('details');
      } else if (initialImageUrl) {
        setMediaPreview(initialImageUrl);
        setMediaType('image');
        setStep('edit');
      } else {
        setStep('select');
      }
    }
  }, [open, initialImageUrl, quotePost]);

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
      if (quotePost) {
        // For quote posts, back should close the modal
        handleClose();
      } else {
        setStep('edit');
      }
    } else if (step === 'edit' || step === 'text') {
      setStep('select');
    } else if (step === 'capture' || step === 'gallery') {
      setStep('select'); // Return to selection instead of closing
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-full md:max-w-4xl h-[100dvh] md:h-[90vh] p-0 gap-0 bg-background [&>button]:hidden" onOpenAutoFocus={(e) => e.preventDefault()}>
        {/* Method Selection */}
        {step === 'select' && (
          <div className="flex flex-col h-full">
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h2 className="text-lg font-semibold">Create Post</h2>
              <Button variant="ghost" size="icon" onClick={handleClose}>
                <X className="w-5 h-5" />
              </Button>
            </div>
            
            <div className="flex-1 flex items-center justify-center p-8">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-2xl">
                <button
                  onClick={() => handleMethodSelect('camera')}
                  className="flex flex-col items-center justify-center p-8 rounded-2xl border-2 border-border hover:border-primary transition-all hover:scale-105 bg-accent/50"
                >
                  <CameraIcon className="w-16 h-16 mb-4 text-primary" />
                  <span className="text-lg font-semibold">Camera</span>
                  <span className="text-sm text-muted-foreground mt-1">Take photo or video</span>
                </button>

                <button
                  onClick={() => handleMethodSelect('gallery')}
                  className="flex flex-col items-center justify-center p-8 rounded-2xl border-2 border-border hover:border-primary transition-all hover:scale-105 bg-accent/50"
                >
                  <ImageIcon className="w-16 h-16 mb-4 text-primary" />
                  <span className="text-lg font-semibold">Gallery</span>
                  <span className="text-sm text-muted-foreground mt-1">Choose from device</span>
                </button>

                <button
                  onClick={() => handleMethodSelect('text')}
                  className="flex flex-col items-center justify-center p-8 rounded-2xl border-2 border-border hover:border-primary transition-all hover:scale-105 bg-accent/50"
                >
                  <Type className="w-16 h-16 mb-4 text-primary" />
                  <span className="text-lg font-semibold">Text</span>
                  <span className="text-sm text-muted-foreground mt-1">Write a post</span>
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
        {step === 'details' && (quotePost || mediaPreview || mediaType === 'text') && (
          <InstagramStylePostDetails
            open={true}
            onClose={handleClose}
            onBack={handleBack}
            mediaUrl={mediaPreview}
            mediaType={mediaType}
            effects={editedEffects}
            mediaFile={mediaFile}
            quotePost={quotePost}
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
