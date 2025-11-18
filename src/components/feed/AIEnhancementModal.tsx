import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Sparkles, ArrowLeft, Check } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface AIEnhancementModalProps {
  open: boolean;
  onClose: () => void;
  onBack: () => void;
  imageUrl: string;
  onNext: (enhancedImageUrl: string) => void;
  isPremium: boolean;
}

type EnhancementLevel = 'normal' | 'best' | 'ultra';

export function AIEnhancementModal({
  open,
  onClose,
  onBack,
  imageUrl,
  onNext,
  isPremium,
}: AIEnhancementModalProps) {
  const { toast } = useToast();
  const [enhancementLevel, setEnhancementLevel] = useState<EnhancementLevel>('normal');
  const [customPrompt, setCustomPrompt] = useState('');
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [enhancedImageUrl, setEnhancedImageUrl] = useState<string | null>(null);
  const [showComparison, setShowComparison] = useState(false);

  const handleEnhance = async () => {
    if (!isPremium) {
      toast({
        title: 'Premium feature',
        description: 'AI enhancement is only available for premium members',
        variant: 'destructive',
      });
      return;
    }

    setIsEnhancing(true);
    try {
      const enhancementPrompts = {
        normal: 'Enhance this image with basic improvements to lighting, color, and clarity',
        best: 'Professionally enhance this image with advanced color grading, lighting optimization, and detail enhancement',
        ultra: 'Apply ultra-level enhancement with maximum quality improvements, perfect lighting, vibrant colors, and exceptional detail',
      };

      const finalPrompt = customPrompt.trim() 
        ? `${enhancementPrompts[enhancementLevel]}. Additional instructions: ${customPrompt}`
        : enhancementPrompts[enhancementLevel];

      const { data, error } = await supabase.functions.invoke('ai-image-gen', {
        body: {
          mode: 'edit',
          imageUrl: imageUrl,
          prompt: finalPrompt,
        },
      });

      if (error) throw error;

      if (data?.imageUrl) {
        setEnhancedImageUrl(data.imageUrl);
        setShowComparison(true);
        toast({
          title: 'Enhancement complete',
          description: 'Your image has been enhanced',
        });
      }
    } catch (error) {
      console.error('Enhancement error:', error);
      toast({
        title: 'Enhancement failed',
        description: 'Failed to enhance image. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsEnhancing(false);
    }
  };

  const handleUseEnhanced = () => {
    if (enhancedImageUrl) {
      onNext(enhancedImageUrl);
    }
  };

  const handleSkip = () => {
    onNext(imageUrl);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] p-0 overflow-hidden">
        <DialogHeader className="px-6 py-4 border-b">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={onBack}
              className="h-8 w-8"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              AI Enhancement {!isPremium && '(Premium Only)'}
            </DialogTitle>
          </div>
        </DialogHeader>

        <div className="flex flex-col gap-4 p-6 overflow-y-auto">
          {/* Image Preview */}
          <div className="relative w-full aspect-[9/16] max-h-[500px] bg-black rounded-lg overflow-hidden">
            {showComparison && enhancedImageUrl ? (
              <div className="flex h-full">
                <div className="flex-1 relative">
                  <img src={imageUrl} alt="Original" className="w-full h-full object-contain" />
                  <div className="absolute bottom-2 left-2 bg-black/70 text-white px-2 py-1 rounded text-sm">
                    Before
                  </div>
                </div>
                <div className="flex-1 relative">
                  <img src={enhancedImageUrl} alt="Enhanced" className="w-full h-full object-contain" />
                  <div className="absolute bottom-2 right-2 bg-primary text-primary-foreground px-2 py-1 rounded text-sm">
                    After
                  </div>
                </div>
              </div>
            ) : (
              <img src={imageUrl} alt="Preview" className="w-full h-full object-contain" />
            )}
          </div>

          {isPremium ? (
            <>
              {/* Enhancement Level Selection */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Enhancement Level</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['normal', 'best', 'ultra'] as EnhancementLevel[]).map((level) => (
                    <Button
                      key={level}
                      variant={enhancementLevel === level ? 'default' : 'outline'}
                      onClick={() => setEnhancementLevel(level)}
                      className="capitalize"
                      disabled={isEnhancing}
                    >
                      {level}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Custom Prompt */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Custom Instructions (Optional)</label>
                <Textarea
                  placeholder="E.g., Change the background to sunset, add a cap, make it brighter..."
                  value={customPrompt}
                  onChange={(e) => setCustomPrompt(e.target.value)}
                  className="min-h-[100px]"
                  disabled={isEnhancing}
                />
              </div>

              {/* Action Buttons */}
              {!showComparison ? (
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={handleSkip}
                    disabled={isEnhancing}
                    className="flex-1"
                  >
                    Skip Enhancement
                  </Button>
                  <Button
                    onClick={handleEnhance}
                    disabled={isEnhancing}
                    className="flex-1"
                  >
                    {isEnhancing ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Enhancing...
                      </>
                    ) : (
                      <>
                        <Sparkles className="mr-2 h-4 w-4" />
                        Enhance Image
                      </>
                    )}
                  </Button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowComparison(false);
                      setEnhancedImageUrl(null);
                    }}
                    className="flex-1"
                  >
                    Try Again
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleSkip}
                    className="flex-1"
                  >
                    Use Original
                  </Button>
                  <Button
                    onClick={handleUseEnhanced}
                    className="flex-1"
                  >
                    <Check className="mr-2 h-4 w-4" />
                    Use Enhanced
                  </Button>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-8">
              <Sparkles className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold mb-2">Premium Feature</h3>
              <p className="text-muted-foreground mb-4">
                AI image enhancement is only available for premium members
              </p>
              <Button onClick={handleSkip} className="w-full">
                Continue Without Enhancement
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
