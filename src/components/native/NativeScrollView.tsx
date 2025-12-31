import React, { useRef, useState, useCallback, useEffect } from 'react';
import { motion, useMotionValue, useTransform, PanInfo } from 'framer-motion';
import { useNativeFeatures } from '@/hooks/useNativeFeatures';

interface NativeScrollViewProps {
  children: React.ReactNode;
  onRefresh?: () => Promise<void>;
  onEndReached?: () => void;
  endReachedThreshold?: number;
  className?: string;
  showScrollIndicator?: boolean;
  bounceEnabled?: boolean;
}

const PULL_THRESHOLD = 80;
const RESISTANCE = 0.4;

export const NativeScrollView: React.FC<NativeScrollViewProps> = ({
  children,
  onRefresh,
  onEndReached,
  endReachedThreshold = 200,
  className = '',
  showScrollIndicator = true,
  bounceEnabled = true,
}) => {
  const { haptic, platform } = useNativeFeatures();
  const scrollRef = useRef<HTMLDivElement>(null);
  const pullY = useMotionValue(0);
  
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isPulling, setIsPulling] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [hasTriggeredEnd, setHasTriggeredEnd] = useState(false);

  // Pull-to-refresh indicator transforms
  const indicatorOpacity = useTransform(pullY, [0, 30, PULL_THRESHOLD], [0, 0.5, 1]);
  const indicatorScale = useTransform(pullY, [0, PULL_THRESHOLD], [0.5, 1]);
  const indicatorRotation = useTransform(pullY, [0, PULL_THRESHOLD], [0, 180]);

  const handleTouchStart = useCallback(() => {
    if (scrollRef.current && scrollRef.current.scrollTop <= 0) {
      setIsPulling(true);
    }
  }, []);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!isPulling || !scrollRef.current || isRefreshing) return;
    
    const scrollTop = scrollRef.current.scrollTop;
    if (scrollTop > 0) {
      setIsPulling(false);
      setPullDistance(0);
      pullY.set(0);
      return;
    }

    const touch = e.touches[0];
    const startY = (e.target as HTMLElement).dataset.startY;
    if (!startY) {
      (e.target as HTMLElement).dataset.startY = touch.clientY.toString();
      return;
    }

    const deltaY = touch.clientY - parseFloat(startY);
    if (deltaY > 0) {
      e.preventDefault();
      const distance = deltaY * RESISTANCE;
      setPullDistance(distance);
      pullY.set(distance);

      // Haptic feedback when reaching threshold
      if (distance >= PULL_THRESHOLD && pullDistance < PULL_THRESHOLD) {
        haptic('medium');
      }
    }
  }, [haptic, isRefreshing, isPulling, pullDistance, pullY]);

  const handleTouchEnd = useCallback(async () => {
    if (!isPulling) return;
    
    (document.activeElement as HTMLElement)?.blur();
    delete (scrollRef.current as HTMLElement)?.dataset?.startY;
    
    if (pullDistance >= PULL_THRESHOLD && onRefresh && !isRefreshing) {
      setIsRefreshing(true);
      haptic('success');
      
      try {
        await onRefresh();
      } finally {
        setIsRefreshing(false);
      }
    }
    
    setIsPulling(false);
    setPullDistance(0);
    pullY.set(0);
  }, [haptic, isRefreshing, isPulling, onRefresh, pullDistance, pullY]);

  // Handle infinite scroll
  const handleScroll = useCallback(() => {
    if (!scrollRef.current || !onEndReached || hasTriggeredEnd) return;

    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    const distanceFromEnd = scrollHeight - scrollTop - clientHeight;

    if (distanceFromEnd < endReachedThreshold) {
      setHasTriggeredEnd(true);
      onEndReached();
      // Reset after a delay to allow for new content
      setTimeout(() => setHasTriggeredEnd(false), 1000);
    }
  }, [endReachedThreshold, hasTriggeredEnd, onEndReached]);

  // Set up touch listeners
  useEffect(() => {
    const scrollEl = scrollRef.current;
    if (!scrollEl || !onRefresh) return;

    scrollEl.addEventListener('touchstart', handleTouchStart, { passive: true });
    scrollEl.addEventListener('touchmove', handleTouchMove as EventListener, { passive: false });
    scrollEl.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      scrollEl.removeEventListener('touchstart', handleTouchStart);
      scrollEl.removeEventListener('touchmove', handleTouchMove as EventListener);
      scrollEl.removeEventListener('touchend', handleTouchEnd);
    };
  }, [handleTouchEnd, handleTouchMove, handleTouchStart, onRefresh]);

  return (
    <div className={`relative overflow-hidden ${className}`}>
      {/* Pull-to-refresh indicator */}
      {onRefresh && (
        <motion.div
          className="absolute top-0 left-1/2 -translate-x-1/2 z-30 pointer-events-none"
          style={{
            y: pullY,
            opacity: indicatorOpacity,
          }}
        >
          <div className="flex flex-col items-center pt-4 pb-2">
            <motion.div
              className="w-10 h-10 rounded-full bg-background border-2 border-primary shadow-lg flex items-center justify-center"
              style={{ scale: indicatorScale }}
            >
              {isRefreshing ? (
                <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              ) : (
                <motion.svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="text-primary"
                  style={{ rotate: indicatorRotation }}
                >
                  <polyline points="6 9 12 15 18 9" />
                </motion.svg>
              )}
            </motion.div>
            <span className="text-xs text-muted-foreground mt-2">
              {isRefreshing 
                ? 'Refreshing...' 
                : pullDistance >= PULL_THRESHOLD 
                  ? 'Release to refresh' 
                  : 'Pull to refresh'
              }
            </span>
          </div>
        </motion.div>
      )}

      {/* Scrollable content */}
      <motion.div
        ref={scrollRef}
        className={`h-full overflow-y-auto overflow-x-hidden ${
          bounceEnabled ? 'overscroll-y-auto' : 'overscroll-none'
        } ${showScrollIndicator ? '' : 'scrollbar-hide'}`}
        style={{
          y: pullY,
          WebkitOverflowScrolling: 'touch',
        }}
        onScroll={handleScroll}
      >
        {children}
      </motion.div>
    </div>
  );
};

// Horizontal scroll view with snap
interface HorizontalScrollProps {
  children: React.ReactNode;
  className?: string;
  snapToItem?: boolean;
  itemWidth?: number | 'auto';
  gap?: number;
  showIndicators?: boolean;
}

export const HorizontalScrollView: React.FC<HorizontalScrollProps> = ({
  children,
  className = '',
  snapToItem = true,
  gap = 12,
}) => {
  return (
    <div
      className={`overflow-x-auto scrollbar-hide ${className}`}
      style={{
        WebkitOverflowScrolling: 'touch',
        scrollSnapType: snapToItem ? 'x mandatory' : 'none',
      }}
    >
      <div 
        className="flex"
        style={{ gap }}
      >
        {React.Children.map(children, (child, index) => (
          <div
            key={index}
            style={{
              scrollSnapAlign: snapToItem ? 'start' : 'none',
              flexShrink: 0,
            }}
          >
            {child}
          </div>
        ))}
      </div>
    </div>
  );
};

export default NativeScrollView;
