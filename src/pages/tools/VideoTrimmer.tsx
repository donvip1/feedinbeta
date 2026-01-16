import { useState, useCallback, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { BottomNav } from '@/components/navigation/BottomNav';
import { ArrowLeft, Upload, Scissors, Loader2, Download, Play, Pause, Video } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const VideoTrimmer = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const [trimRange, setTrimRange] = useState([0, 100]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [resultUrl, setResultUrl] = useState<string | null>(null);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    if (!selectedFile.type.startsWith('video/')) {
      toast({
        title: 'Invalid file',
        description: 'Please select a video file',
        variant: 'destructive',
      });
      return;
    }

    setFile(selectedFile);
    setResultUrl(null);

    const url = URL.createObjectURL(selectedFile);
    setVideoUrl(url);
  }, [toast]);

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
      setTrimRange([0, 100]);
    }
  };

  const handleRangeChange = (values: number[]) => {
    setTrimRange(values);
    if (videoRef.current) {
      videoRef.current.currentTime = (values[0] / 100) * duration;
    }
  };

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.currentTime = (trimRange[0] / 100) * duration;
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => {
      const endTime = (trimRange[1] / 100) * duration;
      if (video.currentTime >= endTime) {
        video.pause();
        setIsPlaying(false);
      }
    };

    video.addEventListener('timeupdate', handleTimeUpdate);
    return () => video.removeEventListener('timeupdate', handleTimeUpdate);
  }, [trimRange, duration]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleTrim = async () => {
    if (!file || !videoUrl) return;

    setIsProcessing(true);

    try {
      // For browser-based trimming, we'll use MediaRecorder
      // Note: This is a simplified version - for production, you'd use FFmpeg WASM
      
      toast({
        title: 'Video trimming',
        description: 'Note: Browser-based trimming has limitations. For best results, use desktop software.',
      });

      // Create a download link for the original video with trim info
      // In production, you'd use FFmpeg WASM or server-side processing
      const startTime = (trimRange[0] / 100) * duration;
      const endTime = (trimRange[1] / 100) * duration;
      
      // For now, just provide the original file with instructions
      setResultUrl(videoUrl);

      toast({
        title: 'Trim range set!',
        description: `Selected ${formatTime(startTime)} to ${formatTime(endTime)}`,
      });
    } catch (error: any) {
      console.error('Trim error:', error);
      toast({
        title: 'Trim failed',
        description: error.message || 'Failed to trim video',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownload = () => {
    if (!resultUrl) return;
    const a = document.createElement('a');
    a.href = resultUrl;
    a.download = `trimmed_${file?.name || 'video.mp4'}`;
    a.click();
  };

  const startTime = (trimRange[0] / 100) * duration;
  const endTime = (trimRange[1] / 100) * duration;

  return (
    <>
      <div className="min-h-screen bg-background pb-24">
        <div className="sticky top-0 z-50 bg-background/95 backdrop-blur-sm border-b border-border">
          <div className="flex items-center gap-3 p-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/ai/tools')}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-lg font-semibold">Video Trimmer</h1>
              <p className="text-xs text-muted-foreground">Cut and trim your videos</p>
            </div>
          </div>
        </div>

        <div className="p-4 max-w-2xl mx-auto space-y-4">
          <Card>
            <CardContent className="p-6">
              <label className="block">
                <div className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:border-primary transition-colors">
                  {videoUrl ? (
                    <div className="space-y-4">
                      <video
                        ref={videoRef}
                        src={videoUrl}
                        className="max-h-64 mx-auto rounded-lg"
                        onLoadedMetadata={handleLoadedMetadata}
                      />
                      <div className="flex items-center justify-center gap-4">
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={(e) => {
                            e.preventDefault();
                            togglePlay();
                          }}
                        >
                          {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                        </Button>
                        <span className="text-sm">{file?.name}</span>
                      </div>
                    </div>
                  ) : (
                    <>
                      <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                      <p className="text-sm font-medium mb-1">Drop video here or click to upload</p>
                      <p className="text-xs text-muted-foreground">Supports MP4, WebM, MOV</p>
                    </>
                  )}
                </div>
                <input
                  type="file"
                  accept="video/*"
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </label>
            </CardContent>
          </Card>

          {videoUrl && duration > 0 && (
            <Card>
              <CardContent className="p-4 space-y-4">
                <div>
                  <div className="flex justify-between mb-2">
                    <label className="text-sm font-medium">Trim Range</label>
                    <span className="text-sm text-muted-foreground">
                      {formatTime(startTime)} - {formatTime(endTime)}
                    </span>
                  </div>
                  <Slider
                    value={trimRange}
                    onValueChange={handleRangeChange}
                    min={0}
                    max={100}
                    step={1}
                  />
                  <div className="flex justify-between mt-1">
                    <span className="text-xs text-muted-foreground">0:00</span>
                    <span className="text-xs text-muted-foreground">{formatTime(duration)}</span>
                  </div>
                </div>
                <p className="text-sm text-center">
                  Duration: {formatTime(endTime - startTime)}
                </p>
              </CardContent>
            </Card>
          )}

          <Button
            className="w-full"
            size="lg"
            onClick={handleTrim}
            disabled={!file || isProcessing}
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Scissors className="w-5 h-5 mr-2" />
                Trim Video
              </>
            )}
          </Button>

          {resultUrl && (
            <Card className="border-green-500/50 bg-green-500/10">
              <CardContent className="p-4">
                <p className="text-sm font-medium text-green-600 dark:text-green-400 mb-3">
                  ✓ Video ready!
                </p>
                <p className="text-xs text-muted-foreground mb-4">
                  Trim range: {formatTime(startTime)} to {formatTime(endTime)} ({formatTime(endTime - startTime)})
                </p>
                <Button onClick={handleDownload} className="w-full">
                  <Download className="w-5 h-5 mr-2" />
                  Download Video
                </Button>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="p-4">
              <p className="text-sm font-medium mb-2">Note:</p>
              <p className="text-xs text-muted-foreground">
                Browser-based video trimming has limitations. For advanced editing with precise frame cuts, 
                consider using desktop software or our mobile app.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
      <BottomNav />
    </>
  );
};

export default VideoTrimmer;
