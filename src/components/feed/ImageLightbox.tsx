import { useCallback, useEffect, useState, useRef } from 'react';
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

interface ImageLightboxProps {
  images: string[];
  activeIndex: number;
  onClose: () => void;
  onNavigate?: (index: number) => void;
  // Post data for social interactions
  postId?: string;
  postUserId?: string;
  caption?: string;
  initialLikesCount?: number;
  initialCommentsCount?: number;
  initialRefeedsCount?: number;
  initialGiftsCount?: number;
  initialViewsCount?: number;
  profiles?: {
    username: string | null;
    display_name: string | null;
    avatar_url: string | null;
  };
  onLikeUpdate?: () => void;
}

export default function ImageLightbox({ 
  images, 
  activeIndex, 
  onClose, 
  onNavigate,
  postId,
  postUserId,
  caption,
  initialLikesCount = 0,
  initialCommentsCount = 0,
  initialRefeedsCount = 0,
  initialGiftsCount = 0,
  initialViewsCount = 0,
  profiles,
  onLikeUpdate
}: ImageLightboxProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [currentIndex, setCurrentIndex] = useState(activeIndex);
  const [showUI, setShowUI] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Social state
  const [liked, setLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(initialLikesCount);
  const [commentsCount, setCommentsCount] = useState(initialCommentsCount);
  const [refeedsCount, setRefeedsCount] = useState(initialRefeedsCount);
  const [giftsCount, setGiftsCount] = useState(initialGiftsCount);
  const [saved, setSaved] = useState(false);
  
  // Modals
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [giftOpen, setGiftOpen] = useState(false);
  const [refeedOpen, setRefeedOpen] = useState(false);

  // Sync internal state with prop
  useEffect(() => {
    setCurrentIndex(activeIndex);
  }, [activeIndex]);

  // Lock body scroll when open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'auto';
    };
  }, []);

  // Check like status
  useEffect(() => {
    const checkLikeStatus = async () => {
      if (!user || !postId) return;
      const { data } = await supabase
        .from('post_likes')
        .select('id')
        .eq('post_id', postId)
        .eq('user_id', user.id)
        .maybeSingle();
      setLiked(!!data);
    };
    checkLikeStatus();
  }, [user, postId]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (commentsOpen || shareOpen || giftOpen || refeedOpen) return;
      
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowLeft') {
        navigatePrev();
      } else if (e.key === 'ArrowRight') {
        navigateNext();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex, commentsOpen, shareOpen, giftOpen, refeedOpen]);

  const navigatePrev = useCallback(() => {
    const newIndex = (currentIndex - 1 + images.length) % images.length;
    setCurrentIndex(newIndex);
    onNavigate?.(newIndex);
  }, [currentIndex, images.length, onNavigate]);

  const navigateNext = useCallback(() => {
    const newIndex = (currentIndex + 1) % images.length;
    setCurrentIndex(newIndex);
    onNavigate?.(newIndex);
  }, [currentIndex, images.length, onNavigate]);

  // Swipe handling
  const handleDragEnd = useCallback((event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    const threshold = 50;
    const velocity = info.velocity.x;
    const offset = info.offset.x;

    if (Math.abs(velocity) > 300 || Math.abs(offset) > threshold) {
      if (offset > 0 || velocity > 300) {
        navigatePrev();
      } else {
        navigateNext();
      }
    }
  }, [navigatePrev, navigateNext]);

  // Vertical swipe to close
  const handleVerticalDrag = useCallback((event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (info.offset.y > 100) {
      onClose();
    }
  }, [onClose]);

  // Toggle UI visibility on tap
  const handleImageTap = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowUI(prev => !prev);
  };

  // Handle like
  const handleLike = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user || !postId) {
      toast({ title: 'Sign in required', variant: 'destructive' });
      return;
    }

    const newLiked = !liked;
    setLiked(newLiked);
    setLikesCount(prev => newLiked ? prev + 1 : prev - 1);

    try {
      if (newLiked) {
        await supabase.from('post_likes').insert({ post_id: postId, user_id: user.id });
      } else {
        await supabase.from('post_likes').delete().eq('post_id', postId).eq('user_id', user.id);
      }
      onLikeUpdate?.();
    } catch (error) {
      setLiked(!newLiked);
      setLikesCount(prev => newLiked ? prev - 1 : prev + 1);
    }
  };

  // Handle comments open
  const handleCommentsOpen = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCommentsOpen(true);
  };

  if (activeIndex === null || images.length === 0) return null;

  const displayName = profiles?.display_name || profiles?.username || 'User';

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[200] bg-black flex flex-col"
      >
        {/* Top Bar - Close button (always visible when UI shown) */}
        <AnimatePresence>
          {showUI && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="absolute top-0 left-0 right-0 z-50 flex items-center justify-between p-4 bg-gradient-to-b from-black/60 to-transparent"
            >
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onClose();
                }}
                className="p-2 bg-black/40 hover:bg-black/60 rounded-full text-white transition-colors"
              >
                <X size={24} />
              </button>
              
              {/* Image Counter */}
              {images.length > 1 && (
                <div className="px-3 py-1.5 bg-black/60 rounded-full text-white text-sm font-medium">
                  {currentIndex + 1} / {images.length}
                </div>
              )}
              
              <div className="w-10" /> {/* Spacer for alignment */}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Navigation Arrows */}
        <AnimatePresence>
          {showUI && images.length > 1 && (
            <>
              <motion.button
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                onClick={(e) => {
                  e.stopPropagation();
                  navigatePrev();
                }}
                className="absolute left-4 top-1/2 -translate-y-1/2 z-50 p-3 bg-black/40 hover:bg-black/60 rounded-full text-white transition-colors"
              >
                <ChevronLeft size={24} />
              </motion.button>
              <motion.button
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                onClick={(e) => {
                  e.stopPropagation();
                  navigateNext();
                }}
                className="absolute right-4 top-1/2 -translate-y-1/2 z-50 p-3 bg-black/40 hover:bg-black/60 rounded-full text-white transition-colors"
              >
                <ChevronRight size={24} />
              </motion.button>
            </>
          )}
        </AnimatePresence>

        {/* Image Container - Cascades when comments open */}
        <motion.div
          ref={containerRef}
          animate={{
            height: commentsOpen ? '25vh' : '100%',
            y: commentsOpen ? 0 : 0,
          }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="relative flex-shrink-0 flex items-center justify-center overflow-hidden"
        >
          <motion.div
            drag={commentsOpen ? false : "x"}
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.2}
            onDragEnd={handleDragEnd}
            onClick={handleImageTap}
            className="w-full h-full flex items-center justify-center p-4"
          >
            <motion.img
              key={currentIndex}
              src={images[currentIndex]}
              alt={`Image ${currentIndex + 1}`}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.2 }}
              drag={commentsOpen ? false : "y"}
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={0.3}
              onDragEnd={handleVerticalDrag}
              className={cn(
                "max-w-full max-h-full object-contain rounded-lg select-none",
                commentsOpen && "object-cover w-full h-full"
              )}
            />
          </motion.div>
        </motion.div>

        {/* Caption - visible when UI is shown or comments are open */}
        <AnimatePresence>
          {(showUI || commentsOpen) && caption && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className={cn(
                "absolute bottom-20 left-0 right-[15%] z-40 px-4 py-3",
                commentsOpen && "relative bottom-0 right-0 bg-black border-b border-border"
              )}
            >
              <p className="text-white text-sm line-clamp-3 drop-shadow-lg">{caption}</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Social Buttons - Horizontal bottom bar (visible when UI shown and comments closed) */}
        <AnimatePresence>
          {showUI && !commentsOpen && postId && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="absolute bottom-8 left-4 right-4 z-50"
            >
              {/* Horizontal Social Buttons Row */}
              <div className="flex items-center gap-4 flex-wrap">
                {/* Like */}
                <button onClick={handleLike} className="flex items-center gap-1 group">
                  <Heart className={cn("w-5 h-5 transition-transform active:scale-90", liked ? "text-pink-500 fill-pink-500" : "text-white")} />
                  <span className="text-white text-xs font-medium drop-shadow-lg">{formatCount(likesCount)}</span>
                </button>

                {/* Comments */}
                <button onClick={handleCommentsOpen} className="flex items-center gap-1 group">
                  <MessageCircle className="w-5 h-5 text-white active:scale-90 transition-transform" />
                  <span className="text-white text-xs font-medium drop-shadow-lg">{formatCount(commentsCount)}</span>
                </button>

                {/* Views */}
                <div className="flex items-center gap-1">
                  <Eye className="w-5 h-5 text-white" />
                  <span className="text-white text-xs font-medium drop-shadow-lg">{formatCount(initialViewsCount)}</span>
                </div>

                {/* Refeed */}
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    setRefeedOpen(true);
                  }} 
                  className="flex items-center gap-1 group"
                >
                  <Repeat className="w-5 h-5 text-white active:scale-90 transition-transform" />
                  <span className="text-white text-xs font-medium drop-shadow-lg">{formatCount(refeedsCount)}</span>
                </button>

                {/* Gift */}
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    setGiftOpen(true);
                  }} 
                  className="flex items-center gap-1 group"
                >
                  <Gift className="w-5 h-5 text-white active:scale-90 transition-transform" />
                  <span className="text-white text-xs font-medium drop-shadow-lg">{formatCount(giftsCount)}</span>
                </button>

                {/* Share */}
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    setShareOpen(true);
                  }} 
                  className="flex items-center gap-1 group"
                >
                  <Share2 className="w-5 h-5 text-white active:scale-90 transition-transform" />
                </button>

                {/* Promote */}
                {user && postId && (
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/promote/${postId}`);
                    }}
                    className="ml-auto px-3 py-1 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full transition-all active:scale-95 flex items-center gap-1"
                  >
                    <TrendingUp className="w-4 h-4 text-white" />
                    <span className="text-white text-xs font-medium">Promote</span>
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Thumbnail Dots at bottom */}
        <AnimatePresence>
          {showUI && !commentsOpen && images.length > 1 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="absolute bottom-8 left-1/2 -translate-x-1/2 z-50 flex gap-2"
            >
              {images.map((_, idx) => (
                <button
                  key={idx}
                  onClick={(e) => {
                    e.stopPropagation();
                    setCurrentIndex(idx);
                    onNavigate?.(idx);
                  }}
                  className={cn(
                    "w-2 h-2 rounded-full transition-all",
                    idx === currentIndex
                      ? "bg-white w-4"
                      : "bg-white/40 hover:bg-white/60"
                  )}
                />
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Comments Modal - Opens as sheet overlay, image stays minimized */}
        <CommentsModal
          isOpen={commentsOpen}
          onClose={() => setCommentsOpen(false)}
          postId={postId || ''}
          postData={{
            content: caption || null,
            media_url: images[currentIndex],
            media_type: 'image',
            profiles
          }}
          onCommentAdded={() => setCommentsCount(prev => prev + 1)}
        />

        {/* Share Modal */}
        {postId && (
          <MobileShareSheet
            isOpen={shareOpen}
            onClose={() => setShareOpen(false)}
            postId={postId}
            postData={{ 
              content: caption || null,
              media_url: images[currentIndex],
              media_type: 'image'
            }}
            posterInfo={{
              displayName,
              username: profiles?.username || 'user'
            }}
            onSavePost={() => setSaved(!saved)}
            isSaved={saved}
          />
        )}

        {/* Gift Modal */}
        {postId && postUserId && (
          <GiftModal
            isOpen={giftOpen}
            onClose={() => setGiftOpen(false)}
            recipientId={postUserId}
            postId={postId}
          />
        )}

        {/* Refeed Modal */}
        {postId && (
          <RefeedModal
            isOpen={refeedOpen}
            onClose={() => setRefeedOpen(false)}
            postId={postId}
            onRefeedAdded={() => setRefeedsCount(prev => prev + 1)}
          />
        )}
      </motion.div>
    </AnimatePresence>
  );
}
