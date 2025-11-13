import React, { useEffect, useRef, useState } from 'react';
import WaveSurfer from 'wavesurfer.js';
import { Button } from '@/components/ui/button';
import { Play, Pause } from 'lucide-react';

interface WaveformPlayerProps {
  audioUrl: string;
  isOwn?: boolean;
}

export const WaveformPlayer = ({ audioUrl, isOwn = false }: WaveformPlayerProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const wavesurferRef = useRef<WaveSurfer | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState('0:00');
  const [currentTime, setCurrentTime] = useState('0:00');

  useEffect(() => {
    if (!containerRef.current) return;

    const wavesurfer = WaveSurfer.create({
      container: containerRef.current,
      waveColor: isOwn ? 'rgba(255, 255, 255, 0.5)' : 'hsl(var(--muted-foreground))',
      progressColor: isOwn ? 'rgba(255, 255, 255, 0.9)' : 'hsl(var(--primary))',
      cursorColor: isOwn ? '#ffffff' : 'hsl(var(--primary))',
      barWidth: 2,
      barRadius: 3,
      cursorWidth: 1,
      height: 40,
      barGap: 2,
    });

    wavesurfer.load(audioUrl);

    wavesurfer.on('ready', () => {
      const dur = wavesurfer.getDuration();
      setDuration(formatTime(dur));
    });

    wavesurfer.on('audioprocess', () => {
      const time = wavesurfer.getCurrentTime();
      setCurrentTime(formatTime(time));
    });

    wavesurfer.on('play', () => setIsPlaying(true));
    wavesurfer.on('pause', () => setIsPlaying(false));
    wavesurfer.on('finish', () => {
      setIsPlaying(false);
      wavesurfer.seekTo(0);
    });

    wavesurferRef.current = wavesurfer;

    return () => {
      wavesurfer.destroy();
    };
  }, [audioUrl, isOwn]);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const togglePlayPause = () => {
    if (wavesurferRef.current) {
      wavesurferRef.current.playPause();
    }
  };

  return (
    <div className="flex items-center gap-2 min-w-[200px] max-w-[300px]">
      <Button
        variant="ghost"
        size="icon"
        className={`h-8 w-8 flex-shrink-0 ${isOwn ? 'text-white hover:bg-white/20' : ''}`}
        onClick={togglePlayPause}
      >
        {isPlaying ? (
          <Pause className="w-4 h-4" />
        ) : (
          <Play className="w-4 h-4" />
        )}
      </Button>
      
      <div className="flex-1 min-w-0">
        <div ref={containerRef} className="w-full" />
      </div>

      <span className={`text-xs flex-shrink-0 ${isOwn ? 'text-white/80' : 'text-muted-foreground'}`}>
        {isPlaying ? currentTime : duration}
      </span>
    </div>
  );
};
