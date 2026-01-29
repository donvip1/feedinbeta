import { useState, useEffect, useCallback, useRef, memo } from 'react';
import { X, ChevronLeft, ChevronRight, Heart, MessageCircle, Share2, Repeat, Gift, Eye, TrendingUp, Globe, Lock, MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence, PanInfo } from 'framer-motion';
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

  // Reset image index when post changes
  useEffect(() => {
    setCurrentImageIndex(initialImageIndex);
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
      className="w-full h-full flex flex-col relative"
      style={{
        transform: 'translate3d(0,0,0)',
        backfaceVisibility: 'hidden',
        willChange: 'transform'
      }}
    >
      {/* Image Container - Full height with proper sizing like TikTok */}
      <div className="flex-1 relative flex items-center justify-center overflow-hidden bg-black">
        <motion.div
          drag={images.length > 1 ? 'x' : false}
          dragConstraints={{ left: -100, right: 100 }}
          dragElastic={0.3}
          onDragEnd={handleDragEnd}
          onClick={onToggleUI}
          className="w-full h-full flex items-center justify-center"
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

        {/* Gradient overlays for better UI visibility */}
        <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-black/70 to-transparent pointer-events-none" />
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-black/80 to-transparent pointer-events-none" />

        {/* Top Bar - Poster Info */}
        <AnimatePresence>
          {showUI && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="absolute top-0 left-0 right-0 z-20 p-4"
            >
              <div className="flex items-center justify-between">
                <div 
                  className="flex items-center gap-3 cursor-pointer"
                  onClick={handleProfileClick}
                >
                  <Avatar className="w-10 h-10 border-2 border-white/30">
                    <AvatarImage src={post.profiles?.avatar_url || ''} />
                    <AvatarFallback className="bg-gray-700 text-white">
                      {displayName[0]?.toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-white text-sm drop-shadow-lg">
                        {displayName}
                      </span>
                      {user && post.user_id !== user.id && (
                        <button 
                          onClick={handleFollow}
                          disabled={isFollowLoading}
                          className={cn(
                            "font-bold text-xs transition",
                            isFollowing ? "text-white/60 hover:text-white/80" : "text-pink-500 hover:text-pink-400",
                            isFollowLoading && "opacity-50"
                          )}
                          style={{ textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}
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
            </motion.div>
          )}
        </AnimatePresence>

        {/* Image Navigation Arrows */}
        <AnimatePresence>
          {showUI && images.length > 1 && (
            <>
              <motion.button
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                onClick={(e) => {
                  e.stopPropagation();
                  navigatePrevImage();
                }}
                className="absolute left-4 top-1/2 -translate-y-1/2 z-20 p-2.5 bg-black/40 hover:bg-black/60 rounded-full text-white transition-colors"
              >
                <ChevronLeft size={22} />
              </motion.button>
              <motion.button
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                onClick={(e) => {
                  e.stopPropagation();
                  navigateNextImage();
                }}
                className="absolute right-4 top-1/2 -translate-y-1/2 z-20 p-2.5 bg-black/40 hover:bg-black/60 rounded-full text-white transition-colors"
              >
                <ChevronRight size={22} />
              </motion.button>
            </>
          )}
        </AnimatePresence>

        {/* Image Counter - positioned at bottom left */}
        <AnimatePresence>
          {showUI && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="absolute bottom-24 left-4 z-20 px-2 py-1 bg-black/60 rounded-full text-white text-xs font-medium"
            >
              {currentImageIndex + 1} / {images.length}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Caption - positioned above social buttons */}
        <AnimatePresence>
          {showUI && caption && !commentsOpen && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="absolute bottom-20 left-4 right-4 z-20"
            >
              <p className="text-white text-sm line-clamp-3 drop-shadow-lg" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.4)' }}>
                {caption}
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Social Buttons Row - All on one line at bottom including Promote */}
        <AnimatePresence>
          {showUI && !commentsOpen && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="absolute bottom-6 left-4 right-4 z-30"
            >
              <div className="flex items-center justify-between">
                {/* Social buttons group */}
                <div className="flex items-center gap-3">
                  {/* Like */}
                  <button 
                    onClick={(e) => { e.stopPropagation(); e.preventDefault(); handleLike(e); }} 
                    className="flex items-center gap-1 group touch-manipulation"
                    type="button"
                    aria-label="Like post"
                  >
                    <Heart className={cn("w-[18px] h-[18px] transition-transform active:scale-90", liked ? "text-pink-500 fill-pink-500" : "text-white")} />
                    <span className="text-white text-[11px] font-medium drop-shadow-lg">{formatCount(likesCount)}</span>
                  </button>

                  {/* Comment */}
                  <button 
                    onClick={(e) => { e.stopPropagation(); e.preventDefault(); setCommentsOpen(true); }} 
                    className="flex items-center gap-1 group touch-manipulation"
                    type="button"
                    aria-label="View comments"
                  >
                    <MessageCircle className="w-[18px] h-[18px] text-white active:scale-90 transition-transform" />
                    <span className="text-white text-[11px] font-medium drop-shadow-lg">{formatCount(commentsCount)}</span>
                  </button>

                  {/* Refeed */}
                  <button 
                    onClick={(e) => { e.stopPropagation(); e.preventDefault(); setRefeedOpen(true); }} 
                    className="flex items-center gap-1 group touch-manipulation"
                    type="button"
                    aria-label="Refeed post"
                  >
                    <Repeat className="w-[18px] h-[18px] text-white active:scale-90 transition-transform" />
                    <span className="text-white text-[11px] font-medium drop-shadow-lg">{formatCount(refeedsCount)}</span>
                  </button>

                  {/* Views */}
                  <div className="flex items-center gap-1" aria-label="View count">
                    <Eye className="w-[18px] h-[18px] text-white" />
                    <span className="text-white text-[11px] font-medium drop-shadow-lg">{formatCount(post.views_count || 0)}</span>
                  </div>

                  {/* Gift */}
                  <button 
                    onClick={(e) => { e.stopPropagation(); e.preventDefault(); setGiftOpen(true); }} 
                    className="flex items-center gap-1 group touch-manipulation"
                    type="button"
                    aria-label="Send gift"
                  >
                    <Gift className="w-[18px] h-[18px] text-white active:scale-90 transition-transform" />
                    <span className="text-white text-[11px] font-medium drop-shadow-lg">{formatCount(giftsCount)}</span>
                  </button>

                  {/* Share */}
                  <button 
                    onClick={(e) => { e.stopPropagation(); e.preventDefault(); setShareOpen(true); }} 
                    className="group touch-manipulation"
                    type="button"
                    aria-label="Share post"
                  >
                    <Share2 className="w-[18px] h-[18px] text-white active:scale-90 transition-transform" />
                  </button>
                </div>

                {/* Promote button - on same line, smaller */}
                {user && post.id && (
                  <button 
                    onClick={(e) => { e.stopPropagation(); e.preventDefault(); navigate(`/promote/${post.id}`); }}
                    className="px-2.5 py-1 bg-gradient-to-r from-pink-500 to-rose-500 rounded-full transition-all active:scale-95 flex items-center gap-1 touch-manipulation"
                    type="button"
                    aria-label="Promote post"
                  >
                    <TrendingUp className="w-3.5 h-3.5 text-white" />
                    <span className="text-white text-[10px] font-semibold">Promote</span>
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
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
