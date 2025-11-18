import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Play, Pause, Scissors, X } from 'lucide-react';

interface VideoTrimmerProps {
  videoUrl: string;
  onTrimComplete: (trimmedBlob: Blob) => void;
  onClose: () => void;
}

export function VideoTrimmer({ videoUrl, onTrimComplete, onClose }: VideoTrimmerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [duration, setDuration] = useState(0);
  const [startTime, setStartTime] = useState(0);
  const [endTime, setEndTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleLoadedMetadata = () => {
      const dur = video.duration;
      setDuration(dur);
      setEndTime(Math.min(dur, 120)); // Max 2 minutes
    };

    const handleTimeUpdate = () => {
      const time = video.currentTime;
      setCurrentTime(time);
      if (time >= endTime) {
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
      video.currentTime = startTime;
      video.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleTrim = async () => {
    // For now, we'll just pass the original video
    // In a production app, you'd use FFmpeg.js or a backend service to actually trim
    const response = await fetch(videoUrl);
    const blob = await response.blob();
    onTrimComplete(blob);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 z-[200] bg-black flex flex-col">
      <div className="flex items-center justify-between p-4 border-b border-white/10">
        <button onClick={onClose} className="text-white">
          <X className="w-6 h-6" />
        </button>
        <h3 className="text-white font-semibold">Trim Video</h3>
        <Button onClick={handleTrim} variant="ghost" className="text-white">
          <Scissors className="w-5 h-5 mr-2" />
          Apply
        </Button>
      </div>

      <div className="flex-1 flex items-center justify-center p-4">
        <video
          ref={videoRef}
          src={videoUrl}
          className="max-w-full max-h-full rounded-lg"
        />
      </div>

      <div className="p-6 space-y-4 bg-black/80 backdrop-blur">
        <div className="flex items-center justify-center gap-4 mb-4">
          <button
            onClick={togglePlayPause}
            className="w-12 h-12 rounded-full bg-white text-black flex items-center justify-center"
          >
            {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6 ml-1" />}
          </button>
        </div>

        <div className="space-y-2">
          <div className="flex justify-between text-white text-sm">
            <span>Start: {formatTime(startTime)}</span>
            <span>Current: {formatTime(currentTime)}</span>
            <span>End: {formatTime(endTime)}</span>
          </div>
          
          <div className="space-y-3">
            <div>
              <label className="text-white text-xs mb-2 block">Start Time</label>
              <Slider
                value={[startTime]}
                onValueChange={([v]) => {
                  setStartTime(Math.min(v, endTime - 1));
                  if (videoRef.current) videoRef.current.currentTime = v;
                }}
                min={0}
                max={duration}
                step={0.1}
                className="[&_[role=slider]]:bg-white"
              />
            </div>
            
            <div>
              <label className="text-white text-xs mb-2 block">End Time</label>
              <Slider
                value={[endTime]}
                onValueChange={([v]) => setEndTime(Math.max(v, startTime + 1))}
                min={0}
                max={Math.min(duration, 120)}
                step={0.1}
                className="[&_[role=slider]]:bg-white"
              />
            </div>
          </div>

          <p className="text-white/60 text-xs text-center mt-2">
            Trim duration: {formatTime(endTime - startTime)} (Max: 2:00)
          </p>
        </div>
      </div>
    </div>
  );
}
