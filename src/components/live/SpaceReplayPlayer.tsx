import { useState, useRef, useEffect } from 'react';
import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, Download, Share2, X, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { useNavigation } from '@/context/NavigationContext';

interface SpaceReplayPlayerProps {
  spaceId: string;
  onClose: () => void;
}

interface SpaceData {
  id: string;
  title: string;
  description: string;
  recording_url: string;
  ended_at: string;
  started_at: string;
  viewer_count: number;
  peak_viewers: number;
  topic_category: string;
  user_id: string;
  host?: {
    display_name: string;
    username: string;
    avatar_url: string;
  };
}

export const SpaceReplayPlayer = ({ spaceId, onClose }: SpaceReplayPlayerProps) => {
  const { setHideBottomNav } = useNavigation();
  const [space, setSpace] = useState<SpaceData | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  
  const audioRef = useRef<HTMLAudioElement>(null);
  const progressInterval = useRef<NodeJS.Timeout | null>(null);

  // Hide bottom navigation when in replay player
  useEffect(() => {
    setHideBottomNav(true);
    return () => setHideBottomNav(false);
  }, [setHideBottomNav]);

  useEffect(() => {
    fetchSpaceData();
    return () => {
      if (progressInterval.current) {
        clearInterval(progressInterval.current);
      }
    };
  }, [spaceId]);

  const fetchSpaceData = async () => {
    const { data: spaceData, error } = await supabase
      .from('live_spaces')
      .select('*')
      .eq('id', spaceId)
      .single();

    if (error || !spaceData) {
      toast.error('Failed to load replay');
      onClose();
      return;
    }

    // Fetch host profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('display_name, username, avatar_url')
      .eq('id', spaceData.user_id)
      .single();

    setSpace({
      ...spaceData,
      host: profile || undefined,
    });
    setIsLoading(false);
  };

  const handlePlay = () => {
    if (audioRef.current) {
      audioRef.current.play();
      setIsPlaying(true);
      startProgressUpdate();
    }
  };

  const handlePause = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
      stopProgressUpdate();
    }
  };

  const togglePlayPause = () => {
    if (isPlaying) {
      handlePause();
    } else {
      handlePlay();
    }
  };

  const startProgressUpdate = () => {
    progressInterval.current = setInterval(() => {
      if (audioRef.current) {
        setCurrentTime(audioRef.current.currentTime);
      }
    }, 100);
  };

  const stopProgressUpdate = () => {
    if (progressInterval.current) {
      clearInterval(progressInterval.current);
    }
  };

  const handleSeek = (value: number[]) => {
    if (audioRef.current) {
      audioRef.current.currentTime = value[0];
      setCurrentTime(value[0]);
    }
  };

  const handleVolumeChange = (value: number[]) => {
    const newVolume = value[0];
    setVolume(newVolume);
    if (audioRef.current) {
      audioRef.current.volume = newVolume;
    }
    setIsMuted(newVolume === 0);
  };

  const toggleMute = () => {
    if (audioRef.current) {
      if (isMuted) {
        audioRef.current.volume = volume || 1;
        setIsMuted(false);
      } else {
        audioRef.current.volume = 0;
        setIsMuted(true);
      }
    }
  };

  const skip = (seconds: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = Math.max(0, Math.min(duration, audioRef.current.currentTime + seconds));
    }
  };

  const handleSpeedChange = () => {
    const speeds = [0.5, 0.75, 1, 1.25, 1.5, 2];
    const currentIndex = speeds.indexOf(playbackSpeed);
    const nextIndex = (currentIndex + 1) % speeds.length;
    const newSpeed = speeds[nextIndex];
    setPlaybackSpeed(newSpeed);
    if (audioRef.current) {
      audioRef.current.playbackRate = newSpeed;
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleShare = async () => {
    const shareUrl = `${window.location.origin}/space/${spaceId}`;
    
    // Try native share first (mobile devices)
    if (navigator.share && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) {
      try {
        await navigator.share({
          title: space?.title || 'Space Replay',
          text: `Listen to this space replay: ${space?.title}`,
          url: shareUrl,
        });
        return;
      } catch (error: any) {
        // If user cancelled, don't fall through to clipboard
        if (error?.name === 'AbortError') return;
      }
    }
    
    // Fallback to clipboard with multiple methods
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(shareUrl);
        toast.success('Link copied to clipboard!');
      } else {
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = shareUrl;
        textArea.style.position = 'fixed';
        textArea.style.left = '-9999px';
        textArea.style.top = '-9999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        
        const successful = document.execCommand('copy');
        document.body.removeChild(textArea);
        
        if (successful) {
          toast.success('Link copied to clipboard!');
        } else {
          toast.error('Could not copy link. Please copy manually: ' + shareUrl);
        }
      }
    } catch (error) {
      console.error('Failed to copy:', error);
      toast.error('Could not copy link. Please copy manually: ' + shareUrl);
    }
  };

  const handleDownload = async () => {
    if (!space?.recording_url) {
      toast.error('No recording available');
      return;
    }

    try {
      const response = await fetch(space.recording_url);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${space.title.replace(/\s+/g, '_')}_replay.webm`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('Download started!');
    } catch (error) {
      toast.error('Failed to download recording');
    }
  };

  if (isLoading) {
    return (
      <div className="fixed inset-0 z-50 bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading replay...</div>
      </div>
    );
  }

  if (!space || !space.recording_url) {
    return (
      <div className="fixed inset-0 z-50 bg-background flex flex-col items-center justify-center">
        <p className="text-muted-foreground mb-4">Recording not available</p>
        <Button onClick={onClose}>Close</Button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col">
      {/* Audio element */}
      <audio
        ref={audioRef}
        src={space.recording_url}
        onLoadedMetadata={() => {
          if (audioRef.current) {
            setDuration(audioRef.current.duration);
          }
        }}
        onEnded={() => {
          setIsPlaying(false);
          stopProgressUpdate();
        }}
      />

      {/* Header */}
      <div className="p-4 border-b flex items-center justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="secondary" className="bg-muted">
              <Clock className="w-3 h-3 mr-1" />
              Replay
            </Badge>
            {space.topic_category && (
              <Badge variant="outline" className="text-xs">
                {space.topic_category}
              </Badge>
            )}
          </div>
          <h1 className="text-lg font-bold truncate">{space.title}</h1>
          <p className="text-sm text-muted-foreground">
            Ended {formatDistanceToNow(new Date(space.ended_at), { addSuffix: true })}
          </p>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="w-5 h-5" />
        </Button>
      </div>

      {/* Host info */}
      <div className="p-4 flex items-center gap-3 border-b">
        <Avatar className="w-12 h-12">
          <AvatarImage src={space.host?.avatar_url || ''} />
          <AvatarFallback>{space.host?.display_name?.[0] || 'H'}</AvatarFallback>
        </Avatar>
        <div>
          <p className="font-medium">{space.host?.display_name || 'Unknown Host'}</p>
          <p className="text-sm text-muted-foreground">@{space.host?.username || 'unknown'}</p>
        </div>
        <div className="ml-auto text-right text-sm text-muted-foreground">
          <p>{space.peak_viewers || space.viewer_count} peak listeners</p>
        </div>
      </div>

      {/* Description */}
      {space.description && (
        <div className="p-4 border-b">
          <p className="text-sm text-muted-foreground">{space.description}</p>
        </div>
      )}

      {/* Visualization area */}
      <div className="flex-1 flex items-center justify-center bg-gradient-to-b from-background to-muted/20">
        <div className="relative">
          {/* Audio visualization placeholder */}
          <div className={cn(
            "w-40 h-40 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center",
            isPlaying && "animate-pulse"
          )}>
            <div className={cn(
              "w-32 h-32 rounded-full bg-gradient-to-br from-primary/30 to-primary/10 flex items-center justify-center",
              isPlaying && "animate-pulse"
            )}>
              <Avatar className="w-24 h-24 ring-4 ring-primary/20">
                <AvatarImage src={space.host?.avatar_url || ''} />
                <AvatarFallback className="text-2xl">{space.host?.display_name?.[0] || 'H'}</AvatarFallback>
              </Avatar>
            </div>
          </div>
        </div>
      </div>

      {/* Player controls */}
      <div className="p-4 border-t bg-background/95 backdrop-blur-sm">
        {/* Progress bar */}
        <div className="mb-4">
          <Slider
            value={[currentTime]}
            max={duration || 100}
            step={0.1}
            onValueChange={handleSeek}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-muted-foreground mt-1">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-between">
          {/* Left controls */}
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSpeedChange}
              className="text-xs"
            >
              {playbackSpeed}x
            </Button>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" onClick={toggleMute}>
                {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </Button>
              <Slider
                value={[isMuted ? 0 : volume]}
                max={1}
                step={0.01}
                onValueChange={handleVolumeChange}
                className="w-20"
              />
            </div>
          </div>

          {/* Center controls */}
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => skip(-15)}>
              <SkipBack className="w-5 h-5" />
            </Button>
            <Button
              size="icon"
              className="w-12 h-12 rounded-full"
              onClick={togglePlayPause}
            >
              {isPlaying ? (
                <Pause className="w-6 h-6" />
              ) : (
                <Play className="w-6 h-6 ml-0.5" />
              )}
            </Button>
            <Button variant="ghost" size="icon" onClick={() => skip(15)}>
              <SkipForward className="w-5 h-5" />
            </Button>
          </div>

          {/* Right controls */}
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={handleShare}>
              <Share2 className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={handleDownload}>
              <Download className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
