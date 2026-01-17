import { useState, useRef, ChangeEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAIToolCredits } from '@/hooks/useAIToolCredits';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { BottomNav } from '@/components/navigation/BottomNav';
import { ImageShareModal } from '@/components/shared/ImageShareModal';
import { ImageComparisonSlider } from '@/components/shared/ImageComparisonSlider';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  ArrowLeft, Upload, Eraser, Loader2, Download, Share2, 
  CheckCircle, Zap, SplitSquareVertical, Grid2x2
} from 'lucide-react';

const CREDIT_COST = 10;
const TOOL_NAME = 'Background Remover';

const BackgroundRemover = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const { balance, isLoading: isLoadingCredits, hasEnoughCredits, checkAndDeductCredits } = useAIToolCredits({
    toolName: TOOL_NAME,
    creditCost: CREDIT_COST,
  });
  
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [resultUrl, setResultUrl] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [showShareModal, setShowShareModal] = useState(false);
  const [viewMode, setViewMode] = useState<'slider' | 'sideBySide'>('slider');

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

    // Check and deduct credits first
    const hasCredits = await checkAndDeductCredits();
    if (!hasCredits) return;

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
          credits_used: CREDIT_COST,
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
          <div className="flex items-center gap-1 text-sm">
            <Zap className="w-4 h-4 text-yellow-500" />
            {isLoadingCredits ? (
              <Skeleton className="w-8 h-4" />
            ) : (
              <span className={hasEnoughCredits ? 'text-muted-foreground' : 'text-destructive font-medium'}>
                {balance}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Description */}
        <Card className="bg-gradient-to-r from-primary/5 to-purple-500/5">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Remove backgrounds from images instantly with AI. Perfect for product photos, 
                profile pictures, and creative projects.
              </p>
              <div className="flex items-center gap-1 px-2 py-1 bg-primary/10 rounded-full text-xs font-medium text-primary shrink-0 ml-2">
                <Zap className="w-3 h-3" />
                {CREDIT_COST} credits
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Insufficient Credits Warning */}
        {!isLoadingCredits && !hasEnoughCredits && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Card className="border-destructive/50 bg-destructive/5">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="font-medium text-destructive">Insufficient Credits</p>
                  <p className="text-sm text-muted-foreground">
                    You need {CREDIT_COST} credits. Balance: {balance}
                  </p>
                </div>
                <Button size="sm" onClick={() => navigate('/credits')}>
                  Get Credits
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        )}

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
            {/* Original Image (shown only when no result yet) */}
            {!resultUrl && !isProcessing && (
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
            )}

            {/* Processing Button */}
            {!resultUrl && !isProcessing && (
              <Button 
                onClick={handleRemoveBackground} 
                className="w-full"
                size="lg"
                disabled={!hasEnoughCredits}
              >
                <Eraser className="w-5 h-5 mr-2" />
                Remove Background ({CREDIT_COST} credits)
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

            {/* Result with Comparison */}
            <AnimatePresence>
              {resultUrl && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-4"
                >
                  <Card className="border-green-500/50">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                          <CheckCircle className="w-5 h-5 text-green-500" />
                          <span className="font-medium">Background Removed</span>
                        </div>
                        
                        {/* View Toggle */}
                        <div className="flex items-center gap-1 p-1 bg-muted rounded-lg">
                          <Button
                            variant={viewMode === 'slider' ? 'secondary' : 'ghost'}
                            size="sm"
                            className="h-7 px-2"
                            onClick={() => setViewMode('slider')}
                          >
                            <SplitSquareVertical className="w-4 h-4" />
                          </Button>
                          <Button
                            variant={viewMode === 'sideBySide' ? 'secondary' : 'ghost'}
                            size="sm"
                            className="h-7 px-2"
                            onClick={() => setViewMode('sideBySide')}
                          >
                            <Grid2x2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>

                      {/* Comparison Views */}
                      {viewMode === 'slider' ? (
                        <ImageComparisonSlider
                          beforeImage={previewUrl}
                          afterImage={resultUrl}
                          beforeLabel="Original"
                          afterLabel="Removed"
                        />
                      ) : (
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <p className="text-xs text-muted-foreground mb-2">Before</p>
                            <img 
                              src={previewUrl} 
                              alt="Before" 
                              className="w-full rounded-lg aspect-square object-contain bg-muted"
                            />
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground mb-2">After</p>
                            <div 
                              className="rounded-lg aspect-square bg-muted"
                              style={{
                                backgroundImage: `
                                  linear-gradient(45deg, hsl(var(--muted)) 25%, transparent 25%),
                                  linear-gradient(-45deg, hsl(var(--muted)) 25%, transparent 25%),
                                  linear-gradient(45deg, transparent 75%, hsl(var(--muted)) 75%),
                                  linear-gradient(-45deg, transparent 75%, hsl(var(--muted)) 75%)
                                `,
                                backgroundSize: '16px 16px',
                                backgroundPosition: '0 0, 0 8px, 8px -8px, -8px 0px',
                              }}
                            >
                              <img 
                                src={resultUrl} 
                                alt="After" 
                                className="w-full h-full rounded-lg object-contain"
                              />
                            </div>
                          </div>
                        </div>
                      )}
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
                      setSelectedFile(null);
                      setPreviewUrl('');
                      setResultUrl('');
                      setProgress(0);
                    }}
                  >
                    Process Another Image
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>
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
