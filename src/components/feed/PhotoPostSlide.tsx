import { useState, useEffect, useCallback, memo } from 'react';
import { ChevronLeft, ChevronRight, Heart, MessageCircle, Share2, Repeat, Gift, Eye, TrendingUp, Globe, Lock, MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, PanInfo } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import CommentsModal from './CommentsModal';
import MobileShareSheet from './MobileShareSheet';
import GiftModal from './GiftModal';
import RefeedModal from './RefeedModal';
import { useNavigate } from 'react-router-dom';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { formatCompactTime } from '@/lib/format-time';

// Format count for display
const formatCount = (count: number): string => {
  if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
  if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
  return count.toString();
};

export interface PhotoPost {
  id: string;
  user_id: string;
  content: string | null;
  media_url: string | null;
  media_urls: string[] | null;
  likes_count: number | null;
  comments_count: number | null;
  refeeds_count: number | null;
  views_count: number | null;
  created_at?: string;
  visibility?: string | null;
  location?: string | null;
  profiles?: {
    username: string | null;
    display_name: string | null;
    avatar_url: string | null;
  };
  // For refeed/quote attribution
  post_type?: string | null;
  original_post?: {
    id: string;
    user_id: string;
    profiles?: {
      username: string | null;
      display_name: string | null;
      avatar_url: string | null;
    };
  } | null;
}

interface PhotoPostSlideProps {
  post: PhotoPost;
  isActive: boolean;
  showUI: boolean;
  onToggleUI: () => void;
  onClose: () => void;
  onLikeUpdate?: () => void;
  initialImageIndex?: number;
  onImageIndexChange?: (index: number) => void;
}

const PhotoPostSlide = memo(function PhotoPostSlide({
  post,
  isActive,
  showUI,
  onToggleUI,
  onClose,
  onLikeUpdate,
  initialImageIndex = 0,
  onImageIndexChange
}: PhotoPostSlideProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  
  // Get images from post
  const images = post.media_urls?.length ? post.media_urls : (post.media_url ? [post.media_url] : []);
  const caption = post.content || '';
  
  // Follow state
  const [isFollowing, setIsFollowing] = useState(false);
  const [isFollowLoading, setIsFollowLoading] = useState(false);
  
  // Image navigation state
  const [currentImageIndex, setCurrentImageIndex] = useState(initialImageIndex);
  
  // Social state
  const [liked, setLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(post.likes_count || 0);
  const [commentsCount, setCommentsCount] = useState(post.comments_count || 0);
  const [refeedsCount, setRefeedsCount] = useState(post.refeeds_count || 0);
  const [giftsCount, setGiftsCount] = useState(0);
  const [saved, setSaved] = useState(false);
  
  // Modals
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [giftOpen, setGiftOpen] = useState(false);
  const [refeedOpen, setRefeedOpen] = useState(false);
  
  // Caption expansion state
  const [showFullCaption, setShowFullCaption] = useState(false);

  // Reset image index and caption state when post changes
  useEffect(() => {
    setCurrentImageIndex(initialImageIndex);
    setShowFullCaption(false);
  }, [post.id, initialImageIndex]);

  // Update counts when post changes
  useEffect(() => {
    setLikesCount(post.likes_count || 0);
    setCommentsCount(post.comments_count || 0);
    setRefeedsCount(post.refeeds_count || 0);
  }, [post]);

  // Check like and follow status when active
  useEffect(() => {
    if (!isActive || !user || !post.id) return;
    
    const checkStatuses = async () => {
      const [likeResult, followResult] = await Promise.all([
        supabase
          .from('post_likes')
          .select('id')
          .eq('post_id', post.id)
          .eq('user_id', user.id)
          .maybeSingle(),
        post.user_id !== user.id 
          ? supabase
              .from('follows')
              .select('id')
              .eq('follower_id', user.id)
              .eq('following_id', post.user_id)
              .maybeSingle()
          : { data: null }
      ]);
      
      setLiked(!!likeResult.data);
      setIsFollowing(!!followResult.data);
    };
    checkStatuses();
  }, [isActive, user, post.id, post.user_id]);

  // Handle follow/unfollow
  const handleFollow = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user || !post.user_id || post.user_id === user.id) return;
    
    setIsFollowLoading(true);
    try {
      if (isFollowing) {
        await supabase
          .from('follows')
          .delete()
          .eq('follower_id', user.id)
          .eq('following_id', post.user_id);
        setIsFollowing(false);
      } else {
        await supabase
          .from('follows')
          .insert({ follower_id: user.id, following_id: post.user_id });
        setIsFollowing(true);
      }
    } catch (error) {
      console.error('Error toggling follow:', error);
    } finally {
      setIsFollowLoading(false);
    }
  };

  const handleProfileClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onClose();
    navigate(`/profile/${post.profiles?.username || post.user_id}`);
  };

  const navigatePrevImage = useCallback(() => {
    const newIdx = (currentImageIndex - 1 + images.length) % images.length;
    setCurrentImageIndex(newIdx);
    onImageIndexChange?.(newIdx);
  }, [currentImageIndex, images.length, onImageIndexChange]);

  const navigateNextImage = useCallback(() => {
    const newIdx = (currentImageIndex + 1) % images.length;
    setCurrentImageIndex(newIdx);
    onImageIndexChange?.(newIdx);
  }, [currentImageIndex, images.length, onImageIndexChange]);

  // Horizontal swipe for image navigation
  const handleDragEnd = useCallback((event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    const threshold = 50;
    const offsetX = info.offset.x;
    
    if (images.length > 1 && Math.abs(offsetX) > threshold) {
      if (offsetX > 0) {
        navigatePrevImage();
      } else {
        navigateNextImage();
      }
    }
  }, [navigatePrevImage, navigateNextImage, images.length]);

  // Handle like
  const handleLike = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user || !post.id) {
      toast({ title: 'Sign in required', variant: 'destructive' });
      return;
    }

    const newLiked = !liked;
    setLiked(newLiked);
    setLikesCount(prev => newLiked ? prev + 1 : prev - 1);

    try {
      if (newLiked) {
        await supabase.from('post_likes').insert({ post_id: post.id, user_id: user.id });
      } else {
        await supabase.from('post_likes').delete().eq('post_id', post.id).eq('user_id', user.id);
      }
      onLikeUpdate?.();
    } catch (error) {
      setLiked(!newLiked);
      setLikesCount(prev => newLiked ? prev - 1 : prev + 1);
    }
  };

  const displayName = post.profiles?.display_name || post.profiles?.username || 'User';

  if (images.length === 0) return null;

  const isPublic = post.visibility !== 'private' && post.visibility !== 'friends';
  const postTime = post.created_at ? formatCompactTime(post.created_at) : '';

  return (
    <div 
      className="w-full h-full flex flex-col bg-black"
      style={{
        transform: 'translate3d(0,0,0)',
        backfaceVisibility: 'hidden',
        willChange: 'transform'
      }}
    >
      {/* User Info Header - Fixed at top */}
      <div 
        className="flex-shrink-0 px-4 py-3 bg-black/80 border-b border-white/10"
        onClick={(e) => e.stopPropagation()}
      >
        <div 
          className="flex items-center gap-3 cursor-pointer"
          onClick={handleProfileClick}
        >
          <Avatar className="w-10 h-10 border-2 border-white/30">
            <AvatarImage src={post.profiles?.avatar_url || ''} />
            <AvatarFallback className="bg-white/20 text-white">
              {displayName[0]?.toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col flex-1">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-white text-sm">
                {displayName}
              </span>
              {user && post.user_id !== user.id && (
                <button 
                  onClick={handleFollow}
                  disabled={isFollowLoading}
                  className={cn(
                    "font-bold text-xs transition",
                    isFollowing ? "text-white/70 hover:text-white" : "text-pink-400 hover:text-pink-300",
                    isFollowLoading && "opacity-50"
                  )}
                >
                  • {isFollowLoading ? '...' : (isFollowing ? 'Following' : 'Follow')}
                </button>
              )}
            </div>
            <div className="flex items-center gap-2 text-white/60 text-xs">
              <span>@{post.profiles?.username || 'user'}</span>
              <span>•</span>
              <span>{postTime}</span>
              <span>•</span>
              {isPublic ? (
                <Globe className="w-3 h-3" />
              ) : (
                <Lock className="w-3 h-3" />
              )}
              {post.location && (
                <>
                  <span>•</span>
                  <div className="flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    <span className="truncate max-w-[100px]">{post.location}</span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Fullscreen Image Container */}
      <div className="flex-1 relative overflow-hidden">
        {/* Image - fills container */}
        <motion.div
          drag={images.length > 1 ? 'x' : false}
          dragConstraints={{ left: -100, right: 100 }}
          dragElastic={0.3}
          onDragEnd={handleDragEnd}
          onClick={onToggleUI}
          className="absolute inset-0 flex items-center justify-center"
          style={{ touchAction: 'pan-y' }}
        >
          <motion.img
            key={`${post.id}-${currentImageIndex}`}
            src={images[currentImageIndex]}
            alt={`Image ${currentImageIndex + 1}`}
            initial={false}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.15 }}
            className="w-full h-full object-contain select-none pointer-events-none will-change-transform"
            draggable={false}
            style={{ 
              transform: 'translate3d(0,0,0)',
              backfaceVisibility: 'hidden' 
            }}
          />
        </motion.div>

        {/* Image Navigation Arrows */}
        {images.length > 1 && (
          <>
            <button
              onClick={(e) => {
                e.stopPropagation();
                navigatePrevImage();
              }}
              className="absolute left-2 top-1/2 -translate-y-1/2 z-20 p-2 bg-black/50 hover:bg-black/70 rounded-full text-white transition-colors"
            >
              <ChevronLeft size={20} />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                navigateNextImage();
              }}
              className="absolute right-2 top-1/2 -translate-y-1/2 z-20 p-2 bg-black/50 hover:bg-black/70 rounded-full text-white transition-colors"
            >
              <ChevronRight size={20} />
            </button>
          </>
        )}

        {/* Dot Indicators - above caption overlay */}
        {images.length > 1 && (
          <div className="absolute bottom-[100px] left-0 right-0 flex justify-center gap-2 z-20">
            {images.map((_, idx) => (
              <button
                key={idx}
                onClick={(e) => {
                  e.stopPropagation();
                  setCurrentImageIndex(idx);
                  onImageIndexChange?.(idx);
                }}
                className={cn(
                  "h-2 rounded-full transition-all duration-200",
                  idx === currentImageIndex 
                    ? "w-4 bg-white" 
                    : "w-2 bg-white/40 hover:bg-white/60"
                )}
              />
            ))}
          </div>
        )}

        {/* Bottom Overlay with Caption Only */}
        <div 
          className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent pt-8 pointer-events-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Caption Section - Scrollable when expanded */}
          {caption && (
            <div 
              className={cn(
                "px-4 pb-3 transition-all duration-300",
                showFullCaption && "max-h-[40vh] overflow-y-auto"
              )}
            >
              <p 
                className={cn(
                  "text-white text-sm leading-relaxed",
                  !showFullCaption && "line-clamp-3"
                )}
              >
                {caption}
              </p>
              {caption.length > 100 && (
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowFullCaption(!showFullCaption);
                  }}
                  className="mt-2 px-2.5 py-0.5 bg-white/20 text-white text-[11px] font-bold uppercase tracking-wide rounded-full hover:bg-white/30 transition-all"
                  style={{ letterSpacing: '0.05em' }}
                >
                  {showFullCaption ? 'Less' : 'More'}
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Fixed Social Buttons Bar */}
      <div className="flex-shrink-0 bg-black/90 px-4 py-3">
        {/* Social buttons row */}
        <div className="flex items-center justify-end gap-4">
          {/* Like */}
          <button 
            onClick={(e) => { 
              e.stopPropagation(); 
              e.preventDefault(); 
              handleLike(e); 
            }} 
            className="flex items-center gap-1 group"
          >
            <Heart className={cn("w-4 h-4 transition-transform", liked ? "text-pink-500 fill-pink-500" : "text-white")} />
            <span className="text-white text-[10px] font-medium">{formatCount(likesCount)}</span>
          </button>

          {/* Comments */}
          <button 
            onClick={(e) => { 
              e.stopPropagation(); 
              e.preventDefault(); 
              setCommentsOpen(true); 
            }} 
            className="flex items-center gap-1 group"
          >
            <MessageCircle className="w-4 h-4 text-white" />
            <span className="text-white text-[10px] font-medium">{formatCount(commentsCount)}</span>
          </button>

          {/* Gift */}
          <button 
            onClick={(e) => { 
              e.stopPropagation(); 
              e.preventDefault(); 
              setGiftOpen(true); 
            }} 
            className="flex items-center gap-1 group"
          >
            <Gift className="w-4 h-4 text-white" />
            <span className="text-white text-[10px] font-medium">{formatCount(giftsCount)}</span>
          </button>

          {/* Views */}
          <div className="flex items-center gap-1">
            <Eye className="w-4 h-4 text-white/60" />
            <span className="text-white/60 text-[10px] font-medium">{formatCount(post.views_count || 0)}</span>
          </div>

          {/* Refeed */}
          <button 
            onClick={(e) => { 
              e.stopPropagation(); 
              e.preventDefault(); 
              setRefeedOpen(true); 
            }} 
            className="flex items-center gap-1 group"
          >
            <Repeat className="w-4 h-4 text-white" />
            <span className="text-white text-[10px] font-medium">{formatCount(refeedsCount)}</span>
          </button>

          {/* Share */}
          <button 
            onClick={(e) => { 
              e.stopPropagation(); 
              e.preventDefault(); 
              setShareOpen(true); 
            }} 
            className="flex items-center gap-1 group"
          >
            <Share2 className="w-4 h-4 text-white" />
          </button>
        </div>

        {/* Promote Button - on its own row below */}
        {user && post.id && (
          <div className="flex justify-end mt-2">
            <button 
              onClick={(e) => { 
                e.stopPropagation(); 
                e.preventDefault(); 
                navigate(`/promote/${post.id}`); 
              }}
              className="px-2.5 py-1 bg-gradient-to-r from-pink-500 to-rose-500 rounded-full transition-all active:scale-95 flex items-center gap-1"
            >
              <TrendingUp className="w-3.5 h-3.5 text-white" />
              <span className="text-white text-[10px] font-semibold">Promote</span>
            </button>
          </div>
        )}
      </div>

      {/* Comments Modal */}
      <CommentsModal
        isOpen={commentsOpen}
        onClose={() => setCommentsOpen(false)}
        postId={post.id}
        postData={{
          content: caption,
          media_url: images[currentImageIndex],
          media_type: 'image',
          profiles: post.profiles
        }}
        onCommentAdded={() => setCommentsCount(prev => prev + 1)}
      />

      {/* Share Modal */}
      <MobileShareSheet
        isOpen={shareOpen}
        onClose={() => setShareOpen(false)}
        postId={post.id}
        postData={{ 
          content: caption,
          media_url: images[currentImageIndex],
          media_type: 'image'
        }}
        posterInfo={{
          displayName,
          username: post.profiles?.username || 'user'
        }}
        onSavePost={() => setSaved(!saved)}
        isSaved={saved}
      />

      {/* Gift Modal */}
      <GiftModal
        isOpen={giftOpen}
        onClose={() => setGiftOpen(false)}
        recipientId={post.user_id}
        postId={post.id}
        recipientName={displayName}
      />

      {/* Refeed Modal */}
      <RefeedModal
        isOpen={refeedOpen}
        onClose={() => setRefeedOpen(false)}
        postId={post.id}
        post={{
          id: post.id,
          content: post.content,
          media_url: images[currentImageIndex] || post.media_url,
          media_type: 'image',
          media_urls: post.media_urls,
          profiles: post.profiles
        }}
        onRefeedAdded={() => setRefeedsCount(prev => prev + 1)}
      />
    </div>
  );
});

export default PhotoPostSlide;
