import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Play, Pause, Scissors, Music } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MusicTrack {
  id: string;
  title: string;
  artist: string | null;
  audio_url: string;
  duration_seconds: number | null;
}

interface MusicTrimmerProps {
  isOpen: boolean;
  onClose: () => void;
  track: MusicTrack | null;
  onConfirm: (track: MusicTrack, trimStart: number, trimEnd: number) => void;
}

export const MusicTrimmer: React.FC<MusicTrimmerProps> = ({
  isOpen,
  onClose,
  track,
  onConfirm,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(track?.duration_seconds || 30);
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(30);
  const [currentTime, setCurrentTime] = useState(0);
  const [waveformData, setWaveformData] = useState<number[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();

  useEffect(() => {
    if (!isOpen || !track) return;
    
    // Reset state
    setIsPlaying(false);
    setCurrentTime(0);
    setTrimStart(0);
    
    // Create audio element
    const audio = new Audio(track.audio_url);
    audioRef.current = audio;
    
    audio.addEventListener('loadedmetadata', () => {
      const dur = audio.duration;
      setDuration(dur);
      setTrimEnd(Math.min(30, dur));
    });

    audio.addEventListener('ended', () => {
      setIsPlaying(false);
      setCurrentTime(trimStart);
    });

    // Generate waveform data
    generateWaveform(track.audio_url);

    return () => {
      audio.pause();
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isOpen, track]);

  const generateWaveform = async (audioUrl: string) => {
    try {
      const response = await fetch(audioUrl);
      const arrayBuffer = await response.arrayBuffer();
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      
      const rawData = audioBuffer.getChannelData(0);
      const samples = 100;
      const blockSize = Math.floor(rawData.length / samples);
      const filteredData: number[] = [];
      
      for (let i = 0; i < samples; i++) {
        let sum = 0;
        for (let j = 0; j < blockSize; j++) {
          sum += Math.abs(rawData[i * blockSize + j]);
        }
        filteredData.push(sum / blockSize);
      }
      
      // Normalize
      const max = Math.max(...filteredData);
      const normalized = filteredData.map(v => v / max);
      setWaveformData(normalized);
    } catch (error) {
      // Fallback to random waveform for display
      const fakeData = Array.from({ length: 100 }, () => Math.random() * 0.5 + 0.25);
      setWaveformData(fakeData);
    }
  };

  const drawWaveform = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || waveformData.length === 0) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const width = canvas.width;
    const height = canvas.height;
    const barWidth = width / waveformData.length;
    
    ctx.clearRect(0, 0, width, height);
    
    waveformData.forEach((value, index) => {
      const x = index * barWidth;
      const barHeight = value * height * 0.8;
      const y = (height - barHeight) / 2;
      
      const timeAtBar = (index / waveformData.length) * duration;
      const isInTrimRange = timeAtBar >= trimStart && timeAtBar <= trimEnd;
      const isCurrentPosition = Math.abs(timeAtBar - currentTime) < (duration / waveformData.length);
      
      if (isCurrentPosition) {
        ctx.fillStyle = 'hsl(230, 85%, 60%)';
      } else if (isInTrimRange) {
        ctx.fillStyle = 'hsl(230, 85%, 60%)';
        ctx.globalAlpha = 0.7;
      } else {
        ctx.fillStyle = 'hsl(215, 20%, 35%)';
        ctx.globalAlpha = 0.5;
      }
      
      ctx.fillRect(x, y, barWidth - 1, barHeight);
      ctx.globalAlpha = 1;
    });
  }, [waveformData, trimStart, trimEnd, currentTime, duration]);

  useEffect(() => {
    drawWaveform();
  }, [drawWaveform]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    } else {
      audioRef.current.currentTime = trimStart;
      audioRef.current.play();
      setIsPlaying(true);
      
      const updateTime = () => {
        if (audioRef.current) {
          const time = audioRef.current.currentTime;
          setCurrentTime(time);
          
          if (time >= trimEnd) {
            audioRef.current.pause();
            audioRef.current.currentTime = trimStart;
            setIsPlaying(false);
            setCurrentTime(trimStart);
          } else if (isPlaying) {
            animationRef.current = requestAnimationFrame(updateTime);
          }
        }
      };
      animationRef.current = requestAnimationFrame(updateTime);
    }
  };

  const handleTrimChange = (values: number[]) => {
    if (values.length === 2) {
      const newStart = values[0];
      const newEnd = Math.min(values[1], newStart + 60); // Max 60 seconds
      setTrimStart(newStart);
      setTrimEnd(newEnd);
      
      if (audioRef.current && isPlaying) {
        audioRef.current.currentTime = newStart;
        setCurrentTime(newStart);
      }
    }
  };

  const selectPreset = (seconds: number) => {
    const end = Math.min(trimStart + seconds, duration);
    setTrimEnd(end);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const trimDuration = trimEnd - trimStart;

  const handleConfirm = () => {
    if (track) {
      onConfirm(track, trimStart, trimEnd);
    }
    onClose();
  };

  if (!track) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md z-[200]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Scissors className="w-5 h-5 text-primary" />
            Trim Audio
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Track Info */}
          <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
            <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-primary/30 to-accent/30 flex items-center justify-center">
              <Music className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">{track.title}</p>
              <p className="text-sm text-muted-foreground truncate">
                {track.artist || 'Unknown Artist'}
              </p>
            </div>
          </div>

          {/* Waveform Visualization */}
          <div className="relative">
            <canvas
              ref={canvasRef}
              width={400}
              height={80}
              className="w-full h-20 rounded-lg bg-muted/30"
            />
            
            {/* Time markers */}
            <div className="flex justify-between mt-2 text-xs text-muted-foreground">
              <span>{formatTime(trimStart)}</span>
              <span className="text-primary font-medium">
                Selected: {formatTime(trimDuration)}
              </span>
              <span>{formatTime(trimEnd)}</span>
            </div>
          </div>

          {/* Trim Range Slider */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Select Range</label>
            <Slider
              value={[trimStart, trimEnd]}
              min={0}
              max={duration}
              step={0.1}
              onValueChange={handleTrimChange}
              className="w-full"
            />
          </div>

          {/* Quick Presets */}
          <div className="flex gap-2">
            <Button
              variant={trimDuration <= 15.5 && trimDuration >= 14.5 ? "default" : "outline"}
              size="sm"
              onClick={() => selectPreset(15)}
              className="flex-1"
            >
              15s
            </Button>
            <Button
              variant={trimDuration <= 30.5 && trimDuration >= 29.5 ? "default" : "outline"}
              size="sm"
              onClick={() => selectPreset(30)}
              className="flex-1"
            >
              30s
            </Button>
            <Button
              variant={trimDuration <= 60.5 && trimDuration >= 59.5 ? "default" : "outline"}
              size="sm"
              onClick={() => selectPreset(60)}
              className="flex-1"
            >
              60s
            </Button>
            <Button
              variant={Math.abs(trimEnd - duration) < 0.5 && trimStart < 0.5 ? "default" : "outline"}
              size="sm"
              onClick={() => { setTrimStart(0); setTrimEnd(duration); }}
              className="flex-1"
            >
              Full
            </Button>
          </div>

          {/* Play Preview */}
          <Button
            variant="outline"
            className="w-full"
            onClick={togglePlay}
          >
            {isPlaying ? (
              <>
                <Pause className="w-4 h-4 mr-2" />
                Pause Preview
              </>
            ) : (
              <>
                <Play className="w-4 h-4 mr-2" />
                Preview Selection
              </>
            )}
          </Button>

          {/* Actions */}
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={onClose}>
              Cancel
            </Button>
            <Button className="flex-1" onClick={handleConfirm}>
              Use This Clip
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};