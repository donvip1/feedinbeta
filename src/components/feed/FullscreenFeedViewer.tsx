import { useState, useEffect, useRef, useCallback, memo } from 'react';
import { ArrowLeft, Heart, MessageCircle, Share2, Repeat, Gift, Volume2, VolumeX, Play, Pause, Bookmark, Music, TrendingUp } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import DraggableCommentsPanel from './DraggableCommentsPanel';
import ShareModal from './ShareModal';
import GiftModal from './GiftModal';
import RefeedModal from './RefeedModal';
import { tailwindGradientToCSS } from '@/lib/tailwind-gradient-utils';
import { cn } from '@/lib/utils';

interface Post {
  id: string;
  user_id: string;
  content: string | null;
  media_url: string | null;
  media_type: string | null;
  media_urls?: string[] | null;
  media_types?: string[] | null;
  created_at: string;
  likes_count?: number | null;
  comments_count?: number | null;
  views_count?: number | null;
  refeeds_count?: number | null;
  gifts_count?: number | null;
  music_title?: string | null;
  music_artist?: string | null;
  music_url?: string | null;
  post_type?: string | null;
  original_post?: any;
  profiles?: {
    username: string | null;
    display_name: string | null;
    avatar_url: string | null;
  };
}

interface FullscreenFeedViewerProps {
  isOpen: boolean;
  onClose: () => void;
  initialPost: Post;
  allPosts: Post[];
  initialVideoTime?: number;
  initialMuted?: boolean;
  onExitWithState?: (postId: string, currentTime: number) => void;
}

const formatCount = (count: number): string => {
  if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
  if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
  return count.toString();
};

const FullscreenFeedViewer = memo(function FullscreenFeedViewer({
  isOpen,
  onClose,
  initialPost,
  allPosts,
  initialVideoTime = 0,
  initialMuted = true,
  onExitWithState
}: FullscreenFeedViewerProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();

  // Find initial index
  const initialIndex = allPosts.findIndex(p => p.id === initialPost.id);
  const [currentIndex, setCurrentIndex] = useState(initialIndex >= 0 ? initialIndex : 0);
  const [isMuted, setIsMuted] = useState(initialMuted);
  const [showUI, setShowUI] = useState(false);
  const [showComments, setShowComments] = useState(false);
  
  // Per-post states
  const [likedPosts, setLikedPosts] = useState<Set<string>>(new Set());
  const [savedPosts, setSavedPosts] = useState<Set<string>>(new Set());
  const [likesCountMap, setLikesCountMap] = useState<Map<string, number>>(new Map());
  const [commentsCountMap, setCommentsCountMap] = useState<Map<string, number>>(new Map());
  const [refeedsCountMap, setRefeedsCountMap] = useState<Map<string, number>>(new Map());
  
  // Modal states
  const [shareOpen, setShareOpen] = useState(false);
  const [giftOpen, setGiftOpen] = useState(false);
  const [refeedOpen, setRefeedOpen] = useState(false);
  
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const videoRefs = useRef<Map<string, HTMLVideoElement>>(new Map());
  const isScrolling = useRef(false);

  const currentPost = allPosts[currentIndex];

  // Initialize counts from posts
  useEffect(() => {
    const likes = new Map<string, number>();
    const comments = new Map<string, number>();
    const refeeds = new Map<string, number>();
    
    allPosts.forEach(p => {
      likes.set(p.id, p.likes_count || 0);
      comments.set(p.id, p.comments_count || 0);
      refeeds.set(p.id, p.refeeds_count || 0);
    });
    
    setLikesCountMap(likes);
    setCommentsCountMap(comments);
    setRefeedsCountMap(refeeds);
  }, [allPosts]);

  // Check liked/saved status for visible posts
  useEffect(() => {
    if (!user) return;
    
    const checkStatuses = async () => {
      const postIds = allPosts.map(p => p.id);
      
      const [likesRes, savesRes] = await Promise.all([
        supabase.from('post_likes').select('post_id').eq('user_id', user.id).in('post_id', postIds),
        supabase.from('saved_posts').select('post_id').eq('user_id', user.id).in('post_id', postIds)
      ]);
      
      if (likesRes.data) {
        setLikedPosts(new Set(likesRes.data.map(l => l.post_id)));
      }
      if (savesRes.data) {
        setSavedPosts(new Set(savesRes.data.map(s => s.post_id)));
      }
    };
    
    checkStatuses();
  }, [user, allPosts]);

  // Scroll to initial position on open
  useEffect(() => {
    if (isOpen && scrollContainerRef.current && initialIndex >= 0) {
      const container = scrollContainerRef.current;
      container.scrollTop = initialIndex * window.innerHeight;
    }
  }, [isOpen, initialIndex]);

  // Handle scroll snap to detect current post
  const handleScroll = useCallback(() => {
    if (!scrollContainerRef.current || isScrolling.current) return;
    
    const container = scrollContainerRef.current;
    const scrollTop = container.scrollTop;
    const itemHeight = container.clientHeight;
    const newIndex = Math.round(scrollTop / itemHeight);
    
    if (newIndex !== currentIndex && newIndex >= 0 && newIndex < allPosts.length) {
      // Pause all videos except new current
      videoRefs.current.forEach((video, postId) => {
        const idx = allPosts.findIndex(p => p.id === postId);
        if (idx !== newIndex) {
          video.pause();
        }
      });
      
      setCurrentIndex(newIndex);
      
      // Auto-play new current video
      const newPost = allPosts[newIndex];
      const newVideo = videoRefs.current.get(newPost.id);
      if (newVideo) {
        newVideo.muted = isMuted;
        newVideo.play().catch(() => {});
      }
    }
  }, [currentIndex, allPosts, isMuted]);

  // Handle close - return video state
  const handleClose = () => {
    const currentVideo = videoRefs.current.get(currentPost?.id);
    const currentTime = currentVideo?.currentTime || 0;
    
    onExitWithState?.(currentPost?.id, currentTime);
    onClose();
  };

  // Toggle UI visibility
  const handleMediaTap = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowUI(prev => !prev);
  };

  // Toggle mute
  const toggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsMuted(prev => !prev);
    
    videoRefs.current.forEach(video => {
      video.muted = !isMuted;
    });
  };

  // Like handler
  const handleLike = async (postId: string) => {
    if (!user) {
      toast({ title: 'Sign in required', variant: 'destructive' });
      return;
    }
    
    const isLiked = likedPosts.has(postId);
    
    try {
      if (isLiked) {
        await supabase.from('post_likes').delete().eq('post_id', postId).eq('user_id', user.id);
        setLikedPosts(prev => { const next = new Set(prev); next.delete(postId); return next; });
        setLikesCountMap(prev => new Map(prev).set(postId, (prev.get(postId) || 1) - 1));
      } else {
        await supabase.from('post_likes').insert({ post_id: postId, user_id: user.id });
        setLikedPosts(prev => new Set(prev).add(postId));
        setLikesCountMap(prev => new Map(prev).set(postId, (prev.get(postId) || 0) + 1));
      }
    } catch (error) {
      console.error('Error toggling like:', error);
    }
  };

  // Save handler
  const handleSave = async (postId: string) => {
    if (!user) {
      toast({ title: 'Sign in required', variant: 'destructive' });
      return;
    }
    
    const isSaved = savedPosts.has(postId);
    
    try {
      if (isSaved) {
        await supabase.from('saved_posts').delete().eq('post_id', postId).eq('user_id', user.id);
        setSavedPosts(prev => { const next = new Set(prev); next.delete(postId); return next; });
        toast({ title: 'Post unsaved' });
      } else {
        await supabase.from('saved_posts').insert({ post_id: postId, user_id: user.id });
        setSavedPosts(prev => new Set(prev).add(postId));
        toast({ title: 'Post saved' });
      }
    } catch (error) {
      console.error('Error toggling save:', error);
    }
  };

  // Get visible posts (current ± 2 for preloading)
  const getVisiblePosts = useCallback(() => {
    const visible: { post: Post; index: number }[] = [];
    const start = Math.max(0, currentIndex - 2);
    const end = Math.min(allPosts.length - 1, currentIndex + 2);
    
    for (let i = start; i <= end; i++) {
      if (allPosts[i]) {
        visible.push({ post: allPosts[i], index: i });
      }
    }
    return visible;
  }, [currentIndex, allPosts]);

  // Get media URL
  const getMediaUrl = (post: Post) => {
    if (post.media_urls && post.media_urls.length > 0) return post.media_urls[0];
    if (post.media_url) return post.media_url;
    if (post.original_post?.media_url) return post.original_post.media_url;
    return null;
  };

  // Get media type
  const getMediaType = (post: Post) => {
    if (post.media_types && post.media_types.length > 0) return post.media_types[0];
    if (post.media_type) return post.media_type;
    if (post.original_post?.media_type) return post.original_post.media_type;
    return null;
  };

  // Get text background for styled text
  const getTextBackground = (post: Post) => {
    if (post.media_type === 'text_styled' && post.media_url) {
      return tailwindGradientToCSS(post.media_url);
    }
    return 'linear-gradient(135deg, hsl(230, 85%, 25%) 0%, hsl(280, 70%, 35%) 100%)';
  };

  if (!isOpen || !currentPost) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black">
      {/* Scrollable container with snap */}
      <div
        ref={scrollContainerRef}
        className="h-full w-full overflow-y-scroll snap-y snap-mandatory"
        onScroll={handleScroll}
        style={{ scrollSnapType: 'y mandatory' }}
      >
        {getVisiblePosts().map(({ post, index }) => {
          const mediaUrl = getMediaUrl(post);
          const mediaType = getMediaType(post);
          const isVideo = mediaType === 'video';
          const isImage = mediaType === 'image';
          const isTextStyled = post.media_type === 'text_styled';
          const isPlainText = post.media_type === 'text_plain';
          const hasMusic = !!post.music_url;
          const displayName = post.profiles?.display_name || post.profiles?.username || 'Anonymous';
          const isCurrentPost = index === currentIndex;
          const isLiked = likedPosts.has(post.id);
          const isSaved = savedPosts.has(post.id);
          const likesCount = likesCountMap.get(post.id) || 0;
          const commentsCount = commentsCountMap.get(post.id) || 0;
          const refeedsCount = refeedsCountMap.get(post.id) || 0;

          return (
            <div
              key={post.id}
              className="h-[100dvh] w-full snap-start snap-always relative flex items-center justify-center"
              style={{ scrollSnapAlign: 'start' }}
            >
              {/* Media content */}
              {isVideo && mediaUrl && (
                <video
                  ref={el => { if (el) videoRefs.current.set(post.id, el); }}
                  src={mediaUrl}
                  className="absolute inset-0 w-full h-full object-cover"
                  muted={isMuted}
                  playsInline
                  loop
                  preload="auto"
                  onClick={handleMediaTap}
                  autoPlay={isCurrentPost}
                />
              )}

              {isImage && mediaUrl && (
                <img
                  src={mediaUrl}
                  alt="Post media"
                  className="absolute inset-0 w-full h-full object-cover"
                  onClick={handleMediaTap}
                />
              )}

              {isTextStyled && (
                <div
                  className="absolute inset-0 w-full h-full flex items-center justify-center px-8"
                  style={{ background: getTextBackground(post) }}
                  onClick={handleMediaTap}
                >
                  <p className="text-white text-2xl font-semibold text-center leading-relaxed drop-shadow-lg">
                    {post.content}
                  </p>
                </div>
              )}

              {(isPlainText || (!mediaUrl && !isTextStyled)) && (
                <div
                  className="absolute inset-0 w-full h-full flex items-center justify-center px-8 bg-background"
                  onClick={handleMediaTap}
                >
                  <p className="text-foreground text-xl text-center leading-relaxed">
                    {post.content}
                  </p>
                </div>
              )}

              {/* Always visible: Avatar */}
              <div className="absolute top-12 left-4 z-30">
                <Avatar 
                  className="w-8 h-8 border-2 border-white/30 cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/profile/${post.profiles?.username || post.user_id}`);
                  }}
                >
                  <AvatarImage src={post.profiles?.avatar_url || ''} />
                  <AvatarFallback className="bg-primary text-white text-xs">
                    {displayName[0]?.toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              </div>

              {/* Back button - Always visible */}
              <button
                onClick={(e) => { e.stopPropagation(); handleClose(); }}
                className="absolute top-12 right-4 z-30 p-2 bg-black/40 backdrop-blur-sm rounded-full transition-all active:scale-95"
              >
                <ArrowLeft className="w-5 h-5 text-white" />
              </button>

              {/* UI Elements - Toggle visibility on tap */}
              <div className={cn(
                "absolute inset-0 pointer-events-none transition-opacity duration-200",
                showUI ? "opacity-100" : "opacity-0"
              )}>
                {/* Play/Pause center button */}
                {isVideo && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-auto">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        const video = videoRefs.current.get(post.id);
                        if (video) {
                          if (video.paused) video.play();
                          else video.pause();
                        }
                      }}
                      className="w-16 h-16 bg-black/40 rounded-full backdrop-blur-md flex items-center justify-center border border-white/10"
                    >
                      <Play className="w-8 h-8 text-white ml-1" fill="white" />
                    </button>
                  </div>
                )}

                {/* Mute button */}
                {isVideo && (
                  <button
                    onClick={toggleMute}
                    className="absolute top-12 right-14 z-30 p-2 bg-black/40 backdrop-blur-sm rounded-full pointer-events-auto"
                  >
                    {isMuted ? <VolumeX className="w-5 h-5 text-white" /> : <Volume2 className="w-5 h-5 text-white" />}
                  </button>
                )}

                {/* Social buttons - Right side */}
                <div className="absolute bottom-32 right-3 z-30 flex flex-col items-center gap-2 pointer-events-auto">
                  {/* Like */}
                  <button onClick={() => handleLike(post.id)} className="flex flex-col items-center gap-0.5">
                    <div className={cn(
                      "p-1.5 rounded-full transition-all active:scale-90",
                      isLiked ? "bg-pink-500/90" : "bg-black/40 backdrop-blur-sm"
                    )}>
                      <Heart className={cn("w-5 h-5", isLiked ? "text-white fill-white" : "text-white")} />
                    </div>
                    <span className="text-white text-[10px] font-semibold">{formatCount(likesCount)}</span>
                  </button>

                  {/* Comments */}
                  <button onClick={() => setShowComments(true)} className="flex flex-col items-center gap-0.5">
                    <div className="p-1.5 bg-black/40 backdrop-blur-sm rounded-full">
                      <MessageCircle className="w-5 h-5 text-white" />
                    </div>
                    <span className="text-white text-[10px] font-semibold">{formatCount(commentsCount)}</span>
                  </button>

                  {/* Refeed */}
                  <button onClick={() => setRefeedOpen(true)} className="flex flex-col items-center gap-0.5">
                    <div className="p-1.5 bg-black/40 backdrop-blur-sm rounded-full">
                      <Repeat className="w-5 h-5 text-white" />
                    </div>
                    <span className="text-white text-[10px] font-semibold">{formatCount(refeedsCount)}</span>
                  </button>

                  {/* Gift */}
                  <button onClick={() => setGiftOpen(true)} className="flex flex-col items-center gap-0.5">
                    <div className="p-1.5 bg-black/40 backdrop-blur-sm rounded-full">
                      <Gift className="w-5 h-5 text-white" />
                    </div>
                  </button>

                  {/* Share */}
                  <button onClick={() => setShareOpen(true)} className="flex flex-col items-center gap-0.5">
                    <div className="p-1.5 bg-black/40 backdrop-blur-sm rounded-full">
                      <Share2 className="w-5 h-5 text-white" />
                    </div>
                  </button>

                  {/* Bookmark */}
                  <button onClick={() => handleSave(post.id)} className="flex flex-col items-center gap-0.5">
                    <div className={cn(
                      "p-1.5 rounded-full transition-all active:scale-90",
                      isSaved ? "bg-primary/90" : "bg-black/40 backdrop-blur-sm"
                    )}>
                      <Bookmark className={cn("w-5 h-5", isSaved ? "text-white fill-white" : "text-white")} />
                    </div>
                  </button>

                  {/* Promote */}
                  {user && (
                    <button
                      onClick={() => navigate(`/promote/${post.id}`)}
                      className="mt-1 p-1.5 bg-gradient-to-r from-pink-500 to-purple-500 rounded-full"
                    >
                      <TrendingUp className="w-5 h-5 text-white" />
                    </button>
                  )}
                </div>

                {/* Music indicator */}
                {hasMusic && (
                  <div className="absolute left-4 bottom-32 z-30 flex items-center gap-3 pointer-events-auto">
                    <div className="relative w-10 h-10 rounded-full bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center animate-spin" style={{ animationDuration: '3s' }}>
                      <div className="w-4 h-4 rounded-full bg-white/20" />
                    </div>
                    <div className="flex items-center gap-2 bg-black/40 backdrop-blur-sm rounded-full px-3 py-1.5 max-w-[180px]">
                      <Music className="w-4 h-4 text-white flex-shrink-0" />
                      <p className="text-white text-xs font-medium truncate">
                        {post.music_title || 'Original Audio'}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Draggable Comments Panel - Only for current post */}
              {isCurrentPost && showComments && (
                <DraggableCommentsPanel
                  postId={post.id}
                  commentsCount={commentsCount}
                  onCommentAdded={() => {
                    setCommentsCountMap(prev => new Map(prev).set(post.id, (prev.get(post.id) || 0) + 1));
                  }}
                  onHide={() => setShowComments(false)}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Modals */}
      <ShareModal
        isOpen={shareOpen}
        onClose={() => setShareOpen(false)}
        postId={currentPost.id}
        postData={{ content: currentPost.content || '' }}
      />

      <GiftModal
        isOpen={giftOpen}
        onClose={() => setGiftOpen(false)}
        recipientId={currentPost.user_id}
        postId={currentPost.id}
      />

      <RefeedModal
        isOpen={refeedOpen}
        onClose={() => setRefeedOpen(false)}
        postId={currentPost.id}
        onRefeedAdded={() => {
          setRefeedsCountMap(prev => new Map(prev).set(currentPost.id, (prev.get(currentPost.id) || 0) + 1));
        }}
      />
    </div>
  );
});

export default FullscreenFeedViewer;
