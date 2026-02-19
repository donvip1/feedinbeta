import { useState, useEffect, useRef, useCallback } from 'react';
import { X, Volume2, VolumeX, Play, Pause, SkipForward, SkipBack, Heart, MessageCircle, Repeat2, Gift, Share2 } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useNavigate } from 'react-router-dom';
import { Slider } from '@/components/ui/slider';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useVideoPreloader } from '@/hooks/useVideoPreloader';
import { videoPreloadManager } from '@/lib/video-preload-manager';
import { useNativeFeatures } from '@/hooks/useNativeFeatures';
import InlineCommentsPanel from './InlineCommentsPanel';
import ShareModal from './ShareModal';
import GiftModal from './GiftModal';
import RefeedModal from './RefeedModal';
import { tailwindGradientToCSS } from '@/lib/tailwind-gradient-utils';
import { VerifiedBadge } from '@/components/profile/VerifiedBadge';

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
  post_type?: string | null;
  original_post?: {
    id: string;
    media_url: string | null;
    media_type: string | null;
  } | null;
  profiles?: {
    username: string | null;
    display_name: string | null;
    avatar_url: string | null;
  };
}

interface FullscreenMediaViewerProps {
  post: Post;
  allPosts: Post[];
  allVideoPosts?: Post[];
  isOpen: boolean;
  onClose: () => void;
  onNavigate?: (postId: string) => void;
  onMarkAsViewed?: (postId: string) => void;
  initialTime?: number;
  initialMuted?: boolean;
  onOpenComments?: (postId: string) => void;
  onOpenRefeed?: (postId: string) => void;
  onOpenGift?: (postId: string) => void;
  onOpenShare?: (postId: string) => void;
  parentCommentsCount?: number;
  parentRefeedsCount?: number;
  parentLikesCount?: number;
  actualPostId?: string;
}

export default function FullscreenMediaViewer({ 
  post, 
  allPosts, 
  allVideoPosts,
  isOpen, 
  onClose,
  onNavigate,
  onMarkAsViewed,
  initialTime = 0,
  initialMuted = true,
  parentCommentsCount,
  parentRefeedsCount,
  parentLikesCount,
  actualPostId
}: FullscreenMediaViewerProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { haptic } = useNativeFeatures();
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
  const [giftsCount, setGiftsCount] = useState(0);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [landscapeVideos, setLandscapeVideos] = useState<Set<string>>(new Set());
  const [hasRefeeded, setHasRefeeded] = useState(false);
  const [hasGifted, setHasGifted] = useState(false);
  
  // Modal states - render inside fullscreen to stay open
  const [showComments, setShowComments] = useState(false);
  const [showRefeed, setShowRefeed] = useState(false);
  const [showGift, setShowGift] = useState(false);
  const [showShare, setShowShare] = useState(false);
  
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const videoRefs = useRef<Map<string, HTMLVideoElement>>(new Map());
  const isScrolling = useRef(false);
  const scrollTimeout = useRef<NodeJS.Timeout | null>(null);
  
  // Touch gesture tracking for fast swipes
  const touchStartY = useRef(0);
  const touchStartTime = useRef(0);
  const SWIPE_THRESHOLD = 40;
  const VELOCITY_THRESHOLD = 0.3;

  // Filter posts by media type
  const isVideoPost = post.media_type === 'video' || 
    ((post as any).post_type === 'refeed' && (post as any).original_post?.media_type === 'video') ||
    ((post as any).post_type === 'quote' && (post as any).original_post?.media_type === 'video');
  
  const navigablePosts = (() => {
    if (isVideoPost) {
      if (allVideoPosts && allVideoPosts.length > 0) {
        return allVideoPosts;
      }
      return allPosts.filter(p => 
        p.media_type === 'video' || 
        (p.post_type === 'refeed' && p.original_post?.media_type === 'video') ||
        (p.post_type === 'quote' && p.original_post?.media_type === 'video')
      );
    }
    return allPosts.filter(p => p.media_type === 'image' && p.media_url);
  })();

  // Use video preloader hook
  useVideoPreloader(navigablePosts, currentPostIndex, isOpen && isVideoPost);

  const currentPost = navigablePosts[currentPostIndex] || post;
  const isVideo = currentPost?.media_type === 'video' || 
    (currentPost?.post_type === 'refeed' && currentPost?.original_post?.media_type === 'video') ||
    (currentPost?.post_type === 'quote' && currentPost?.original_post?.media_type === 'video');
  
  const getMediaUrl = (p: Post) => {
    if (p.media_url) return p.media_url;
    if ((p as any).original_post?.media_url) return (p as any).original_post.media_url;
    return null;
  };

  // Pause ALL videos except the current one
  const pauseAllExceptCurrent = useCallback((currentIdx: number) => {
    videoRefs.current.forEach((video, postId) => {
      const postIndex = navigablePosts.findIndex(p => p.id === postId);
      if (postIndex !== currentIdx) {
        video.pause();
        video.currentTime = 0;
      }
    });
  }, [navigablePosts]);

  // Get visible posts for rendering - ONLY current ± 1 for performance
  const getVisiblePosts = useCallback(() => {
    const visible: { post: Post; index: number }[] = [];
    const start = Math.max(0, currentPostIndex - 1);
    const end = Math.min(navigablePosts.length - 1, currentPostIndex + 1);
    
    for (let i = start; i <= end; i++) {
      if (navigablePosts[i]) {
        visible.push({ post: navigablePosts[i], index: i });
      }
    }
    return visible;
  }, [currentPostIndex, navigablePosts]);

  // Handle scroll snap to detect which post is in view
  const handleScroll = useCallback(() => {
    if (!scrollContainerRef.current || isScrolling.current) return;

    const container = scrollContainerRef.current;
    const scrollTop = container.scrollTop;
    const itemHeight = container.clientHeight;
    const newIndex = Math.round(scrollTop / itemHeight);

    if (newIndex !== currentPostIndex && newIndex >= 0 && newIndex < navigablePosts.length) {
      setIsTransitioning(true);
      setCurrentPostIndex(newIndex);
      onNavigate?.(navigablePosts[newIndex].id);
      
      // Pause ALL videos except the new current
      pauseAllExceptCurrent(newIndex);
      
      // Remove transition state after animation
      setTimeout(() => setIsTransitioning(false), 150);
    }
  }, [currentPostIndex, navigablePosts, onNavigate, pauseAllExceptCurrent]);

  // Scroll to specific index with smooth transition
  const scrollToIndex = useCallback((index: number) => {
    if (!scrollContainerRef.current) return;
    
    setIsTransitioning(true);
    isScrolling.current = true;
    const container = scrollContainerRef.current;
    const targetTop = index * container.clientHeight;
    
    // Pause all videos first
    pauseAllExceptCurrent(index);
    
    // Use smooth scroll for better visual transition
    container.scrollTo({
      top: targetTop,
      behavior: 'smooth'
    });
    
    setCurrentPostIndex(index);

    if (scrollTimeout.current) clearTimeout(scrollTimeout.current);
    scrollTimeout.current = setTimeout(() => {
      isScrolling.current = false;
      setIsTransitioning(false);
    }, 200);
  }, [pauseAllExceptCurrent]);

  // Touch gesture handlers for fast swipe detection
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
    touchStartTime.current = Date.now();
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    const deltaY = touchStartY.current - e.changedTouches[0].clientY;
    const deltaTime = Date.now() - touchStartTime.current;
    const velocity = Math.abs(deltaY) / deltaTime;
    
    // Fast flick OR sufficient distance = navigate immediately
    if (velocity > VELOCITY_THRESHOLD || Math.abs(deltaY) > SWIPE_THRESHOLD) {
      if (deltaY > 0 && currentPostIndex < navigablePosts.length - 1) {
        // Swipe up - next post
        haptic('light');
        scrollToIndex(currentPostIndex + 1);
      } else if (deltaY < 0 && currentPostIndex > 0) {
        // Swipe down - previous post
        haptic('light');
        scrollToIndex(currentPostIndex - 1);
      }
    }
  }, [currentPostIndex, navigablePosts.length, scrollToIndex, haptic]);

  // Initialize scroll position
  useEffect(() => {
    if (!isOpen || !scrollContainerRef.current) return;

    const index = navigablePosts.findIndex(p => p.id === post.id);
    if (index !== -1) {
      setCurrentPostIndex(index);
      // Scroll to correct position without animation on initial load
      const container = scrollContainerRef.current;
      container.scrollTop = index * container.clientHeight;
    }
  }, [isOpen, post.id, navigablePosts]);

  // Mark post as viewed
  useEffect(() => {
    if (isOpen && currentPost && onMarkAsViewed) {
      onMarkAsViewed(currentPost.id);
    }
  }, [isOpen, currentPost?.id, onMarkAsViewed]);

  // Get current user
  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUserId(user?.id || null);
    };
    getUser();
  }, []);

  // Check like status, refeed status, gift status, and counts
  useEffect(() => {
    if (!currentPost || !currentUserId) return;
    
    const checkStatus = async () => {
      const [likeCheck, refeedCheck, giftCheck] = await Promise.all([
        supabase
          .from('post_likes')
          .select('id')
          .eq('post_id', actualPostId || currentPost.id)
          .eq('user_id', currentUserId)
          .maybeSingle(),
        supabase
          .from('post_shares')
          .select('id')
          .eq('post_id', actualPostId || currentPost.id)
          .eq('user_id', currentUserId)
          .in('share_type', ['refeed', 'quote'])
          .maybeSingle(),
        supabase
          .from('gift_analytics')
          .select('id')
          .eq('source_id', actualPostId || currentPost.id)
          .eq('sender_id', currentUserId)
          .eq('source_type', 'post')
          .maybeSingle()
      ]);
      
      setIsLiked(!!likeCheck.data);
      setHasRefeeded(!!refeedCheck.data);
      setHasGifted(!!giftCheck.data);
    };
    
    setLikesCount(parentLikesCount ?? currentPost.likes_count ?? 0);
    setCommentsCount(parentCommentsCount ?? currentPost.comments_count ?? 0);
    setRefeedsCount(parentRefeedsCount ?? currentPost.refeeds_count ?? 0);
    setGiftsCount((currentPost as any).gifts_count ?? 0);
    checkStatus();
  }, [currentPost?.id, currentUserId, actualPostId, parentLikesCount, parentCommentsCount, parentRefeedsCount]);

  // Sync counts
  useEffect(() => {
    if (parentCommentsCount !== undefined) setCommentsCount(parentCommentsCount);
  }, [parentCommentsCount]);

  useEffect(() => {
    if (parentRefeedsCount !== undefined) setRefeedsCount(parentRefeedsCount);
  }, [parentRefeedsCount]);

  useEffect(() => {
    if (parentLikesCount !== undefined) setLikesCount(parentLikesCount);
  }, [parentLikesCount]);

  useEffect(() => {
    setIsMuted(initialMuted);
  }, [initialMuted]);

  // Auto-play current video and pause others
  useEffect(() => {
    if (!isOpen || !isVideo) return;

    // First pause all other videos
    pauseAllExceptCurrent(currentPostIndex);

    const video = videoRefs.current.get(currentPost?.id);
    if (video) {
      video.currentTime = currentPostIndex === navigablePosts.findIndex(p => p.id === post.id) ? initialTime : 0;
      video.muted = isMuted;
      video.play().catch(() => {});
      setIsPlaying(true);
      setShowControls(false);
    }
  }, [isOpen, currentPostIndex, currentPost?.id, isVideo, pauseAllExceptCurrent]);

  // Show controls for images
  useEffect(() => {
    if (isOpen && !isVideo) {
      setShowControls(true);
    }
  }, [isOpen, isVideo, currentPostIndex]);

  // Keyboard navigation with haptic feedback
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
        e.preventDefault();
        if (currentPostIndex < navigablePosts.length - 1) {
          haptic('light');
          scrollToIndex(currentPostIndex + 1);
        }
      } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
        e.preventDefault();
        if (currentPostIndex > 0) {
          haptic('light');
          scrollToIndex(currentPostIndex - 1);
        }
      } else if (e.key === 'Escape') {
        onClose();
      } else if (e.key === ' ') {
        e.preventDefault();
        if (isVideo) {
          togglePlayPause();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, currentPostIndex, navigablePosts.length, isVideo, scrollToIndex, onClose, haptic]);

  // Video time update
  useEffect(() => {
    const video = videoRefs.current.get(currentPost?.id);
    if (!video) return;

    const updateTime = () => {
      if (!isSeeking) setCurrentTime(video.currentTime);
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
  }, [currentPost?.id, isSeeking]);

  const togglePlayPause = useCallback((e?: React.MouseEvent) => {
    e?.stopPropagation();
    const video = videoRefs.current.get(currentPost?.id);
    if (!video) return;
    
    if (isPlaying) {
      video.pause();
    } else {
      video.play().catch(() => {});
    }
  }, [isPlaying, currentPost?.id]);

  const handleImageTap = useCallback((e: React.MouseEvent) => {
    // Get tap position relative to screen
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const tapX = e.clientX - rect.left;
    const screenWidth = rect.width;
    
    // Tap on right third → next post
    if (tapX > screenWidth * 0.66) {
      if (currentPostIndex < navigablePosts.length - 1) {
        haptic('light');
        scrollToIndex(currentPostIndex + 1);
      }
    }
    // Tap on left third → previous post
    else if (tapX < screenWidth * 0.33) {
      if (currentPostIndex > 0) {
        haptic('light');
        scrollToIndex(currentPostIndex - 1);
      }
    }
    // Tap in center → toggle controls
    else {
      setShowControls(prev => !prev);
    }
  }, [currentPostIndex, navigablePosts.length, scrollToIndex, haptic]);

  const toggleMute = useCallback((e?: React.MouseEvent) => {
    e?.stopPropagation();
    const video = videoRefs.current.get(currentPost?.id);
    if (video) {
      const newMuted = !isMuted;
      video.muted = newMuted;
      setIsMuted(newMuted);
    }
  }, [isMuted, currentPost?.id]);

  const seekForward = useCallback((e?: React.MouseEvent) => {
    e?.stopPropagation();
    const video = videoRefs.current.get(currentPost?.id);
    if (video) {
      const newTime = Math.min(video.currentTime + 10, duration);
      video.currentTime = newTime;
      setCurrentTime(newTime);
    }
  }, [duration, currentPost?.id]);

  const seekBackward = useCallback((e?: React.MouseEvent) => {
    e?.stopPropagation();
    const video = videoRefs.current.get(currentPost?.id);
    if (video) {
      const newTime = Math.max(video.currentTime - 10, 0);
      video.currentTime = newTime;
      setCurrentTime(newTime);
    }
  }, [currentPost?.id]);

  const handleSeekChange = useCallback((value: number[]) => {
    const newTime = value[0];
    setCurrentTime(newTime);
    setIsSeeking(true);
    const video = videoRefs.current.get(currentPost?.id);
    if (video) video.currentTime = newTime;
  }, [currentPost?.id]);

  const handleSeekEnd = useCallback((value: number[]) => {
    setIsSeeking(false);
    const newTime = value[0];
    const video = videoRefs.current.get(currentPost?.id);
    if (video) {
      video.currentTime = newTime;
      setCurrentTime(newTime);
    }
  }, [currentPost?.id]);

  const formatTime = (time: number) => {
    if (!isFinite(time) || isNaN(time)) return '0:00';
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const handleProfileClick = () => {
    onClose();
    navigate(`/profile/${currentPost.profiles?.username || currentPost.user_id}`);
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

  // Open modals INSIDE fullscreen - don't close fullscreen
  const handleComments = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowComments(true);
  };

  const handleRefeed = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowRefeed(true);
  };

  const handleGift = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowGift(true);
  };

  const handleShare = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowShare(true);
  };

  if (!isOpen || !currentPost) return null;

  const displayName = currentPost.profiles?.display_name || currentPost.profiles?.username || 'Anonymous';
  const username = currentPost.profiles?.username || 'anonymous';
  const visiblePosts = getVisiblePosts();

  return (
    <div className="fixed inset-0 z-[100] bg-black flex flex-col">
      {/* Media Container - shrinks when comments are open */}
      <div 
        className={`relative transition-all duration-300 ease-in-out ${
          showComments ? 'h-[55%]' : 'h-full'
        }`}
      >
        {/* Scroll Container with snap and touch gestures */}
        <div 
          ref={scrollContainerRef}
          className="w-full h-full overflow-y-scroll snap-y snap-mandatory scrollbar-hide"
          onScroll={handleScroll}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          style={{ 
            scrollBehavior: 'auto',
            overscrollBehavior: 'contain',
            WebkitOverflowScrolling: 'touch'
          }}
        >
          {/* Only render current ± 1 posts for performance - with placeholder spacing */}
          {navigablePosts.map((p, index) => {
            // Only render posts within 1 index of current
            const shouldRender = Math.abs(index - currentPostIndex) <= 1;
            
            // Calculate dynamic height based on whether comments are open
            const itemHeight = showComments ? '55dvh' : '100dvh';
            
            if (!shouldRender) {
              // Return empty placeholder to maintain scroll position
              return (
                <div 
                  key={p.id}
                  className="w-full snap-start snap-always"
                  style={{ height: itemHeight, minHeight: itemHeight }}
                />
              );
            }

            const mediaUrl = getMediaUrl(p);
            const isCurrentVideo = p.media_type === 'video' || 
              (p.post_type === 'refeed' && p.original_post?.media_type === 'video') ||
              (p.post_type === 'quote' && p.original_post?.media_type === 'video');
            const isTextStyled = p.media_type === 'text_styled';
            const isImage = p.media_type === 'image' && mediaUrl;
            const isCurrent = index === currentPostIndex;
            const postDisplayName = p.profiles?.display_name || p.profiles?.username || 'Anonymous';
            const postUsername = p.profiles?.username || 'anonymous';
            
            // Check if video is preloaded
            const isPreloaded = mediaUrl ? videoPreloadManager.isReady(mediaUrl) : false;

            // Get background for text_styled posts
            const getPostBackground = () => {
              if (isTextStyled && p.media_url) {
                return tailwindGradientToCSS(p.media_url);
              }
              return 'linear-gradient(135deg, #6b21a8 0%, #db2777 100%)';
            };

            return (
              <div 
                key={p.id}
                className={`w-full h-full snap-start snap-always relative flex items-center justify-center transition-opacity duration-150 ${
                  isCurrent ? 'opacity-100' : 'opacity-70'
                }`}
                style={{ height: itemHeight, minHeight: itemHeight }}
              >
                {/* Media */}
                {isCurrentVideo ? (
                  <video
                    ref={(el) => {
                      if (el) videoRefs.current.set(p.id, el);
                      else videoRefs.current.delete(p.id);
                    }}
                    src={mediaUrl || ''}
                    className={`w-full h-full ${landscapeVideos.has(p.id) ? 'object-contain bg-black' : 'object-cover'}`}
                    playsInline
                    muted={isMuted}
                    loop
                    preload={isPreloaded ? 'auto' : 'metadata'}
                    onClick={() => isCurrent && togglePlayPause()}
                    onLoadedMetadata={(e) => {
                      const video = e.target as HTMLVideoElement;
                      const aspectRatio = video.videoWidth / video.videoHeight;
                      if (aspectRatio > 1.2) {
                        setLandscapeVideos(prev => new Set(prev).add(p.id));
                      }
                    }}
                    onContextMenu={(e) => e.preventDefault()}
                    controlsList="nodownload nofullscreen noremoteplayback"
                    disablePictureInPicture
                  />
                ) : isImage ? (
                  <img
                    src={mediaUrl || ''}
                    alt="Post content"
                    className="w-full h-full object-cover"
                    onClick={handleImageTap}
                    onContextMenu={(e) => e.preventDefault()}
                  />
                ) : (
                  /* Text styled or text-only posts */
                  <div 
                    className="w-full h-full flex items-center justify-center px-8"
                    style={{ background: getPostBackground() }}
                    onClick={handleImageTap}
                  >
                    <p className="text-white text-xl md:text-2xl font-semibold text-center leading-relaxed drop-shadow-lg break-words whitespace-pre-wrap">
                      {p.content || ''}
                    </p>
                  </div>
                )}

                {/* Overlays - only show for current post */}
                {isCurrent && (
                  <>
                    {/* Top Overlay */}
                    <div className="absolute top-0 left-0 right-0 bg-gradient-to-b from-black/70 to-transparent p-4 z-10">
                      <div className="flex items-center justify-between">
                        <div 
                          className="flex items-center gap-3 cursor-pointer"
                          onClick={handleProfileClick}
                        >
                          <Avatar className="w-10 h-10">
                            <AvatarImage src={p.profiles?.avatar_url || ''} />
                            <AvatarFallback>{postDisplayName[0]?.toUpperCase()}</AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-semibold text-white text-sm flex items-center gap-1">{postDisplayName} <VerifiedBadge userId={p.user_id} size="sm" /></p>
                            <p className="text-xs text-white/60">@{postUsername}</p>
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

                    {/* Social Action Buttons - adjust position based on comments state */}
                    {showControls && (
                      <div 
                        className={`absolute right-4 flex flex-col items-center gap-5 z-30 transition-all duration-300 ${
                          showComments ? 'bottom-4' : 'bottom-32'
                        }`}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button onClick={handleLike} className="flex flex-col items-center gap-1">
                          <div className={`p-3 rounded-full ${isLiked ? 'bg-red-500' : 'bg-black/50'} hover:bg-black/70 transition-all`}>
                            <Heart className={`w-6 h-6 ${isLiked ? 'text-white fill-white' : 'text-white'}`} />
                          </div>
                          <span className="text-white text-xs font-medium">{likesCount}</span>
                        </button>

                        <button onClick={handleComments} className="flex flex-col items-center gap-1">
                          <div className={`p-3 rounded-full transition-all ${showComments ? 'bg-primary' : 'bg-black/50 hover:bg-black/70'}`}>
                            <MessageCircle className="w-6 h-6 text-white" />
                          </div>
                          <span className="text-white text-xs font-medium">{commentsCount}</span>
                        </button>

                        <button onClick={handleRefeed} className="flex flex-col items-center gap-1">
                          <div className={`p-3 rounded-full transition-all ${hasRefeeded ? 'bg-green-500' : 'bg-black/50 hover:bg-black/70'}`}>
                            <Repeat2 className="w-6 h-6 text-white" />
                          </div>
                          <span className="text-white text-xs font-medium">{refeedsCount}</span>
                        </button>

                        <button onClick={handleGift} className="flex flex-col items-center gap-1">
                          <div className={`p-3 rounded-full transition-all ${hasGifted ? 'bg-pink-500' : 'bg-black/50 hover:bg-black/70'}`}>
                            <Gift className="w-6 h-6 text-white" />
                          </div>
                          <span className="text-white text-xs font-medium">{giftsCount}</span>
                        </button>

                        <button onClick={handleShare} className="flex flex-col items-center gap-1">
                          <div className="p-3 bg-black/50 rounded-full hover:bg-black/70 transition-all">
                            <Share2 className="w-6 h-6 text-white" />
                          </div>
                          <span className="text-white text-xs font-medium">{p.shares_count || 0}</span>
                        </button>
                      </div>
                    )}

                    {/* Play/Pause indicator */}
                    {isCurrentVideo && !isPlaying && showControls && !showComments && (
                      <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
                        <div className="p-5 bg-black/40 rounded-full">
                          <Play className="w-12 h-12 text-white" fill="white" />
                        </div>
                      </div>
                    )}

                    {/* Video Controls - hide when comments are open for cleaner look */}
                    {isCurrentVideo && showControls && !showComments && (
                      <div 
                        className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent p-4 z-20"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex justify-between text-white text-xs mb-2 font-medium">
                          <span>{formatTime(currentTime)}</span>
                          <span>{formatTime(duration)}</span>
                        </div>

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

                        <div className="flex items-center justify-center gap-6">
                          <button onClick={seekBackward} className="p-3 hover:bg-white/10 rounded-full transition-all" type="button">
                            <SkipBack className="w-6 h-6 text-white" fill="white" />
                          </button>

                          <button onClick={togglePlayPause} className="p-4 bg-primary rounded-full hover:bg-primary/90 transition-all" type="button">
                            {isPlaying ? (
                              <Pause className="w-7 h-7 text-primary-foreground" fill="currentColor" />
                            ) : (
                              <Play className="w-7 h-7 text-primary-foreground" fill="currentColor" />
                            )}
                          </button>

                          <button onClick={seekForward} className="p-3 hover:bg-white/10 rounded-full transition-all" type="button">
                            <SkipForward className="w-6 h-6 text-white" fill="white" />
                          </button>

                          <button onClick={toggleMute} className="p-3 hover:bg-white/10 rounded-full transition-all" type="button">
                            {isMuted ? <VolumeX className="w-6 h-6 text-white" /> : <Volume2 className="w-6 h-6 text-white" />}
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Compact video controls when comments are open */}
                    {isCurrentVideo && showComments && (
                      <div 
                        className="absolute bottom-2 left-2 right-16 flex items-center gap-2 z-20"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button 
                          onClick={togglePlayPause} 
                          className="p-2 bg-black/60 rounded-full"
                          type="button"
                        >
                          {isPlaying ? (
                            <Pause className="w-4 h-4 text-white" fill="white" />
                          ) : (
                            <Play className="w-4 h-4 text-white" fill="white" />
                          )}
                        </button>
                        <div className="flex-1">
                          <Slider
                            value={[currentTime]}
                            min={0}
                            max={duration || 100}
                            step={0.1}
                            onValueChange={handleSeekChange}
                            onValueCommit={handleSeekEnd}
                            className="w-full cursor-pointer [&_[role=slider]]:h-3 [&_[role=slider]]:w-3 [&_[role=slider]]:bg-white [&_[role=slider]]:border-0 [&>span:first-child]:h-1 [&>span:first-child]:bg-white/30 [&>span:first-child>span]:bg-primary"
                          />
                        </div>
                        <span className="text-white text-[10px] font-medium bg-black/60 px-1.5 py-0.5 rounded">
                          {formatTime(currentTime)}
                        </span>
                        <button 
                          onClick={toggleMute} 
                          className="p-2 bg-black/60 rounded-full"
                          type="button"
                        >
                          {isMuted ? <VolumeX className="w-4 h-4 text-white" /> : <Volume2 className="w-4 h-4 text-white" />}
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Inline Comments Panel - YouTube style */}
      <InlineCommentsPanel
        isOpen={showComments}
        onClose={() => setShowComments(false)}
        postId={actualPostId || currentPost?.id || ''}
        onCommentAdded={() => setCommentsCount(prev => prev + 1)}
      />

      {/* Other Modals rendered INSIDE fullscreen to stay open */}
      <RefeedModal
        isOpen={showRefeed}
        onClose={() => setShowRefeed(false)}
        postId={actualPostId || currentPost?.id || ''}
        post={currentPost}
        hasRefeeded={hasRefeeded}
        onRefeedAdded={() => {
          setRefeedsCount(prev => prev + 1);
          setHasRefeeded(true);
          setShowRefeed(false);
        }}
        onUnrefeed={() => {
          setRefeedsCount(prev => Math.max(0, prev - 1));
          setHasRefeeded(false);
          setShowRefeed(false);
        }}
      />

      <GiftModal
        isOpen={showGift}
        onClose={() => setShowGift(false)}
        recipientId={currentPost?.user_id || ''}
        recipientName={displayName}
        postId={actualPostId || currentPost?.id}
      />

      <ShareModal
        isOpen={showShare}
        onClose={() => setShowShare(false)}
        postId={actualPostId || currentPost?.id || ''}
        postData={{
          content: currentPost?.content || undefined,
          media_url: getMediaUrl(currentPost) || undefined,
          media_type: currentPost?.media_type || undefined
        }}
      />
    </div>
  );
}
