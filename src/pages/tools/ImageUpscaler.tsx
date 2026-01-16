import { useState, useRef, ChangeEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BottomNav } from '@/components/navigation/BottomNav';
import { ImageShareModal } from '@/components/shared/ImageShareModal';
import { 
  ArrowLeft, Upload, Maximize, Loader2, Download, Share2, 
  CheckCircle, Zap, ZoomIn
} from 'lucide-react';

const ImageUpscaler = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [resultUrl, setResultUrl] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [upscaleLevel, setUpscaleLevel] = useState<'2x' | '4x'>('2x');
  const [showShareModal, setShowShareModal] = useState(false);

  const handleFileSelect = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        toast({ title: 'File too large', description: 'Maximum size is 10MB', variant: 'destructive' });
        return;
      }
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      setResultUrl('');
    }
  };

  const handleUpscale = async () => {
    if (!user || !selectedFile) return;

    setIsProcessing(true);
    setProgress(10);

    try {
      const reader = new FileReader();
      reader.readAsDataURL(selectedFile);
      
      reader.onload = async () => {
        const base64Image = reader.result as string;
        setProgress(30);

        const upscalePrompt = upscaleLevel === '2x' 
          ? 'Upscale this image to 2x resolution. Enhance details, reduce noise, sharpen the image while maintaining natural appearance. Improve overall quality significantly.'
          : 'Upscale this image to 4x resolution. Maximum quality enhancement with professional-level detail recovery, noise reduction, and sharpening. Make it look like a high-resolution professional photo.';

        const { data, error } = await supabase.functions.invoke('ai-image-gen', {
          body: {
            prompt: upscalePrompt,
            inputImageUrl: base64Image,
            mode: 'edit',
          },
        });

        setProgress(80);

        if (error) throw error;

        if (data?.imageUrl) {
          setResultUrl(data.imageUrl);
          setProgress(100);

          await supabase.from('ai_tool_usage').insert({
            user_id: user.id,
            tool_id: 'image-upscaler',
            tool_category: 'image',
            credits_used: upscaleLevel === '2x' ? 15 : 25,
            status: 'completed',
            metadata: { upscale_level: upscaleLevel },
          });

          toast({ title: 'Image upscaled successfully!' });
        }
      };
    } catch (error: any) {
      console.error('Error:', error);
      toast({ 
        title: 'Upscaling failed', 
        description: error.message, 
        variant: 'destructive' 
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownload = async () => {
    if (!resultUrl) return;

    try {
      const response = await fetch(resultUrl);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `feedin-upscaled-${upscaleLevel}-${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast({ title: 'Image downloaded!' });
    } catch (error) {
      toast({ title: 'Download failed', variant: 'destructive' });
    }
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="flex items-center justify-between p-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/ai/tools')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-primary/10 rounded-lg text-primary">
              <Maximize className="w-5 h-5" />
            </div>
            <span className="text-lg font-semibold">Image Upscaler</span>
          </div>
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <Zap className="w-4 h-4 text-yellow-500" />
            ~15
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Description */}
        <Card className="bg-gradient-to-r from-primary/5 to-purple-500/5">
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">
              Increase image resolution up to 4x with AI. Similar to Remini, this tool enhances 
              details and improves quality for blurry or low-resolution photos.
            </p>
          </CardContent>
        </Card>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          className="hidden"
        />

        {!previewUrl ? (
          <Card 
            className="border-2 border-dashed cursor-pointer hover:border-primary/50 transition-all"
            onClick={() => fileInputRef.current?.click()}
          >
            <CardContent className="p-12 text-center">
              <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <p className="font-medium mb-1">Drop image here or click to upload</p>
              <p className="text-sm text-muted-foreground">
                Best results with photos under 2MB
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {/* Original Image */}
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="font-medium">Original Image</span>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => {
                      setSelectedFile(null);
                      setPreviewUrl('');
                      setResultUrl('');
                    }}
                  >
                    Change
                  </Button>
                </div>
                <img 
                  src={previewUrl} 
                  alt="Original" 
                  className="w-full rounded-lg max-h-64 object-contain bg-muted"
                />
              </CardContent>
            </Card>

            {/* Upscale Options */}
            {!resultUrl && !isProcessing && (
              <>
                <Card>
                  <CardContent className="p-4">
                    <h3 className="font-medium mb-3">Upscale Level</h3>
                    <Tabs value={upscaleLevel} onValueChange={(v) => setUpscaleLevel(v as '2x' | '4x')}>
                      <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="2x">
                          <ZoomIn className="w-4 h-4 mr-1" />
                          2x (~15 credits)
                        </TabsTrigger>
                        <TabsTrigger value="4x">
                          <ZoomIn className="w-4 h-4 mr-1" />
                          4x (~25 credits)
                        </TabsTrigger>
                      </TabsList>
                      <TabsContent value="2x" className="text-sm text-muted-foreground mt-2">
                        Double the resolution with enhanced details
                      </TabsContent>
                      <TabsContent value="4x" className="text-sm text-muted-foreground mt-2">
                        Maximum quality - 4x resolution with professional enhancement
                      </TabsContent>
                    </Tabs>
                  </CardContent>
                </Card>

                <Button 
                  onClick={handleUpscale} 
                  className="w-full"
                  size="lg"
                >
                  <Maximize className="w-5 h-5 mr-2" />
                  Upscale Image ({upscaleLevel})
                </Button>
              </>
            )}

            {/* Processing State */}
            {isProcessing && (
              <Card className="border-primary/50">
                <CardContent className="p-6 text-center">
                  <Loader2 className="w-10 h-10 mx-auto mb-4 animate-spin text-primary" />
                  <p className="font-medium mb-2">Upscaling to {upscaleLevel}...</p>
                  <Progress value={progress} className="h-2" />
                  <p className="text-xs text-muted-foreground mt-2">
                    AI is enhancing your image
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Result */}
            {resultUrl && (
              <>
                <Card className="border-green-500/50">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <CheckCircle className="w-5 h-5 text-green-500" />
                      <span className="font-medium">Upscaled to {upscaleLevel}</span>
                    </div>
                    <img 
                      src={resultUrl} 
                      alt="Upscaled" 
                      className="w-full rounded-lg"
                    />
                  </CardContent>
                </Card>

                {/* Comparison */}
                <Card>
                  <CardContent className="p-4">
                    <h3 className="font-medium mb-3">Before & After</h3>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Before</p>
                        <img src={previewUrl} alt="Before" className="w-full rounded-lg" />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">After ({upscaleLevel})</p>
                        <img src={resultUrl} alt="After" className="w-full rounded-lg" />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <div className="flex gap-2">
                  <Button onClick={handleDownload} className="flex-1">
                    <Download className="w-4 h-4 mr-2" />
                    Download
                  </Button>
                  <Button 
                    variant="outline" 
                    className="flex-1"
                    onClick={() => setShowShareModal(true)}
                  >
                    <Share2 className="w-4 h-4 mr-2" />
                    Share
                  </Button>
                </div>

                <Button 
                  variant="outline" 
                  className="w-full"
                  onClick={() => {
                    setResultUrl('');
                    setProgress(0);
                  }}
                >
                  Upscale Another Image
                </Button>
              </>
            )}
          </div>
        )}
      </div>

      <ImageShareModal
        open={showShareModal}
        onOpenChange={setShowShareModal}
        imageUrl={resultUrl}
        imageType="enhanced"
      />

      <BottomNav />
    </div>
  );
};

export default ImageUpscaler;
