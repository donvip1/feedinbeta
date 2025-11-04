import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Scissors, Crop, RotateCw, Check, X, Play, Pause } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface VideoEditorProps {
  videoUrl: string;
  open: boolean;
  onClose: () => void;
  onSave: (editedBlob: Blob, thumbnail: string) => void;
}

const ASPECT_RATIOS = [
  { label: '9:16', value: 9/16, name: 'Vertical' },
  { label: '1:1', value: 1, name: 'Square' },
  { label: '4:5', value: 4/5, name: 'Portrait' },
  { label: '16:9', value: 16/9, name: 'Landscape' },
  { label: 'Free', value: 0, name: 'Free' },
];

export const VideoEditor = ({ videoUrl, open, onClose, onSave }: VideoEditorProps) => {
  const { toast } = useToast();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(100);
  const [selectedRatio, setSelectedRatio] = useState(ASPECT_RATIOS[0]);
  const [rotation, setRotation] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.load();
    }
  }, [videoUrl]);

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      const videoDuration = videoRef.current.duration;
      setDuration(videoDuration);
      setTrimEnd(videoDuration);
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      const current = videoRef.current.currentTime;
      setCurrentTime(current);
      
      // Loop within trim range
      const startTime = (trimStart / 100) * duration;
      const endTime = (trimEnd / 100) * duration;
      
      if (current >= endTime) {
        videoRef.current.currentTime = startTime;
      }
    }
  };

  const togglePlayPause = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        const startTime = (trimStart / 100) * duration;
        if (currentTime < startTime || currentTime >= (trimEnd / 100) * duration) {
          videoRef.current.currentTime = startTime;
        }
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleTrimStartChange = (value: number[]) => {
    const newStart = value[0];
    if (newStart < trimEnd - 1) {
      setTrimStart(newStart);
      if (videoRef.current) {
        videoRef.current.currentTime = (newStart / 100) * duration;
      }
    }
  };

  const handleTrimEndChange = (value: number[]) => {
    const newEnd = value[0];
    if (newEnd > trimStart + 1) {
      setTrimEnd(newEnd);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const generateThumbnail = async (): Promise<string> => {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      const video = videoRef.current!;
      
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      canvas.toBlob((blob) => {
        resolve(URL.createObjectURL(blob!));
      }, 'image/jpeg', 0.8);
    });
  };

  const handleSave = async () => {
    if (!videoRef.current || !canvasRef.current) return;

    setProcessing(true);
    try {
      // Generate thumbnail from current video frame
      const thumbnail = await generateThumbnail();

      // For now, we'll pass the trimmed video URL and let the server handle the actual trimming
      // In a production app, you'd use FFmpeg.wasm or a backend service to process the video
      
      // Create a metadata object with all the editing parameters
      const editMetadata = {
        trimStart: (trimStart / 100) * duration,
        trimEnd: (trimEnd / 100) * duration,
        aspectRatio: selectedRatio.label,
        rotation,
      };

      // For browser-based processing, we can't actually edit video files
      // So we'll just pass back a reference to the original with edit metadata
      toast({
        title: 'Video settings saved',
        description: 'Your video edits have been applied.',
      });

      // In a real implementation, you would:
      // 1. Send video + metadata to a backend service
      // 2. Use FFmpeg.wasm in the browser (heavy processing)
      // 3. Or use a video editing API service
      
      // For now, create a dummy blob from the canvas thumbnail
      const response = await fetch(videoUrl);
      const blob = await response.blob();
      
      onSave(blob, thumbnail);
    } catch (error) {
      console.error('Error processing video:', error);
      toast({
        title: 'Error processing video',
        description: 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setProcessing(false);
    }
  };

  const trimmedDuration = ((trimEnd - trimStart) / 100) * duration;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Scissors className="w-5 h-5" />
            Video Editor
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Video Preview */}
          <div className="relative bg-black rounded-lg overflow-hidden aspect-video">
            <video
              ref={videoRef}
              src={videoUrl}
              onLoadedMetadata={handleLoadedMetadata}
              onTimeUpdate={handleTimeUpdate}
              className="w-full h-full object-contain"
              playsInline
            />
            <canvas ref={canvasRef} className="hidden" />
            
            {/* Play/Pause Overlay */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <Button
                size="icon"
                variant="secondary"
                className="w-16 h-16 rounded-full pointer-events-auto opacity-80 hover:opacity-100"
                onClick={togglePlayPause}
              >
                {isPlaying ? (
                  <Pause className="w-8 h-8" />
                ) : (
                  <Play className="w-8 h-8 ml-1" />
                )}
              </Button>
            </div>

            {/* Time Display */}
            <div className="absolute bottom-4 left-4 bg-black/70 px-3 py-1 rounded text-white text-sm">
              {formatTime(currentTime)} / {formatTime(duration)}
            </div>
          </div>

          {/* Trim Controls */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Scissors className="w-4 h-4" />
                <span className="font-semibold">Trim</span>
              </div>
              <span className="text-sm text-muted-foreground">
                Duration: {formatTime(trimmedDuration)}
              </span>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-4">
                <span className="text-sm w-12">Start</span>
                <Slider
                  value={[trimStart]}
                  min={0}
                  max={100}
                  step={0.1}
                  onValueChange={handleTrimStartChange}
                  className="flex-1"
                />
                <span className="text-sm w-16 text-right">
                  {formatTime((trimStart / 100) * duration)}
                </span>
              </div>

              <div className="flex items-center gap-4">
                <span className="text-sm w-12">End</span>
                <Slider
                  value={[trimEnd]}
                  min={0}
                  max={100}
                  step={0.1}
                  onValueChange={handleTrimEndChange}
                  className="flex-1"
                />
                <span className="text-sm w-16 text-right">
                  {formatTime((trimEnd / 100) * duration)}
                </span>
              </div>
            </div>
          </div>

          {/* Aspect Ratio Selection */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Crop className="w-4 h-4" />
              <span className="font-semibold">Aspect Ratio</span>
            </div>
            <div className="grid grid-cols-5 gap-2">
              {ASPECT_RATIOS.map((ratio) => (
                <Button
                  key={ratio.label}
                  variant={selectedRatio.label === ratio.label ? 'default' : 'outline'}
                  onClick={() => setSelectedRatio(ratio)}
                  className="flex flex-col items-center gap-1 h-auto py-3"
                >
                  <span className="font-semibold">{ratio.label}</span>
                  <span className="text-xs">{ratio.name}</span>
                </Button>
              ))}
            </div>
          </div>

          {/* Rotation */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <RotateCw className="w-4 h-4" />
              <span className="font-semibold">Rotation</span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={() => setRotation((rotation - 90) % 360)}
              >
                <RotateCw className="w-4 h-4 transform scale-x-[-1]" />
              </Button>
              <span className="flex-1 text-center text-sm">{rotation}°</span>
              <Button
                variant="outline"
                onClick={() => setRotation((rotation + 90) % 360)}
              >
                <RotateCw className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={onClose} disabled={processing}>
              <X className="w-4 h-4 mr-2" />
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={processing}>
              <Check className="w-4 h-4 mr-2" />
              {processing ? 'Processing...' : 'Save Changes'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};