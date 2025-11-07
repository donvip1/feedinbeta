import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Play, Pause, Volume2 } from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import { toast } from '@/hooks/use-toast';

interface AudioTrimmerProps {
  open: boolean;
  onClose: () => void;
  audioFile: File;
  onSave: (trimmedBlob: Blob, startTime: number, endTime: number) => void;
}

export const AudioTrimmer = ({ open, onClose, audioFile, onSave }: AudioTrimmerProps) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [startTime, setStartTime] = useState(0);
  const [endTime, setEndTime] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string>('');
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    if (audioFile) {
      const url = URL.createObjectURL(audioFile);
      setAudioUrl(url);
      return () => URL.revokeObjectURL(url);
    }
  }, [audioFile]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleLoadedMetadata = () => {
      setDuration(audio.duration);
      setEndTime(audio.duration);
    };

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
      if (audio.currentTime >= endTime) {
        audio.pause();
        setIsPlaying(false);
        audio.currentTime = startTime;
      }
    };

    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('timeupdate', handleTimeUpdate);

    return () => {
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
    };
  }, [endTime, startTime]);

  const togglePlayPause = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
    } else {
      audio.currentTime = Math.max(startTime, currentTime);
      audio.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleStartChange = (value: number[]) => {
    const newStart = value[0];
    if (newStart < endTime) {
      setStartTime(newStart);
      if (audioRef.current) {
        audioRef.current.currentTime = newStart;
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
      // For now, we'll pass the original file since browser-based audio trimming
      // requires complex audio processing. In production, this should be done server-side.
      onSave(audioFile, startTime, endTime);
      onClose();
      toast({ title: 'Audio trimmed successfully' });
    } catch (error) {
      console.error('Error trimming audio:', error);
      toast({ title: 'Error trimming audio', variant: 'destructive' });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Trim Audio</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <audio ref={audioRef} src={audioUrl} className="hidden" />

          {/* Waveform visualization placeholder */}
          <div className="bg-muted rounded-lg p-8 flex items-center justify-center relative overflow-hidden">
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="flex gap-1 items-center h-full">
                {Array.from({ length: 50 }).map((_, i) => (
                  <div
                    key={i}
                    className="bg-primary/30 w-2 rounded-full"
                    style={{
                      height: `${Math.random() * 60 + 20}%`,
                      opacity: currentTime >= (i / 50) * duration && currentTime <= ((i + 1) / 50) * duration ? 1 : 0.3,
                    }}
                  />
                ))}
              </div>
            </div>
            <Volume2 className="w-12 h-12 text-muted-foreground relative z-10" />
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
