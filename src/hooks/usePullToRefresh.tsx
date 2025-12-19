import { useState, useRef, useCallback, useEffect } from 'react';
import { useNativeFeatures } from './useNativeFeatures';

interface PullToRefreshOptions {
  onRefresh: () => Promise<void>;
  threshold?: number;
  resistance?: number;
}

/**
 * Native-style pull-to-refresh hook with haptic feedback
 */
export const usePullToRefresh = ({
  onRefresh,
  threshold = 80,
  resistance = 2.5,
}: PullToRefreshOptions) => {
  const [isPulling, setIsPulling] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { haptic } = useNativeFeatures();

  const containerRef = useRef<HTMLDivElement>(null);
  const startY = useRef(0);
  const currentY = useRef(0);
  const isAtTop = useRef(true);
  const hasTriggeredHaptic = useRef(false);

  const handleTouchStart = useCallback((e: TouchEvent) => {
    const container = containerRef.current;
    if (!container) return;

    // Only enable pull-to-refresh when scrolled to top
    isAtTop.current = container.scrollTop <= 0;
    if (!isAtTop.current) return;

    startY.current = e.touches[0].clientY;
    currentY.current = startY.current;
    hasTriggeredHaptic.current = false;
  }, []);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!isAtTop.current || isRefreshing) return;

    currentY.current = e.touches[0].clientY;
    const distance = (currentY.current - startY.current) / resistance;

    if (distance > 0) {
      setIsPulling(true);
      setPullDistance(Math.min(distance, threshold * 1.5));

      // Trigger haptic when crossing threshold
      if (distance >= threshold && !hasTriggeredHaptic.current) {
        hasTriggeredHaptic.current = true;
        haptic('medium');
      }
    }
  }, [isRefreshing, resistance, threshold, haptic]);

  const handleTouchEnd = useCallback(async () => {
    if (!isPulling) return;

    if (pullDistance >= threshold && !isRefreshing) {
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
  }, [isPulling, pullDistance, threshold, isRefreshing, onRefresh, haptic]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener('touchstart', handleTouchStart, { passive: true });
    container.addEventListener('touchmove', handleTouchMove, { passive: true });
    container.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd]);

  const pullProgress = Math.min(pullDistance / threshold, 1);

  return {
    containerRef,
    isPulling,
    pullDistance,
    pullProgress,
    isRefreshing,
  };
};
