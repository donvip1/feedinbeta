import { useCallback, useEffect, useState, useRef } from 'react';
import { X } from 'lucide-react';
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
  const [currentImageIdx, setCurrentImageIdx] = useState(activeIndex); // Track current image in single-post mode
  const isMultiPostMode = allPhotoPosts && allPhotoPosts.length > 0;
  const hasInitiallyScrolled = useRef(false);

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

  // Scroll to active post on mount (instant) and on change (smooth)
  useEffect(() => {
    if (!isMultiPostMode || !scrollContainerRef.current) return;
    
    const container = scrollContainerRef.current;
    const targetScroll = activePostIdx * container.clientHeight;
    
    // Use instant scroll on initial mount, smooth scroll after
    if (!hasInitiallyScrolled.current) {
      container.scrollTo({ top: targetScroll, behavior: 'instant' });
      hasInitiallyScrolled.current = true;
    } else {
      container.scrollTo({ top: targetScroll, behavior: 'smooth' });
    }
  }, [activePostIdx, isMultiPostMode]);

  // Handle scroll snap to detect post changes
  const handleScroll = useCallback(() => {
    if (!isMultiPostMode || !scrollContainerRef.current || !allPhotoPosts) return;
    
    const container = scrollContainerRef.current;
    const scrollTop = container.scrollTop;
    const itemHeight = container.clientHeight;
    const newIndex = Math.round(scrollTop / itemHeight);
    
    if (newIndex !== activePostIdx && newIndex >= 0 && newIndex < allPhotoPosts.length) {
      setActivePostIdx(newIndex);
      onPostChange?.(newIndex);
    }
  }, [activePostIdx, allPhotoPosts, isMultiPostMode, onPostChange]);

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
          {/* Top Bar - Close button */}
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
                
                {/* Empty space to center close button */}
                <div className="w-10" />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Vertical Scroll Container - TikTok-style snap scrolling with smooth behavior */}
          <div
            ref={scrollContainerRef}
            onScroll={handleScroll}
            className="h-full w-full overflow-y-scroll snap-y snap-mandatory scrollbar-hide"
            style={{ 
              scrollbarWidth: 'none',
              msOverflowStyle: 'none',
              WebkitOverflowScrolling: 'touch',
              scrollBehavior: 'smooth',
              overscrollBehavior: 'contain'
            }}
          >
            {postsToRender.map(({ post, idx, shouldRender }) => (
              <div
                key={post.id}
                className="h-[100dvh] w-full snap-start snap-always"
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
        {/* Top Bar - Close button */}
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
              
              {/* Empty space to center close button */}
              <div className="w-10" />
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
