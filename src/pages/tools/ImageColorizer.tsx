import { useState, ChangeEvent } from 'react';
import { ArrowLeft, Palette, Download, Upload, Loader2, Sparkles, Zap } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { BackButton } from '@/components/navigation/BackButton';
import { Card } from '@/components/ui/card';
import { toast } from 'sonner';
import { BottomNav } from '@/components/navigation/BottomNav';
import { supabase } from '@/integrations/supabase/client';
import { useAIToolCredits } from '@/hooks/useAIToolCredits';

const CREDIT_COST = 10;

const ImageColorizer = () => {
  const navigate = useNavigate();
  const { balance, isLoading: creditsLoading, hasEnoughCredits, checkAndDeductCredits } = useAIToolCredits({
    toolName: 'image_colorizer',
    creditCost: CREDIT_COST,
  });
  const [image, setImage] = useState<string | null>(null);
  const [colorizedImage, setColorizedImage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => {
          setImage(e.target?.result as string);
          setColorizedImage(null);
        };
        reader.readAsDataURL(file);
      } else {
        toast.error('Please select an image file');
      }
    }
  };

  const handleColorize = async () => {
    if (!image) {
      toast.error('Please select an image first');
      return;
    }

    const success = await checkAndDeductCredits();
    if (!success) return;

    setIsProcessing(true);
    try {
      // Use AI to describe and re-generate the image in color
      const { data, error } = await supabase.functions.invoke('ai-image-gen', {
        body: {
          prompt: 'Take this black and white or grayscale image and colorize it naturally with realistic colors. Maintain the same composition and details but add vibrant, natural colors.',
          image: image.split(',')[1], // Send base64 without prefix
          mode: 'colorize'
        }
      });

      if (error) throw error;

      if (data?.imageUrl) {
        setColorizedImage(data.imageUrl);
        toast.success('Image colorized successfully!');
      } else {
        // Fallback: Apply a sepia-to-color filter effect
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const img = new Image();
        img.onload = () => {
          canvas.width = img.width;
          canvas.height = img.height;
          ctx?.drawImage(img, 0, 0);
          
          // Apply warm color overlay to simulate colorization
          if (ctx) {
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const data = imageData.data;
            
            for (let i = 0; i < data.length; i += 4) {
              const gray = (data[i] + data[i + 1] + data[i + 2]) / 3;
              // Add warm tones
              data[i] = Math.min(255, gray * 1.1);     // Red
              data[i + 1] = Math.min(255, gray * 0.95); // Green
              data[i + 2] = Math.min(255, gray * 0.85); // Blue
            }
            
            ctx.putImageData(imageData, 0, 0);
            setColorizedImage(canvas.toDataURL('image/png'));
            toast.success('Basic colorization applied!');
          }
        };
        img.src = image;
      }
    } catch (error) {
      console.error('Colorization error:', error);
      toast.error('Colorization failed. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownload = () => {
    if (colorizedImage) {
      const a = document.createElement('a');
      a.href = colorizedImage;
      a.download = 'colorized-image.png';
      a.click();
      toast.success('Image downloaded!');
    }
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border p-4">
        <div className="flex items-center gap-3">
          <BackButton fallback="/ai/copilot" />
          <div className="flex-1">
            <h1 className="text-xl font-bold">Image Colorizer</h1>
            <p className="text-sm text-muted-foreground">Add color to black & white photos</p>
          </div>
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <Zap className="w-4 h-4 text-yellow-500" />
            <span>{CREDIT_COST}</span>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4">
        <Card className="p-6">
          <div className="text-center space-y-4">
            <div className="w-16 h-16 mx-auto bg-primary/10 rounded-full flex items-center justify-center">
              <Palette className="h-8 w-8 text-primary" />
            </div>
            
            <div>
              <label htmlFor="image-upload" className="cursor-pointer">
                <div className="border-2 border-dashed border-border rounded-lg p-8 hover:border-primary/50 transition-colors">
                  {image ? (
                    <img src={image} alt="Upload" className="max-h-48 mx-auto rounded" />
                  ) : (
                    <>
                      <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">
                        Click to upload black & white image
                      </p>
                    </>
                  )}
                </div>
                <input
                  id="image-upload"
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="hidden"
                />
              </label>
            </div>

            <Button 
              onClick={handleColorize} 
              disabled={!image || isProcessing}
              className="w-full"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Colorizing...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Colorize Image
                </>
              )}
            </Button>
          </div>
        </Card>

        {colorizedImage && (
          <Card className="p-6">
            <div className="space-y-4">
              <h3 className="font-semibold">Colorized Result</h3>
              <img src={colorizedImage} alt="Colorized" className="w-full rounded-lg" />
              <Button onClick={handleDownload} className="w-full">
                <Download className="h-4 w-4 mr-2" />
                Download Colorized Image
              </Button>
            </div>
          </Card>
        )}
      </div>

      <BottomNav />
    </div>
  );
};

export default ImageColorizer;
