import { useState, useRef, ChangeEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { BottomNav } from '@/components/navigation/BottomNav';
import { ImageShareModal } from '@/components/shared/ImageShareModal';
import { 
  ArrowLeft, Upload, Eraser, Loader2, Download, Share2, 
  CheckCircle, Zap 
} from 'lucide-react';

const BackgroundRemover = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [resultUrl, setResultUrl] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
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

  const handleRemoveBackground = async () => {
    if (!user || !selectedFile) return;

    setIsProcessing(true);
    setProgress(10);

    try {
      // Convert file to base64
      const base64Image = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(selectedFile);
      });
      
      setProgress(30);

      // Call AI to remove background with improved prompt
      const { data, error } = await supabase.functions.invoke('ai-image-gen', {
        body: {
          prompt: 'CRITICAL INSTRUCTION: You must edit the EXACT image I provided. Remove ONLY the background from this specific image while keeping the main subject EXACTLY as it appears. The subject must remain identical - same pose, same details, same colors. Replace the background with pure white (#FFFFFF). Do NOT generate a new or different image. Preserve every detail of the original subject.',
          imageUrl: base64Image,
          mode: 'edit',
        },
      });

      setProgress(80);

      if (error) {
        throw new Error(error.message || 'Failed to process image');
      }

      if (data?.imageUrl) {
        setResultUrl(data.imageUrl);
        setProgress(100);

        // Log usage
        await supabase.from('ai_tool_usage').insert({
          user_id: user.id,
          tool_id: 'bg-remover',
          tool_category: 'image',
          credits_used: 10,
          status: 'completed',
        });

        toast({ title: 'Background removed successfully!' });
      } else {
        throw new Error('No image returned from AI');
      }
    } catch (error: any) {
      console.error('Error:', error);
      setProgress(0);
      toast({ 
        title: 'Processing failed', 
        description: 'AI could not process this image. Try a different image with a clear subject.',
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
      a.download = `feedin-bg-removed-${Date.now()}.png`;
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
              <Eraser className="w-5 h-5" />
            </div>
            <span className="text-lg font-semibold">Background Remover</span>
          </div>
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <Zap className="w-4 h-4 text-yellow-500" />
            ~10
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Description */}
        <Card className="bg-gradient-to-r from-primary/5 to-purple-500/5">
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">
              Remove backgrounds from images instantly with AI. Perfect for product photos, 
              profile pictures, and creative projects.
            </p>
          </CardContent>
        </Card>

        {/* File Upload */}
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
                Supports JPG, PNG, WebP (max 10MB)
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

            {/* Processing Button */}
            {!resultUrl && !isProcessing && (
              <Button 
                onClick={handleRemoveBackground} 
                className="w-full"
                size="lg"
              >
                <Eraser className="w-5 h-5 mr-2" />
                Remove Background
              </Button>
            )}

            {/* Processing State */}
            {isProcessing && (
              <Card className="border-primary/50">
                <CardContent className="p-6 text-center">
                  <Loader2 className="w-10 h-10 mx-auto mb-4 animate-spin text-primary" />
                  <p className="font-medium mb-2">Removing background...</p>
                  <Progress value={progress} className="h-2" />
                  <p className="text-xs text-muted-foreground mt-2">
                    AI is processing your image
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
                      <span className="font-medium">Background Removed</span>
                    </div>
                    <div className="bg-[url('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAGElEQVQYlWNgYGCQwoKxgqGgcJA5h3yFAXcADqgCZh7zURUAAAAASUVORK5CYII=')] rounded-lg p-2">
                      <img 
                        src={resultUrl} 
                        alt="Result" 
                        className="w-full rounded-lg max-h-64 object-contain"
                      />
                    </div>
                  </CardContent>
                </Card>

                {/* Action Buttons */}
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
                  Process Another Image
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
        imageType="generated"
      />

      <BottomNav />
    </div>
  );
};

export default BackgroundRemover;
