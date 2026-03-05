import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, Download, Share2, X, Clock, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { shareUrls } from '@/lib/url-utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { useNavigation } from '@/context/NavigationContext';
import { SpaceChat } from './SpaceChat';

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
  cover_image_url?: string;
  host?: {
    display_name: string;
    username: string;
    avatar_url: string;
  };
}

export const SpaceReplayPlayer = ({ spaceId, onClose }: SpaceReplayPlayerProps) => {
  const navigate = useNavigate();
  const { setHideBottomNav } = useNavigation();
  const [space, setSpace] = useState<SpaceData | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [showChat, setShowChat] = useState(false);
  
  const audioRef = useRef<HTMLAudioElement>(null);
  const progressInterval = useRef<NodeJS.Timeout | null>(null);

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
    isPlaying ? handlePause() : handlePlay();
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
    const shareUrl = shareUrls.liveSpace(spaceId);
    if (navigator.share && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) {
      try {
        await navigator.share({
          title: space?.title || 'Space Replay',
          text: `Listen to this space replay: ${space?.title}`,
          url: shareUrl,
        });
        return;
      } catch (error: any) {
        if (error?.name === 'AbortError') return;
      }
    }
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast.success('Link copied!');
    } catch {
      toast.error('Could not copy link');
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
    } catch {
      toast.error('Failed to download');
    }
  };

  if (isLoading) {
    return (
      <div className="fixed inset-0 z-50 bg-black flex items-center justify-center">
        <div className="animate-pulse text-zinc-400 text-sm">Loading replay...</div>
      </div>
    );
  }

  if (!space || !space.recording_url) {
    return (
      <div className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center gap-4 px-6">
        <p className="text-zinc-400 text-sm">Recording not available</p>
        <Button onClick={onClose} variant="outline" size="sm">Close</Button>
      </div>
    );
  }

  // Chat overlay
  if (showChat) {
    return (
      <div className="fixed inset-0 z-50 bg-black flex flex-col">
        <SpaceChat
          spaceId={spaceId}
          onClose={() => setShowChat(false)}
          spaceTitle={space.title}
          coverImageUrl={space.cover_image_url}
        />
      </div>
    );
  }

  const durationMins = space.started_at && space.ended_at
    ? Math.floor((new Date(space.ended_at).getTime() - new Date(space.started_at).getTime()) / 60000)
    : 0;

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col overflow-hidden">
      {/* Audio element */}
      <audio
        ref={audioRef}
        src={space.recording_url}
        onLoadedMetadata={() => {
          if (audioRef.current) setDuration(audioRef.current.duration);
        }}
        onEnded={() => {
          setIsPlaying(false);
          stopProgressUpdate();
        }}
      />

      <div className="flex items-center gap-2 px-3 py-2 pt-safe border-b border-white/5 shrink-0">
        <Button variant="ghost" size="icon" onClick={() => navigate('/live', { state: { tab: 'Replays' } })} className="shrink-0 w-8 h-8 text-zinc-400 hover:text-white">
          <X className="w-5 h-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-sm font-bold text-white truncate">{space.title}</h1>
          <p className="text-[10px] text-zinc-500 truncate">
            {space.host?.display_name} · {space.started_at ? format(new Date(space.started_at), 'MMM d, yyyy · h:mm a') : ''} · {durationMins > 0 ? `${durationMins} min` : ''}
          </p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Badge variant="secondary" className="bg-zinc-800/80 text-zinc-400 text-[10px] px-2 py-0.5 border-0">
            <Clock className="w-3 h-3 mr-1" />
            Replay
          </Badge>
        </div>
      </div>

      {/* Scrollable content area */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {/* Host card + visualization */}
        <div className="flex flex-col items-center justify-center px-4 py-6 gap-5">
          {/* Animated avatar visualization */}
          <div className="relative">
            <div className={cn(
              "w-36 h-36 sm:w-44 sm:h-44 rounded-full bg-gradient-to-br from-purple-500/20 to-purple-500/5 flex items-center justify-center transition-all",
              isPlaying && "animate-pulse"
            )}>
              <div className={cn(
                "w-28 h-28 sm:w-36 sm:h-36 rounded-full bg-gradient-to-br from-purple-500/30 to-purple-500/10 flex items-center justify-center",
                isPlaying && "animate-pulse"
              )}>
                <Avatar className="w-20 h-20 sm:w-28 sm:h-28 ring-4 ring-purple-500/20">
                  <AvatarImage src={space.host?.avatar_url || ''} />
                  <AvatarFallback className="text-xl bg-zinc-800 text-zinc-300">{space.host?.display_name?.[0] || 'H'}</AvatarFallback>
                </Avatar>
              </div>
            </div>
          </div>

          {/* Host info */}
          <div className="text-center space-y-1 w-full max-w-xs">
            <p className="font-bold text-white text-base">{space.host?.display_name || 'Unknown Host'}</p>
            <p className="text-xs text-zinc-500">@{space.host?.username || 'unknown'}</p>
          </div>

          {/* Stats row */}
          <div className="flex items-center gap-4 flex-wrap justify-center">
            {space.topic_category && (
              <Badge variant="outline" className="text-[10px] border-zinc-700 text-zinc-400">
                {space.topic_category}
              </Badge>
            )}
            <span className="text-[10px] text-zinc-500">{space.peak_viewers || space.viewer_count || 0} listeners</span>
            {durationMins > 0 && <span className="text-[10px] text-zinc-500">{durationMins} min</span>}
          </div>

          {/* Description */}
          {space.description && (
            <p className="text-xs text-zinc-400 text-center max-w-sm leading-relaxed px-2">{space.description}</p>
          )}

          {/* Action buttons */}
          <div className="flex items-center gap-3 flex-wrap justify-center">
            <button
              onClick={() => setShowChat(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-zinc-800/80 border border-white/5 text-zinc-300 hover:bg-zinc-700/80 text-xs font-medium transition-all active:scale-95"
            >
              <MessageSquare className="w-4 h-4" />
              Chat
            </button>
            <button
              onClick={handleShare}
              className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-zinc-800/80 border border-white/5 text-zinc-300 hover:bg-zinc-700/80 text-xs font-medium transition-all active:scale-95"
            >
              <Share2 className="w-4 h-4" />
              Share
            </button>
            <button
              onClick={handleDownload}
              className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-zinc-800/80 border border-white/5 text-zinc-300 hover:bg-zinc-700/80 text-xs font-medium transition-all active:scale-95"
            >
              <Download className="w-4 h-4" />
              Download
            </button>
          </div>
        </div>
      </div>

      {/* Player controls - fixed bottom */}
      <div className="shrink-0 border-t border-white/5 bg-zinc-950/95 backdrop-blur-sm px-4 pt-3 pb-safe">
        {/* Progress bar */}
        <div className="mb-3">
          <Slider
            value={[currentTime]}
            max={duration || 100}
            step={0.1}
            onValueChange={handleSeek}
            className="w-full"
          />
          <div className="flex justify-between text-[10px] text-zinc-500 mt-1 px-0.5">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        {/* Controls row - responsive */}
        <div className="flex items-center justify-between gap-1">
          {/* Left: Speed + Volume */}
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={handleSpeedChange}
              className="px-2 py-1.5 rounded-lg bg-zinc-800/60 text-[10px] font-bold text-zinc-400 hover:text-white transition-colors min-w-[36px]"
            >
              {playbackSpeed}x
            </button>
            <button onClick={toggleMute} className="w-8 h-8 flex items-center justify-center text-zinc-400 hover:text-white transition-colors">
              {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
          </div>

          {/* Center: Playback controls */}
          <div className="flex items-center gap-1">
            <button onClick={() => skip(-15)} className="w-10 h-10 flex items-center justify-center text-zinc-400 hover:text-white transition-colors active:scale-90">
              <SkipBack className="w-5 h-5" />
            </button>
            <button
              onClick={togglePlayPause}
              className="w-14 h-14 rounded-full bg-purple-600 hover:bg-purple-500 flex items-center justify-center text-white transition-all active:scale-90 shadow-lg shadow-purple-500/20"
            >
              {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6 ml-0.5" />}
            </button>
            <button onClick={() => skip(15)} className="w-10 h-10 flex items-center justify-center text-zinc-400 hover:text-white transition-colors active:scale-90">
              <SkipForward className="w-5 h-5" />
            </button>
          </div>

          {/* Right: spacer for balance */}
          <div className="w-[76px] shrink-0" />
        </div>
      </div>
    </div>
  );
};
