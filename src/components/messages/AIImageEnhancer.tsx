import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Sparkles, Loader2, X } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface AIImageEnhancerProps {
  open: boolean;
  onClose: () => void;
  imageFile: File;
  onSave: (blob: Blob) => void;
}

const ENHANCEMENT_OPTIONS = [
  { 
    id: 'quality', 
    name: 'Enhance Quality', 
    description: 'Improve clarity and sharpness',
    icon: '✨'
  },
  { 
    id: 'background', 
    name: 'Remove Background', 
    description: 'Make background transparent',
    icon: '🎭'
  },
  { 
    id: 'artistic', 
    name: 'Artistic Filter', 
    description: 'Apply professional effects',
    icon: '🎨'
  },
  { 
    id: 'portrait', 
    name: 'Portrait Mode', 
    description: 'Enhance faces naturally',
    icon: '👤'
  },
  { 
    id: 'landscape', 
    name: 'Landscape Mode', 
    description: 'Enhance colors and contrast',
    icon: '🏞️'
  },
];

export const AIImageEnhancer = ({ open, onClose, imageFile, onSave }: AIImageEnhancerProps) => {
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [imagePreview, setImagePreview] = useState<string>('');
  const [enhancedPreview, setEnhancedPreview] = useState<string>('');
  const [selectedEnhancement, setSelectedEnhancement] = useState<string>('');

  useState(() => {
    if (imageFile) {
      const url = URL.createObjectURL(imageFile);
      setImagePreview(url);
      return () => URL.revokeObjectURL(url);
    }
  });

  const handleEnhance = async (enhancementType: string) => {
    setIsEnhancing(true);
    setSelectedEnhancement(enhancementType);
    
    try {
      // Convert file to data URL
      const reader = new FileReader();
      const imageDataUrl = await new Promise<string>((resolve) => {
        reader.onload = (e) => resolve(e.target?.result as string);
        reader.readAsDataURL(imageFile);
      });

      console.log('Calling enhance-image function...');
      
      const { data, error } = await supabase.functions.invoke('enhance-image', {
        body: { 
          imageUrl: imageDataUrl,
          enhancement: enhancementType 
        },
      });

      if (error) {
        if (error.message.includes('429')) {
          throw new Error('Rate limit exceeded. Please try again later.');
        }
        if (error.message.includes('402')) {
          throw new Error('Payment required. Please add credits to your workspace.');
        }
        throw error;
      }

      if (!data?.enhancedImageUrl) {
        throw new Error('No enhanced image returned');
      }

      console.log('Image enhanced successfully');
      setEnhancedPreview(data.enhancedImageUrl);

      toast({
        title: 'Image Enhanced',
        description: 'AI enhancement applied successfully',
      });
    } catch (error) {
      console.error('Enhancement error:', error);
      toast({
        title: 'Enhancement Failed',
        description: error instanceof Error ? error.message : 'Failed to enhance image',
        variant: 'destructive',
      });
    } finally {
      setIsEnhancing(false);
    }
  };

  const handleSave = async () => {
    if (!enhancedPreview) return;

    try {
      // Convert base64 to blob
      const response = await fetch(enhancedPreview);
      const blob = await response.blob();
      
      onSave(blob);
      toast({ title: 'Enhanced image saved' });
    } catch (error) {
      console.error('Save error:', error);
      toast({
        title: 'Save Failed',
        description: 'Failed to save enhanced image',
        variant: 'destructive',
      });
    }
  };

  const handleReset = () => {
    setEnhancedPreview('');
    setSelectedEnhancement('');
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            AI Image Enhancement
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Image Preview */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm font-medium mb-2">Original</p>
              <div className="border rounded-lg overflow-hidden bg-muted">
                <img
                  src={imagePreview}
                  alt="Original"
                  className="w-full h-64 object-contain"
                />
              </div>
            </div>
            
            <div>
              <p className="text-sm font-medium mb-2">Enhanced</p>
              <div className="border rounded-lg overflow-hidden bg-muted relative">
                {enhancedPreview ? (
                  <img
                    src={enhancedPreview}
                    alt="Enhanced"
                    className="w-full h-64 object-contain"
                  />
                ) : (
                  <div className="w-full h-64 flex items-center justify-center text-muted-foreground">
                    {isEnhancing ? (
                      <div className="text-center">
                        <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" />
                        <p className="text-sm">Enhancing with AI...</p>
                      </div>
                    ) : (
                      <p className="text-sm">Select an enhancement option</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Enhancement Options */}
          <div>
            <p className="text-sm font-medium mb-3">Enhancement Options</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {ENHANCEMENT_OPTIONS.map((option) => (
                <Button
                  key={option.id}
                  variant={selectedEnhancement === option.id ? 'default' : 'outline'}
                  className="h-auto p-4 flex flex-col items-start gap-2"
                  onClick={() => handleEnhance(option.id)}
                  disabled={isEnhancing}
                >
                  <div className="flex items-center gap-2 w-full">
                    <span className="text-2xl">{option.icon}</span>
                    <span className="font-medium text-left">{option.name}</span>
                  </div>
                  <span className="text-xs text-muted-foreground text-left">
                    {option.description}
                  </span>
                </Button>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 justify-end">
            {enhancedPreview && (
              <Button
                variant="outline"
                onClick={handleReset}
                disabled={isEnhancing}
              >
                Try Another
              </Button>
            )}
            <Button
              variant="outline"
              onClick={onClose}
              disabled={isEnhancing}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={!enhancedPreview || isEnhancing}
              className="bg-primary hover:bg-primary/90"
            >
              <Sparkles className="w-4 h-4 mr-2" />
              Use Enhanced Image
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
