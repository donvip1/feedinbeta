import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Sparkles } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface AIImageGeneratorProps {
  open: boolean;
  onClose: () => void;
  onCreate: (file: File) => void;
}

interface ApiError extends Error {
  message: string;
}

export function AIImageGenerator({ open, onClose, onCreate }: AIImageGeneratorProps) {
  const { toast } = useToast();
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      toast({
        title: 'Enter a prompt',
        description: 'Please describe what you want to create',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('ai-image-gen', {
        body: { 
          prompt: prompt.trim(),
          mode: 'generate'
        },
      });

      if (error) throw error;

      if (data.imageUrl) {
        setGeneratedImage(data.imageUrl);
      }
    } catch (error) {
      console.error('AI generation error:', error);
      toast({
        title: 'Generation failed',
        description: (error as ApiError).message || 'Failed to generate image. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleUseImage = async () => {
    if (!generatedImage) return;

    try {
      // Convert base64 to blob
      const base64Data = generatedImage.split(',')[1];
      const byteCharacters = atob(base64Data);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'image/png' });
      
      const file = new File([blob], `ai-generated-${Date.now()}.png`, { type: 'image/png' });
      onCreate(file);
      onClose();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to process generated image',
        variant: 'destructive',
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            AI Image Generator
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-2 block">Describe your image</label>
            <Textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="E.g., A serene sunset over mountains with golden light, photorealistic style"
              rows={4}
              disabled={loading}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Be specific and descriptive for best results
            </p>
          </div>

          {generatedImage && (
            <div className="aspect-square bg-muted rounded-lg overflow-hidden">
              <img
                src={generatedImage}
                alt="Generated"
                className="w-full h-full object-contain"
              />
            </div>
          )}

          <div className="flex gap-2">
            <Button
              onClick={handleGenerate}
              disabled={loading || !prompt.trim()}
              className="flex-1 bg-gradient-primary"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" />
                  Generate Image
                </>
              )}
            </Button>
            {generatedImage && (
              <Button onClick={handleUseImage} variant="outline">
                Use This Image
              </Button>
            )}
          </div>

          <p className="text-xs text-muted-foreground text-center">
            Premium feature • Credits may apply for generation
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
