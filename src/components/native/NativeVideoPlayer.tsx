import React, { useRef, useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Pause, Volume2, VolumeX, Heart, MessageCircle, Share2, MoreHorizontal } from 'lucide-react';
import { useNativeFeatures } from '@/hooks/useNativeFeatures';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';

interface NativeVideoPlayerProps {
  src: string;
  poster?: string;
  autoPlay?: boolean;
  loop?: boolean;
  muted?: boolean;
  isActive?: boolean;
  onLike?: () => void;
  onComment?: () => void;
  onShare?: () => void;
  onMore?: () => void;
  onUserPress?: () => void;
  isLiked?: boolean;
  likeCount?: number;
  commentCount?: number;
  shareCount?: number;
  username?: string;
  userAvatar?: string;
  caption?: string;
  className?: string;
}

export const NativeVideoPlayer: React.FC<NativeVideoPlayerProps> = ({
  src,
  poster,
  autoPlay = true,
  loop = true,
  muted: initialMuted = false,
  isActive = true,
  onLike,
  onComment,
  onShare,
  onMore,
  onUserPress,
  isLiked = false,
  likeCount = 0,
  commentCount = 0,
  shareCount = 0,
  username,
  userAvatar,
  caption,
  className = '',
}) => {
  const { haptic } = useNativeFeatures();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(autoPlay);
  const [isMuted, setIsMuted] = useState(initialMuted);
  const [showControls, setShowControls] = useState(false);
  const [progress, setProgress] = useState(0);
  const [showLikeAnimation, setShowLikeAnimation] = useState(false);
  const controlsTimeoutRef = useRef<NodeJS.Timeout>();
  const lastTapRef = useRef<number>(0);
  const doubleTapTimeoutRef = useRef<NodeJS.Timeout>();

  // Handle play/pause based on visibility
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (isActive && autoPlay) {
      video.play().catch(() => {
        // Autoplay was prevented, mute and try again
        video.muted = true;
        setIsMuted(true);
        video.play();
      });
      setIsPlaying(true);
    } else {
      video.pause();
      setIsPlaying(false);
    }
  }, [isActive, autoPlay]);

  // Update progress
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const updateProgress = () => {
      if (video.duration) {
        setProgress((video.currentTime / video.duration) * 100);
      }
    };

    video.addEventListener('timeupdate', updateProgress);
    return () => video.removeEventListener('timeupdate', updateProgress);
  }, []);

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    if (isPlaying) {
      video.pause();
    } else {
      video.play();
    }
    setIsPlaying(!isPlaying);
    haptic('light');
  }, [haptic, isPlaying]);

  const toggleMute = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    video.muted = !isMuted;
    setIsMuted(!isMuted);
    haptic('light');
  }, [haptic, isMuted]);

  const handleTap = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    const now = Date.now();
    const DOUBLE_TAP_DELAY = 300;

    if (now - lastTapRef.current < DOUBLE_TAP_DELAY) {
      // Double tap - like
      clearTimeout(doubleTapTimeoutRef.current);
      if (onLike && !isLiked) {
        haptic('success');
        setShowLikeAnimation(true);
        setTimeout(() => setShowLikeAnimation(false), 1000);
        onLike();
      }
    } else {
      // Single tap - show/hide controls
      doubleTapTimeoutRef.current = setTimeout(() => {
        setShowControls(!showControls);
        if (!showControls) {
          controlsTimeoutRef.current = setTimeout(() => {
            setShowControls(false);
          }, 3000);
        }
      }, DOUBLE_TAP_DELAY);
    }

    lastTapRef.current = now;
  }, [haptic, isLiked, onLike, showControls]);

  const handleLikePress = useCallback(() => {
    haptic(isLiked ? 'light' : 'success');
    if (!isLiked) {
      setShowLikeAnimation(true);
      setTimeout(() => setShowLikeAnimation(false), 1000);
    }
    onLike?.();
  }, [haptic, isLiked, onLike]);

  const formatCount = (count: number): string => {
    if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
    if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
    return count.toString();
  };

  return (
    <div
      className={`relative w-full h-full bg-black overflow-hidden ${className}`}
      onClick={handleTap}
    >
      {/* Video */}
      <video
        ref={videoRef}
        src={src}
        poster={poster}
        loop={loop}
        muted={isMuted}
        playsInline
        preload="metadata"
        className="absolute inset-0 w-full h-full object-cover"
      />

      {/* Double tap like animation */}
      <AnimatePresence>
        {showLikeAnimation && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 1.5, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 15 }}
            className="absolute inset-0 flex items-center justify-center pointer-events-none z-20"
          >
            <Heart className="w-24 h-24 text-red-500 fill-red-500 drop-shadow-lg" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Controls overlay */}
      <AnimatePresence>
        {showControls && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/30 flex items-center justify-center z-10"
          >
            <button
              onClick={(e) => {
                e.stopPropagation();
                togglePlay();
              }}
              className="w-16 h-16 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center"
            >
              {isPlaying ? (
                <Pause className="w-8 h-8 text-white" />
              ) : (
                <Play className="w-8 h-8 text-white ml-1" />
              )}
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Progress bar */}
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/20 z-20">
        <motion.div
          className="h-full bg-white"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Right side actions */}
      <div className="absolute right-3 bottom-24 flex flex-col items-center gap-5 z-20">
        {/* User avatar */}
        {userAvatar && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onUserPress?.();
            }}
            className="relative"
          >
            <Avatar className="w-12 h-12 border-2 border-white shadow-lg">
              <AvatarImage src={userAvatar} />
              <AvatarFallback>{username?.[0]?.toUpperCase()}</AvatarFallback>
            </Avatar>
            <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
              <span className="text-white text-xs">+</span>
            </div>
          </button>
        )}

        {/* Like button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleLikePress();
          }}
          className="flex flex-col items-center"
        >
          <motion.div
            whileTap={{ scale: 0.8 }}
            transition={{ type: 'spring', stiffness: 400, damping: 17 }}
          >
            <Heart
              className={`w-8 h-8 ${isLiked ? 'text-red-500 fill-red-500' : 'text-white'}`}
            />
          </motion.div>
          <span className="text-white text-xs mt-1">{formatCount(likeCount)}</span>
        </button>

        {/* Comment button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            haptic('light');
            onComment?.();
          }}
          className="flex flex-col items-center"
        >
          <MessageCircle className="w-8 h-8 text-white" />
          <span className="text-white text-xs mt-1">{formatCount(commentCount)}</span>
        </button>

        {/* Share button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            haptic('light');
            onShare?.();
          }}
          className="flex flex-col items-center"
        >
          <Share2 className="w-8 h-8 text-white" />
          <span className="text-white text-xs mt-1">{formatCount(shareCount)}</span>
        </button>

        {/* More button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            haptic('light');
            onMore?.();
          }}
        >
          <MoreHorizontal className="w-8 h-8 text-white" />
        </button>

        {/* Sound toggle */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            toggleMute();
          }}
          className="w-10 h-10 rounded-full bg-black/30 backdrop-blur-sm flex items-center justify-center"
        >
          {isMuted ? (
            <VolumeX className="w-5 h-5 text-white" />
          ) : (
            <Volume2 className="w-5 h-5 text-white" />
          )}
        </button>
      </div>

      {/* Bottom info - username and caption */}
      <div className="absolute left-3 right-20 bottom-20 z-20">
        {username && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onUserPress?.();
            }}
            className="font-semibold text-white text-base mb-2"
          >
            @{username}
          </button>
        )}
        {caption && (
          <p className="text-white text-sm line-clamp-2">{caption}</p>
        )}
      </div>
    </div>
  );
};

export default NativeVideoPlayer;
