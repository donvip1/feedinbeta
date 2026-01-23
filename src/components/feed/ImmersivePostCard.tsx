import { useState, useEffect, useRef, memo } from 'react';
import { Heart, MessageCircle, Share2, Repeat, Gift, TrendingUp, Volume2, VolumeX, Play, Pause, Trash2, Bookmark, Music, MoreVertical, Sparkles, Plus, Globe, Star } from 'lucide-react';
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
import { cn } from '@/lib/utils';
import { tailwindGradientToCSS } from '@/lib/tailwind-gradient-utils';

// Format count for display (e.g., 1.2K, 3.5M)
const formatCount = (count: number): string => {
  if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
  if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
  return count.toString();
};

// Helper to count words
const countWords = (text: string): number => {
  return text.trim().split(/\s+/).filter(word => word.length > 0).length;
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
  layoutType?: 'video' | 'photo-text'; // Determines social button placement
  globalMuted?: boolean; // Global mute state from parent
  onGlobalMuteToggle?: () => void; // Callback to toggle global mute
  onImmersiveModeChange?: (isImmersive: boolean) => void; // Callback when entering/exiting fullscreen immersive mode
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
  onMarkAsViewed,
  layoutType = 'video', // Default to video layout
  globalMuted,
  onGlobalMuteToggle,
  onImmersiveModeChange
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
  // Use global mute state if provided, otherwise use local state
  const [localMuted, setLocalMuted] = useState(false);
  const isMuted = globalMuted !== undefined ? globalMuted : localMuted;
  const [isPlaying, setIsPlaying] = useState(false);
  const [showPlayIcon, setShowPlayIcon] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [currentMediaIndex, setCurrentMediaIndex] = useState(0);
  const [isMediaLoaded, setIsMediaLoaded] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [isImmersiveMode, setIsImmersiveMode] = useState(false); // Fullscreen immersive mode - hides all UI except author name
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
  const isPlainText = post.media_type === 'text_plain';
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
                // Force mute on autoplay failure - use global or local
                if (onGlobalMuteToggle && !globalMuted) {
                  onGlobalMuteToggle();
                } else if (!onGlobalMuteToggle) {
                  setLocalMuted(true);
                }
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

  // Toggle immersive mode (fullscreen with minimal UI)
  const toggleImmersiveMode = () => {
    const newMode = !isImmersiveMode;
    setIsImmersiveMode(newMode);
    onImmersiveModeChange?.(newMode);
    
    // In immersive mode, start playing if not already
    if (newMode && videoRef.current && !isPlaying) {
      videoRef.current.play();
      setIsPlaying(true);
    }
  };

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

  // Handle tap on video/media area
  const handleMediaTap = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    
    if (isImmersiveMode) {
      // In immersive mode, tap exits immersive mode
      toggleImmersiveMode();
    } else {
      // In normal mode, tap toggles play/pause
      togglePlayPause();
    }
  };

  const toggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      // Use global toggle if available, otherwise use local
      if (onGlobalMuteToggle) {
        onGlobalMuteToggle();
      } else {
        setLocalMuted(!localMuted);
      }
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

  // Parse caption for display - expandable if more than 5 words
  const caption = post.content || '';
  const wordCount = countWords(caption);
  const shouldTruncateCaption = wordCount > 5;
  const words = caption.trim().split(/\s+/);
  const truncatedCaption = shouldTruncateCaption ? words.slice(0, 5).join(' ') + '...' : caption;

  return (
    <>
      <div 
        ref={postRef}
        className={cn(
          "relative w-full max-w-[430px] mx-auto bg-black overflow-hidden rounded-none sm:rounded-2xl flex flex-col transition-all duration-300",
          isImmersiveMode ? "h-[100dvh]" : "h-[calc(100dvh-68px)]"
        )}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {/* --- TOP SECTION: User Info & Caption (NOT overlayed) - Hidden in immersive mode --- */}
        {!isImmersiveMode && (
          <div className="flex-shrink-0 bg-black/95 px-4 pt-16 pb-3 z-20">
            <div className="flex items-start justify-between">
              <div className="flex gap-3">
                <div className="relative">
                  <Avatar 
                    className="w-10 h-10 cursor-pointer border border-white/20"
                    onClick={handleProfileClick}
                  >
                    <AvatarImage src={post.profiles?.avatar_url || ''} />
                    <AvatarFallback className="bg-primary text-white text-sm">{displayName[0]?.toUpperCase()}</AvatarFallback>
                  </Avatar>
                  {/* Online indicator */}
                  <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-black rounded-full" />
                </div>
                <div className="flex flex-col">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-base text-white cursor-pointer" onClick={handleProfileClick}>
                      {displayName}
                    </span>
                    {/* Follow button inline */}
                    {user && user.id !== post.user_id && (
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          toast({ title: 'Following', description: `You are now following @${username}` });
                        }}
                        className="text-blue-400 font-bold text-sm hover:text-blue-300 transition"
                      >
                        • Follow
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-1 text-xs text-gray-400">
                    <Globe className="w-2.5 h-2.5" />
                    <span>Public</span>
                  </div>
                </div>
              </div>
              {/* Menu button */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="p-2 rounded-full transition-all active:scale-95 hover:bg-white/10">
                    <MoreVertical className="w-6 h-6 text-white" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="bg-background/95 backdrop-blur-md border-border/50">
                  <DropdownMenuItem onClick={handleSave} className="gap-2">
                    <Bookmark className="w-4 h-4" />
                    {saved ? 'Unsave Post' : 'Save Post'}
                  </DropdownMenuItem>
                  {canDeletePost && (
                    <DropdownMenuItem 
                      onClick={() => setShowDeleteDialog(true)}
                      className="text-destructive focus:text-destructive gap-2"
                    >
                      <Trash2 className="w-4 h-4" />
                      Delete Post
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Caption - Below user info */}
            {caption && !isTextStyled && (
              <div className="mt-2">
                <p className="text-white text-sm leading-snug">
                  {showFullCaption ? renderCaptionWithHashtags(caption) : renderCaptionWithHashtags(truncatedCaption)}
                </p>
                {shouldTruncateCaption && (
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowFullCaption(!showFullCaption);
                    }}
                    className="text-blue-400 text-xs mt-1 font-medium hover:text-blue-300 transition"
                  >
                    {showFullCaption ? 'Show less' : 'View more'}
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* --- MEDIA SECTION (takes remaining space) --- */}
        <div className="flex-1 relative overflow-hidden">
          {/* Loading skeleton */}
          {!isMediaLoaded && (currentMediaUrl || isTextStyled) && (
            <Skeleton className="absolute inset-0 w-full h-full bg-muted/30" />
          )}

          {/* Video */}
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
              onClick={handleMediaTap}
              onCanPlay={() => setIsMediaLoaded(true)}
              onLoadedMetadata={(e) => {
                const video = e.target as HTMLVideoElement;
                const aspectRatio = video.videoWidth / video.videoHeight;
                setIsLandscapeVideo(aspectRatio > 1.2);
              }}
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              onContextMenu={(e) => e.preventDefault()}
              controlsList="nodownload nofullscreen noremoteplayback"
              disablePictureInPicture
            />
          )}

          {/* Image */}
          {hasImage && currentMediaUrl && (
            <>
              <img
                src={currentMediaUrl}
                alt="Post media"
                className={cn(
                  "w-full h-full object-contain transition-opacity duration-300",
                  isMediaLoaded ? "opacity-100" : "opacity-0"
                )}
                onClick={handleMediaTap}
                onLoad={() => setIsMediaLoaded(true)}
                onContextMenu={(e) => e.preventDefault()}
                draggable={false}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none" />
            </>
          )}

          {/* Text/Styled text background */}
          {isTextStyled && (
            <div 
              className="w-full h-full flex flex-col items-center justify-center px-4 pr-20 py-6 overflow-hidden"
              style={{ 
                background: getTextBackground(),
                touchAction: 'manipulation'
              }}
              onClick={handleMediaTap}
            >
              <p className="text-white text-xl md:text-2xl font-semibold text-center leading-relaxed max-w-full drop-shadow-lg break-words whitespace-pre-wrap">
                {renderCaptionWithHashtags(caption)}
              </p>
            </div>
          )}

          {/* Plain text posts */}
          {(isPlainText || (!currentMediaUrl && !hasVideo && !hasImage && !isTextStyled)) && (
            <div 
              className="w-full h-full flex flex-col items-center justify-center px-4 pr-16 py-6 overflow-hidden bg-background"
              style={{ touchAction: 'manipulation' }}
              onClick={handleMediaTap}
            >
              <p className="text-foreground text-lg md:text-xl leading-relaxed max-w-full break-words whitespace-pre-wrap text-center">
                {renderCaptionWithHashtags(caption)}
              </p>
            </div>
          )}

          {/* Gradient overlays for buttons readability - shown when NOT in immersive mode */}
          {(hasVideo || hasImage) && !isImmersiveMode && (
            <>
              <div className="absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-black/50 to-transparent pointer-events-none" />
              <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-black/80 to-transparent pointer-events-none" />
            </>
          )}

          {/* Immersive Mode: Author Name Overlay (only visible in immersive mode) */}
          {isImmersiveMode && (
            <div className="absolute top-12 left-4 z-30 pointer-events-none">
              <div className="flex items-center gap-2 bg-black/40 backdrop-blur-sm rounded-full px-3 py-1.5">
                <Avatar className="w-6 h-6 border border-white/20">
                  <AvatarImage src={post.profiles?.avatar_url || ''} />
                  <AvatarFallback className="bg-primary text-white text-xs">{displayName[0]?.toUpperCase()}</AvatarFallback>
                </Avatar>
                <span className="text-white text-sm font-medium drop-shadow-lg">{displayName}</span>
              </div>
            </div>
          )}

          {/* Play/Pause Center Overlay - only in normal mode */}
          {hasVideo && !isImmersiveMode && (
            <div className={cn(
              "absolute inset-0 flex items-center justify-center pointer-events-none transition-opacity duration-300",
              showControls ? "opacity-100" : "opacity-0"
            )}>
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  toggleImmersiveMode();
                }}
                className="w-16 h-16 bg-black/40 rounded-full backdrop-blur-md flex items-center justify-center pointer-events-auto transition-transform hover:scale-110 active:scale-95 border border-white/10"
              >
                {isPlaying ? (
                  <Pause className="w-8 h-8 text-white" fill="white" />
                ) : (
                  <Play className="w-8 h-8 text-white ml-1" fill="white" />
                )}
              </button>
            </div>
          )}

          {/* Multiple Media Indicator */}
          {hasMultipleMedia && (
            <div className="absolute top-4 right-16 flex gap-1.5 z-10">
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

          {/* Mute/Unmute Button - Top right of media, standalone - hidden in immersive mode */}
          {hasVideo && !isImmersiveMode && (
            <button 
              onClick={toggleMute}
              className="absolute top-4 right-3 z-20 p-2 bg-black/30 backdrop-blur-sm rounded-full transition-all active:scale-95 hover:bg-black/50"
            >
              {isMuted ? (
                <VolumeX className="w-5 h-5 text-white" />
              ) : (
                <Volume2 className="w-5 h-5 text-white" />
              )}
            </button>
          )}

          {/* Promoted Badge - hidden in immersive mode */}
          {isPromoted && !isImmersiveMode && (
            <div className="absolute top-4 left-4 z-10">
              <Badge className="bg-pink-500/90 backdrop-blur-sm text-white text-xs font-semibold">
                <Sparkles className="w-3 h-3 mr-1" />
                Sponsored
              </Badge>
            </div>
          )}

          {/* --- RIGHT SIDEBAR: Social Buttons (overlayed on media) - hidden in immersive mode --- */}
          {!isImmersiveMode && (
            <div className={cn(
              "absolute bottom-4 right-3 z-10 flex flex-col items-center gap-2 pointer-events-auto",
              showControls ? "visible" : "invisible"
            )}>
              {/* Like */}
              <button onClick={handleLike} className="flex flex-col items-center gap-0.5 group">
                <div className={cn(
                  "p-1.5 rounded-full transition-all active:scale-90",
                  liked ? "bg-pink-500/90" : "bg-black/40 backdrop-blur-sm"
                )}>
                  <Heart className={cn("w-5 h-5 transition-transform", liked ? "text-white fill-white" : "text-white")} />
                </div>
                <span className="text-white text-[10px] font-semibold drop-shadow-lg">{formatCount(likesCount)}</span>
              </button>

              {/* Comments */}
              <button onClick={() => handleCommentsOpenChange(true)} className="flex flex-col items-center gap-0.5 group">
                <div className="p-1.5 bg-black/40 backdrop-blur-sm rounded-full transition-all active:scale-90">
                  <MessageCircle className="w-5 h-5 text-white" />
                </div>
                <span className="text-white text-[10px] font-semibold drop-shadow-lg">{formatCount(commentsCount)}</span>
              </button>

              {/* Refeed */}
              <button onClick={() => { setRefeedOpen(true); onInteractionStart?.(); }} className="flex flex-col items-center gap-0.5 group">
                <div className="p-1.5 bg-black/40 backdrop-blur-sm rounded-full transition-all active:scale-90">
                  <Repeat className="w-5 h-5 text-white" />
                </div>
                <span className="text-white text-[10px] font-semibold drop-shadow-lg">{formatCount(refeedsCount)}</span>
              </button>

              {/* Gift */}
              <button onClick={() => { setGiftOpen(true); onInteractionStart?.(); }} className="flex flex-col items-center gap-0.5 group">
                <div className="p-1.5 bg-black/40 backdrop-blur-sm rounded-full transition-all active:scale-90">
                  <Gift className="w-5 h-5 text-white" />
                </div>
                <span className="text-white text-[10px] font-semibold drop-shadow-lg">{formatCount(giftsCount)}</span>
              </button>

              {/* Share */}
              <button onClick={() => { setShareOpen(true); onInteractionStart?.(); }} className="flex flex-col items-center gap-0.5 group">
                <div className="p-1.5 bg-black/40 backdrop-blur-sm rounded-full transition-all active:scale-90">
                  <Share2 className="w-5 h-5 text-white" />
                </div>
              </button>

              {/* Bookmark */}
              <button onClick={handleSave} className="flex flex-col items-center gap-0.5 group">
                <div className={cn(
                  "p-1.5 rounded-full transition-all active:scale-90",
                  saved ? "bg-primary/90" : "bg-black/40 backdrop-blur-sm"
                )}>
                  <Bookmark className={cn("w-5 h-5", saved ? "text-white fill-white" : "text-white")} />
                </div>
              </button>

              {/* Promote Button - Bottom right */}
              {user && !isPromoted && (
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/promote/${post.id}`);
                  }}
                  className="mt-1 p-1.5 bg-gradient-to-r from-pink-500 to-purple-500 rounded-full transition-all active:scale-90 hover:opacity-90"
                >
                  <TrendingUp className="w-5 h-5 text-white" />
                </button>
              )}
            </div>
          )}

          {/* Bottom Left - Music indicator - hidden in immersive mode */}
          {hasMusic && !isImmersiveMode && (
            <div className="absolute left-4 bottom-4 z-10 flex items-center gap-3">
              <div className="relative w-10 h-10 rounded-full bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center animate-spin" style={{ animationDuration: '3s' }}>
                <div className="w-4 h-4 rounded-full bg-white/20" />
                <div className="absolute inset-0 rounded-full border border-white/10" />
              </div>
              <div className="flex items-center gap-2 bg-black/40 backdrop-blur-sm rounded-full px-3 py-1.5 overflow-hidden max-w-[180px]">
                <Music className="w-4 h-4 text-white flex-shrink-0" />
                <p className="text-white text-xs font-medium truncate">
                  {post.music_title || 'Original Audio'} {post.music_artist && `· ${post.music_artist}`}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Bottom spacer removed - Promote button now in social buttons stack */}

        {/* Social buttons for Plain Text - positioned at bottom */}
        {isPlainText && (
          <div className="absolute left-4 right-4 bottom-16 z-10">
            {/* Promote CTA */}
            {user && !isPromoted && (
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(`/promote/${post.id}`);
                }}
                className="flex items-center gap-1.5 text-primary hover:text-primary/80 text-xs font-bold transition-all animate-pulse mb-2"
              >
                <TrendingUp className="w-3.5 h-3.5" />
                <span>Promote this post</span>
              </button>
            )}

            {/* Social buttons - Horizontal layout */}
            <div className="flex items-center gap-4 mt-2">
              <button onClick={handleLike} className="flex items-center gap-1.5 group">
                <Heart className={cn("w-5 h-5 transition-transform group-active:scale-90", liked ? "text-destructive fill-destructive" : "text-muted-foreground")} />
                <span className="text-muted-foreground text-xs font-semibold">{formatCount(likesCount)}</span>
              </button>
              <button onClick={() => handleCommentsOpenChange(true)} className="flex items-center gap-1.5 group">
                <MessageCircle className="w-5 h-5 text-muted-foreground transition-transform group-active:scale-90" />
                <span className="text-muted-foreground text-xs font-semibold">{formatCount(commentsCount)}</span>
              </button>
              <button onClick={() => { setRefeedOpen(true); onInteractionStart?.(); }} className="flex items-center gap-1.5 group">
                <Repeat className="w-5 h-5 text-muted-foreground transition-transform group-active:scale-90" />
                <span className="text-muted-foreground text-xs font-semibold">{formatCount(refeedsCount)}</span>
              </button>
              <button onClick={() => { setGiftOpen(true); onInteractionStart?.(); }} className="flex items-center gap-1.5 group">
                <Gift className="w-5 h-5 text-muted-foreground transition-transform group-active:scale-90" />
                <span className="text-muted-foreground text-xs font-semibold">{formatCount(giftsCount)}</span>
              </button>
              <button onClick={() => { setShareOpen(true); onInteractionStart?.(); }} className="group">
                <Share2 className="w-5 h-5 text-muted-foreground transition-transform group-active:scale-90" />
              </button>
            </div>
          </div>
        )}
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

    </>
  );
});

export default ImmersivePostCard;
