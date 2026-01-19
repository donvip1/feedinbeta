import { useState, useEffect, useRef, memo } from 'react';
import { Heart, MessageCircle, Share2, Repeat, Gift, TrendingUp, Volume2, VolumeX, Play, Pause, Trash2, Bookmark, Music, MoreVertical, Sparkles, Maximize } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import CommentsModal from './CommentsModal';
import ShareModal from './ShareModal';
import GiftModal from './GiftModal';
import RefeedModal from './RefeedModal';
import FullscreenMediaViewer from './FullscreenMediaViewer';
import { cn } from '@/lib/utils';
import { tailwindGradientToCSS } from '@/lib/tailwind-gradient-utils';

// Format count for display (e.g., 1.2K, 3.5M)
const formatCount = (count: number): string => {
  if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
  if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
  return count.toString();
};

interface ImmersivePostCardProps {
  post: {
    id: string;
    user_id: string;
    content: string | null;
    media_url: string | null;
    media_type: string | null;
    media_urls: string[] | null;
    media_types: string[] | null;
    created_at: string;
    likes_count: number | null;
    comments_count: number | null;
    views_count: number | null;
    refeeds_count: number | null;
    location: string | null;
    post_type: string | null;
    original_post_id: string | null;
    music_title?: string | null;
    music_artist?: string | null;
    music_url?: string | null;
    is_original_audio?: boolean | null;
    original_post?: {
      id: string;
      user_id: string;
      content: string | null;
      media_url: string | null;
      media_type: string | null;
      media_urls: string[] | null;
      media_types: string[] | null;
      created_at: string;
      profiles?: {
        username: string | null;
        display_name: string | null;
        avatar_url: string | null;
      };
    } | null;
    profiles?: {
      username: string | null;
      display_name: string | null;
      avatar_url: string | null;
    };
  };
  isPromoted?: boolean;
  promoterName?: string;
  boostLevel?: string;
  onLikeUpdate?: () => void;
  onCommentsOpenChange?: (open: boolean) => void;
  onInteractionStart?: () => void;
  onInteractionEnd?: () => void;
  onView?: () => void;
  allPosts?: any[];
  allVideoPosts?: any[];
  onMarkAsViewed?: (postId: string) => void;
}

const ImmersivePostCard = memo(function ImmersivePostCard({ 
  post, 
  isPromoted, 
  promoterName, 
  boostLevel, 
  onLikeUpdate, 
  onCommentsOpenChange, 
  onInteractionStart, 
  onInteractionEnd, 
  onView,
  allPosts,
  allVideoPosts,
  onMarkAsViewed
}: ImmersivePostCardProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [liked, setLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(post.likes_count || 0);
  const [commentsCount, setCommentsCount] = useState(post.comments_count || 0);
  const [refeedsCount, setRefeedsCount] = useState(post.refeeds_count || 0);
  const [giftsCount, setGiftsCount] = useState((post as any).gifts_count || 0);
  const [saved, setSaved] = useState(false);
  const [hasViewed, setHasViewed] = useState(false);
  const [showFullCaption, setShowFullCaption] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [giftOpen, setGiftOpen] = useState(false);
  const [refeedOpen, setRefeedOpen] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showPlayIcon, setShowPlayIcon] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [currentMediaIndex, setCurrentMediaIndex] = useState(0);
  const [isMediaLoaded, setIsMediaLoaded] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [showFullscreenViewer, setShowFullscreenViewer] = useState(false);
  const [isLandscapeVideo, setIsLandscapeVideo] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const postRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef<number>(0);
  const touchEndX = useRef<number>(0);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-show controls after 1 second of inactivity
  const resetControlsTimer = () => {
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    controlsTimeoutRef.current = setTimeout(() => {
      setShowControls(true);
    }, 1000);
  };

  // Hide controls on scroll start
  useEffect(() => {
    const handleScroll = () => {
      setShowControls(false);
      resetControlsTimer();
    };

    const container = postRef.current?.parentElement;
    if (container) {
      container.addEventListener('scroll', handleScroll, { passive: true });
    }

    return () => {
      if (container) {
        container.removeEventListener('scroll', handleScroll);
      }
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
    };
  }, []);

  // Parse hashtags from caption
  const renderCaptionWithHashtags = (text: string) => {
    const hashtagRegex = /(#\w+)/g;
    const parts = text.split(hashtagRegex);
    
    return parts.map((part, index) => {
      if (part.match(hashtagRegex)) {
        const hashtag = part.slice(1); // Remove # for navigation
        return (
          <span
            key={index}
            className="text-primary font-semibold cursor-pointer hover:underline"
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/feed/hashtag/${encodeURIComponent(hashtag)}`);
            }}
          >
            {part}
          </span>
        );
      }
      return part;
    });
  };

  // Determine media to display
  const isRefeed = post.post_type === 'refeed' || post.post_type === 'quote';
  const displayPost = isRefeed && post.original_post ? post.original_post : post;
  
  const mediaUrls = displayPost.media_urls && displayPost.media_urls.length > 0 
    ? displayPost.media_urls 
    : (displayPost.media_url ? [displayPost.media_url] : []);
  const mediaTypes = displayPost.media_types && displayPost.media_types.length > 0 
    ? displayPost.media_types 
    : (displayPost.media_type ? [displayPost.media_type] : []);
  
  const currentMediaUrl = mediaUrls[currentMediaIndex];
  const currentMediaType = mediaTypes[currentMediaIndex];
  const hasMultipleMedia = mediaUrls.length > 1;
  const isTextStyled = post.media_type === 'text_styled';
  const hasVideo = currentMediaType === 'video';
  const hasImage = currentMediaType === 'image';
  const hasMusic = !!post.music_url;

  const displayName = post.profiles?.display_name || post.profiles?.username || 'Anonymous';
  const username = post.profiles?.username || 'user';

  // Handle swipe for multiple media
  const handleSwipe = () => {
    const swipeThreshold = 50;
    const swipeDistance = touchStartX.current - touchEndX.current;

    if (Math.abs(swipeDistance) > swipeThreshold && hasMultipleMedia) {
      if (swipeDistance > 0 && currentMediaIndex < mediaUrls.length - 1) {
        setCurrentMediaIndex(prev => prev + 1);
      } else if (swipeDistance < 0 && currentMediaIndex > 0) {
        setCurrentMediaIndex(prev => prev - 1);
      }
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    touchEndX.current = e.changedTouches[0].clientX;
    handleSwipe();
  };

  // Check if post is liked and saved
  useEffect(() => {
    const checkStatus = async () => {
      if (!user) return;

      try {
        const [likeCheck, saveCheck] = await Promise.all([
          supabase.from('post_likes').select('id').eq('post_id', post.id).eq('user_id', user.id).single(),
          supabase.from('saved_posts').select('id').eq('post_id', post.id).eq('user_id', user.id).single()
        ]);

        setLiked(!!likeCheck.data);
        setSaved(!!saveCheck.data);
      } catch (error) {
        // Expected when not liked/saved
      }
    };

    checkStatus();
  }, [user, post.id]);

  // Track visibility and record view
  useEffect(() => {
    if (!user || hasViewed || user.id === post.user_id) return;
    
    const observer = new IntersectionObserver(
      async (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting && !hasViewed) {
          try {
            await supabase.from('post_views').insert({
              post_id: post.id,
              user_id: user.id,
            });
            setHasViewed(true);
            onView?.();
            observer.disconnect();
          } catch (error) {
            // Likely duplicate view
          }
        }
      },
      { threshold: 0.5 }
    );
    
    if (postRef.current) observer.observe(postRef.current);
    return () => observer.disconnect();
  }, [user, post.id, post.user_id, hasViewed, onView]);

  // Auto-play video when visible
  useEffect(() => {
    if (!hasVideo && !isTextStyled) return;
    if (!videoRef.current && !isTextStyled) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        
        if (entry.isIntersecting) {
          if (videoRef.current) {
            videoRef.current.muted = isMuted;
            videoRef.current.play().catch(() => {
              if (videoRef.current) {
                videoRef.current.muted = true;
                setIsMuted(true);
                videoRef.current.play().catch(() => {});
              }
            });
            setIsPlaying(true);
          }
        } else {
          if (videoRef.current) {
            videoRef.current.pause();
            setIsPlaying(false);
          }
        }
      },
      { threshold: 0.6 }
    );
    
    if (postRef.current) observer.observe(postRef.current);
    return () => observer.disconnect();
  }, [hasVideo, isTextStyled, isMuted]);

  // Real-time subscription for count updates
  useEffect(() => {
    const channel = supabase
      .channel(`immersive-post-${post.id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'posts', filter: `id=eq.${post.id}` },
        (payload) => {
          const newData = payload.new as any;
          if (newData) {
            setLikesCount(newData.likes_count || 0);
            setCommentsCount(newData.comments_count || 0);
            setRefeedsCount(newData.refeeds_count || 0);
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [post.id]);

  const togglePlayPause = () => {
    // Toggle controls visibility on any tap
    setShowControls(prev => !prev);
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
        setIsPlaying(false);
      } else {
        videoRef.current.play();
        setIsPlaying(true);
      }
      setShowPlayIcon(true);
      setTimeout(() => setShowPlayIcon(false), 500);
    }
  };

  const toggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const handleProfileClick = () => navigate(`/profile/${username}`);

  const handleDeletePost = async () => {
    try {
      const { error } = await supabase.from('posts').delete().eq('id', post.id);
      if (error) throw error;
      toast({ title: 'Post deleted', description: 'Your post has been deleted successfully' });
      onLikeUpdate?.();
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to delete post', variant: 'destructive' });
    }
    setShowDeleteDialog(false);
  };

  const canDeletePost = user && user.id === post.user_id;

  const handleLike = async () => {
    if (!user) {
      toast({ title: 'Sign in required', description: 'Please sign in to like posts', variant: 'destructive' });
      return;
    }

    try {
      if (liked) {
        await supabase.from('post_likes').delete().eq('post_id', post.id).eq('user_id', user.id);
        setLikesCount(prev => prev - 1);
        setLiked(false);
      } else {
        await supabase.from('post_likes').insert({ post_id: post.id, user_id: user.id });
        setLikesCount(prev => prev + 1);
        setLiked(true);
      }
      onLikeUpdate?.();
    } catch (error) {
      console.error('Error toggling like:', error);
    }
  };

  const handleSave = async () => {
    if (!user) {
      toast({ title: 'Sign in required', description: 'Please sign in to save posts', variant: 'destructive' });
      return;
    }

    try {
      if (saved) {
        await supabase.from('saved_posts').delete().eq('post_id', post.id).eq('user_id', user.id);
        setSaved(false);
        toast({ title: 'Post unsaved', description: 'Post removed from your saved items' });
      } else {
        await supabase.from('saved_posts').insert({ post_id: post.id, user_id: user.id });
        setSaved(true);
        toast({ title: 'Post saved', description: 'Post added to your saved items' });
      }
      onLikeUpdate?.();
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to save post', variant: 'destructive' });
    }
  };

  const handleCommentsOpenChange = (open: boolean) => {
    setCommentsOpen(open);
    onCommentsOpenChange?.(open);
    if (open) onInteractionStart?.();
    else onInteractionEnd?.();
  };

  // Generate gradient background for text posts
  const getTextBackground = () => {
    if (isTextStyled && post.media_url) {
      // media_url contains Tailwind classes - convert to CSS gradient
      return tailwindGradientToCSS(post.media_url);
    }
    // Default gradient for text-only posts
    return 'linear-gradient(135deg, hsl(230, 85%, 25%) 0%, hsl(280, 70%, 35%) 100%)';
  };

  // Parse caption for display
  const caption = post.content || '';
  const truncatedCaption = caption.length > 150 ? caption.substring(0, 150) + '...' : caption;

  return (
    <>
      <div 
        ref={postRef}
        className="relative w-full max-w-[430px] mx-auto h-[100dvh] bg-black overflow-hidden rounded-none sm:rounded-2xl"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {/* Background Media Layer */}
        <div className="absolute inset-0">
          {/* Loading skeleton */}
          {!isMediaLoaded && (currentMediaUrl || isTextStyled) && (
            <Skeleton className="absolute inset-0 w-full h-full bg-muted/30" />
          )}

          {/* Video background */}
          {hasVideo && currentMediaUrl && (
            <video
              ref={videoRef}
              src={currentMediaUrl}
              className={cn(
                "w-full h-full transition-opacity duration-300",
                isMediaLoaded ? "opacity-100" : "opacity-0",
                isLandscapeVideo ? "object-contain bg-black" : "object-cover"
              )}
              style={{ touchAction: 'manipulation' }}
              muted={isMuted}
              playsInline
              loop
              preload="auto"
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                togglePlayPause();
              }}
              onCanPlay={() => setIsMediaLoaded(true)}
              onLoadedMetadata={(e) => {
                const video = e.target as HTMLVideoElement;
                const aspectRatio = video.videoWidth / video.videoHeight;
                setIsLandscapeVideo(aspectRatio > 1.2); // Landscape if wider than 1.2:1
              }}
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              onContextMenu={(e) => e.preventDefault()}
              controlsList="nodownload nofullscreen noremoteplayback"
              disablePictureInPicture
            />
          )}

          {/* Image background */}
          {hasImage && currentMediaUrl && (
            <>
              <img
                src={currentMediaUrl}
                alt="Post media"
                className={cn(
                  "w-full h-full object-cover transition-opacity duration-300",
                  isMediaLoaded ? "opacity-100" : "opacity-0"
                )}
                onLoad={() => setIsMediaLoaded(true)}
                onContextMenu={(e) => e.preventDefault()}
                draggable={false}
              />
              {/* Slight overlay for text readability */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/30" />
            </>
          )}

          {/* Text/Styled text background */}
          {(isTextStyled || (!currentMediaUrl && !hasVideo && !hasImage)) && (
            <div 
              className="w-full h-full flex flex-col items-center justify-center px-4 pr-20 py-6 overflow-hidden"
              style={{ 
                background: isTextStyled ? getTextBackground() : 'linear-gradient(135deg, hsl(230, 85%, 25%) 0%, hsl(280, 70%, 35%) 100%)',
                touchAction: 'manipulation'
              }}
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                togglePlayPause();
              }}
            >
              <p className="text-white text-xl md:text-2xl font-semibold text-center leading-relaxed max-w-full drop-shadow-lg break-words whitespace-pre-wrap">
                {renderCaptionWithHashtags(caption)}
              </p>
            </div>
          )}
        </div>

        {/* Gradient overlays for text readability */}
        {(hasVideo || hasImage) && (
          <>
            <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-black/50 to-transparent pointer-events-none" />
            <div className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-black/70 to-transparent pointer-events-none" />
          </>
        )}

        {/* Play/Pause Overlay Icon */}
        {showPlayIcon && hasVideo && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
            <div className="bg-black/40 backdrop-blur-sm rounded-full p-5">
              {isPlaying ? (
                <Pause className="w-12 h-12 text-white" fill="white" />
              ) : (
                <Play className="w-12 h-12 text-white" fill="white" />
              )}
            </div>
          </div>
        )}

        {/* Multiple Media Indicator */}
        {hasMultipleMedia && (
          <div className="absolute top-16 right-16 flex gap-1.5 z-10">
            {mediaUrls.map((_, idx) => (
              <div 
                key={idx} 
                className={cn(
                  "w-2 h-2 rounded-full transition-all",
                  idx === currentMediaIndex ? "bg-white w-4" : "bg-white/50"
                )}
              />
            ))}
          </div>
        )}

        {/* Top Left - User Info Overlay */}
        <div className="absolute top-16 left-4 z-10 flex items-center gap-3">
          <Avatar 
            className="w-6 h-6 ring-1 ring-white/30 cursor-pointer"
            onClick={handleProfileClick}
          >
            <AvatarImage src={post.profiles?.avatar_url || ''} />
            <AvatarFallback className="bg-primary text-white text-xs">{displayName[0]?.toUpperCase()}</AvatarFallback>
          </Avatar>
          <div className="flex flex-col" onClick={handleProfileClick}>
            <span className="text-white font-semibold text-sm drop-shadow-lg cursor-pointer">
              {displayName}
            </span>
            <span className="text-white/70 text-xs drop-shadow-md">
              @{username} · {formatDistanceToNow(new Date(post.created_at), { addSuffix: false })}
            </span>
          </div>
        </div>

        {/* Top Right - Menu & Promoted Badge */}
        <div className="absolute top-16 right-4 z-10 flex items-center gap-2">
          {isPromoted && (
            <Badge className="bg-primary/80 backdrop-blur-sm text-white text-xs">
              <Sparkles className="w-3 h-3 mr-1" />
              Sponsored
            </Badge>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="p-2 bg-black/30 backdrop-blur-sm rounded-full hover:bg-black/50 transition-colors">
                <MoreVertical className="w-5 h-5 text-white" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleSave}>
                <Bookmark className="w-4 h-4 mr-2" />
                {saved ? 'Unsave Post' : 'Save Post'}
              </DropdownMenuItem>
              {canDeletePost && (
                <DropdownMenuItem 
                  onClick={() => setShowDeleteDialog(true)}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete Post
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Fullscreen Button - Below three-dot menu */}
        {(allPosts && allPosts.length > 0) && (
          <button 
            onClick={(e) => {
              e.stopPropagation();
              if (videoRef.current) {
                videoRef.current.pause();
              }
              setShowFullscreenViewer(true);
              onInteractionStart?.();
            }}
            className="absolute top-28 right-4 z-10 p-2 bg-black/30 backdrop-blur-sm rounded-full hover:bg-black/50 transition-colors"
          >
            <Maximize className="w-5 h-5 text-white" />
          </button>
        )}

        {/* Right Side - Action Buttons (Vertical Stack) */}
        <div className={cn(
          "absolute right-3 bottom-24 flex flex-col items-center gap-3 z-10",
          showControls ? "visible" : "invisible"
        )}>
          {/* Like */}
          <button 
            onClick={handleLike}
            className="flex flex-col items-center gap-0.5 group"
          >
            <Heart 
              className={cn(
                "w-6 h-6 drop-shadow-lg transition-transform group-active:scale-90", 
                liked ? "text-red-500 fill-red-500" : "text-white"
              )} 
            />
            <span className="text-white text-[10px] font-semibold drop-shadow-lg">{formatCount(likesCount)}</span>
          </button>

          {/* Comments */}
          <button 
            onClick={() => handleCommentsOpenChange(true)}
            className="flex flex-col items-center gap-0.5 group"
          >
            <MessageCircle className="w-6 h-6 text-white drop-shadow-lg transition-transform group-active:scale-90" />
            <span className="text-white text-[10px] font-semibold drop-shadow-lg">{formatCount(commentsCount)}</span>
          </button>

          {/* Refeed */}
          <button 
            onClick={() => { setRefeedOpen(true); onInteractionStart?.(); }}
            className="flex flex-col items-center gap-0.5 group"
          >
            <Repeat className="w-6 h-6 text-white drop-shadow-lg transition-transform group-active:scale-90" />
            <span className="text-white text-[10px] font-semibold drop-shadow-lg">{formatCount(refeedsCount)}</span>
          </button>

          {/* Gift */}
          <button 
            onClick={() => { setGiftOpen(true); onInteractionStart?.(); }}
            className="flex flex-col items-center gap-0.5 group"
          >
            <Gift className="w-6 h-6 text-white drop-shadow-lg transition-transform group-active:scale-90" />
            <span className="text-white text-[10px] font-semibold drop-shadow-lg">{formatCount(giftsCount)}</span>
          </button>

          {/* Share */}
          <button 
            onClick={() => { setShareOpen(true); onInteractionStart?.(); }}
            className="flex flex-col items-center gap-0.5 group"
          >
            <Share2 className="w-6 h-6 text-white drop-shadow-lg transition-transform group-active:scale-90" />
          </button>

          {/* Mute/Unmute for videos */}
          {hasVideo && (
            <button 
              onClick={toggleMute}
              className="flex flex-col items-center gap-0.5"
            >
              {isMuted ? (
                <VolumeX className="w-6 h-6 text-white drop-shadow-lg" />
              ) : (
                <Volume2 className="w-6 h-6 text-white drop-shadow-lg" />
              )}
            </button>
          )}
        </div>

        {/* Bottom Left - Caption & Music */}
        <div className="absolute left-4 right-20 bottom-20 z-10">
          {/* Refeed indicator */}
          {isRefeed && (
            <div className="flex items-center gap-1.5 mb-2">
              <Repeat className="w-3.5 h-3.5 text-white/70" />
              <span className="text-xs text-white/70">Refeed from @{post.original_post?.profiles?.username}</span>
            </div>
          )}

          {/* Caption - shown for all post types */}
          {caption && (
            <div className="mb-2">
            <p className="text-white text-sm leading-relaxed drop-shadow-lg line-clamp-2">
              {!isTextStyled && renderCaptionWithHashtags(truncatedCaption)}
            </p>
              {!isTextStyled && caption.length > 100 && (
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowFullCaption(!showFullCaption);
                  }}
                  className="text-primary text-xs mt-1 font-medium"
                >
                  {showFullCaption ? 'Show less' : 'Show more...'}
                </button>
              )}
            </div>
          )}

          {/* Promote CTA - Just under caption as clickable text */}
          {user && !isPromoted && (
            <button 
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/promote/${post.id}`);
              }}
              className="flex items-center gap-1.5 text-blue-400 hover:text-blue-300 text-xs font-bold transition-all animate-pulse"
            >
              <TrendingUp className="w-3.5 h-3.5" />
              <span>Promote this post</span>
            </button>
          )}

          {/* Music indicator */}
          {hasMusic && (
            <div className="flex items-center gap-2 bg-black/30 backdrop-blur-sm rounded-full px-3 py-1.5 w-fit mb-2">
              <Music className="w-4 h-4 text-white animate-pulse" />
              <div className="overflow-hidden">
                <p className="text-white text-xs font-medium truncate max-w-[180px]">
                  {post.music_title || 'Original Audio'} {post.music_artist && `· ${post.music_artist}`}
                </p>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* Modals */}
      <CommentsModal
        isOpen={commentsOpen}
        onClose={() => handleCommentsOpenChange(false)}
        postId={post.id}
        onCommentAdded={() => setCommentsCount(prev => prev + 1)}
      />

      <ShareModal
        isOpen={shareOpen}
        onClose={() => {
          setShareOpen(false);
          onInteractionEnd?.();
        }}
        postId={post.id}
        postData={{ content: caption }}
      />

      <GiftModal
        isOpen={giftOpen}
        onClose={() => {
          setGiftOpen(false);
          onInteractionEnd?.();
        }}
        recipientId={post.user_id}
        postId={post.id}
      />

      <RefeedModal
        isOpen={refeedOpen}
        onClose={() => {
          setRefeedOpen(false);
          onInteractionEnd?.();
        }}
        postId={post.id}
        onRefeedAdded={() => {
          setRefeedsCount(prev => prev + 1);
          onLikeUpdate?.();
        }}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Post</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this post? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeletePost} className="bg-destructive text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Fullscreen Media Viewer */}
      {allPosts && allPosts.length > 0 && (
        <FullscreenMediaViewer
          post={isRefeed && displayPost ? displayPost as any : post}
          allPosts={allPosts}
          allVideoPosts={allVideoPosts}
          isOpen={showFullscreenViewer}
          onClose={() => {
            setShowFullscreenViewer(false);
            onInteractionEnd?.();
          }}
          onMarkAsViewed={onMarkAsViewed}
          parentLikesCount={likesCount}
          parentCommentsCount={commentsCount}
          parentRefeedsCount={refeedsCount}
          actualPostId={post.id}
          initialMuted={isMuted}
        />
      )}
    </>
  );
});

export default ImmersivePostCard;
