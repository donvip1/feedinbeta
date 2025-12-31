import React, { useRef, useState, useCallback, useEffect } from 'react';
import { motion, useMotionValue, useTransform, PanInfo } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useNativeFeatures } from '@/hooks/useNativeFeatures';

interface GestureNavigatorProps {
  children: React.ReactNode;
  enableSwipeBack?: boolean;
  enablePullToRefresh?: boolean;
  onRefresh?: () => Promise<void>;
  className?: string;
}

const SWIPE_THRESHOLD = 100;
const SWIPE_VELOCITY_THRESHOLD = 500;
const PULL_THRESHOLD = 80;

export const GestureNavigator: React.FC<GestureNavigatorProps> = ({
  children,
  enableSwipeBack = true,
  enablePullToRefresh = true,
  onRefresh,
  className = '',
}) => {
  const navigate = useNavigate();
  const { haptic, platform } = useNativeFeatures();
  const containerRef = useRef<HTMLDivElement>(null);
  
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [dragDirection, setDragDirection] = useState<'horizontal' | 'vertical' | null>(null);

  // Transform for swipe back indicator
  const swipeOpacity = useTransform(x, [0, SWIPE_THRESHOLD], [0, 1]);
  const swipeScale = useTransform(x, [0, SWIPE_THRESHOLD], [0.5, 1]);
  const swipeX = useTransform(x, [0, SWIPE_THRESHOLD], [-20, 10]);

  // Transform for page sliding
  const pageX = useTransform(x, (value) => Math.max(0, value));
  const shadowOpacity = useTransform(x, [0, 100], [0, 0.3]);

  const handleDragStart = useCallback(() => {
    setIsDragging(true);
    setDragDirection(null);
  }, []);

  const handleDrag = useCallback((event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    // Determine drag direction on first significant movement
    if (!dragDirection) {
      const absX = Math.abs(info.offset.x);
      const absY = Math.abs(info.offset.y);
      if (absX > 10 || absY > 10) {
        setDragDirection(absX > absY ? 'horizontal' : 'vertical');
      }
    }

    // Handle pull to refresh
    if (dragDirection === 'vertical' && enablePullToRefresh && info.offset.y > 0) {
      const scrollTop = containerRef.current?.scrollTop ?? 0;
      if (scrollTop <= 0) {
        const distance = Math.min(info.offset.y * 0.5, PULL_THRESHOLD * 1.5);
        setPullDistance(distance);
        y.set(distance);
        
        if (distance >= PULL_THRESHOLD && !isRefreshing) {
          haptic('medium');
        }
      }
    }

    // Handle swipe back
    if (dragDirection === 'horizontal' && enableSwipeBack && info.offset.x > 0) {
      // Only allow swipe from left edge
      const touch = event instanceof TouchEvent ? event.touches[0] : event;
      if ('clientX' in touch && touch.clientX < 50) {
        x.set(info.offset.x);
      }
    }
  }, [dragDirection, enablePullToRefresh, enableSwipeBack, haptic, isRefreshing, x, y]);

  const handleDragEnd = useCallback(async (event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    setIsDragging(false);

    // Handle pull to refresh release
    if (dragDirection === 'vertical' && pullDistance >= PULL_THRESHOLD && onRefresh && !isRefreshing) {
      setIsRefreshing(true);
      haptic('success');
      try {
        await onRefresh();
      } finally {
        setIsRefreshing(false);
        setPullDistance(0);
        y.set(0);
      }
    } else {
      setPullDistance(0);
      y.set(0);
    }

    // Handle swipe back release
    if (dragDirection === 'horizontal') {
      const shouldNavigateBack = 
        info.offset.x > SWIPE_THRESHOLD || 
        info.velocity.x > SWIPE_VELOCITY_THRESHOLD;
      
      if (shouldNavigateBack && window.history.length > 1) {
        haptic('light');
        // Animate out before navigating
        x.set(window.innerWidth);
        setTimeout(() => {
          navigate(-1);
        }, 200);
      } else {
        x.set(0);
      }
    }

    setDragDirection(null);
  }, [dragDirection, haptic, isRefreshing, navigate, onRefresh, pullDistance, x, y]);

  // Reset on navigation
  useEffect(() => {
    x.set(0);
    y.set(0);
  }, [x, y]);

  return (
    <div className={`relative overflow-hidden ${className}`} ref={containerRef}>
      {/* Swipe back indicator */}
      {enableSwipeBack && (
        <motion.div
          className="fixed left-0 top-1/2 -translate-y-1/2 z-50 pointer-events-none"
          style={{
            opacity: swipeOpacity,
            scale: swipeScale,
            x: swipeX,
          }}
        >
          <div className="w-10 h-10 rounded-full bg-background/90 shadow-lg flex items-center justify-center border border-border">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-foreground"
            >
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </div>
        </motion.div>
      )}

      {/* Pull to refresh indicator */}
      {enablePullToRefresh && (
        <motion.div
          className="absolute top-0 left-1/2 -translate-x-1/2 z-40 pointer-events-none"
          style={{ y }}
          animate={{
            opacity: pullDistance > 10 ? 1 : 0,
          }}
        >
          <div className="flex flex-col items-center py-4">
            <motion.div
              className="w-8 h-8 rounded-full border-2 border-primary flex items-center justify-center"
              animate={{
                rotate: isRefreshing ? 360 : (pullDistance / PULL_THRESHOLD) * 180,
              }}
              transition={{
                rotate: isRefreshing 
                  ? { repeat: Infinity, duration: 0.8, ease: 'linear' }
                  : { duration: 0 },
              }}
            >
              {isRefreshing ? (
                <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              ) : (
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="text-primary"
                  style={{
                    transform: `rotate(${pullDistance >= PULL_THRESHOLD ? 180 : 0}deg)`,
                    transition: 'transform 0.2s',
                  }}
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              )}
            </motion.div>
            <span className="text-xs text-muted-foreground mt-2">
              {isRefreshing ? 'Refreshing...' : pullDistance >= PULL_THRESHOLD ? 'Release to refresh' : 'Pull to refresh'}
            </span>
          </div>
        </motion.div>
      )}

      {/* Main content with gesture handling */}
      <motion.div
        className="min-h-screen"
        style={{ 
          x: pageX,
          y: dragDirection === 'vertical' ? y : 0,
        }}
        drag={platform !== 'web' ? 'x' : false}
        dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
        dragElastic={0.1}
        onDragStart={handleDragStart}
        onDrag={handleDrag}
        onDragEnd={handleDragEnd}
        transition={{
          type: 'spring',
          stiffness: 400,
          damping: 40,
        }}
      >
        {/* Shadow overlay when swiping */}
        <motion.div
          className="absolute inset-y-0 -left-4 w-4 pointer-events-none"
          style={{
            background: 'linear-gradient(to right, transparent, rgba(0,0,0,0.1))',
            opacity: shadowOpacity,
          }}
        />
        {children}
      </motion.div>
    </div>
  );
};

// Vertical swipe navigation for video feeds (TikTok-style)
interface VerticalSwipeProps {
  children: React.ReactNode[];
  currentIndex: number;
  onIndexChange: (index: number) => void;
  className?: string;
}

export const VerticalSwipeNavigator: React.FC<VerticalSwipeProps> = ({
  children,
  currentIndex,
  onIndexChange,
  className = '',
}) => {
  const { haptic } = useNativeFeatures();
  const containerRef = useRef<HTMLDivElement>(null);
  const y = useMotionValue(0);
  const [isDragging, setIsDragging] = useState(false);

  const handleDragEnd = useCallback((event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    setIsDragging(false);
    
    const threshold = 50;
    const velocity = info.velocity.y;
    const offset = info.offset.y;

    if (Math.abs(velocity) > 500 || Math.abs(offset) > threshold) {
      if (offset < 0 || velocity < -500) {
        // Swipe up - next item
        if (currentIndex < children.length - 1) {
          haptic('light');
          onIndexChange(currentIndex + 1);
        }
      } else if (offset > 0 || velocity > 500) {
        // Swipe down - previous item
        if (currentIndex > 0) {
          haptic('light');
          onIndexChange(currentIndex - 1);
        }
      }
    }
    
    y.set(0);
  }, [children.length, currentIndex, haptic, onIndexChange, y]);

  return (
    <div className={`relative overflow-hidden h-screen ${className}`} ref={containerRef}>
      <motion.div
        className="h-full"
        style={{ y }}
        drag="y"
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={0.2}
        onDragStart={() => setIsDragging(true)}
        onDragEnd={handleDragEnd}
      >
        <motion.div
          animate={{ y: -currentIndex * 100 + '%' }}
          transition={{
            type: 'spring',
            stiffness: 300,
            damping: 30,
          }}
          className="h-full"
        >
          {children.map((child, index) => (
            <div
              key={index}
              className="h-screen w-full"
              style={{ touchAction: 'none' }}
            >
              {child}
            </div>
          ))}
        </motion.div>
      </motion.div>

      {/* Navigation dots */}
      <div className="absolute right-2 top-1/2 -translate-y-1/2 flex flex-col gap-1.5 z-10">
        {children.map((_, index) => (
          <button
            key={index}
            onClick={() => onIndexChange(index)}
            className={`w-1.5 rounded-full transition-all ${
              index === currentIndex 
                ? 'h-6 bg-primary' 
                : 'h-1.5 bg-muted-foreground/40'
            }`}
          />
        ))}
      </div>
    </div>
  );
};

export default GestureNavigator;
