import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Play, Pause } from 'lucide-react';

interface WaveformPlayerProps {
  audioUrl: string;
  isOwn?: boolean;
}

export const WaveformPlayer = ({ audioUrl, isOwn = false }: WaveformPlayerProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const wavesurferRef = useRef<any>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState('0:00');
  const [currentTime, setCurrentTime] = useState('0:00');
  const [usesFallback, setUsesFallback] = useState(false);

  useEffect(() => {
    let mounted = true;

    const initWaveSurfer = async () => {
      if (!containerRef.current || !mounted) return;

      try {
        // Dynamically import WaveSurfer to avoid SSR issues
        const WaveSurfer = (await import('wavesurfer.js')).default;
        
        if (!mounted || !containerRef.current) return;

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
          if (!mounted) return;
          const dur = wavesurfer.getDuration();
          setDuration(formatTime(dur));
        });

        wavesurfer.on('audioprocess', () => {
          if (!mounted) return;
          const time = wavesurfer.getCurrentTime();
          setCurrentTime(formatTime(time));
        });

        wavesurfer.on('play', () => mounted && setIsPlaying(true));
        wavesurfer.on('pause', () => mounted && setIsPlaying(false));
        wavesurfer.on('finish', () => {
          if (!mounted) return;
          setIsPlaying(false);
          wavesurfer.seekTo(0);
        });

        wavesurferRef.current = wavesurfer;
      } catch (error) {
        console.error('WaveSurfer failed to load, using fallback player:', error);
        if (mounted) {
          setUsesFallback(true);
        }
      }
    };

    initWaveSurfer();

    return () => {
      mounted = false;
      if (wavesurferRef.current) {
        try {
          wavesurferRef.current.destroy();
        } catch (e) {
          console.error('Error destroying wavesurfer:', e);
        }
      }
    };
  }, [audioUrl, isOwn]);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const togglePlayPause = () => {
    if (usesFallback && audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
      } else {
        audioRef.current.play();
        setIsPlaying(true);
      }
    } else if (wavesurferRef.current) {
      wavesurferRef.current.playPause();
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(formatTime(audioRef.current.currentTime));
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(formatTime(audioRef.current.duration));
    }
  };

  // Fallback to simple audio player if WaveSurfer fails
  if (usesFallback) {
    return (
      <div className="flex items-center gap-2 min-w-[200px] max-w-[300px]">
        <audio
          ref={audioRef}
          src={audioUrl}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onEnded={() => setIsPlaying(false)}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
        />
      <Button
        variant="ghost"
        size="icon"
        className={`h-8 w-8 flex-shrink-0 ${isOwn ? 'text-primary-foreground hover:bg-primary/20' : 'text-foreground'}`}
        onClick={togglePlayPause}
      >
        {isPlaying ? (
          <Pause className="w-4 h-4" />
        ) : (
          <Play className="w-4 h-4" />
        )}
      </Button>
      
      <div className="flex-1 min-w-0">
        <div className="h-8 bg-muted/30 rounded-full flex items-center px-2">
          <div className="text-xs">🎵 Voice message</div>
        </div>
      </div>

      <span className={`text-xs flex-shrink-0 ${isOwn ? 'text-primary-foreground/80' : 'text-muted-foreground'}`}>
        {isPlaying ? currentTime : duration}
      </span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 min-w-[200px] max-w-[300px]">
      <Button
        variant="ghost"
        size="icon"
        className={`h-8 w-8 flex-shrink-0 ${isOwn ? 'text-primary-foreground hover:bg-primary/20' : 'text-foreground'}`}
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

      <span className={`text-xs flex-shrink-0 ${isOwn ? 'text-primary-foreground/80' : 'text-muted-foreground'}`}>
        {isPlaying ? currentTime : duration}
      </span>
    </div>
  );
};
