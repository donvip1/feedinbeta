import { useState } from 'react';
import { ArrowLeft, Video, Download, Upload, Loader2, Settings, Zap } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { BottomNav } from '@/components/navigation/BottomNav';
import { useAIToolCredits } from '@/hooks/useAIToolCredits';
import { compressVideo } from '@/lib/video-compressor';

const CREDIT_COST = 5;

const VideoCompressor = () => {
  const navigate = useNavigate();
  const { balance, hasEnoughCredits, checkAndDeductCredits } = useAIToolCredits({
    toolName: 'video_compressor',
    creditCost: CREDIT_COST,
  });
  const [video, setVideo] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [compressedUrl, setCompressedUrl] = useState<string | null>(null);
  const [compressedBlob, setCompressedBlob] = useState<Blob | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [quality, setQuality] = useState('medium');
  const [originalSize, setOriginalSize] = useState(0);
  const [compressedSize, setCompressedSize] = useState(0);

  const handleVideoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.type.startsWith('video/')) {
        setVideo(file);
        setVideoUrl(URL.createObjectURL(file));
        setOriginalSize(file.size);
        setCompressedUrl(null);
        setCompressedBlob(null);
        setCompressedSize(0);
        setProgress(0);
      } else {
        toast.error('Please select a video file');
      }
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleCompress = async () => {
    if (!video) {
      toast.error('Please select a video first');
      return;
    }

    const success = await checkAndDeductCredits();
    if (!success) return;

    setIsProcessing(true);
    setProgress(0);

    try {
      const result = await compressVideo(video, {
        quality: quality as 'low' | 'medium' | 'high',
        onProgress: (p) => setProgress(p),
      });

      const blobUrl = URL.createObjectURL(result.blob);
      setCompressedUrl(blobUrl);
      setCompressedBlob(result.blob);
      setCompressedSize(result.compressedSize);
      
      const savedPercent = Math.round((1 - result.compressedSize / originalSize) * 100);
      toast.success(`Video compressed! Saved ${savedPercent}% (${formatSize(originalSize - result.compressedSize)})`);
    } catch (error) {
      console.error('Compression error:', error);
      toast.error('Compression failed. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownload = () => {
    if (compressedBlob && video) {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(compressedBlob);
      // Change extension to .webm since we're using WebM codec
      const originalName = video.name.replace(/\.[^/.]+$/, '');
      a.download = `compressed_${originalName}.webm`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      toast.success('Compressed video downloaded!');
    }
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border p-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-xl font-bold">Video Compressor</h1>
            <p className="text-sm text-muted-foreground">Reduce video file size</p>
          </div>
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <Zap className="w-4 h-4 text-yellow-500" />
            {CREDIT_COST}
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4">
        <Card className="p-6">
          <div className="text-center space-y-4">
            <div className="w-16 h-16 mx-auto bg-primary/10 rounded-full flex items-center justify-center">
              <Video className="h-8 w-8 text-primary" />
            </div>
            
            <div>
              <label htmlFor="video-upload" className="cursor-pointer">
                <div className="border-2 border-dashed border-border rounded-lg p-8 hover:border-primary/50 transition-colors">
                  {videoUrl ? (
                    <video src={videoUrl} className="max-h-48 mx-auto rounded" controls />
                  ) : (
                    <>
                      <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">
                        Click to upload video
                      </p>
                    </>
                  )}
                </div>
                <input
                  id="video-upload"
                  type="file"
                  accept="video/*"
                  onChange={handleVideoChange}
                  className="hidden"
                />
              </label>
            </div>

            {video && (
              <div className="text-sm text-muted-foreground">
                Original size: {formatSize(originalSize)}
              </div>
            )}

            <div className="flex items-center gap-2">
              <Settings className="h-4 w-4 text-muted-foreground" />
              <Select value={quality} onValueChange={setQuality}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select quality" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low (480p - Smallest file)</SelectItem>
                  <SelectItem value="medium">Medium (720p - Balanced)</SelectItem>
                  <SelectItem value="high">High (1080p - Best quality)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {isProcessing && (
              <div className="space-y-2">
                <Progress value={progress} className="h-2" />
                <p className="text-sm text-muted-foreground">
                  Compressing... {progress}%
                </p>
              </div>
            )}

            <Button 
              onClick={handleCompress} 
              disabled={!video || isProcessing}
              className="w-full"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Compressing...
                </>
              ) : (
                'Compress Video'
              )}
            </Button>
          </div>
        </Card>

        {compressedUrl && !isProcessing && (
          <Card className="p-6">
            <div className="space-y-4">
              <h3 className="font-semibold">Compression Complete!</h3>
              
              <video src={compressedUrl} className="w-full max-h-48 rounded" controls />
              
              <div className="bg-muted/50 p-4 rounded-lg space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Original:</span>
                  <span>{formatSize(originalSize)}</span>
                </div>
                <div className="flex justify-between text-sm text-primary">
                  <span>Compressed:</span>
                  <span>{formatSize(compressedSize)}</span>
                </div>
                <div className="flex justify-between text-sm font-medium">
                  <span>Saved:</span>
                  <span className="text-green-500">
                    {Math.round((1 - compressedSize / originalSize) * 100)}%
                  </span>
                </div>
              </div>
              <Button onClick={handleDownload} className="w-full">
                <Download className="h-4 w-4 mr-2" />
                Download Compressed Video
              </Button>
            </div>
          </Card>
        )}
      </div>

      <BottomNav />
    </div>
  );
};

export default VideoCompressor;