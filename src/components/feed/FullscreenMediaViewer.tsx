import { useState, useEffect, useRef, useCallback } from 'react';
import { X, Volume2, VolumeX, Play, Pause, SkipForward, SkipBack } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useNavigate } from 'react-router-dom';
import { Slider } from '@/components/ui/slider';

interface Post {
  id: string;
  user_id: string;
  content: string | null;
  media_url: string | null;
  media_type: string | null;
  created_at: string;
  profiles?: {
    username: string | null;
    display_name: string | null;
    avatar_url: string | null;
  };
}

interface FullscreenMediaViewerProps {
  post: Post;
  allPosts: Post[];
  isOpen: boolean;
  onClose: () => void;
  onNavigate?: (postId: string) => void;
  initialTime?: number;
  initialMuted?: boolean;
}

export default function FullscreenMediaViewer({ 
  post, 
  allPosts, 
  isOpen, 
  onClose,
  onNavigate,
  initialTime = 0,
  initialMuted = true
}: FullscreenMediaViewerProps) {
  const navigate = useNavigate();
  const [currentPostIndex, setCurrentPostIndex] = useState(0);
  const [isMuted, setIsMuted] = useState(initialMuted);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isSeeking, setIsSeeking] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const touchStartY = useRef(0);

  // Filter to only video posts for swipe navigation in video fullscreen
  const navigablePosts = post.media_type === 'video' 
    ? allPosts.filter(p => p.media_type === 'video')
    : allPosts;

  const currentPost = navigablePosts[currentPostIndex];
  const isVideo = currentPost?.media_type === 'video';

  useEffect(() => {
    const index = navigablePosts.findIndex(p => p.id === post.id);
    if (index !== -1) {
      setCurrentPostIndex(index);
    }
  }, [post.id, navigablePosts]);

  // Sync mute state when it changes from parent
  useEffect(() => {
    setIsMuted(initialMuted);
  }, [initialMuted]);

  useEffect(() => {
    if (isOpen && isVideo && videoRef.current) {
      videoRef.current.currentTime = initialTime;
      videoRef.current.muted = initialMuted;
      setIsMuted(initialMuted);
      setCurrentTime(initialTime);
      videoRef.current.play().catch(() => {});
      setIsPlaying(true);
    }
  }, [isOpen, currentPostIndex, isVideo, initialTime, initialMuted]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const updateTime = () => {
      if (!isSeeking) {
        setCurrentTime(video.currentTime);
      }
    };
    const updateDuration = () => setDuration(video.duration);
    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);

    video.addEventListener('timeupdate', updateTime);
    video.addEventListener('loadedmetadata', updateDuration);
    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);

    return () => {
      video.removeEventListener('timeupdate', updateTime);
      video.removeEventListener('loadedmetadata', updateDuration);
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
    };
  }, [currentPostIndex, isSeeking]);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const touchEndY = e.changedTouches[0].clientY;
    const diff = touchStartY.current - touchEndY;

    if (!isVideo) return;

    if (diff > 50 && currentPostIndex < navigablePosts.length - 1) {
      navigateToPost(currentPostIndex + 1);
    } else if (diff < -50 && currentPostIndex > 0) {
      navigateToPost(currentPostIndex - 1);
    }
  };

  const navigateToPost = (index: number) => {
    const newPost = navigablePosts[index];
    if (!newPost) return;

    setCurrentPostIndex(index);
    setCurrentTime(0);
    setIsPlaying(false);
    onNavigate?.(newPost.id);
  };

  const togglePlayPause = useCallback((e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!videoRef.current) return;
    
    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
    } else {
      videoRef.current.play().catch(() => {});
      setIsPlaying(true);
    }
  }, [isPlaying]);

  const toggleMute = useCallback((e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (videoRef.current) {
      const newMuted = !isMuted;
      videoRef.current.muted = newMuted;
      setIsMuted(newMuted);
    }
  }, [isMuted]);

  const seekForward = useCallback((e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (videoRef.current) {
      const newTime = Math.min(videoRef.current.currentTime + 10, duration);
      videoRef.current.currentTime = newTime;
      setCurrentTime(newTime);
    }
  }, [duration]);

  const seekBackward = useCallback((e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (videoRef.current) {
      const newTime = Math.max(videoRef.current.currentTime - 10, 0);
      videoRef.current.currentTime = newTime;
      setCurrentTime(newTime);
    }
  }, []);

  const handleSeekChange = useCallback((value: number[]) => {
    const newTime = value[0];
    setCurrentTime(newTime);
    setIsSeeking(true);
    if (videoRef.current) {
      videoRef.current.currentTime = newTime;
    }
  }, []);

  const handleSeekEnd = useCallback((value: number[]) => {
    setIsSeeking(false);
    const newTime = value[0];
    if (videoRef.current) {
      videoRef.current.currentTime = newTime;
      setCurrentTime(newTime);
    }
  }, []);

  const formatTime = (time: number) => {
    if (!isFinite(time) || isNaN(time)) return '0:00';
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const handleProfileClick = () => {
    onClose();
    navigate(`/profile/${currentPost.user_id}`);
  };

  if (!isOpen || !currentPost) return null;

  const displayName = currentPost.profiles?.display_name || currentPost.profiles?.username || 'Anonymous';
  const username = currentPost.profiles?.username || 'anonymous';

  return (
    <div 
      ref={containerRef}
      className="fixed inset-0 z-[100] bg-black"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className="relative w-full h-full flex items-center justify-center">
        {isVideo ? (
          <video
            ref={videoRef}
            src={currentPost.media_url || ''}
            className="w-full h-full object-contain"
            playsInline
            muted={isMuted}
            onClick={() => togglePlayPause()}
            onContextMenu={(e) => e.preventDefault()}
            controlsList="nodownload nofullscreen noremoteplayback"
            disablePictureInPicture
          />
        ) : (
          <img
            src={currentPost.media_url || ''}
            alt="Post content"
            className="w-full h-full object-contain"
            onContextMenu={(e) => e.preventDefault()}
          />
        )}

        {/* Top Overlay */}
        <div className="absolute top-0 left-0 right-0 bg-gradient-to-b from-black/70 to-transparent p-4 z-10">
          <div className="flex items-center justify-between">
            <div 
              className="flex items-center gap-3 cursor-pointer"
              onClick={handleProfileClick}
            >
              <Avatar className="w-10 h-10">
                <AvatarImage src={currentPost.profiles?.avatar_url || ''} />
                <AvatarFallback>{displayName[0]?.toUpperCase()}</AvatarFallback>
              </Avatar>
              <div>
                <p className="font-semibold text-white text-sm">{displayName}</p>
                <p className="text-xs text-white/60">@{username}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 bg-black/50 rounded-full text-white hover:bg-black/70 transition-all"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Video Controls */}
        {isVideo && (
          <div 
            className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent p-4 z-20"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Time Display */}
            <div className="flex justify-between text-white text-xs mb-2 font-medium">
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(duration)}</span>
            </div>

            {/* Seek Slider */}
            <div className="mb-4">
              <Slider
                value={[currentTime]}
                min={0}
                max={duration || 100}
                step={0.1}
                onValueChange={handleSeekChange}
                onValueCommit={handleSeekEnd}
                className="w-full cursor-pointer [&_[role=slider]]:h-4 [&_[role=slider]]:w-4 [&_[role=slider]]:bg-white [&_[role=slider]]:border-0 [&_[role=slider]]:shadow-lg [&>span:first-child]:h-1.5 [&>span:first-child]:bg-white/30 [&>span:first-child>span]:bg-primary"
              />
            </div>

            {/* Control Buttons */}
            <div className="flex items-center justify-center gap-6">
              <button
                onClick={(e) => seekBackward(e)}
                className="p-3 hover:bg-white/10 rounded-full transition-all"
                type="button"
              >
                <SkipBack className="w-6 h-6 text-white" fill="white" />
              </button>

              <button
                onClick={(e) => togglePlayPause(e)}
                className="p-4 bg-primary rounded-full hover:bg-primary/90 transition-all"
                type="button"
              >
                {isPlaying ? (
                  <Pause className="w-7 h-7 text-primary-foreground" fill="currentColor" />
                ) : (
                  <Play className="w-7 h-7 text-primary-foreground" fill="currentColor" />
                )}
              </button>

              <button
                onClick={(e) => seekForward(e)}
                className="p-3 hover:bg-white/10 rounded-full transition-all"
                type="button"
              >
                <SkipForward className="w-6 h-6 text-white" fill="white" />
              </button>

              <button
                onClick={(e) => toggleMute(e)}
                className="p-3 hover:bg-white/10 rounded-full transition-all"
                type="button"
              >
                {isMuted ? (
                  <VolumeX className="w-6 h-6 text-white" />
                ) : (
                  <Volume2 className="w-6 h-6 text-white" />
                )}
              </button>
            </div>
          </div>
        )}

        {/* Navigation Hints */}
        {isVideo && navigablePosts.length > 1 && (
          <>
            {currentPostIndex < navigablePosts.length - 1 && (
              <div className="absolute bottom-36 right-4 text-white/50 text-xs">
                Swipe up for next
              </div>
            )}
            {currentPostIndex > 0 && (
              <div className="absolute top-20 right-4 text-white/50 text-xs">
                Swipe down for previous
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}