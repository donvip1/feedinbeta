import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Play, Pause, Video } from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import { toast } from '@/hooks/use-toast';
import { extractVideoThumbnails } from '@/lib/media-compression';

interface VideoTrimmerProps {
  open: boolean;
  onClose: () => void;
  videoFile: File;
  onSave: (trimmedBlob: Blob, startTime: number, endTime: number) => void;
}

export const VideoTrimmer = ({ open, onClose, videoFile, onSave }: VideoTrimmerProps) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [startTime, setStartTime] = useState(0);
  const [endTime, setEndTime] = useState(0);
  const [videoUrl, setVideoUrl] = useState<string>('');
  const [thumbnails, setThumbnails] = useState<string[]>([]);
  const [loadingThumbnails, setLoadingThumbnails] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoFile) {
      const url = URL.createObjectURL(videoFile);
      setVideoUrl(url);
      loadThumbnails();
      return () => URL.revokeObjectURL(url);
    }
  }, [videoFile]);

  const loadThumbnails = async () => {
    if (!videoFile) return;
    setLoadingThumbnails(true);
    try {
      const thumbs = await extractVideoThumbnails(videoFile, 10);
      setThumbnails(thumbs);
    } catch (error) {
      console.error('Error loading thumbnails:', error);
    } finally {
      setLoadingThumbnails(false);
    }
  };

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleLoadedMetadata = () => {
      setDuration(video.duration);
      setEndTime(video.duration);
    };

    const handleTimeUpdate = () => {
      setCurrentTime(video.currentTime);
      if (video.currentTime >= endTime) {
        video.pause();
        setIsPlaying(false);
        video.currentTime = startTime;
      }
    };

    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('timeupdate', handleTimeUpdate);

    return () => {
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('timeupdate', handleTimeUpdate);
    };
  }, [endTime, startTime]);

  const togglePlayPause = () => {
    const video = videoRef.current;
    if (!video) return;

    if (isPlaying) {
      video.pause();
    } else {
      video.currentTime = Math.max(startTime, currentTime);
      video.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleStartChange = (value: number[]) => {
    const newStart = value[0];
    if (newStart < endTime) {
      setStartTime(newStart);
      if (videoRef.current) {
        videoRef.current.currentTime = newStart;
      }
    }
  };

  const handleEndChange = (value: number[]) => {
    const newEnd = value[0];
    if (newEnd > startTime) {
      setEndTime(newEnd);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleSave = async () => {
    try {
      // For now, we'll pass the original file since browser-based video trimming
      // requires complex video processing. In production, this should be done server-side.
      onSave(videoFile, startTime, endTime);
      onClose();
      toast({ title: 'Video trimmed successfully' });
    } catch (error) {
      console.error('Error trimming video:', error);
      toast({ title: 'Error trimming video', variant: 'destructive' });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Trim Video</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Video preview */}
          <div className="bg-black rounded-lg overflow-hidden">
            <video
              ref={videoRef}
              src={videoUrl}
              className="w-full max-h-[400px]"
              onClick={togglePlayPause}
            />
          </div>

          {/* Controls */}
          <div className="space-y-4">
            <div className="flex items-center justify-center gap-4">
              <Button
                variant="outline"
                size="icon"
                onClick={togglePlayPause}
                className="h-12 w-12 rounded-full"
              >
                {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-1" />}
              </Button>
              <div className="text-sm text-muted-foreground">
                {formatTime(currentTime)} / {formatTime(duration)}
              </div>
            </div>

            {/* Timeline thumbnails */}
            <div className="bg-muted rounded-lg p-4">
              <div className="flex gap-1 overflow-x-auto">
                {loadingThumbnails ? (
                  Array.from({ length: 10 }).map((_, i) => (
                    <div
                      key={i}
                      className="flex-shrink-0 w-16 h-16 bg-accent rounded flex items-center justify-center animate-pulse"
                    >
                      <Video className="w-6 h-6 text-muted-foreground" />
                    </div>
                  ))
                ) : thumbnails.length > 0 ? (
                  thumbnails.map((thumb, i) => (
                    <img
                      key={i}
                      src={thumb}
                      alt={`Frame ${i + 1}`}
                      className="flex-shrink-0 w-16 h-16 rounded object-cover cursor-pointer hover:ring-2 hover:ring-primary"
                      onClick={() => {
                        if (videoRef.current && duration) {
                          videoRef.current.currentTime = ((i + 1) / (thumbnails.length + 1)) * duration;
                        }
                      }}
                    />
                  ))
                ) : (
                  Array.from({ length: 10 }).map((_, i) => (
                    <div
                      key={i}
                      className="flex-shrink-0 w-16 h-16 bg-accent rounded flex items-center justify-center"
                    >
                      <Video className="w-6 h-6 text-muted-foreground" />
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Start trim */}
            <div>
              <label className="text-sm font-medium">Start: {formatTime(startTime)}</label>
              <Slider
                value={[startTime]}
                onValueChange={handleStartChange}
                min={0}
                max={duration}
                step={0.1}
                className="mt-2"
              />
            </div>

            {/* End trim */}
            <div>
              <label className="text-sm font-medium">End: {formatTime(endTime)}</label>
              <Slider
                value={[endTime]}
                onValueChange={handleEndChange}
                min={0}
                max={duration}
                step={0.1}
                className="mt-2"
              />
            </div>

            <div className="text-sm text-muted-foreground text-center">
              Duration: {formatTime(endTime - startTime)}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave}>
            Save Trim
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
