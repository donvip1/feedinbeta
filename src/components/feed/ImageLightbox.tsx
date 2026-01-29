import { useCallback, useEffect, useState, useRef } from 'react';
import { ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import PhotoPostSlide, { PhotoPost } from './PhotoPostSlide';

interface ImageLightboxProps {
  images: string[];
  activeIndex: number;
  onClose: () => void;
  onNavigate?: (index: number) => void;
  // Post data for social interactions (single post mode)
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
  // NEW: Multi-post vertical navigation
  allPhotoPosts?: PhotoPost[];
  currentPostIndex?: number;
  onPostChange?: (index: number) => void;
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
  onLikeUpdate,
  // Multi-post props
  allPhotoPosts,
  currentPostIndex = 0,
  onPostChange
}: ImageLightboxProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [showUI, setShowUI] = useState(true);
  const [activePostIdx, setActivePostIdx] = useState(currentPostIndex);
  const [currentImageIdx, setCurrentImageIdx] = useState(activeIndex);
  const isMultiPostMode = allPhotoPosts && allPhotoPosts.length > 0;
  const hasInitiallyScrolled = useRef(false);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastScrollTop = useRef(0);

  // Lock body scroll when open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'auto';
    };
  }, []);

  // Sync with external post index
  useEffect(() => {
    setActivePostIdx(currentPostIndex);
  }, [currentPostIndex]);

  // Scroll to active post on mount (instant)
  useEffect(() => {
    if (!isMultiPostMode || !scrollContainerRef.current) return;
    
    const container = scrollContainerRef.current;
    const targetScroll = activePostIdx * container.clientHeight;
    
    // Only use instant scroll on initial mount
    if (!hasInitiallyScrolled.current) {
      container.scrollTo({ top: targetScroll, behavior: 'instant' });
      hasInitiallyScrolled.current = true;
    }
  }, [activePostIdx, isMultiPostMode]);

  // Throttled scroll handler - only update index when scroll settles
  const handleScroll = useCallback(() => {
    if (!isMultiPostMode || !scrollContainerRef.current || !allPhotoPosts) return;
    
    // Clear any pending timeout
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }
    
    // Debounce: only calculate after scroll stops for 100ms
    scrollTimeoutRef.current = setTimeout(() => {
      const container = scrollContainerRef.current;
      if (!container) return;
      
      const scrollTop = container.scrollTop;
      const itemHeight = container.clientHeight;
      const newIndex = Math.round(scrollTop / itemHeight);
      
      if (newIndex !== activePostIdx && newIndex >= 0 && newIndex < allPhotoPosts.length) {
        setActivePostIdx(newIndex);
        onPostChange?.(newIndex);
      }
    }, 100);
  }, [activePostIdx, allPhotoPosts, isMultiPostMode, onPostChange]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (isMultiPostMode && allPhotoPosts) {
        if (e.key === 'ArrowUp' && activePostIdx > 0) {
          setActivePostIdx(prev => prev - 1);
          onPostChange?.(activePostIdx - 1);
        } else if (e.key === 'ArrowDown' && activePostIdx < allPhotoPosts.length - 1) {
          setActivePostIdx(prev => prev + 1);
          onPostChange?.(activePostIdx + 1);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, isMultiPostMode, allPhotoPosts, activePostIdx, onPostChange]);

  // Toggle UI visibility
  const handleToggleUI = useCallback(() => {
    setShowUI(prev => !prev);
  }, []);

  if (activeIndex === null || (images.length === 0 && !isMultiPostMode)) return null;

  // Multi-post vertical scroll mode
  if (isMultiPostMode && allPhotoPosts) {
    // Render posts around current index for performance (current ± 2)
    const renderRange = 2;
    const postsToRender = allPhotoPosts.map((post, idx) => ({
      post,
      idx,
      shouldRender: Math.abs(idx - activePostIdx) <= renderRange
    }));

    return (
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[200] bg-black"
        >
          {/* Top Bar - Back button on right side */}
          <AnimatePresence>
            {showUI && (
              <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="absolute top-4 right-4 z-50"
              >
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onClose();
                  }}
                  className="p-2 bg-black/50 hover:bg-black/70 rounded-full text-white transition-colors"
                >
                  <ArrowLeft size={24} />
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Vertical Scroll Container - GPU-accelerated smooth scrolling */}
          <div
            ref={scrollContainerRef}
            onScroll={handleScroll}
            className="h-full w-full overflow-y-auto scrollbar-hide"
            style={{ 
              scrollbarWidth: 'none',
              msOverflowStyle: 'none',
              WebkitOverflowScrolling: 'touch',
              overscrollBehavior: 'contain',
              transform: 'translate3d(0,0,0)',
              willChange: 'scroll-position',
              backfaceVisibility: 'hidden'
            }}
          >
            {postsToRender.map(({ post, idx, shouldRender }) => (
              <div
                key={post.id}
                className="h-[100dvh] w-full"
                style={{
                  transform: 'translate3d(0,0,0)',
                  backfaceVisibility: 'hidden',
                  willChange: idx === activePostIdx ? 'transform' : 'auto'
                }}
              >
                {shouldRender ? (
                  <PhotoPostSlide
                    post={post}
                    isActive={idx === activePostIdx}
                    showUI={showUI}
                    onToggleUI={handleToggleUI}
                    onClose={onClose}
                    onLikeUpdate={onLikeUpdate}
                  />
                ) : (
                  <div className="w-full h-full bg-black" />
                )}
              </div>
            ))}
          </div>
        </motion.div>
      </AnimatePresence>
    );
  }

  // Single post mode - Legacy behavior with single post data
  const singlePost: PhotoPost = {
    id: postId || '',
    user_id: postUserId || '',
    content: caption || null,
    media_url: images[0] || null,
    media_urls: images,
    likes_count: initialLikesCount,
    comments_count: initialCommentsCount,
    refeeds_count: initialRefeedsCount,
    views_count: initialViewsCount,
    profiles
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[200] bg-black flex flex-col"
      >
        {/* Top Bar - Back button on right side */}
        <AnimatePresence>
          {showUI && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="absolute top-4 right-4 z-50"
            >
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onClose();
                }}
                className="p-2 bg-black/50 hover:bg-black/70 rounded-full text-white transition-colors"
              >
                <ArrowLeft size={24} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Single Post Slide */}
        <div className="flex-1">
          <PhotoPostSlide
            post={singlePost}
            isActive={true}
            showUI={showUI}
            onToggleUI={handleToggleUI}
            onClose={onClose}
            onLikeUpdate={onLikeUpdate}
            initialImageIndex={activeIndex}
            onImageIndexChange={(idx) => {
              setCurrentImageIdx(idx);
              onNavigate?.(idx);
            }}
          />
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
