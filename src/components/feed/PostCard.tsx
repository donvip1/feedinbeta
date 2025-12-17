import { useState, useEffect, useRef } from 'react';
import { Heart, MessageCircle, Share2, Eye, MoreVertical, Repeat, Gift, TrendingUp, MapPin, Maximize, Volume2, VolumeX, Play, Pause, Trash2, X, Bookmark } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import CommentsModal from './CommentsModal';
import ShareModal from './ShareModal';
import GiftModal from './GiftModal';
import RefeedModal from './RefeedModal';
import CaptionText from './CaptionText';
import FullscreenMediaViewer from './FullscreenMediaViewer';

interface PostCardProps {
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
    original_post?: {
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
    } | null;
    profiles?: {
      username: string | null;
      display_name: string | null;
      avatar_url: string | null;
    };
  };
  allPosts?: any[];
  onLikeUpdate?: () => void;
  onCommentsOpenChange?: (open: boolean) => void;
  onInteractionStart?: () => void;
  onInteractionEnd?: () => void;
}

export default function PostCard({ post, allPosts = [], onLikeUpdate, onCommentsOpenChange, onInteractionStart, onInteractionEnd }: PostCardProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [liked, setLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(post.likes_count || 0);
  const [commentsCount, setCommentsCount] = useState(post.comments_count || 0);
  const [refeedsCount, setRefeedsCount] = useState(post.refeeds_count || 0);
  const [saved, setSaved] = useState(false);
  const [hasViewed, setHasViewed] = useState(false);
  const [showFullCaption, setShowFullCaption] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);

  const handleCommentsOpenChange = (open: boolean) => {
    setCommentsOpen(open);
    onCommentsOpenChange?.(open);
    if (open) {
      onInteractionStart?.();
    } else {
      onInteractionEnd?.();
    }
  };
  const [shareOpen, setShareOpen] = useState(false);
  const [giftOpen, setGiftOpen] = useState(false);
  const [refeedOpen, setRefeedOpen] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showPlayIcon, setShowPlayIcon] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showFullscreenViewer, setShowFullscreenViewer] = useState(false);
  const [currentMediaIndex, setCurrentMediaIndex] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const currentVideoTime = useRef(0);
  const touchStartX = useRef<number>(0);
  const touchEndX = useRef<number>(0);

  // Determine if this post has multiple media
  const mediaUrls = post.media_urls && post.media_urls.length > 0 ? post.media_urls : (post.media_url ? [post.media_url] : []);
  const mediaTypes = post.media_types && post.media_types.length > 0 ? post.media_types : (post.media_type ? [post.media_type] : []);
  const hasMultipleMedia = mediaUrls.length > 1;
  const currentMediaUrl = mediaUrls[currentMediaIndex];
  const currentMediaType = mediaTypes[currentMediaIndex];

  const displayName = post.profiles?.display_name || post.profiles?.username || 'Anonymous';
  const username = post.profiles?.username || 'user';

  const handleSwipe = () => {
    const swipeThreshold = 50;
    const swipeDistance = touchStartX.current - touchEndX.current;

    if (Math.abs(swipeDistance) > swipeThreshold) {
      if (swipeDistance > 0 && currentMediaIndex < mediaUrls.length - 1) {
        // Swipe left - next media
        setCurrentMediaIndex(prev => prev + 1);
      } else if (swipeDistance < 0 && currentMediaIndex > 0) {
        // Swipe right - previous media
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
          supabase
            .from('post_likes')
            .select('id')
            .eq('post_id', post.id)
            .eq('user_id', user.id)
            .single(),
          supabase
            .from('saved_posts')
            .select('id')
            .eq('post_id', post.id)
            .eq('user_id', user.id)
            .single()
        ]);

        setLiked(!!likeCheck.data);
        setSaved(!!saveCheck.data);
      } catch (error) {
        // Errors expected when not liked/saved
      }
    };

    checkStatus();
  }, [user, post.id]);

  // Track if post is visible using Intersection Observer
  const postRef = useRef<HTMLDivElement>(null);
  
  // Record view only when post is actually visible on screen
  useEffect(() => {
    // Don't record if: no user, already viewed, or user is the post creator
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
            observer.disconnect();
          } catch (error) {
            // Likely duplicate view, ignore
          }
        }
      },
      { threshold: 0.5 } // Post must be 50% visible
    );
    
    if (postRef.current) {
      observer.observe(postRef.current);
    }
    
    return () => observer.disconnect();
  }, [user, post.id, post.user_id, hasViewed]);

  // Listen for fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  // Real-time subscription for post count updates
  useEffect(() => {
    const channel = supabase
      .channel(`post-counts-${post.id}`)
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

    return () => {
      supabase.removeChannel(channel);
    };
  }, [post.id]);

  const togglePlayPause = () => {
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

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const toggleFullscreen = () => {
    // Save current video time and pause the feed video
    // Check both regular video posts AND refeed/quote posts with video original_post
    const isRefeedVideo = (post.post_type === 'refeed' || post.post_type === 'quote') && 
                          post.original_post?.media_type === 'video';
    const isRegularVideo = currentMediaType === 'video';
    
    if (videoRef.current && (isRegularVideo || isRefeedVideo)) {
      currentVideoTime.current = videoRef.current.currentTime;
      videoRef.current.pause();
      setIsPlaying(false);
    }
    setShowFullscreenViewer(true);
    onInteractionStart?.();
  };

  const handleProfileClick = () => {
    navigate(`/profile/${post.user_id}`);
  };

  const handleDeletePost = async () => {
    try {
      const { error } = await supabase
        .from('posts')
        .delete()
        .eq('id', post.id);

      if (error) throw error;

      toast({
        title: 'Post deleted',
        description: 'Your post has been deleted successfully',
      });

      onLikeUpdate?.();
    } catch (error) {
      console.error('Error deleting post:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete post',
        variant: 'destructive',
      });
    }
    setShowDeleteDialog(false);
  };

  const canDeletePost = user && (user.id === post.user_id);

  const handleLike = async () => {
    if (!user) {
      toast({
        title: 'Sign in required',
        description: 'Please sign in to like posts',
        variant: 'destructive',
      });
      return;
    }

    try {
      if (liked) {
        await supabase
          .from('post_likes')
          .delete()
          .eq('post_id', post.id)
          .eq('user_id', user.id);
        setLikesCount(prev => prev - 1);
        setLiked(false);
      } else {
        await supabase.from('post_likes').insert({
          post_id: post.id,
          user_id: user.id,
        });
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
      toast({
        title: 'Sign in required',
        description: 'Please sign in to save posts',
        variant: 'destructive',
      });
      return;
    }

    try {
      if (saved) {
        await supabase
          .from('saved_posts')
          .delete()
          .eq('post_id', post.id)
          .eq('user_id', user.id);
        setSaved(false);
        toast({
          title: 'Post unsaved',
          description: 'Post removed from your saved items',
        });
      } else {
        await supabase.from('saved_posts').insert({
          post_id: post.id,
          user_id: user.id,
        });
        setSaved(true);
        toast({
          title: 'Post saved',
          description: 'Post added to your saved items',
        });
      }
      onLikeUpdate?.();
    } catch (error) {
      console.error('Error toggling save:', error);
      toast({
        title: 'Error',
        description: 'Failed to save post',
        variant: 'destructive',
      });
    }
  };

  return (
    <>
      <div ref={postRef} className="mb-4 snap-start snap-always w-full px-4 py-2">
        {/* Refeed/Quote Refeed indicator */}
        {(post.post_type === 'refeed' || post.post_type === 'quote') && (
          <div className="flex items-center gap-1.5 mb-2 px-1">
            <Repeat className="w-3.5 h-3.5 text-muted-foreground/70" />
            <span className="text-xs font-medium text-muted-foreground/70">
              Refeed
            </span>
          </div>
        )}

        {/* Header - Outside card */}
        <div className="flex items-center justify-between mb-2 px-1">
          <div 
            className="flex items-center gap-3 cursor-pointer"
            onClick={handleProfileClick}
          >
            <Avatar className="w-10 h-10">
              <AvatarImage src={post.profiles?.avatar_url || ''} />
              <AvatarFallback>{displayName[0]?.toUpperCase()}</AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <p className="font-semibold text-sm">{displayName}</p>
                <span className="text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">@{username}</p>
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="p-2 hover:bg-muted rounded-full">
                <MoreVertical className="w-5 h-5 text-muted-foreground" />
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

        {/* Caption - Outside card (only for regular posts, not styled text, not refeeds, not quotes) */}
        {post.content && post.media_type !== 'text_styled' && post.post_type !== 'refeed' && post.post_type !== 'quote' && (
          <div className="mb-2 px-1">
            <CaptionText
              text={post.content}
              showMore={showFullCaption}
              onToggleMore={() => setShowFullCaption(!showFullCaption)}
            />
          </div>
        )}

        {/* Quote post caption - only for quote posts */}
        {post.post_type === 'quote' && post.content && (
          <div className="mb-2 px-1">
            <CaptionText
              text={post.content}
              showMore={showFullCaption}
              onToggleMore={() => setShowFullCaption(!showFullCaption)}
            />
          </div>
        )}

        {/* Location - Outside card */}
        {post.location && (
          <div className="mb-2 px-1 flex items-center gap-1">
            <MapPin className="w-3 h-3 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">{post.location}</p>
          </div>
        )}

        {/* Original post for refeeds and quotes - Clickable */}
        {(post.post_type === 'refeed' || post.post_type === 'quote') && post.original_post && (
          <div className="border rounded-2xl p-3 bg-muted/30 mb-2">
            <div 
              className="flex items-center gap-2 mb-2 cursor-pointer"
              onClick={() => navigate(`/post/${post.original_post.id}`)}
            >
              <Avatar 
                className="w-6 h-6 cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  if (post.original_post?.user_id) {
                    navigate(`/profile/${post.original_post.user_id}`);
                  }
                }}
              >
                <AvatarImage src={post.original_post.profiles?.avatar_url || ''} />
                <AvatarFallback className="text-xs">
                  {post.original_post.profiles?.display_name?.[0]}
                </AvatarFallback>
              </Avatar>
              <span 
                className="text-sm font-semibold cursor-pointer hover:underline"
                onClick={(e) => {
                  e.stopPropagation();
                  if (post.original_post?.user_id) {
                    navigate(`/profile/${post.original_post.user_id}`);
                  }
                }}
              >
                {post.original_post.profiles?.display_name}
              </span>
              <span className="text-xs text-muted-foreground">
                @{post.original_post.profiles?.username}
              </span>
            </div>
            {post.original_post.content && (
              <p 
                className="text-sm mb-2 line-clamp-3 cursor-pointer"
                onClick={() => navigate(`/post/${post.original_post.id}`)}
              >
                {post.original_post.content}
              </p>
            )}
            {post.original_post.media_url && (
              post.original_post.media_type === 'video' ? (
                <div className="relative rounded-lg overflow-hidden h-[55vh]">
                  <video 
                    ref={videoRef}
                    src={post.original_post.media_url} 
                    className="rounded-lg w-full h-full object-cover"
                    muted={isMuted}
                    playsInline
                    loop
                    onClick={(e) => {
                      e.stopPropagation();
                      togglePlayPause();
                    }}
                    onPlay={() => setIsPlaying(true)}
                    onPause={() => setIsPlaying(false)}
                  />
                  {/* Play/Pause overlay */}
                  {showPlayIcon && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="bg-black/50 rounded-full p-4">
                        {isPlaying ? (
                          <Pause className="w-8 h-8 text-white" />
                        ) : (
                          <Play className="w-8 h-8 text-white" />
                        )}
                      </div>
                    </div>
                  )}
                  {/* Video controls */}
                  <div className="absolute bottom-2 left-2 right-2 flex justify-between items-center">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleMute();
                      }}
                      className="p-2 bg-black/50 rounded-full"
                    >
                      {isMuted ? (
                        <VolumeX className="w-4 h-4 text-white" />
                      ) : (
                        <Volume2 className="w-4 h-4 text-white" />
                      )}
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleFullscreen();
                      }}
                      className="p-2 bg-black/50 rounded-full"
                    >
                      <Maximize className="w-4 h-4 text-white" />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="relative rounded-lg overflow-hidden h-[55vh]">
                  <img 
                    src={post.original_post.media_url} 
                    alt="Original post" 
                    className="w-full h-full object-cover cursor-pointer"
                    onClick={() => navigate(`/post/${post.original_post.id}`)}
                  />
                </div>
              )
            )}
          </div>
        )}

        {/* Text posts with styled background (gradient/solid) */}
        {!post.media_url && post.content && post.post_type !== 'refeed' && post.post_type !== 'quote' ? (
          // Plain text post without background - just show content
          null
        ) : post.media_type === 'text_styled' && post.media_url && post.content ? (
          // Styled text post with background
          <div className={`${post.media_url} rounded-lg overflow-hidden border border-border relative`}>
            <div className="w-full h-[55vh] flex items-center justify-center p-8">
              <p className="text-white text-2xl md:text-3xl font-bold text-center leading-relaxed">
                {post.content}
              </p>
            </div>
          </div>
        ) : (post.post_type !== 'refeed' && post.post_type !== 'quote') && currentMediaUrl && post.media_type !== 'text_styled' ? (
          // Regular post with media (NOT refeed/quote - those show media in original_post preview only)
          <div 
            className="bg-card rounded-lg overflow-hidden border border-border relative"
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
          >
            <div className="w-full relative group h-[55vh]" id={`media-${post.id}`}>
              {/* Media Counter */}
              {hasMultipleMedia && (
                <div className="absolute top-3 right-3 z-20 bg-black/60 backdrop-blur-sm text-white text-xs px-2.5 py-1 rounded-full font-medium">
                  {currentMediaIndex + 1}/{mediaUrls.length}
                </div>
              )}

              {currentMediaType === 'image' ? (
                <>
                  <img
                    src={currentMediaUrl}
                    alt="Post content"
                    className="w-full h-full object-cover"
                    onContextMenu={(e) => e.preventDefault()}
                  />
                  {/* Fullscreen button for images */}
                  <button
                    onClick={toggleFullscreen}
                    className="absolute bottom-4 right-4 p-2 bg-black/50 rounded-full text-white hover:bg-black/70 transition-all z-10"
                  >
                    <Maximize className="w-5 h-5" />
                  </button>
                </>
              ) : (
                <>
                  <video
                    ref={videoRef}
                    src={currentMediaUrl}
                    className="w-full h-full object-cover"
                    playsInline
                    autoPlay
                    muted={isMuted}
                    loop
                    onClick={togglePlayPause}
                    onPlay={() => setIsPlaying(true)}
                    onPause={() => setIsPlaying(false)}
                    onContextMenu={(e) => e.preventDefault()}
                    controlsList="nodownload nofullscreen noremoteplayback"
                    disablePictureInPicture
                  />
                  
                  {/* Play/Pause icon in center */}
                  {showPlayIcon && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="bg-black/30 rounded-full p-6 animate-scale-in">
                        {isPlaying ? (
                          <Pause className="w-12 h-12 text-white" fill="white" />
                        ) : (
                          <Play className="w-12 h-12 text-white" fill="white" />
                        )}
                      </div>
                    </div>
                  )}

                  {/* Video controls */}
                  <div className="absolute bottom-4 left-4 right-4 flex justify-between z-10">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleMute();
                      }}
                      className="p-2 bg-black/50 rounded-full text-white hover:bg-black/70 transition-all"
                    >
                      {isMuted ? (
                        <VolumeX className="w-5 h-5" />
                      ) : (
                        <Volume2 className="w-5 h-5" />
                      )}
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleFullscreen();
                      }}
                      className="p-2 bg-black/50 rounded-full text-white hover:bg-black/70 transition-all"
                    >
                      <Maximize className="w-5 h-5" />
                    </button>
                  </div>
                </>
              )}

              {/* Navigation Dots for Multiple Media */}
              {hasMultipleMedia && (
                <div className="absolute bottom-12 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
                  {mediaUrls.map((_, index) => (
                    <button
                      key={index}
                      onClick={() => setCurrentMediaIndex(index)}
                      className={`w-1.5 h-1.5 rounded-full transition-all ${
                        index === currentMediaIndex ? 'bg-white w-4' : 'bg-white/50'
                      }`}
                      aria-label={`Go to media ${index + 1}`}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : null}

        {/* Actions - Outside below card */}
        <div className="px-1 py-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1">
              <button
                onClick={handleLike}
                className="p-2 hover:bg-muted rounded-full transition-colors"
              >
                <Heart
                  className={`w-4 h-4 ${liked ? 'fill-red-500 text-red-500' : ''}`}
                />
              </button>
              <span className="text-sm">{likesCount}</span>

              <button
                onClick={() => handleCommentsOpenChange(true)}
                className="p-2 hover:bg-muted rounded-full transition-colors ml-2"
              >
                <MessageCircle className="w-4 h-4" />
              </button>
              <span className="text-sm">{commentsCount}</span>

              <button className="p-2 hover:bg-muted rounded-full transition-colors ml-2">
                <Eye className="w-4 h-4" />
              </button>
              <span className="text-sm">{post.views_count || 0}</span>

              <button
                onClick={() => {
                  setRefeedOpen(true);
                  onInteractionStart?.();
                }}
                className="p-2 hover:bg-muted rounded-full transition-colors ml-2"
              >
                <Repeat className="w-4 h-4" />
              </button>
              <span className="text-sm">{refeedsCount}</span>

              <button
                onClick={() => {
                  setGiftOpen(true);
                  onInteractionStart?.();
                }}
                className="p-2 hover:bg-muted rounded-full transition-colors"
              >
                <Gift className="w-4 h-4" />
              </button>

              <button
                onClick={() => {
                  setShareOpen(true);
                  onInteractionStart?.();
                }}
                className="p-2 hover:bg-muted rounded-full transition-colors"
              >
                <Share2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Promote button on separate line */}
          <button 
            onClick={() => navigate(`/promote/${post.id}`)}
            className="mt-2 flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors"
          >
            <TrendingUp className="w-4 h-4" />
            <span>Promote</span>
          </button>
        </div>
      </div>

      {/* Modals */}
      <CommentsModal
        isOpen={commentsOpen}
        onClose={() => handleCommentsOpenChange(false)}
        postId={post.id}
        postData={{
          content: post.content,
          media_url: post.media_url,
          media_type: post.media_type,
          profiles: post.profiles,
        }}
        onCommentAdded={() => setCommentsCount(prev => prev + 1)}
      />
      <ShareModal
        isOpen={shareOpen}
        onClose={() => {
          setShareOpen(false);
          onInteractionEnd?.();
        }}
        postId={post.id}
        postData={{
          media_url: post.media_url,
          media_type: post.media_type,
          content: post.content,
        }}
      />
      <GiftModal
        isOpen={giftOpen}
        onClose={() => {
          setGiftOpen(false);
          onInteractionEnd?.();
        }}
        postId={post.id}
        recipientId={post.user_id}
      />
      <RefeedModal
        isOpen={refeedOpen}
        onClose={() => {
          setRefeedOpen(false);
          onInteractionEnd?.();
        }}
        postId={post.id}
        post={post}
        onRefeedAdded={() => setRefeedsCount(prev => prev + 1)}
      />

      {/* Delete Confirmation Dialog */}
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
            <AlertDialogAction onClick={handleDeletePost} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Fullscreen Media Viewer */}
      <FullscreenMediaViewer
        post={(post.post_type === 'refeed' || post.post_type === 'quote') && post.original_post ? {
          id: post.original_post.id,
          user_id: post.original_post.user_id,
          content: post.original_post.content,
          media_url: post.original_post.media_url,
          media_type: post.original_post.media_type,
          created_at: post.original_post.created_at,
          likes_count: post.likes_count || 0,
          comments_count: post.comments_count || 0,
          refeeds_count: post.refeeds_count || 0,
          profiles: post.original_post.profiles
        } : {
          ...post,
          likes_count: post.likes_count || 0,
          comments_count: post.comments_count || 0,
          refeeds_count: post.refeeds_count || 0
        }}
        allPosts={allPosts.map(p => ({
          ...p,
          likes_count: p.likes_count || 0,
          comments_count: p.comments_count || 0,
          refeeds_count: p.refeeds_count || 0
        }))}
        isOpen={showFullscreenViewer}
        onClose={() => {
          setShowFullscreenViewer(false);
          // Resume the feed video if it was playing (including refeed videos)
          const isRefeedVideo = (post.post_type === 'refeed' || post.post_type === 'quote') && 
                                post.original_post?.media_type === 'video';
          const isRegularVideo = currentMediaType === 'video';
          
          if (videoRef.current && (isRegularVideo || isRefeedVideo)) {
            videoRef.current.currentTime = currentVideoTime.current;
            videoRef.current.play().catch(() => {});
          }
          onInteractionEnd?.();
        }}
        initialTime={currentVideoTime.current}
        initialMuted={isMuted}
        onOpenComments={() => {
          setShowFullscreenViewer(false);
          setCommentsOpen(true);
        }}
        onOpenRefeed={() => {
          setShowFullscreenViewer(false);
          setRefeedOpen(true);
        }}
        onOpenGift={() => {
          setShowFullscreenViewer(false);
          setGiftOpen(true);
        }}
        onOpenShare={() => {
          setShowFullscreenViewer(false);
          setShareOpen(true);
        }}
      />
    </>
  );
}
