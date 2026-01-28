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

  // Scroll to current index
  useEffect(() => {
    if (!scrollContainerRef.current) return;
    
    const container = scrollContainerRef.current;
    const targetScroll = currentIndex * container.clientWidth;
    container.scrollTo({ left: targetScroll, behavior: 'smooth' });
  }, [currentIndex]);

  // Handle scroll snap detection
  const handleScroll = useCallback(() => {
    if (!scrollContainerRef.current) return;
    
    const container = scrollContainerRef.current;
    const scrollLeft = container.scrollLeft;
    const itemWidth = container.clientWidth;
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

  if (images.length === 0) return null;

  // Single image - no carousel needed
  if (images.length === 1) {
    return (
      <div 
        className={cn("w-full rounded-xl overflow-hidden border border-border cursor-pointer hover:brightness-95 transition-all", className)}
        onClick={() => onImageClick?.(0)}
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
        onTouchStart={handleActivity}
        onMouseDown={handleActivity}
        className="w-full overflow-x-scroll snap-x snap-mandatory scrollbar-hide rounded-xl border border-border"
        style={{ 
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          WebkitOverflowScrolling: 'touch'
        }}
      >
        <div className="flex">
          {images.map((url, idx) => (
            <div
              key={idx}
              className="w-full flex-shrink-0 snap-start snap-always cursor-pointer hover:brightness-95 transition-all"
              onClick={(e) => {
                e.stopPropagation();
                onImageClick?.(idx);
              }}
            >
              <img
                src={url}
                alt={`Image ${idx + 1}`}
                className="w-full object-cover"
                style={{ maxHeight: '60vh' }}
                draggable={false}
                onContextMenu={(e) => e.preventDefault()}
              />
            </div>
          ))}
        </div>
      </div>
      
      {/* Dot indicators */}
      <div className="flex justify-center gap-1.5 mt-2">
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
