import { useState, useEffect, useCallback, useRef } from 'react';
import { X, ChevronLeft, ChevronRight, Heart, MessageCircle, Share2, Repeat, Gift, Eye, TrendingUp } from 'lucide-react';
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

export default function PhotoPostSlide({
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

  // Check like status when active
  useEffect(() => {
    if (!isActive || !user || !post.id) return;
    
    const checkLikeStatus = async () => {
      const { data } = await supabase
        .from('post_likes')
        .select('id')
        .eq('post_id', post.id)
        .eq('user_id', user.id)
        .maybeSingle();
      setLiked(!!data);
    };
    checkLikeStatus();
  }, [isActive, user, post.id]);

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

  return (
    <div className="w-full h-full flex flex-col relative">
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
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className="w-full h-full object-contain select-none pointer-events-none"
          />
        </motion.div>

        {/* Gradient overlays for better UI visibility */}
        <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/50 to-transparent pointer-events-none" />
        <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-black/70 to-transparent pointer-events-none" />

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

        {/* Image Dots - positioned above social buttons */}
        <AnimatePresence>
          {showUI && images.length > 1 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="absolute bottom-24 left-1/2 -translate-x-1/2 z-20 flex gap-1.5"
            >
              {images.map((_, idx) => (
                <button
                  key={idx}
                  onClick={(e) => {
                    e.stopPropagation();
                    setCurrentImageIndex(idx);
                  }}
                  className={cn(
                    "w-1.5 h-1.5 rounded-full transition-all",
                    idx === currentImageIndex
                      ? "bg-white w-3"
                      : "bg-white/40 hover:bg-white/60"
                  )}
                />
              ))}
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
                  <button onClick={handleLike} className="flex items-center gap-1 group">
                    <Heart className={cn("w-[18px] h-[18px] transition-transform active:scale-90", liked ? "text-pink-500 fill-pink-500" : "text-white")} />
                    <span className="text-white text-[11px] font-medium drop-shadow-lg">{formatCount(likesCount)}</span>
                  </button>

                  <button onClick={(e) => { e.stopPropagation(); setCommentsOpen(true); }} className="flex items-center gap-1 group">
                    <MessageCircle className="w-[18px] h-[18px] text-white active:scale-90 transition-transform" />
                    <span className="text-white text-[11px] font-medium drop-shadow-lg">{formatCount(commentsCount)}</span>
                  </button>

                  <button onClick={(e) => { e.stopPropagation(); setRefeedOpen(true); }} className="flex items-center gap-1 group">
                    <Repeat className="w-[18px] h-[18px] text-white active:scale-90 transition-transform" />
                    <span className="text-white text-[11px] font-medium drop-shadow-lg">{formatCount(refeedsCount)}</span>
                  </button>

                  <div className="flex items-center gap-1">
                    <Eye className="w-[18px] h-[18px] text-white" />
                    <span className="text-white text-[11px] font-medium drop-shadow-lg">{formatCount(post.views_count || 0)}</span>
                  </div>

                  <button onClick={(e) => { e.stopPropagation(); setGiftOpen(true); }} className="group">
                    <Gift className="w-[18px] h-[18px] text-white active:scale-90 transition-transform" />
                  </button>

                  <button onClick={(e) => { e.stopPropagation(); setShareOpen(true); }} className="group">
                    <Share2 className="w-[18px] h-[18px] text-white active:scale-90 transition-transform" />
                  </button>
                </div>

                {/* Promote button - on same line, smaller */}
                {user && post.id && (
                  <button 
                    onClick={(e) => { e.stopPropagation(); navigate(`/promote/${post.id}`); }}
                    className="px-2.5 py-1 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full transition-all active:scale-95 flex items-center gap-1"
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
      />

      {/* Refeed Modal */}
      <RefeedModal
        isOpen={refeedOpen}
        onClose={() => setRefeedOpen(false)}
        postId={post.id}
        onRefeedAdded={() => setRefeedsCount(prev => prev + 1)}
      />
    </div>
  );
}
