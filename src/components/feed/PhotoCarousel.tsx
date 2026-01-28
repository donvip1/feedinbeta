import { useState, useEffect, useRef, useCallback, memo } from 'react';
import { cn } from '@/lib/utils';

interface PhotoCarouselProps {
  images: string[];
  onImageClick?: (index: number) => void;
  className?: string;
}

const AUTO_SLIDE_INTERVAL = 4000; // 4 seconds
const INACTIVITY_DELAY = 4000; // 4 seconds before resuming auto-slide

const PhotoCarousel = memo(function PhotoCarousel({ 
  images, 
  onImageClick,
  className 
}: PhotoCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isUserInteracting, setIsUserInteracting] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const autoSlideRef = useRef<NodeJS.Timeout | null>(null);
  const inactivityRef = useRef<NodeJS.Timeout | null>(null);
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);

  // Start auto-slide timer
  const startAutoSlide = useCallback(() => {
    if (autoSlideRef.current) {
      clearInterval(autoSlideRef.current);
    }
    
    if (images.length <= 1) return;
    
    autoSlideRef.current = setInterval(() => {
      setCurrentIndex(prev => (prev + 1) % images.length);
    }, AUTO_SLIDE_INTERVAL);
  }, [images.length]);

  // Stop auto-slide timer
  const stopAutoSlide = useCallback(() => {
    if (autoSlideRef.current) {
      clearInterval(autoSlideRef.current);
      autoSlideRef.current = null;
    }
  }, []);

  // Reset inactivity timer
  const resetInactivityTimer = useCallback(() => {
    if (inactivityRef.current) {
      clearTimeout(inactivityRef.current);
    }
    
    setIsUserInteracting(true);
    stopAutoSlide();
    
    inactivityRef.current = setTimeout(() => {
      setIsUserInteracting(false);
      startAutoSlide();
    }, INACTIVITY_DELAY);
  }, [startAutoSlide, stopAutoSlide]);

  // Handle user activity
  const handleActivity = useCallback(() => {
    resetInactivityTimer();
  }, [resetInactivityTimer]);

  // Scroll to current index (each image is 50% width)
  useEffect(() => {
    if (!scrollContainerRef.current) return;
    
    const container = scrollContainerRef.current;
    const itemWidth = container.clientWidth / 2;
    const targetScroll = currentIndex * itemWidth;
    container.scrollTo({ left: targetScroll, behavior: 'smooth' });
  }, [currentIndex]);

  // Handle scroll snap detection (each image is 50% width)
  const handleScroll = useCallback(() => {
    if (!scrollContainerRef.current) return;
    
    const container = scrollContainerRef.current;
    const scrollLeft = container.scrollLeft;
    const itemWidth = container.clientWidth / 2;
    const newIndex = Math.round(scrollLeft / itemWidth);
    
    if (newIndex !== currentIndex && newIndex >= 0 && newIndex < images.length) {
      setCurrentIndex(newIndex);
    }
  }, [currentIndex, images.length]);

  // Start auto-slide on mount
  useEffect(() => {
    if (images.length > 1) {
      startAutoSlide();
    }
    
    return () => {
      stopAutoSlide();
      if (inactivityRef.current) {
        clearTimeout(inactivityRef.current);
      }
    };
  }, [images.length, startAutoSlide, stopAutoSlide]);

  // Global activity detection (scroll, touch, click)
  useEffect(() => {
    const handleGlobalActivity = () => {
      if (!isUserInteracting) {
        resetInactivityTimer();
      }
    };

    // Listen for scroll, touch and mouse events on window
    window.addEventListener('scroll', handleGlobalActivity, { passive: true });
    window.addEventListener('touchstart', handleGlobalActivity, { passive: true });
    window.addEventListener('click', handleGlobalActivity, { passive: true });
    
    return () => {
      window.removeEventListener('scroll', handleGlobalActivity);
      window.removeEventListener('touchstart', handleGlobalActivity);
      window.removeEventListener('click', handleGlobalActivity);
    };
  }, [isUserInteracting, resetInactivityTimer]);

  // Handle tap vs swipe detection - stop propagation to prevent SwipeableTabs from capturing
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    // CRITICAL: Stop propagation to prevent SwipeableTabs from capturing the swipe
    e.stopPropagation();
    
    handleActivity();
    touchStartRef.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
      time: Date.now()
    };
  }, [handleActivity]);

  // Stop propagation during horizontal swipe to prevent tab switching
  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (touchStartRef.current) {
      const deltaX = Math.abs(e.touches[0].clientX - touchStartRef.current.x);
      const deltaY = Math.abs(e.touches[0].clientY - touchStartRef.current.y);
      
      // If horizontal movement is dominant, this is a carousel swipe - stop it from bubbling
      if (deltaX > deltaY && deltaX > 10) {
        e.stopPropagation();
      }
    }
  }, []);

  // Stop propagation on touch end to prevent SwipeableTabs from navigating
  const handleCarouselTouchEnd = useCallback((e: React.TouchEvent) => {
    if (touchStartRef.current) {
      const deltaX = Math.abs(e.changedTouches[0].clientX - touchStartRef.current.x);
      const deltaY = Math.abs(e.changedTouches[0].clientY - touchStartRef.current.y);
      
      // If it was a horizontal swipe on the carousel, stop it from bubbling
      if (deltaX > deltaY && deltaX > 10) {
        e.stopPropagation();
      }
    }
  }, []);

  const handleImageTap = useCallback((idx: number, e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    
    // For touch events, check if it was a tap (not a swipe)
    if ('changedTouches' in e) {
      if (touchStartRef.current) {
        const touch = e.changedTouches[0];
        if (touch) {
          const deltaX = Math.abs(touch.clientX - touchStartRef.current.x);
          const deltaY = Math.abs(touch.clientY - touchStartRef.current.y);
          const deltaTime = Date.now() - touchStartRef.current.time;
          
          // If user swiped more than 10px or held for more than 300ms, it's not a tap
          if (deltaX > 10 || deltaY > 10 || deltaTime > 300) {
            touchStartRef.current = null;
            return;
          }
        }
      }
      touchStartRef.current = null;
      e.preventDefault(); // Prevent subsequent click event (avoid double-firing)
      onImageClick?.(idx);
      return;
    }
    
    // Mouse click - always trigger
    onImageClick?.(idx);
  }, [onImageClick]);

  if (images.length === 0) return null;

  // Single image - no carousel needed
  if (images.length === 1) {
    return (
      <div 
        className={cn("w-full rounded-xl overflow-hidden border border-border cursor-pointer hover:brightness-95 transition-all", className)}
        onClick={(e) => {
          e.stopPropagation();
          onImageClick?.(0);
        }}
      >
        <img
          src={images[0]}
          alt="Post image"
          className="w-full object-cover"
          style={{ maxHeight: '60vh' }}
          draggable={false}
          onContextMenu={(e) => e.preventDefault()}
        />
      </div>
    );
  }

  return (
    <div className={cn("w-full", className)}>
      {/* Horizontal scroll carousel */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleCarouselTouchEnd}
        onMouseDown={handleActivity}
        className="w-full overflow-x-scroll snap-x snap-mandatory scrollbar-hide rounded-xl border border-border touch-pan-x"
        style={{ 
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          WebkitOverflowScrolling: 'touch',
          touchAction: 'pan-x'
        }}
      >
        <div className="flex">
          {images.map((url, idx) => (
            <div
              key={idx}
              className="w-1/2 flex-shrink-0 snap-start cursor-pointer hover:brightness-95 transition-all px-0.5"
              onClick={(e) => handleImageTap(idx, e)}
              onTouchEnd={(e) => handleImageTap(idx, e)}
            >
              <img
                src={url}
                alt={`Image ${idx + 1}`}
                className="w-full aspect-square object-cover rounded-lg pointer-events-none"
                draggable={false}
                onContextMenu={(e) => e.preventDefault()}
              />
            </div>
          ))}
        </div>
      </div>
      
      {/* Image Counter - Text format */}
      <div className="text-center text-xs text-muted-foreground mt-2">
        {currentIndex + 1} / {images.length}
      </div>
      
      {/* Dot indicators */}
      <div className="flex justify-center gap-1.5 mt-1">
        {images.map((_, idx) => (
          <button
            key={idx}
            onClick={(e) => {
              e.stopPropagation();
              handleActivity();
              setCurrentIndex(idx);
            }}
            className={cn(
              "w-1.5 h-1.5 rounded-full transition-all",
              idx === currentIndex
                ? "bg-primary w-3"
                : "bg-muted-foreground/40 hover:bg-muted-foreground/60"
            )}
          />
        ))}
      </div>
    </div>
  );
});

export default PhotoCarousel;
