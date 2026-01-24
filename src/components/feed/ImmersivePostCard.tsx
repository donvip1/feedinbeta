import { useState, useEffect, useRef, memo, useCallback } from 'react';
import { Heart, MessageCircle, Share2, Repeat, Gift, TrendingUp, Volume2, VolumeX, Play, Pause, Trash2, Music, Sparkles, Plus, Globe, Star, ArrowLeft, Eye, MoreHorizontal, X } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
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

  return (
    <>
      <div 
        ref={postRef}
        className={cn(
          "relative w-full max-w-[430px] mx-auto bg-black overflow-hidden rounded-none sm:rounded-2xl flex flex-col transition-all duration-300",
          // In immersive mode, card takes full viewport height but stays in scroll flow
          // In normal mode with video, reduce height to leave room for caption + compact nav (28px)
          isImmersiveMode ? "h-[100dvh] max-w-none" : (hasVideo && caption && !isTextStyled && !isPlainText ? "h-[calc(100dvh-95px)]" : "h-[calc(100dvh-35px)]")
        )}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {/* --- TOP SECTION: User Info & Caption (NOT overlayed) - Hidden in immersive mode --- */}
        {!isImmersiveMode && (
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
                          isFollowing ? "text-gray-400 hover:text-gray-300" : "text-blue-400 hover:text-blue-300",
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
                  <div className="flex items-center gap-1.5 text-xs text-gray-400">
                    <Globe className="w-2.5 h-2.5" />
                    <span>Public</span>
                    <span className="text-gray-500">•</span>
                    <span>{formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}</span>
                  </div>
                </div>
              </div>
              {/* Delete button - only show for post owner/admin */}
              {canDeletePost && (
                <button 
                  onClick={() => setShowDeleteDialog(true)}
                  className="p-2 rounded-full transition-all active:scale-95 hover:bg-white/10"
                >
                  <Trash2 className="w-5 h-5 text-destructive" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* --- MEDIA SECTION (takes full screen in immersive mode) --- */}
        <div className={cn(
          "relative overflow-hidden",
          isImmersiveMode ? "flex-1 h-full w-full" : "flex-1"
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

          {/* Image */}
          {hasImage && currentMediaUrl && (
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

          {/* Immersive Mode: Only Avatar Overlay (always visible in immersive mode) */}
          {isImmersiveMode && (
            <div className="absolute top-12 left-4 z-30">
              <Avatar 
                className="w-8 h-8 border-2 border-white/30 cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  handleProfileClick();
                }}
              >
                <AvatarImage src={post.profiles?.avatar_url || ''} />
                <AvatarFallback className="bg-primary text-white text-xs">{displayName[0]?.toUpperCase()}</AvatarFallback>
              </Avatar>
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
                className="w-16 h-16 bg-black/10 rounded-full backdrop-blur-xl flex items-center justify-center pointer-events-auto transition-transform hover:scale-110 active:scale-95 border border-white/5"
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

          {/* Promoted Badge - hidden in immersive mode, or shown when immersive UI is visible */}
          {isPromoted && (!isImmersiveMode || showImmersiveUI) && (
            <div className="absolute top-4 left-4 z-10">
              <Badge className="bg-pink-500/90 backdrop-blur-sm text-white text-xs font-semibold">
                <Sparkles className="w-3 h-3 mr-1" />
                Sponsored
              </Badge>
            </div>
          )}

          {/* --- CAPTION OVERLAY with Promote Button (positioned at bottom left) --- */}
          {/* For VIDEO posts in NORMAL mode: caption will be rendered OUTSIDE the card, below it */}
          {/* For IMAGE/OTHER posts in NORMAL mode: keep caption overlaid */}
          {!isImmersiveMode && caption && !isTextStyled && !isPlainText && !hasVideo && (
            <div className="absolute left-4 right-16 bottom-4 z-10 transition-opacity duration-200 pr-2">
              <p className="text-white text-sm leading-snug break-words" style={{ textShadow: '0 1px 1px rgba(0,0,0,0.15)' }}>
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
              {/* Promote Button - always at bottom of caption area */}
              {user && !isPromoted && (
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/promote/${post.id}`);
                  }}
                  className="flex items-center gap-1.5 mt-4 px-3 py-1.5 bg-gradient-to-r from-pink-500 to-purple-500 rounded-full transition-all active:scale-95 hover:opacity-90"
                >
                  <TrendingUp className="w-4 h-4 text-white" />
                  <span className="text-white text-xs font-semibold">Promote</span>
                </button>
              )}
            </div>
          )}

          {/* Promote Button for posts without caption */}
          {!isImmersiveMode && (!caption || isTextStyled || isPlainText) && user && !isPromoted && (
            <div className="absolute left-4 bottom-4 z-10">
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(`/promote/${post.id}`);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-pink-500 to-purple-500 rounded-full transition-all active:scale-95 hover:opacity-90"
              >
                <TrendingUp className="w-4 h-4 text-white" />
                <span className="text-white text-xs font-semibold">Promote</span>
              </button>
            </div>
          )}

          {/* --- RIGHT SIDEBAR: Social Buttons (with collapsible "more" for long captions) --- */}
          {(!isImmersiveMode || showImmersiveUI) && (() => {
            const hasLongCaption = caption && countWords(caption) > 15;
            return (
              <div className={cn(
                "absolute right-3 z-50 flex flex-col items-center gap-2 pointer-events-auto transition-opacity duration-200",
                isImmersiveMode ? "bottom-8" : "bottom-4",
                (isImmersiveMode ? showImmersiveUI : showControls) ? "opacity-100" : "opacity-0 pointer-events-none"
              )}>
                {/* Like - always visible */}
                <button onClick={handleLike} className="flex flex-col items-center gap-0.5 group">
                  <div className="p-1.5 transition-all active:scale-90" style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.15))' }}>
                    <Heart className={cn("w-5 h-5 transition-transform", liked ? "text-pink-500 fill-pink-500" : "text-white")} />
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
                  <div className="p-1.5 transition-all active:scale-90" style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.15))' }}>
                    <MessageCircle className="w-5 h-5 text-white" />
                  </div>
                  <span className="text-white text-[10px] font-semibold drop-shadow-lg">{formatCount(commentsCount)}</span>
                </button>

                {/* Gift - always visible */}
                <button onClick={() => { setGiftOpen(true); onInteractionStart?.(); }} className="flex flex-col items-center gap-0.5 group">
                  <div className="p-1.5 transition-all active:scale-90" style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.15))' }}>
                    <Gift className="w-5 h-5 text-white" />
                  </div>
                  <span className="text-white text-[10px] font-semibold drop-shadow-lg">{formatCount(giftsCount)}</span>
                </button>

                {/* Collapsible buttons - show when no long caption OR when expanded */}
                {(!hasLongCaption || showMoreActions) && (
                  <>
                    {/* Views */}
                    <div className="flex flex-col items-center gap-0.5">
                      <div className="p-1.5" style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.15))' }}>
                        <Eye className="w-5 h-5 text-white" />
                      </div>
                      <span className="text-white text-[10px] font-semibold drop-shadow-lg">{formatCount(post.views_count || 0)}</span>
                    </div>

                    {/* Refeed */}
                    <button onClick={() => { setRefeedOpen(true); onInteractionStart?.(); }} className="flex flex-col items-center gap-0.5 group">
                      <div className="p-1.5 transition-all active:scale-90" style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.15))' }}>
                        <Repeat className="w-5 h-5 text-white" />
                      </div>
                      <span className="text-white text-[10px] font-semibold drop-shadow-lg">{formatCount(refeedsCount)}</span>
                    </button>

                    {/* Share */}
                    <button onClick={() => { setShareOpen(true); onInteractionStart?.(); }} className="flex flex-col items-center gap-0.5 group">
                      <div className="p-1.5 transition-all active:scale-90" style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.15))' }}>
                        <Share2 className="w-5 h-5 text-white" />
                      </div>
                    </button>
                  </>
                )}

                {/* More/Close toggle button - only show when caption is long */}
                {hasLongCaption && (
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowMoreActions(!showMoreActions);
                    }} 
                    className="flex flex-col items-center gap-0.5 group"
                  >
                    <div className="p-1.5 transition-all active:scale-90" style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.15))' }}>
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

          {/* Immersive Mode: Caption overlay - shown when UI is visible */}
          {isImmersiveMode && showImmersiveUI && caption && !isTextStyled && !isPlainText && (
            <div className="absolute left-4 right-16 bottom-8 z-20 transition-opacity duration-200">
              <div className="flex items-center gap-2 mb-2" onClick={handleProfileClick}>
                <Avatar className="w-8 h-8 cursor-pointer border border-white/30">
                  <AvatarImage src={post.profiles?.avatar_url || ''} />
                  <AvatarFallback className="bg-primary text-white text-xs">{displayName[0]?.toUpperCase()}</AvatarFallback>
                </Avatar>
                <span className="text-white font-bold text-sm cursor-pointer" style={{ textShadow: '0 1px 1px rgba(0,0,0,0.15)' }}>{displayName}</span>
              </div>
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
              {user && !isPromoted && (
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/promote/${post.id}`);
                  }}
                  className="flex items-center gap-1.5 mt-4 px-3 py-1.5 bg-gradient-to-r from-pink-500 to-purple-500 rounded-full transition-all active:scale-95 hover:opacity-90"
                >
                  <TrendingUp className="w-4 h-4 text-white" />
                  <span className="text-white text-xs font-semibold">Promote</span>
                </button>
              )}
            </div>
          )}

          {/* Bottom Left - Music indicator - hidden in immersive mode, or shown when immersive UI is visible */}
          {hasMusic && (!isImmersiveMode || showImmersiveUI) && (
            <div className={cn(
              "absolute left-4 z-10 flex items-center gap-3 transition-opacity duration-200",
              isImmersiveMode ? "bottom-24" : "bottom-4",
              (isImmersiveMode ? showImmersiveUI : true) ? "opacity-100" : "opacity-0"
            )}>
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
            <div className="flex items-center gap-3 mt-2">
              <button onClick={handleLike} className="flex items-center gap-1 group">
                <Heart className={cn("w-4 h-4 transition-transform group-active:scale-90", liked ? "text-destructive fill-destructive" : "text-muted-foreground")} />
                <span className="text-muted-foreground text-xs font-semibold">{formatCount(likesCount)}</span>
              </button>
              <button onClick={() => handleCommentsOpenChange(true)} className="flex items-center gap-1 group">
                <MessageCircle className="w-4 h-4 text-muted-foreground transition-transform group-active:scale-90" />
                <span className="text-muted-foreground text-xs font-semibold">{formatCount(commentsCount)}</span>
              </button>
              <div className="flex items-center gap-1">
                <Eye className="w-4 h-4 text-muted-foreground" />
                <span className="text-muted-foreground text-xs font-semibold">{formatCount(post.views_count || 0)}</span>
              </div>
              <button onClick={() => { setRefeedOpen(true); onInteractionStart?.(); }} className="flex items-center gap-1 group">
                <Repeat className="w-4 h-4 text-muted-foreground transition-transform group-active:scale-90" />
                <span className="text-muted-foreground text-xs font-semibold">{formatCount(refeedsCount)}</span>
              </button>
              <button onClick={() => { setGiftOpen(true); onInteractionStart?.(); }} className="flex items-center gap-1 group">
                <Gift className="w-4 h-4 text-muted-foreground transition-transform group-active:scale-90" />
                <span className="text-muted-foreground text-xs font-semibold">{formatCount(giftsCount)}</span>
              </button>
              <button onClick={() => { setShareOpen(true); onInteractionStart?.(); }} className="group">
                <Share2 className="w-4 h-4 text-muted-foreground transition-transform group-active:scale-90" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Caption BELOW the video card in normal mode - sits above nav bar */}
      {!isImmersiveMode && hasVideo && caption && !isTextStyled && !isPlainText && (
        <div className="w-full max-w-[430px] mx-auto px-4 py-3 bg-background">
          <p className="text-foreground text-sm leading-snug break-words">
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
          {/* Promote Text Link */}
          {user && !isPromoted && (
            <span 
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/promote/${post.id}`);
              }}
              className="inline-block mt-2 text-pink-500 text-xs font-semibold cursor-pointer hover:opacity-80 transition-opacity"
              style={{ textShadow: '0 0 8px rgba(236, 72, 153, 0.5)' }}
            >
              Promote
            </span>
          )}
        </div>
      )}

      {/* Modals */}
      <CommentsModal
        isOpen={commentsOpen}
        onClose={() => handleCommentsOpenChange(false)}
        postId={post.id}
        onCommentAdded={() => setCommentsCount(prev => prev + 1)}
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
