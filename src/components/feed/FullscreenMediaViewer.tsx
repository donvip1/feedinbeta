import { useState, useEffect, useRef, useCallback } from 'react';
import { X, Volume2, VolumeX, Play, Pause, SkipForward, SkipBack, Heart, MessageCircle, Repeat2, Gift, Share2 } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useNavigate } from 'react-router-dom';
import { Slider } from '@/components/ui/slider';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Post {
  id: string;
  user_id: string;
  content: string | null;
  media_url: string | null;
  media_type: string | null;
  created_at: string;
  likes_count?: number;
  comments_count?: number;
  refeeds_count?: number;
  shares_count?: number;
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
  onOpenComments?: (postId: string) => void;
  onOpenRefeed?: (postId: string) => void;
  onOpenGift?: (postId: string) => void;
  onOpenShare?: (postId: string) => void;
  // For syncing counts from parent
  parentCommentsCount?: number;
  parentRefeedsCount?: number;
  parentLikesCount?: number;
  actualPostId?: string; // The actual post ID for interactions (may differ from post.id for refeeds)
}

export default function FullscreenMediaViewer({ 
  post, 
  allPosts, 
  isOpen, 
  onClose,
  onNavigate,
  initialTime = 0,
  initialMuted = true,
  onOpenComments,
  onOpenRefeed,
  onOpenGift,
  onOpenShare,
  parentCommentsCount,
  parentRefeedsCount,
  parentLikesCount,
  actualPostId
}: FullscreenMediaViewerProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [currentPostIndex, setCurrentPostIndex] = useState(0);
  const [isMuted, setIsMuted] = useState(initialMuted);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isSeeking, setIsSeeking] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [isLiked, setIsLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(0);
  const [commentsCount, setCommentsCount] = useState(0);
  const [refeedsCount, setRefeedsCount] = useState(0);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const touchStartY = useRef(0);

  // Filter posts by media type - videos with videos, images with images
  const isVideoPost = post.media_type === 'video';
  const navigablePosts = isVideoPost 
    ? allPosts.filter(p => p.media_type === 'video')
    : allPosts.filter(p => p.media_type === 'image');

  const currentPost = navigablePosts[currentPostIndex];
  const isVideo = currentPost?.media_type === 'video';

  // Get current user
  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUserId(user?.id || null);
    };
    getUser();
  }, []);

  // Check if current post is liked and get likes count
  useEffect(() => {
    if (!currentPost || !currentUserId) return;
    
    const checkLikeStatus = async () => {
      const { data: likeData } = await supabase
        .from('post_likes')
        .select('id')
        .eq('post_id', actualPostId || currentPost.id)
        .eq('user_id', currentUserId)
        .maybeSingle();
      
      setIsLiked(!!likeData);
    };
    
    // Use parent counts if provided (for syncing), otherwise use post counts
    setLikesCount(parentLikesCount ?? currentPost.likes_count ?? 0);
    setCommentsCount(parentCommentsCount ?? currentPost.comments_count ?? 0);
    setRefeedsCount(parentRefeedsCount ?? currentPost.refeeds_count ?? 0);
    checkLikeStatus();
  }, [currentPost?.id, currentUserId, actualPostId, parentLikesCount, parentCommentsCount, parentRefeedsCount]);

  // Sync counts when parent props change (for real-time updates)
  useEffect(() => {
    if (parentCommentsCount !== undefined) {
      setCommentsCount(parentCommentsCount);
    }
  }, [parentCommentsCount]);

  useEffect(() => {
    if (parentRefeedsCount !== undefined) {
      setRefeedsCount(parentRefeedsCount);
    }
  }, [parentRefeedsCount]);

  useEffect(() => {
    if (parentLikesCount !== undefined) {
      setLikesCount(parentLikesCount);
    }
  }, [parentLikesCount]);

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
      setShowControls(false); // Hide controls when video starts playing
    }
  }, [isOpen, currentPostIndex, isVideo, initialTime, initialMuted]);

  // For images, show controls by default
  useEffect(() => {
    if (isOpen && !isVideo) {
      setShowControls(true);
    }
  }, [isOpen, isVideo, currentPostIndex]);

  // Keyboard navigation (Arrow Up/Down)
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
        e.preventDefault();
        if (currentPostIndex < navigablePosts.length - 1) {
          navigateToPost(currentPostIndex + 1);
        }
      } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
        e.preventDefault();
        if (currentPostIndex > 0) {
          navigateToPost(currentPostIndex - 1);
        }
      } else if (e.key === 'Escape') {
        onClose();
      } else if (e.key === ' ') {
        e.preventDefault();
        if (isVideo) {
          togglePlayPause();
        } else {
          setShowControls(prev => !prev);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, currentPostIndex, navigablePosts.length, isVideo]);

  // Mouse wheel navigation
  useEffect(() => {
    if (!isOpen) return;

    let wheelTimeout: NodeJS.Timeout | null = null;
    let wheelDelta = 0;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      wheelDelta += e.deltaY;

      if (wheelTimeout) clearTimeout(wheelTimeout);

      wheelTimeout = setTimeout(() => {
        if (wheelDelta > 50 && currentPostIndex < navigablePosts.length - 1) {
          navigateToPost(currentPostIndex + 1);
        } else if (wheelDelta < -50 && currentPostIndex > 0) {
          navigateToPost(currentPostIndex - 1);
        }
        wheelDelta = 0;
      }, 100);
    };

    const container = containerRef.current;
    if (container) {
      container.addEventListener('wheel', handleWheel, { passive: false });
    }

    return () => {
      if (container) {
        container.removeEventListener('wheel', handleWheel);
      }
      if (wheelTimeout) clearTimeout(wheelTimeout);
    };
  }, [isOpen, currentPostIndex, navigablePosts.length]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const updateTime = () => {
      if (!isSeeking) {
        setCurrentTime(video.currentTime);
      }
    };
    const updateDuration = () => setDuration(video.duration);
    const handlePlay = () => {
      setIsPlaying(true);
      setShowControls(false);
    };
    const handlePause = () => {
      setIsPlaying(false);
      setShowControls(true);
    };

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

    // Swipe navigation for both video and image posts
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
    setShowControls(true);
    setLikesCount(newPost.likes_count || 0);
    onNavigate?.(newPost.id);
  };

  const togglePlayPause = useCallback((e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!videoRef.current) return;
    
    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
      setShowControls(true);
    } else {
      videoRef.current.play().catch(() => {});
      setIsPlaying(true);
      setShowControls(false);
    }
  }, [isPlaying]);

  const handleImageTap = useCallback(() => {
    setShowControls(prev => !prev);
  }, []);

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

  // Social actions
  const handleLike = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!currentUserId || !currentPost) {
      toast({ title: "Please sign in to like posts", variant: "destructive" });
      return;
    }

    const postIdForLike = actualPostId || currentPost.id;
    try {
      if (isLiked) {
        await supabase
          .from('post_likes')
          .delete()
          .eq('post_id', postIdForLike)
          .eq('user_id', currentUserId);
        setIsLiked(false);
        setLikesCount(prev => Math.max(0, prev - 1));
      } else {
        await supabase
          .from('post_likes')
          .insert({ post_id: postIdForLike, user_id: currentUserId });
        setIsLiked(true);
        setLikesCount(prev => prev + 1);
      }
    } catch (error) {
      console.error('Error toggling like:', error);
    }
  };

  const handleComments = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onOpenComments) {
      // Use actualPostId for interactions (important for refeed/quote posts)
      onOpenComments(actualPostId || currentPost?.id || '');
    }
  };

  const handleRefeed = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onOpenRefeed) {
      onOpenRefeed(actualPostId || currentPost?.id || '');
    }
  };

  const handleGift = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onOpenGift && currentPost) {
      onOpenGift(actualPostId || currentPost.id);
    }
  };

  const handleShare = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onOpenShare && currentPost) {
      onOpenShare(actualPostId || currentPost.id);
    }
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
            className="w-full h-full object-cover"
            playsInline
            muted={isMuted}
            loop
            onClick={() => togglePlayPause()}
            onContextMenu={(e) => e.preventDefault()}
            controlsList="nodownload nofullscreen noremoteplayback"
            disablePictureInPicture
          />
        ) : (
          <img
            src={currentPost.media_url || ''}
            alt="Post content"
            className="w-full h-full object-cover"
            onClick={handleImageTap}
            onContextMenu={(e) => e.preventDefault()}
          />
        )}

        {/* Top Overlay - Always visible */}
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

        {/* Social Action Buttons - Show when paused (video) or tapped (image) */}
        {showControls && (
          <div 
            className="absolute right-4 bottom-32 flex flex-col items-center gap-5 z-30"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Like */}
            <button
              onClick={handleLike}
              className="flex flex-col items-center gap-1"
            >
              <div className={`p-3 rounded-full ${isLiked ? 'bg-red-500' : 'bg-black/50'} hover:bg-black/70 transition-all`}>
                <Heart className={`w-6 h-6 ${isLiked ? 'text-white fill-white' : 'text-white'}`} />
              </div>
              <span className="text-white text-xs font-medium">{likesCount}</span>
            </button>

            {/* Comments */}
            <button
              onClick={handleComments}
              className="flex flex-col items-center gap-1"
            >
              <div className="p-3 bg-black/50 rounded-full hover:bg-black/70 transition-all">
                <MessageCircle className="w-6 h-6 text-white" />
              </div>
              <span className="text-white text-xs font-medium">{commentsCount}</span>
            </button>

            {/* Refeed/Quote */}
            <button
              onClick={handleRefeed}
              className="flex flex-col items-center gap-1"
            >
              <div className="p-3 bg-black/50 rounded-full hover:bg-black/70 transition-all">
                <Repeat2 className="w-6 h-6 text-white" />
              </div>
              <span className="text-white text-xs font-medium">{refeedsCount}</span>
            </button>

            {/* Gift */}
            <button
              onClick={handleGift}
              className="flex flex-col items-center gap-1"
            >
              <div className="p-3 bg-black/50 rounded-full hover:bg-black/70 transition-all">
                <Gift className="w-6 h-6 text-white" />
              </div>
            </button>

            {/* Share */}
            <button
              onClick={handleShare}
              className="flex flex-col items-center gap-1"
            >
              <div className="p-3 bg-black/50 rounded-full hover:bg-black/70 transition-all">
                <Share2 className="w-6 h-6 text-white" />
              </div>
              <span className="text-white text-xs font-medium">{currentPost.shares_count || 0}</span>
            </button>
          </div>
        )}

        {/* Play/Pause indicator for video when paused */}
        {isVideo && !isPlaying && showControls && (
          <div 
            className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none"
          >
            <div className="p-5 bg-black/40 rounded-full">
              <Play className="w-12 h-12 text-white" fill="white" />
            </div>
          </div>
        )}

        {/* Video Controls - Show when paused */}
        {isVideo && showControls && (
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
        {navigablePosts.length > 1 && (
          <>
            {currentPostIndex < navigablePosts.length - 1 && (
              <div className="absolute bottom-36 left-4 text-white/50 text-xs">
                Swipe up for next {isVideo ? 'video' : 'image'}
              </div>
            )}
            {currentPostIndex > 0 && (
              <div className="absolute top-20 left-4 text-white/50 text-xs">
                Swipe down for previous {isVideo ? 'video' : 'image'}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
