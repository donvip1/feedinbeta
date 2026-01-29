import { useState, useEffect, useRef, memo, useCallback } from 'react';
import { Heart, MessageCircle, Share2, Repeat, Gift, TrendingUp, Volume2, VolumeX, Play, Pause, Trash2, Music, Sparkles, Plus, Globe, Star, ArrowLeft, Eye, MoreHorizontal, X, MoreVertical, MapPin } from 'lucide-react';
import { formatCompactTime } from '@/lib/format-time';
import { Skeleton } from '@/components/ui/skeleton';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import CommentsModal from './CommentsModal';
import MobileShareSheet from './MobileShareSheet';
import GiftModal from './GiftModal';
import RefeedModal from './RefeedModal';
import DraggableCommentsPanel from './DraggableCommentsPanel';
import ImageLightbox from './ImageLightbox';
import { cn } from '@/lib/utils';
import { AnimatePresence, motion } from 'framer-motion';
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
  isGlobalImmersive?: boolean; // Global immersive mode state from parent - persists across scrolling
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
  onImmersiveModeChange,
  isGlobalImmersive = false // Global immersive mode from parent
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
  const [showControls, setShowControls] = useState(false); // Start hidden, only show after user taps
  // Use global immersive state if provided, allows all cards to stay in immersive mode when scrolling
  const isImmersiveMode = isGlobalImmersive;
  const [showImmersiveUI, setShowImmersiveUI] = useState(false); // Toggle UI visibility while in immersive mode
  const [showDraggableComments, setShowDraggableComments] = useState(false); // Draggable comments panel
  const [isLandscapeVideo, setIsLandscapeVideo] = useState(false);
  const [videoProgress, setVideoProgress] = useState(0); // Video progress 0-100
  const [videoDuration, setVideoDuration] = useState(0); // Video duration in seconds
  const [isSeeking, setIsSeeking] = useState(false); // Is user dragging timeline
  const [isFollowing, setIsFollowing] = useState(false); // Follow state
  const [showMoreActions, setShowMoreActions] = useState(false); // Toggle for expanded social buttons when caption is long
  const [isFollowLoading, setIsFollowLoading] = useState(false); // Loading state for follow action
  const [showLightbox, setShowLightbox] = useState(false); // Lightbox state for Photo+ images
  const [lightboxIndex, setLightboxIndex] = useState(0); // Active image in lightbox
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const postRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef<number>(0);
  const touchEndX = useRef<number>(0);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const timelineRef = useRef<HTMLDivElement>(null);

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
  
  // Determine if this is effectively a plain text post (no media at all) - needed for early function definitions
  const isEffectivelyPlainText = isPlainText || (!currentMediaUrl && !hasVideo && !hasImage && !isTextStyled);

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

  // Check if post is liked, saved, and if we're following the poster
  useEffect(() => {
    const checkStatus = async () => {
      if (!user) return;

      try {
        const [likeCheck, saveCheck, followCheck] = await Promise.all([
          supabase.from('post_likes').select('id').eq('post_id', post.id).eq('user_id', user.id).maybeSingle(),
          supabase.from('saved_posts').select('id').eq('post_id', post.id).eq('user_id', user.id).maybeSingle(),
          supabase.from('follows').select('id').eq('follower_id', user.id).eq('following_id', post.user_id).maybeSingle()
        ]);

        setLiked(!!likeCheck.data);
        setSaved(!!saveCheck.data);
        setIsFollowing(!!followCheck.data);
      } catch (error) {
        // Expected when not liked/saved/following
      }
    };

    checkStatus();
  }, [user, post.id, post.user_id]);

  // Handle follow/unfollow
  const handleFollow = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) {
      toast({ title: 'Sign in required', description: 'Please sign in to follow users', variant: 'destructive' });
      return;
    }
    if (isFollowLoading) return;

    setIsFollowLoading(true);
    try {
      if (isFollowing) {
        // Unfollow
        await supabase
          .from('follows')
          .delete()
          .eq('follower_id', user.id)
          .eq('following_id', post.user_id);
        setIsFollowing(false);
        toast({ title: 'Unfollowed', description: `You unfollowed @${username}` });
      } else {
        // Follow
        await supabase
          .from('follows')
          .insert({ follower_id: user.id, following_id: post.user_id });
        setIsFollowing(true);
        toast({ title: 'Following', description: `You are now following @${username}` });
      }
    } catch (error: any) {
      // Handle unique constraint violation (already following)
      if (error?.code === '23505') {
        setIsFollowing(true);
      } else {
        toast({ title: 'Error', description: 'Failed to update follow status', variant: 'destructive' });
      }
    } finally {
      setIsFollowLoading(false);
    }
  };

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
            setGiftsCount(newData.gifts_count || 0);
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [post.id]);

  // Enter immersive mode (fullscreen with minimal UI)
  const enterImmersiveMode = () => {
    setShowImmersiveUI(false); // Start with UI hidden
    onImmersiveModeChange?.(true); // Notify parent to set global immersive mode
    
    // In immersive mode, start playing if not already
    if (videoRef.current && !isPlaying) {
      videoRef.current.play();
      setIsPlaying(true);
    }
  };

  // Exit immersive mode (return to normal view)
  const exitImmersiveMode = () => {
    setShowImmersiveUI(false);
    onImmersiveModeChange?.(false); // Notify parent to exit global immersive mode
    // Video continues playing from current position - no need to reset
  };

  // Toggle UI visibility in immersive mode
  const toggleImmersiveUI = () => {
    setShowImmersiveUI(prev => !prev);
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
      // Only show play/pause icon when user manually taps (not on auto-play)
      setShowPlayIcon(true);
      setTimeout(() => setShowPlayIcon(false), 500);
    }
  };

  // Handle tap on video/media area
  const handleMediaTap = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    
    // Don't enter fullscreen for plain text posts - they should stay inline
    if (isEffectivelyPlainText) {
      return;
    }
    
    if (isImmersiveMode) {
      // In immersive mode, tap toggles UI visibility (not exit)
      toggleImmersiveUI();
    } else {
      // In normal mode, tapping anywhere enters fullscreen immersive mode
      enterImmersiveMode();
    }
  };

  // Video progress update handler
  const handleTimeUpdate = useCallback(() => {
    if (videoRef.current && !isSeeking) {
      const progress = (videoRef.current.currentTime / videoRef.current.duration) * 100;
      setVideoProgress(progress);
    }
  }, [isSeeking]);

  // Handle video seek via timeline
  const handleSeek = useCallback((e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
    if (!videoRef.current || !timelineRef.current) return;
    
    const rect = timelineRef.current.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const position = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    
    videoRef.current.currentTime = position * videoRef.current.duration;
    setVideoProgress(position * 100);
  }, []);

  const handleSeekStart = useCallback((e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
    setIsSeeking(true);
    handleSeek(e);
  }, [handleSeek]);

  const handleSeekEnd = useCallback(() => {
    setIsSeeking(false);
  }, []);

  // Open comments in immersive mode
  const openImmersiveComments = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setShowDraggableComments(true);
  }, []);

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
    if (open) {
      onInteractionStart?.();
      // Pause main video when comments open to prevent audio echo
      if (videoRef.current && hasVideo) {
        videoRef.current.pause();
        setIsPlaying(false);
      }
    } else {
      onInteractionEnd?.();
      // Resume video when comments close
      if (videoRef.current && hasVideo) {
        videoRef.current.play().catch(() => {});
        setIsPlaying(true);
      }
    }
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

  // Parse caption for display - different limits based on media type
  // Video posts: max 90 characters, Photo+ posts: max 125 words
  const caption = post.content || '';
  const wordCount = countWords(caption);
  const isVideoPost = hasVideo;
  
  // For video posts, truncate by character count (90 chars)
  // For photo/text posts, truncate by word count (125 words)
  const shouldTruncateCaption = isVideoPost 
    ? caption.length > 90 
    : wordCount > 125;
  
  const truncatedCaption = isVideoPost
    ? (caption.length > 90 ? caption.slice(0, 90).trim() + '...' : caption)
    : (wordCount > 125 ? caption.trim().split(/\s+/).slice(0, 125).join(' ') + '...' : caption);

  // Check if we need a footer section (caption, music, or promote button exists)
  const hasFooterContent = !isImmersiveMode && !isTextStyled && !isPlainText && (caption || hasMusic || (user && !isPromoted));

  // isEffectivelyPlainText is already defined earlier (line 236) for use in callbacks

  // Photo+ layout: caption above image, horizontal social buttons below
  // Excludes plain text posts - they have inline social buttons
  const isPhotoTextLayout = layoutType === 'photo-text' && !isTextStyled && !isEffectivelyPlainText;

  return (
    <>
      <div 
        ref={postRef}
        className={cn(
          "relative w-full max-w-[430px] mx-auto bg-black overflow-hidden rounded-none sm:rounded-2xl flex flex-col transition-all duration-300",
          // In immersive mode, card takes full viewport height
          isImmersiveMode && "h-[100dvh] max-w-none",
          // Video layout: full viewport height for TikTok-style
          !isImmersiveMode && layoutType === 'video' && "h-[calc(100dvh-68px)]",
          // Photo+ layout: content-driven height with minimal padding, no fixed height
          !isImmersiveMode && isPhotoTextLayout && "min-h-fit pb-4"
        )}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {/* --- TOP SECTION: User Info (NOT overlayed) - Hidden in immersive mode and for plain text posts (they have their own header) --- */}
        {/* Video posts keep dark background header */}
        {!isImmersiveMode && !isEffectivelyPlainText && !isPhotoTextLayout && (
          <div className="flex-shrink-0 bg-black/95 px-4 pt-16 pb-3 z-20">
            <div className="flex items-start justify-between">
              <div className="flex gap-3 flex-1">
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
                <div className="flex flex-col flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-base text-white cursor-pointer" onClick={handleProfileClick}>
                      {displayName}
                    </span>
                    {/* Follow button inline */}
                    {user && user.id !== post.user_id && (
                      <button 
                        onClick={handleFollow}
                        disabled={isFollowLoading}
                        className={cn(
                          "font-bold text-sm transition",
                          isFollowing ? "text-muted-foreground hover:text-foreground" : "text-primary hover:text-primary/80",
                          isFollowLoading && "opacity-50"
                        )}
                      >
                        • {isFollowLoading ? '...' : (isFollowing ? 'Following' : 'Follow')}
                      </button>
                    )}
                    {/* Mute/Unmute button - inline with follow */}
                    {hasVideo && (
                      <button 
                        onClick={toggleMute}
                        className="p-1.5 bg-white/10 backdrop-blur-sm rounded-full transition-all active:scale-95 hover:bg-white/20 ml-auto"
                      >
                        {isMuted ? (
                          <VolumeX className="w-4 h-4 text-white" />
                        ) : (
                          <Volume2 className="w-4 h-4 text-white" />
                        )}
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
                    <Globe className="w-2.5 h-2.5" />
                    <span>Public</span>
                    <span className="opacity-50">•</span>
                    <span>{formatCompactTime(post.created_at)}</span>
                    {/* Location display */}
                    {post.location && (
                      <>
                        <span className="opacity-50">•</span>
                        <span className="truncate max-w-[120px]">{post.location}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
              {/* Three-dots menu - show for post owner/admin to access delete */}
              {canDeletePost && (
                <div className="relative">
                  <button 
                    onClick={() => setShowMoreActions(!showMoreActions)}
                    className="p-2 rounded-full transition-all active:scale-95 hover:bg-white/10"
                  >
                    <MoreVertical className="w-5 h-5 text-white" />
                  </button>
                  {showMoreActions && (
                    <>
                      <div 
                        className="fixed inset-0 z-40"
                        onClick={() => setShowMoreActions(false)}
                      />
                      <div className="absolute right-0 top-full mt-1 bg-background border border-border rounded-lg shadow-lg z-50 min-w-[120px] overflow-hidden">
                        <button
                          onClick={() => {
                            setShowMoreActions(false);
                            setShowDeleteDialog(true);
                          }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-destructive hover:bg-destructive/10 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                          Delete
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
            
            {/* Refeed/Quote indicator - show original poster */}
            {isRefeed && post.original_post && (
              <div 
                className="flex items-center gap-2 mt-2 px-1 py-1.5 bg-white/5 rounded-lg cursor-pointer hover:bg-white/10 transition"
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(`/feed/post/${post.original_post.id}`);
                }}
              >
                <Repeat className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                <span className="text-xs text-muted-foreground">
                  Refeed from
                </span>
                <div className="flex items-center gap-1.5">
                  <Avatar className="w-4 h-4">
                    <AvatarImage src={post.original_post.profiles?.avatar_url || ''} />
                    <AvatarFallback className="text-[8px] bg-primary text-white">
                      {post.original_post.profiles?.display_name?.[0]?.toUpperCase() || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-xs font-medium text-white truncate max-w-[100px]">
                    {post.original_post.profiles?.display_name || post.original_post.profiles?.username || 'User'}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* --- Photo+ Facebook-style Card Layout: Header + Caption + Image + Social Buttons --- */}
        {!isImmersiveMode && isPhotoTextLayout && !isEffectivelyPlainText && (
          <div className="flex-shrink-0 bg-card rounded-t-lg border-x border-t border-border mt-14 mx-2">
            {/* Post Header - User info */}
            <div className="flex items-center gap-3 p-4 pb-3">
              <Avatar 
                className="w-10 h-10 cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  handleProfileClick();
                }}
              >
                <AvatarImage src={post.profiles?.avatar_url || ''} />
                <AvatarFallback className="bg-primary text-white text-sm">{displayName[0]?.toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span 
                    className="font-semibold text-foreground text-sm cursor-pointer hover:underline"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleProfileClick();
                    }}
                  >
                    {displayName}
                  </span>
                  {user && user.id !== post.user_id && (
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        handleFollow(e);
                      }}
                      disabled={isFollowLoading}
                      className={cn(
                        "font-semibold text-xs transition",
                        isFollowing ? "text-muted-foreground hover:text-foreground" : "text-primary hover:text-primary/80",
                        isFollowLoading && "opacity-50"
                      )}
                    >
                      • {isFollowLoading ? '...' : (isFollowing ? 'Following' : 'Follow')}
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-1.5 text-muted-foreground text-xs">
                  <span>@{post.profiles?.username || 'user'}</span>
                  <span>•</span>
                  <span>{formatCompactTime(post.created_at || '')}</span>
                  {post.location && (
                    <>
                      <span>•</span>
                      <MapPin className="w-3 h-3" />
                      <span className="truncate max-w-[80px]">{post.location}</span>
                    </>
                  )}
                </div>
              </div>
              {/* Three-dots menu */}
              {canDeletePost && (
                <div className="relative">
                  <button 
                    onClick={() => setShowMoreActions(!showMoreActions)}
                    className="p-2 rounded-full transition-all active:scale-95 hover:bg-muted"
                  >
                    <MoreVertical className="w-5 h-5 text-muted-foreground" />
                  </button>
                  {showMoreActions && (
                    <>
                      <div 
                        className="fixed inset-0 z-40"
                        onClick={() => setShowMoreActions(false)}
                      />
                      <div className="absolute right-0 top-full mt-1 bg-background border border-border rounded-lg shadow-lg z-50 min-w-[120px] overflow-hidden">
                        <button
                          onClick={() => {
                            setShowMoreActions(false);
                            setShowDeleteDialog(true);
                          }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-destructive hover:bg-destructive/10 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                          Delete
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
            
            {/* Caption - BEFORE the image */}
            {caption && (
              <div className="px-4 pb-3">
                <p className="text-foreground text-sm leading-relaxed break-words whitespace-pre-wrap">
                  {showFullCaption ? renderCaptionWithHashtags(caption) : renderCaptionWithHashtags(truncatedCaption)}
                </p>
                {shouldTruncateCaption && (
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowFullCaption(!showFullCaption);
                    }}
                    className="text-primary text-xs mt-1 font-medium hover:opacity-80 transition"
                  >
                    {showFullCaption ? 'less' : 'more'}
                  </button>
                )}
              </div>
            )}

            {/* Refeed/Quote indicator */}
            {isRefeed && post.original_post && (
              <div 
                className="flex items-center gap-2 mx-4 mb-3 px-2 py-1.5 bg-muted/50 rounded-lg cursor-pointer hover:bg-muted transition"
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(`/feed/post/${post.original_post.id}`);
                }}
              >
                <Repeat className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                <span className="text-xs text-muted-foreground">Refeed from</span>
                <div className="flex items-center gap-1.5">
                  <Avatar className="w-4 h-4">
                    <AvatarImage src={post.original_post.profiles?.avatar_url || ''} />
                    <AvatarFallback className="text-[8px] bg-primary text-white">
                      {post.original_post.profiles?.display_name?.[0]?.toUpperCase() || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-xs font-medium text-foreground truncate max-w-[100px]">
                    {post.original_post.profiles?.display_name || post.original_post.profiles?.username || 'User'}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* --- MEDIA SECTION (takes available space, footer sits below) --- */}
        <div className={cn(
          "relative overflow-hidden",
          isImmersiveMode ? "flex-1 h-full w-full" : "flex-1 min-h-0"
        )}>
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
                // In immersive mode, always cover full screen
                isImmersiveMode ? "object-cover" : (isLandscapeVideo ? "object-contain bg-black" : "object-cover")
              )}
              style={{ touchAction: 'manipulation', minHeight: isImmersiveMode ? '100%' : undefined, minWidth: isImmersiveMode ? '100%' : undefined }}
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
                setVideoDuration(video.duration);
              }}
              onTimeUpdate={handleTimeUpdate}
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              onContextMenu={(e) => e.preventDefault()}
              controlsList="nodownload nofullscreen noremoteplayback"
              disablePictureInPicture
            />
          )}

          {/* Image - Different layouts for Photo+ vs Video posts */}
          {hasImage && currentMediaUrl && (
            <>
              {/* Photo+ Layout: Multi-image grid within card */}
              {isPhotoTextLayout && hasMultipleMedia && !isImmersiveMode ? (
                <div className="w-full bg-card border-x border-border mx-2 px-3 py-2">
                  {/* Side-by-side grid for 2 images */}
                  <div className="flex gap-2">
                    {mediaUrls.slice(0, 2).map((url, idx) => (
                      <div 
                        key={idx} 
                        className="relative flex-1 rounded-lg overflow-hidden border border-border/50 cursor-pointer hover:brightness-95 transition-all"
                        onClick={(e) => {
                          e.stopPropagation();
                          setLightboxIndex(idx);
                          setShowLightbox(true);
                        }}
                      >
                        <img
                          src={url}
                          alt={`Image ${idx + 1}`}
                          className="w-full aspect-square object-cover transition-opacity duration-300"
                          onLoad={() => idx === 0 && setIsMediaLoaded(true)}
                          onContextMenu={(e) => e.preventDefault()}
                          draggable={false}
                        />
                        {/* Image number indicator at bottom-left */}
                        <div className="absolute bottom-2 left-2 px-1.5 py-0.5 bg-black/60 rounded text-white text-[10px] font-medium">
                          {idx + 1}/{Math.min(mediaUrls.length, 2)}
                        </div>
                      </div>
                    ))}
                  </div>
                  {/* Show indicator if more than 2 images */}
                  {mediaUrls.length > 2 && (
                    <div className="flex justify-center gap-1.5 mt-2">
                      {mediaUrls.map((_, idx) => (
                        <button
                          key={idx}
                          onClick={(e) => {
                            e.stopPropagation();
                            setLightboxIndex(idx);
                            setShowLightbox(true);
                          }}
                          className={cn(
                            "w-1.5 h-1.5 rounded-full transition-all",
                            idx < 2 ? "bg-primary" : "bg-muted-foreground/40"
                          )}
                        />
                      ))}
                    </div>
                  )}
                </div>
              ) : isPhotoTextLayout && !hasMultipleMedia && !isImmersiveMode ? (
                /* Single image in Photo+ within card */
                <div className="w-full bg-card border-x border-border mx-2 px-3 py-2">
                  <div
                    className="relative rounded-lg overflow-hidden border border-border cursor-pointer hover:brightness-95 transition-all"
                    onClick={(e) => {
                      e.stopPropagation();
                      setLightboxIndex(0);
                      setShowLightbox(true);
                    }}
                  >
                    <img
                      src={currentMediaUrl}
                      alt="Post media"
                      className="w-full object-cover transition-opacity duration-300"
                      style={{ maxHeight: '50vh' }}
                      onLoad={() => setIsMediaLoaded(true)}
                      onContextMenu={(e) => e.preventDefault()}
                      draggable={false}
                    />
                  </div>
                </div>
              ) : (
                /* Default single image display for video tab or immersive mode */
                <>
                  <img
                    src={currentMediaUrl}
                    alt="Post media"
                    className={cn(
                      "w-full h-full transition-opacity duration-300",
                      isMediaLoaded ? "opacity-100" : "opacity-0",
                      isImmersiveMode ? "object-cover" : "object-contain"
                    )}
                    style={{ minHeight: isImmersiveMode ? '100%' : undefined, minWidth: isImmersiveMode ? '100%' : undefined }}
                    onClick={(e) => {
                      // For Photo+ with images, open lightbox on tap
                      if (isPhotoTextLayout && hasImage) {
                        e.stopPropagation();
                        setLightboxIndex(currentMediaIndex);
                        setShowLightbox(true);
                      } else {
                        handleMediaTap(e);
                      }
                    }}
                    onLoad={() => setIsMediaLoaded(true)}
                    onContextMenu={(e) => e.preventDefault()}
                    draggable={false}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none" />
                </>
              )}
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

          {/* Plain text posts - Facebook-style card layout with proper margins */}
          {isEffectivelyPlainText && (
            <div className="w-full bg-card rounded-lg border border-border shadow-sm mt-14 mx-auto max-w-[430px]">
              {/* Post Header - User info */}
              <div className="flex items-center gap-3 p-4 pb-3">
                <Avatar 
                  className="w-10 h-10 cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleProfileClick();
                  }}
                >
                  <AvatarImage src={post.profiles?.avatar_url || ''} />
                  <AvatarFallback className="bg-primary text-white text-sm">{displayName[0]?.toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span 
                      className="font-semibold text-foreground text-sm cursor-pointer hover:underline"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleProfileClick();
                      }}
                    >
                      {displayName}
                    </span>
                    {user && user.id !== post.user_id && (
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          handleFollow(e);
                        }}
                        disabled={isFollowLoading}
                        className={cn(
                          "font-semibold text-xs transition",
                          isFollowing ? "text-muted-foreground hover:text-foreground" : "text-primary hover:text-primary/80",
                          isFollowLoading && "opacity-50"
                        )}
                      >
                        • {isFollowLoading ? '...' : (isFollowing ? 'Following' : 'Follow')}
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 text-muted-foreground text-xs">
                    <span>@{post.profiles?.username || 'user'}</span>
                    <span>•</span>
                    <span>{formatCompactTime(post.created_at || '')}</span>
                    {post.location && (
                      <>
                        <span>•</span>
                        <MapPin className="w-3 h-3" />
                        <span className="truncate max-w-[80px]">{post.location}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
              
              {/* Text Content */}
              <div className="px-4 pb-4">
                <p className="text-foreground text-base leading-relaxed break-words whitespace-pre-wrap">
                  {renderCaptionWithHashtags(caption)}
                </p>
              </div>
              
              {/* Divider */}
              <div className="border-t border-border mx-4" />
              
              {/* Social Buttons Row - Facebook style, evenly spaced at bottom */}
              <div className="flex items-center justify-between px-4 py-3">
                <button onClick={handleLike} className="flex items-center gap-1.5 group flex-1 justify-center">
                  <Heart className={cn("w-5 h-5 transition-transform group-active:scale-90", liked ? "text-destructive fill-destructive" : "text-muted-foreground")} />
                  <span className="text-muted-foreground text-xs font-medium">{formatCount(likesCount)}</span>
                </button>
                <button onClick={() => handleCommentsOpenChange(true)} className="flex items-center gap-1.5 group flex-1 justify-center">
                  <MessageCircle className="w-5 h-5 text-muted-foreground transition-transform group-active:scale-90" />
                  <span className="text-muted-foreground text-xs font-medium">{formatCount(commentsCount)}</span>
                </button>
                <button onClick={() => { setRefeedOpen(true); onInteractionStart?.(); }} className="flex items-center gap-1.5 group flex-1 justify-center">
                  <Repeat className="w-5 h-5 text-muted-foreground transition-transform group-active:scale-90" />
                  <span className="text-muted-foreground text-xs font-medium">{formatCount(refeedsCount)}</span>
                </button>
                <button onClick={() => { setGiftOpen(true); onInteractionStart?.(); }} className="flex items-center gap-1.5 group flex-1 justify-center">
                  <Gift className="w-5 h-5 text-muted-foreground transition-transform group-active:scale-90" />
                  <span className="text-muted-foreground text-xs font-medium">{formatCount(giftsCount)}</span>
                </button>
                <button onClick={() => { setShareOpen(true); onInteractionStart?.(); }} className="flex items-center gap-1.5 group flex-1 justify-center">
                  <Share2 className="w-5 h-5 text-muted-foreground transition-transform group-active:scale-90" />
                </button>
              </div>
              
              {/* Views count - subtle at bottom */}
              <div className="flex items-center justify-between px-4 pb-3">
                <div className="flex items-center gap-1">
                  <Eye className="w-4 h-4 text-muted-foreground/60" />
                  <span className="text-muted-foreground/60 text-xs">{formatCount(post.views_count || 0)} views</span>
                </div>
                
                {/* Promote Button */}
                {user && !isPromoted && (
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/promote/${post.id}`);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-pink-500 to-rose-500 rounded-full text-white hover:from-pink-600 hover:to-rose-600 transition-all active:scale-95 shadow-sm"
                  >
                    <TrendingUp className="w-3.5 h-3.5" />
                    <span className="text-xs font-semibold">Promote</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Gradient overlays for buttons readability - shown when NOT in immersive mode */}
          {(hasVideo || hasImage) && !isImmersiveMode && (
            <>
              <div className="absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-black/50 to-transparent pointer-events-none" />
              <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-black/80 to-transparent pointer-events-none" />
            </>
          )}

          {/* Immersive Mode: Avatar with Display Name and Username (always visible in immersive mode) */}
          {isImmersiveMode && (
            <div className="absolute top-12 left-4 z-30 flex items-center gap-2">
              <Avatar 
                className="w-10 h-10 border-2 border-white/30 cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  handleProfileClick();
                }}
              >
                <AvatarImage src={post.profiles?.avatar_url || ''} />
                <AvatarFallback className="bg-primary text-white text-xs">{displayName[0]?.toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <span 
                    className="font-bold text-sm text-white cursor-pointer" 
                    style={{ textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleProfileClick();
                    }}
                  >
                    {displayName}
                  </span>
                  {/* Follow button inline */}
                  {user && user.id !== post.user_id && (
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        handleFollow(e);
                      }}
                      disabled={isFollowLoading}
                      className={cn(
                        "font-bold text-xs transition",
                        isFollowing ? "text-white/60 hover:text-white/80" : "text-primary hover:text-primary/80",
                        isFollowLoading && "opacity-50"
                      )}
                      style={{ textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}
                    >
                      • {isFollowLoading ? '...' : (isFollowing ? 'Following' : 'Follow')}
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  <span 
                    className="text-xs text-white/70 cursor-pointer hover:text-white/90 transition"
                    style={{ textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleProfileClick();
                    }}
                  >
                    @{post.profiles?.username || 'user'}
                  </span>
                  {post.location && (
                    <>
                      <span className="text-white/50 text-xs">•</span>
                      <div className="flex items-center gap-1 text-white/60">
                        <MapPin className="w-3 h-3" />
                        <span className="text-xs truncate max-w-[100px]" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}>
                          {post.location}
                        </span>
                      </div>
                    </>
                  )}
                </div>
                {/* Refeed/Quote indicator in immersive mode */}
                {isRefeed && post.original_post && (
                  <div 
                    className="flex items-center gap-1.5 mt-1 cursor-pointer hover:opacity-80 transition"
                    onClick={(e) => {
                      e.stopPropagation();
                      const opUsername = post.original_post?.profiles?.username || post.original_post?.user_id;
                      if (opUsername) navigate(`/profile/${opUsername}`);
                    }}
                  >
                    <Repeat className="w-3 h-3 text-white/60" />
                    <span className="text-[10px] text-white/60">
                      From @{post.original_post.profiles?.username || 'user'}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Immersive Mode: Back Button to exit fullscreen */}
          {isImmersiveMode && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                exitImmersiveMode();
              }}
              className="absolute top-12 right-4 z-30 p-2 bg-black/40 backdrop-blur-sm rounded-full transition-all active:scale-95 hover:bg-black/50"
            >
              <ArrowLeft className="w-5 h-5 text-white" />
            </button>
          )}

          {/* Play/Pause Center Overlay - in normal mode: clicking enters fullscreen. In immersive mode with UI shown: toggle play/pause */}
          {hasVideo && (
            <div className={cn(
              "absolute inset-0 flex items-center justify-center pointer-events-none transition-opacity duration-300",
              // In normal mode: show when controls visible. In immersive mode: show when UI visible
              (isImmersiveMode ? showImmersiveUI : showControls) ? "opacity-100" : "opacity-0"
            )}>
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  if (isImmersiveMode) {
                    // In immersive mode, toggle play/pause
                    togglePlayPause();
                  } else {
                    // In normal mode, enter fullscreen immersive mode
                    enterImmersiveMode();
                  }
                }}
                className="w-16 h-16 bg-black/20 rounded-full backdrop-blur-md flex items-center justify-center pointer-events-auto transition-transform hover:scale-110 active:scale-95 border border-white/10"
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

          {/* Mute/Unmute Button - Only show in immersive mode (normal mode has it in the header) */}
          {hasVideo && isImmersiveMode && showImmersiveUI && (
            <button 
              onClick={toggleMute}
              className="absolute z-20 p-2 bg-black/30 backdrop-blur-sm rounded-full transition-all active:scale-95 hover:bg-black/50 top-12 right-14"
            >
              {isMuted ? (
                <VolumeX className="w-5 h-5 text-white" />
              ) : (
                <Volume2 className="w-5 h-5 text-white" />
              )}
            </button>
          )}

          {/* Promoted/Sponsored Badge - prominent indicator for boosted content */}
          {isPromoted === true && (!isImmersiveMode || showImmersiveUI) && (
            <div className="absolute top-4 left-4 z-10 flex flex-col gap-1.5">
              <Badge className="bg-gradient-to-r from-amber-500 via-orange-500 to-pink-500 backdrop-blur-md text-white text-xs font-bold px-3 py-1.5 shadow-lg border border-white/20 animate-pulse-slow">
                <Sparkles className="w-3.5 h-3.5 mr-1.5 animate-pulse" />
                Sponsored
              </Badge>
              {(boostLevel || promoterName) && (
                <div className="flex flex-wrap gap-1">
                  {boostLevel && (
                    <Badge variant="secondary" className="bg-black/40 backdrop-blur-sm text-white/90 text-[10px] px-2 py-0.5 border border-white/10">
                      {boostLevel}
                    </Badge>
                  )}
                  {promoterName && (
                    <Badge variant="secondary" className="bg-black/40 backdrop-blur-sm text-white/90 text-[10px] px-2 py-0.5 border border-white/10">
                      by {promoterName}
                    </Badge>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Caption, Music, and Promote moved to footer section below media */}

          {/* --- RIGHT SIDEBAR: Social Buttons (with collapsible "more" for long captions) --- */}
          {/* Hide for plain text posts (effectively plain text) and Photo+ layout - they have their own horizontal layout */}
          {!isEffectivelyPlainText && !isPhotoTextLayout && (!isImmersiveMode || showImmersiveUI) && (() => {
            // For videos: always show only 3 buttons (Like, Comment, Gift) by default
            // Views, Refeed, Share hidden under "more" toggle for videos
            const shouldCollapseForVideo = isVideoPost;
            const hasLongCaption = caption && countWords(caption) > 15;
            const shouldCollapse = shouldCollapseForVideo || hasLongCaption;
            return (
              <div className={cn(
                "absolute right-3 z-50 flex flex-col items-center gap-2 pointer-events-auto transition-opacity duration-200",
                isImmersiveMode ? "bottom-8" : "bottom-4",
                // In normal mode, always show. In immersive mode, show only when UI is toggled visible
                isImmersiveMode ? (showImmersiveUI ? "opacity-100" : "opacity-0 pointer-events-none") : "opacity-100"
              )}>
                {/* Like - always visible */}
                <button onClick={handleLike} className="flex flex-col items-center gap-0.5 group">
                  <div className={cn(
                    "p-1.5 rounded-full transition-all active:scale-90",
                    liked ? "bg-pink-500/90" : "bg-black/40 backdrop-blur-sm"
                  )}>
                    <Heart className={cn("w-5 h-5 transition-transform", liked ? "text-white fill-white" : "text-white")} />
                  </div>
                  <span className="text-white text-[10px] font-semibold drop-shadow-lg">{formatCount(likesCount)}</span>
                </button>

                {/* Comments - always visible */}
                <button 
                  onClick={(e) => {
                    if (isImmersiveMode) {
                      openImmersiveComments(e);
                    } else {
                      handleCommentsOpenChange(true);
                    }
                  }} 
                  className="flex flex-col items-center gap-0.5 group"
                >
                  <div className="p-1.5 bg-black/40 backdrop-blur-sm rounded-full transition-all active:scale-90">
                    <MessageCircle className="w-5 h-5 text-white" />
                  </div>
                  <span className="text-white text-[10px] font-semibold drop-shadow-lg">{formatCount(commentsCount)}</span>
                </button>

                {/* Gift - always visible */}
                <button onClick={() => { setGiftOpen(true); onInteractionStart?.(); }} className="flex flex-col items-center gap-0.5 group">
                  <div className="p-1.5 bg-black/40 backdrop-blur-sm rounded-full transition-all active:scale-90">
                    <Gift className="w-5 h-5 text-white" />
                  </div>
                  <span className="text-white text-[10px] font-semibold drop-shadow-lg">{formatCount(giftsCount)}</span>
                </button>

                {/* Collapsible buttons - show when not collapsed OR when expanded via toggle */}
                {(!shouldCollapse || showMoreActions) && (
                  <>
                    {/* Views */}
                    <div className="flex flex-col items-center gap-0.5">
                      <div className="p-1.5 bg-black/40 backdrop-blur-sm rounded-full">
                        <Eye className="w-5 h-5 text-white" />
                      </div>
                      <span className="text-white text-[10px] font-semibold drop-shadow-lg">{formatCount(post.views_count || 0)}</span>
                    </div>

                    {/* Refeed */}
                    <button onClick={() => { setRefeedOpen(true); onInteractionStart?.(); }} className="flex flex-col items-center gap-0.5 group">
                      <div className="p-1.5 bg-black/40 backdrop-blur-sm rounded-full transition-all active:scale-90">
                        <Repeat className="w-5 h-5 text-white" />
                      </div>
                      <span className="text-white text-[10px] font-semibold drop-shadow-lg">{formatCount(refeedsCount)}</span>
                    </button>

                    {/* Share */}
                    <button onClick={() => { setShareOpen(true); onInteractionStart?.(); }} className="flex flex-col items-center gap-0.5 group">
                      <div className="p-1.5 bg-black/40 backdrop-blur-sm rounded-full transition-all active:scale-90">
                        <Share2 className="w-5 h-5 text-white" />
                      </div>
                    </button>
                  </>
                )}

                {/* More/Close toggle button - show when video or long caption */}
                {shouldCollapse && (
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowMoreActions(!showMoreActions);
                    }} 
                    className="flex flex-col items-center gap-0.5 group"
                  >
                    <div className="p-1.5 bg-black/40 backdrop-blur-sm rounded-full transition-all active:scale-90">
                      {showMoreActions ? (
                        <X className="w-5 h-5 text-white" />
                      ) : (
                        <MoreHorizontal className="w-5 h-5 text-white" />
                      )}
                    </div>
                  </button>
                )}
              </div>
            );
          })()}

          {/* Immersive Mode: Caption overlay - shown when UI is visible (no avatar, just caption) */}
          {isImmersiveMode && showImmersiveUI && caption && !isTextStyled && !isPlainText && (
            <div className="absolute left-4 right-16 bottom-8 z-20 transition-opacity duration-200">
              <p className="text-white text-sm leading-snug pr-2" style={{ textShadow: '0 1px 1px rgba(0,0,0,0.15)' }}>
                {showFullCaption ? renderCaptionWithHashtags(caption) : renderCaptionWithHashtags(truncatedCaption)}
              </p>
              {shouldTruncateCaption && (
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowFullCaption(!showFullCaption);
                  }}
                  className="text-white/70 text-xs mt-1 font-medium hover:text-white transition"
                >
                  {showFullCaption ? 'less' : 'more'}
                </button>
              )}
              {/* Promote Button - always at bottom of caption area in immersive mode */}
              {user && isPromoted !== true && (
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/promote/${post.id}`);
                  }}
                  className="flex items-center gap-1.5 mt-4 px-3 py-1.5 bg-gradient-to-r from-pink-500 to-rose-500 rounded-full text-white hover:from-pink-600 hover:to-rose-600 transition-all active:scale-95 shadow-lg"
                >
                  <TrendingUp className="w-4 h-4" />
                  <span className="text-xs font-semibold">Promote</span>
                </button>
              )}
            </div>
          )}

          {/* Music indicator for immersive mode only */}
          {hasMusic && isImmersiveMode && showImmersiveUI && (
            <div className="absolute left-4 bottom-24 z-10 flex items-center gap-3 transition-opacity duration-200">
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

          {/* Immersive Mode: Video Timeline - Facebook Reels style */}
          {isImmersiveMode && hasVideo && showImmersiveUI && (
            <div className="absolute bottom-0 left-0 right-0 z-40 px-2 pb-safe">
              <div 
                ref={timelineRef}
                className="relative h-8 flex items-center cursor-pointer touch-none"
                onMouseDown={handleSeekStart}
                onMouseMove={(e) => isSeeking && handleSeek(e)}
                onMouseUp={handleSeekEnd}
                onMouseLeave={handleSeekEnd}
                onTouchStart={handleSeekStart}
                onTouchMove={(e) => isSeeking && handleSeek(e)}
                onTouchEnd={handleSeekEnd}
                onClick={(e) => e.stopPropagation()}
              >
                {/* Timeline background */}
                <div className="absolute left-0 right-0 h-1 bg-white/30 rounded-full" />
                {/* Progress bar */}
                <motion.div 
                  className="absolute left-0 h-1 bg-white rounded-full"
                  style={{ width: `${videoProgress}%` }}
                />
                {/* Seek handle */}
                <motion.div 
                  className="absolute w-3 h-3 bg-white rounded-full shadow-lg -translate-x-1/2"
                  style={{ left: `${videoProgress}%` }}
                  animate={{ scale: isSeeking ? 1.5 : 1 }}
                />
              </div>
            </div>
          )}

          {/* Immersive Mode: Draggable Comments Panel */}
          <AnimatePresence>
            {isImmersiveMode && showDraggableComments && (
              <DraggableCommentsPanel
                isOpen={showDraggableComments}
                onClose={() => setShowDraggableComments(false)}
                postId={post.id}
                onCommentAdded={() => setCommentsCount(prev => prev + 1)}
                commentsCount={commentsCount}
              />
            )}
          </AnimatePresence>
        </div>

        {/* --- FOOTER SECTION: Caption, Music, Promote (Below Media) - For Video layout only --- */}
        {!isImmersiveMode && !isTextStyled && !isPlainText && !isPhotoTextLayout && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: "easeOut", delay: 0.1 }}
            className="flex-shrink-0 bg-black px-4 py-3 z-20"
          >
            {/* Caption */}
            {caption && (
              <div className="mb-2">
                <p className="text-white text-sm leading-snug break-words">
                  {showFullCaption ? renderCaptionWithHashtags(caption) : renderCaptionWithHashtags(truncatedCaption)}
                </p>
                {shouldTruncateCaption && (
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowFullCaption(!showFullCaption);
                    }}
                    className="text-primary text-xs mt-1 font-medium hover:opacity-80 transition"
                  >
                    {showFullCaption ? 'less' : 'more'}
                  </button>
                )}
              </div>
            )}

            {/* Music Info */}
            {hasMusic && (
              <div className="flex items-center gap-3 mb-3">
                <div className="relative w-8 h-8 rounded-full bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center animate-spin" style={{ animationDuration: '3s' }}>
                  <div className="w-3 h-3 rounded-full bg-white/20" />
                  <div className="absolute inset-0 rounded-full border border-white/10" />
                </div>
                <div className="flex items-center gap-2 overflow-hidden flex-1">
                  <Music className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  <p className="text-gray-300 text-xs font-medium truncate">
                    {post.music_title || 'Original Audio'} {post.music_artist && `· ${post.music_artist}`}
                  </p>
                </div>
              </div>
            )}

            {/* Promote Button - show for all posts (own and others) except already promoted */}
            {user && isPromoted !== true && (
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(`/promote/${post.id}`);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-pink-500 to-rose-500 rounded-full text-white hover:from-pink-600 hover:to-rose-600 transition-all active:scale-95 shadow-lg"
              >
                <TrendingUp className="w-4 h-4" />
                <span className="text-xs font-semibold">Promote</span>
              </button>
            )}
          </motion.div>
        )}

        {/* --- FOOTER SECTION: Horizontal Social Buttons for Photo+ Layout - Facebook-style card footer --- */}
        {!isImmersiveMode && isPhotoTextLayout && !isEffectivelyPlainText && (
          <div className="flex-shrink-0 bg-card border-x border-b border-border rounded-b-lg mx-2">
            {/* Divider line */}
            <div className="border-t border-border mx-3" />
            
            {/* Social buttons row */}
            <div className="flex items-center justify-between px-3 py-2.5">
              <div className="flex items-center gap-4">
                {/* Like */}
                <button onClick={handleLike} className="flex items-center gap-1.5 group">
                  <Heart className={cn("w-5 h-5 transition-transform group-active:scale-90", liked ? "text-destructive fill-destructive" : "text-muted-foreground")} />
                  <span className="text-muted-foreground text-xs font-medium">{formatCount(likesCount)}</span>
                </button>
                
                {/* Comments */}
                <button onClick={() => handleCommentsOpenChange(true)} className="flex items-center gap-1.5 group">
                  <MessageCircle className="w-5 h-5 text-muted-foreground transition-transform group-active:scale-90" />
                  <span className="text-muted-foreground text-xs font-medium">{formatCount(commentsCount)}</span>
                </button>
                
                {/* Refeed */}
                <button onClick={() => { setRefeedOpen(true); onInteractionStart?.(); }} className="flex items-center gap-1.5 group">
                  <Repeat className="w-5 h-5 text-muted-foreground transition-transform group-active:scale-90" />
                  <span className="text-muted-foreground text-xs font-medium">{formatCount(refeedsCount)}</span>
                </button>

                {/* Gift */}
                <button onClick={() => { setGiftOpen(true); onInteractionStart?.(); }} className="flex items-center gap-1.5 group">
                  <Gift className="w-5 h-5 text-muted-foreground transition-transform group-active:scale-90" />
                </button>
                
                {/* Share */}
                <button onClick={() => { setShareOpen(true); onInteractionStart?.(); }} className="flex items-center gap-1.5 group">
                  <Share2 className="w-5 h-5 text-muted-foreground transition-transform group-active:scale-90" />
                </button>
              </div>

              {/* Views + Promote */}
              <div className="flex items-center gap-3">
                {/* Views */}
                <div className="flex items-center gap-1">
                  <Eye className="w-4 h-4 text-muted-foreground/60" />
                  <span className="text-muted-foreground/60 text-xs">{formatCount(post.views_count || 0)}</span>
                </div>

                {/* Promote Button */}
                {user && isPromoted !== true && (
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/promote/${post.id}`);
                    }}
                    className="flex items-center gap-1 px-2.5 py-1 bg-gradient-to-r from-pink-500 to-rose-500 rounded-full text-white hover:from-pink-600 hover:to-rose-600 transition-all active:scale-95"
                  >
                    <TrendingUp className="w-3.5 h-3.5" />
                    <span className="text-[10px] font-semibold">Promote</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
        {/* Social buttons for Plain Text are now inline within the text section above */}
      </div>

      {/* Modals */}
      <CommentsModal
        isOpen={commentsOpen}
        onClose={() => handleCommentsOpenChange(false)}
        postId={post.id}
        postData={{
          content: caption,
          media_url: currentMediaUrl,
          media_type: currentMediaType,
          profiles: post.profiles
        }}
        onCommentAdded={() => setCommentsCount(prev => prev + 1)}
        videoCurrentTime={videoRef.current?.currentTime || 0}
        isMuted={isMuted}
      />

      <MobileShareSheet
        isOpen={shareOpen}
        onClose={() => {
          setShareOpen(false);
          onInteractionEnd?.();
        }}
        postId={post.id}
        postData={{ 
          content: caption,
          media_url: currentMediaUrl,
          media_type: currentMediaType
        }}
        posterInfo={{
          displayName: displayName,
          username: username
        }}
        onSavePost={handleSave}
        isSaved={saved}
      />

      <GiftModal
        isOpen={giftOpen}
        onClose={() => {
          setGiftOpen(false);
          onInteractionEnd?.();
        }}
        recipientId={post.user_id}
        postId={post.id}
        recipientName={displayName}
      />

      <RefeedModal
        isOpen={refeedOpen}
        onClose={() => {
          setRefeedOpen(false);
          onInteractionEnd?.();
        }}
        postId={post.id}
        post={{
          id: post.id,
          content: post.content,
          media_url: currentMediaUrl || post.media_url,
          media_type: post.media_type,
          media_urls: post.media_urls,
          media_types: post.media_types,
          profiles: post.profiles
        }}
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

      {/* ImageLightbox for Photo+ posts with vertical swipe between posts */}
      {showLightbox && hasImage && mediaUrls.length > 0 && (() => {
        // Filter to Photo+ posts only (non-video) for vertical navigation
        const photoPosts = allPosts?.filter(p => {
          const pMediaType = p.media_type;
          const originalMediaType = p.original_post?.media_type;
          // Exclude video posts
          return pMediaType !== 'video' && originalMediaType !== 'video';
        }).map(p => ({
          id: p.id,
          user_id: p.user_id,
          content: p.content,
          media_url: p.media_url,
          media_urls: p.media_urls,
          likes_count: p.likes_count,
          comments_count: p.comments_count,
          refeeds_count: p.refeeds_count,
          views_count: p.views_count,
          profiles: p.profiles
        })) || [];
        
        const currentPhotoPostIndex = photoPosts.findIndex(p => p.id === post.id);
        
        return (
          <ImageLightbox
            images={mediaUrls}
            activeIndex={lightboxIndex}
            onClose={() => setShowLightbox(false)}
            onNavigate={(idx) => {
              setLightboxIndex(idx);
              setCurrentMediaIndex(idx);
            }}
            postId={post.id}
            postUserId={post.user_id}
            caption={caption}
            initialLikesCount={likesCount}
            initialCommentsCount={commentsCount}
            initialRefeedsCount={refeedsCount}
            initialGiftsCount={giftsCount}
            initialViewsCount={post.views_count || 0}
            profiles={post.profiles}
            onLikeUpdate={onLikeUpdate}
            // Multi-post vertical navigation
            allPhotoPosts={photoPosts.length > 1 ? photoPosts : undefined}
            currentPostIndex={currentPhotoPostIndex >= 0 ? currentPhotoPostIndex : 0}
            onPostChange={(idx) => {
              // Optional: Could sync back to parent if needed
            }}
          />
        );
      })()}

    </>
  );
});

export default ImmersivePostCard;
