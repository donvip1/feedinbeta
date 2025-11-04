import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ImageIcon, Video, Type, X, Upload } from 'lucide-react';
import { PostEditorModal } from './PostEditorModal';
import { PostDetailsModal } from './PostDetailsModal';
import { CreatePostMethodSelector } from './CreatePostMethodSelector';
import { CameraCapture } from './CameraCapture';
import { MediaGalleryPicker } from './MediaGalleryPicker';
import { TextToImageCreator } from './TextToImageCreator';
import { AIImageGenerator } from './AIImageGenerator';
import { useToast } from '@/hooks/use-toast';
import { usePremiumStatus } from '@/hooks/usePremiumStatus';

interface EnhancedCreatePostModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  defaultTab?: 'text' | 'image' | 'video';
  initialImageUrl?: string | null;
}

export function EnhancedCreatePostModal({
  open,
  onClose,
  onSuccess,
  defaultTab = 'text',
  initialImageUrl = null,
}: EnhancedCreatePostModalProps) {
  const { toast } = useToast();
  const { isPremium } = usePremiumStatus();
  const [step, setStep] = useState<'method' | 'upload' | 'edit' | 'details'>('method');
  const [activeTab, setActiveTab] = useState<'text' | 'image' | 'video'>(defaultTab);
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string | null>(initialImageUrl);
  const [mediaType, setMediaType] = useState<'text' | 'image' | 'video'>(
    initialImageUrl ? 'image' : 'text'
  );
  const [effects, setEffects] = useState<any>(null);
  const [showMethodSelector, setShowMethodSelector] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [showGallery, setShowGallery] = useState(false);
  const [showTextToImage, setShowTextToImage] = useState(false);
  const [showAIGenerator, setShowAIGenerator] = useState(false);

  const handleMediaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isImage = file.type.startsWith('image/');
    const isVideo = file.type.startsWith('video/');

    if (!isImage && !isVideo) {
      toast({
        title: 'Invalid file type',
        description: 'Please select an image or video file',
        variant: 'destructive',
      });
      return;
    }

    // Check file size (max 40MB for videos, 10MB for images)
    const maxSize = isVideo ? 40 * 1024 * 1024 : 10 * 1024 * 1024;
    if (file.size > maxSize) {
      toast({
        title: 'File too large',
        description: isVideo ? 'Videos must be under 50MB' : 'Images must be under 10MB',
        variant: 'destructive',
      });
      return;
    }

    setMediaFile(file);
    setMediaType(isImage ? 'image' : 'video');
    setMediaPreview(URL.createObjectURL(file));

    // Move to editor for image/video
    if (isImage || isVideo) {
      setStep('edit');
    }
  };

  const handleEditorNext = (editedUrl: string, appliedEffects: any) => {
    setMediaPreview(editedUrl); // Update preview to show processed image
    setEffects(appliedEffects);
    setStep('details');
  };

  const handleDetailsSuccess = () => {
    setStep('method');
    setMediaFile(null);
    setMediaPreview(null);
    setEffects(null);
    setShowMethodSelector(false);
    onSuccess();
  };

  const handleClose = () => {
    setStep('method');
    setMediaFile(null);
    setMediaPreview(null);
    setEffects(null);
    setShowMethodSelector(false);
    setShowCamera(false);
    setShowGallery(false);
    setShowTextToImage(false);
    setShowAIGenerator(false);
    onClose();
  };

  const handleMethodSelect = (method: 'camera' | 'gallery' | 'text-to-image' | 'ai-generate') => {
    setShowMethodSelector(false);
    
    switch (method) {
      case 'camera':
        setShowCamera(true);
        break;
      case 'gallery':
        setShowGallery(true);
        break;
      case 'text-to-image':
        setShowTextToImage(true);
        break;
      case 'ai-generate':
        setShowAIGenerator(true);
        break;
    }
  };

  const handleCameraCapture = (file: File, type: 'image' | 'video') => {
    setMediaFile(file);
    setMediaType(type);
    setMediaPreview(URL.createObjectURL(file));
    setShowCamera(false);
    setStep('edit');
  };

  const handleGallerySelect = (files: File[]) => {
    // For now, use first file. Later can support multiple
    const file = files[0];
    const isVideo = file.type.startsWith('video/');
    setMediaFile(file);
    setMediaType(isVideo ? 'video' : 'image');
    setMediaPreview(URL.createObjectURL(file));
    setShowGallery(false);
    setStep('edit');
  };

  const handleTextToImageCreate = (file: File) => {
    setMediaFile(file);
    setMediaType('image');
    setMediaPreview(URL.createObjectURL(file));
    setShowTextToImage(false);
    setStep('edit');
  };

  const handleAIImageCreate = (file: File) => {
    setMediaFile(file);
    setMediaType('image');
    setMediaPreview(URL.createObjectURL(file));
    setShowAIGenerator(false);
    setStep('edit');
  };

  // For text-only posts, skip editor
  const handleTextPost = () => {
    setMediaType('text');
    setStep('details');
  };

  // Show method selector when modal opens
  if (open && step === 'method' && !showMethodSelector) {
    setTimeout(() => setShowMethodSelector(true), 0);
  }

  return (
    <>
      {/* Method Selector */}
      <CreatePostMethodSelector
        open={open && showMethodSelector}
        onClose={handleClose}
        onSelectMethod={handleMethodSelect}
        isPremium={isPremium}
      />

      {/* Camera Capture */}
      <CameraCapture
        open={showCamera}
        onClose={() => {
          setShowCamera(false);
          setShowMethodSelector(true);
        }}
        onCapture={handleCameraCapture}
      />

      {/* Gallery Picker */}
      <MediaGalleryPicker
        open={showGallery}
        onClose={() => {
          setShowGallery(false);
          setShowMethodSelector(true);
        }}
        onSelect={handleGallerySelect}
        multiSelect={false}
      />

      {/* Text to Image */}
      <TextToImageCreator
        open={showTextToImage}
        onClose={() => {
          setShowTextToImage(false);
          setShowMethodSelector(true);
        }}
        onCreate={handleTextToImageCreate}
      />

      {/* AI Generator */}
      <AIImageGenerator
        open={showAIGenerator}
        onClose={() => {
          setShowAIGenerator(false);
          setShowMethodSelector(true);
        }}
        onCreate={handleAIImageCreate}
      />

      {/* Step 1: Upload (Legacy - keeping for backward compatibility) */}
      <Dialog open={open && step === 'upload'} onOpenChange={handleClose}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create Post</DialogTitle>
          </DialogHeader>

          <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)} className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="text">
                <Type className="w-4 h-4 mr-2" />
                Text
              </TabsTrigger>
              <TabsTrigger value="image">
                <ImageIcon className="w-4 h-4 mr-2" />
                Image
              </TabsTrigger>
              <TabsTrigger value="video">
                <Video className="w-4 h-4 mr-2" />
                Video
              </TabsTrigger>
            </TabsList>

            <TabsContent value="text" className="space-y-4 mt-6">
              <div className="text-center py-12 border-2 border-dashed rounded-lg">
                <Type className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
                <p className="text-lg font-medium mb-2">Share your thoughts</p>
                <p className="text-sm text-muted-foreground mb-4">
                  Create a text-only post
                </p>
                <Button onClick={handleTextPost} className="bg-gradient-primary">
                  Continue
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="image" className="space-y-4 mt-6">
              <div className="text-center">
                {mediaPreview && mediaType === 'image' ? (
                  <div className="relative inline-block">
                    <img
                      src={mediaPreview}
                      alt="Preview"
                      className="max-w-full max-h-60 rounded-lg"
                    />
                    <Button
                      size="icon"
                      variant="destructive"
                      className="absolute top-2 right-2"
                      onClick={() => {
                        setMediaFile(null);
                        setMediaPreview(null);
                      }}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="py-12 border-2 border-dashed rounded-lg">
                    <Upload className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
                    <p className="text-lg font-medium mb-2">Upload an image</p>
                    <p className="text-sm text-muted-foreground mb-4">
                      JPG, PNG, WEBP
                    </p>
                    <label htmlFor="image-upload" className="inline-block">
                      <Button type="button" className="bg-gradient-primary" onClick={() => document.getElementById('image-upload')?.click()}>
                        Choose File
                      </Button>
                    </label>
                    <Input
                      id="image-upload"
                      type="file"
                      accept="image/*"
                      onChange={handleMediaChange}
                      className="hidden"
                    />
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="video" className="space-y-4 mt-6">
              <div className="text-center">
                {mediaPreview && mediaType === 'video' ? (
                  <div className="relative inline-block">
                    <video
                      src={mediaPreview}
                      className="max-w-full max-h-60 rounded-lg"
                      controls
                    />
                    <Button
                      size="icon"
                      variant="destructive"
                      className="absolute top-2 right-2"
                      onClick={() => {
                        setMediaFile(null);
                        setMediaPreview(null);
                      }}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="py-12 border-2 border-dashed rounded-lg">
                    <Upload className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
                    <p className="text-lg font-medium mb-2">Upload a video</p>
                    <p className="text-sm text-muted-foreground mb-4">
                      MP4, MOV
                    </p>
                    <label htmlFor="video-upload" className="inline-block">
                      <Button type="button" className="bg-gradient-primary" onClick={() => document.getElementById('video-upload')?.click()}>
                        Choose File
                      </Button>
                    </label>
                    <Input
                      id="video-upload"
                      type="file"
                      accept="video/*"
                      onChange={handleMediaChange}
                      className="hidden"
                    />
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Step 2: Editor */}
      {mediaPreview && mediaType !== 'text' && (
        <PostEditorModal
          open={step === 'edit'}
          onClose={handleClose}
          onBack={() => setStep('upload')}
          mediaUrl={mediaPreview}
          mediaType={mediaType as 'image' | 'video'}
          onNext={handleEditorNext}
        />
      )}

      {/* Step 3: Details */}
      <PostDetailsModal
        open={step === 'details'}
        onClose={handleClose}
        onBack={() => setStep(mediaType === 'text' ? 'upload' : 'edit')}
        mediaUrl={mediaPreview || ''}
        mediaType={mediaType}
        effects={effects}
        onSuccess={handleDetailsSuccess}
        mediaFile={mediaFile}
      />
    </>
  );
}
