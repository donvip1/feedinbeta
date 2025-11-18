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
import { AIEnhancementModal } from './AIEnhancementModal';
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
  const [step, setStep] = useState<'method' | 'enhance' | 'edit' | 'details'>('method');
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
  const [capturedMediaUrl, setCapturedMediaUrl] = useState<string | null>(null);

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

  const handleEnhancementNext = (enhancedImageUrl: string) => {
    setMediaPreview(enhancedImageUrl);
    setStep('edit');
  };

  const handleDetailsSuccess = () => {
    setStep('method');
    setMediaFile(null);
    setMediaPreview(null);
    setCapturedMediaUrl(null);
    setEffects(null);
    setShowMethodSelector(false);
    onSuccess();
  };

  const handleClose = () => {
    setStep('method');
    setMediaFile(null);
    setMediaPreview(null);
    setCapturedMediaUrl(null);
    setEffects(null);
    setShowMethodSelector(false);
    setShowCamera(false);
    setShowGallery(false);
    setShowTextToImage(false);
    setShowAIGenerator(false);
    onClose();
  };

  const handleMethodSelect = (method: 'camera' | 'text-to-image' | 'text-only' | 'ai-generate') => {
    setShowMethodSelector(false);
    
    switch (method) {
      case 'camera':
        setShowCamera(true);
        break;
      case 'text-only':
        handleTextPost();
        break;
      case 'text-to-image':
        setShowTextToImage(true);
        break;
      case 'ai-generate':
        setShowAIGenerator(true);
        break;
    }
  };

  const handleCameraCapture = (file: File, type: 'image' | 'video', appliedEffects?: any) => {
    setMediaFile(file);
    setMediaType(type);
    const mediaUrl = URL.createObjectURL(file);
    setMediaPreview(mediaUrl);
    setCapturedMediaUrl(mediaUrl);
    setShowCamera(false);
    
    // For images, go to enhancement step; for videos, go directly to edit
    if (type === 'image') {
      setStep('enhance');
    } else {
      setStep('edit');
    }
  };

  const handleGallerySelect = (files: File[]) => {
    // For now, use first file. Later can support multiple
    const file = files[0];
    const isVideo = file.type.startsWith('video/');
    setMediaFile(file);
    setMediaType(isVideo ? 'video' : 'image');
    setMediaPreview(URL.createObjectURL(file));
    setShowGallery(false);
    
    // Check if multiple images for carousel
    if (files.length > 1 && files.every(f => f.type.startsWith('image/'))) {
      // Handle carousel - skip editor and go to details
      setStep('details');
      toast({
        title: 'Carousel post',
        description: `${files.length} images selected for carousel`,
      });
    } else {
      setStep('edit');
    }
  };

  const handleTextToImageCreate = (file: File) => {
    setMediaFile(file);
    setMediaType('image');
    const mediaUrl = URL.createObjectURL(file);
    setMediaPreview(mediaUrl);
    setCapturedMediaUrl(mediaUrl);
    setShowTextToImage(false);
    setStep('enhance');
  };

  const handleAIImageCreate = (file: File) => {
    setMediaFile(file);
    setMediaType('image');
    const mediaUrl = URL.createObjectURL(file);
    setMediaPreview(mediaUrl);
    setCapturedMediaUrl(mediaUrl);
    setShowAIGenerator(false);
    setStep('enhance');
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
        onSwitchToGallery={() => {
          setShowCamera(false);
          setShowGallery(true);
        }}
      />

      {/* Gallery Picker */}
      <MediaGalleryPicker
        open={showGallery}
        onClose={() => {
          setShowGallery(false);
          setShowCamera(true);
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

      {/* AI Enhancement */}
      {capturedMediaUrl && mediaType === 'image' && (
        <AIEnhancementModal
          open={step === 'enhance'}
          onClose={handleClose}
          onBack={() => setStep('method')}
          imageUrl={capturedMediaUrl}
          onNext={handleEnhancementNext}
          isPremium={isPremium}
        />
      )}

      {/* Editor */}
      {mediaPreview && mediaType !== 'text' && (
        <PostEditorModal
          open={step === 'edit'}
          onClose={handleClose}
          onBack={() => {
            if (mediaType === 'image' && capturedMediaUrl) {
              setStep('enhance');
            } else {
              setStep('method');
            }
          }}
          mediaUrl={mediaPreview}
          mediaType={mediaType as 'image' | 'video'}
          onNext={handleEditorNext}
        />
      )}

      {/* Post Details */}
      <PostDetailsModal
        open={step === 'details'}
        onClose={handleClose}
        onBack={() => setStep('edit')}
        mediaUrl={mediaPreview || ''}
        mediaType={mediaType}
        effects={effects}
        onSuccess={handleDetailsSuccess}
        mediaFile={mediaFile}
      />
    </>
  );
}
