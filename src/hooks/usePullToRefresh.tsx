import { useState, useRef, useCallback, useEffect } from 'react';
import { useNativeFeatures } from './useNativeFeatures';

type PullState = 'idle' | 'pulling' | 'ready' | 'refreshing';

interface PullToRefreshOptions {
  onRefresh: () => Promise<void>;
  threshold?: number;
  resistance?: number;
}

/**
 * Native-style pull-to-refresh hook with haptic feedback and spring physics
 */
export const usePullToRefresh = ({
  onRefresh,
  threshold = 80,
  resistance = 2.5,
}: PullToRefreshOptions) => {
  const [pullState, setPullState] = useState<PullState>('idle');
  const [pullDistance, setPullDistance] = useState(0);
  const { haptic } = useNativeFeatures();

  const containerRef = useRef<HTMLDivElement>(null);
  const startY = useRef(0);
  const currentY = useRef(0);
  const isAtTop = useRef(true);
  const hasTriggeredStartHaptic = useRef(false);
  const hasTriggeredThresholdHaptic = useRef(false);

  const isRefreshing = pullState === 'refreshing';
  const isPulling = pullState === 'pulling' || pullState === 'ready';

  const handleTouchStart = useCallback((e: TouchEvent) => {
    const container = containerRef.current;
    if (!container || isRefreshing) return;

    // Only enable pull-to-refresh when scrolled to top
    isAtTop.current = container.scrollTop <= 0;
    if (!isAtTop.current) return;

    startY.current = e.touches[0].clientY;
    currentY.current = startY.current;
    hasTriggeredStartHaptic.current = false;
    hasTriggeredThresholdHaptic.current = false;
  }, [isRefreshing]);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!isAtTop.current || isRefreshing) return;

    currentY.current = e.touches[0].clientY;
    const rawDistance = currentY.current - startY.current;
    
    // Apply resistance for natural feel
    const distance = rawDistance > 0 ? rawDistance / resistance : 0;

    if (distance > 0) {
      // Trigger start haptic
      if (!hasTriggeredStartHaptic.current && distance > 5) {
        hasTriggeredStartHaptic.current = true;
        haptic('selection');
      }

      const newDistance = Math.min(distance, threshold * 1.5);
      setPullDistance(newDistance);

      // Update state based on distance
      if (distance >= threshold) {
        if (pullState !== 'ready') {
          setPullState('ready');
          // Trigger threshold haptic
          if (!hasTriggeredThresholdHaptic.current) {
            hasTriggeredThresholdHaptic.current = true;
            haptic('medium');
          }
        }
      } else if (distance > 0) {
        if (pullState !== 'pulling') {
          setPullState('pulling');
        }
      }
    }
  }, [isRefreshing, resistance, threshold, haptic, pullState]);

  const handleTouchEnd = useCallback(async () => {
    if (pullState === 'idle' || isRefreshing) return;

    if (pullState === 'ready') {
      setPullState('refreshing');
      setPullDistance(60); // Keep some distance while refreshing
      haptic('success');

      try {
        await onRefresh();
        haptic('success');
      } catch (error) {
        console.error('Refresh error:', error);
        haptic('error');
      } finally {
        // Spring animation back to zero
        setPullState('idle');
        setPullDistance(0);
      }
    } else {
      // Spring back if not ready
      setPullState('idle');
      setPullDistance(0);
    }
  }, [pullState, isRefreshing, onRefresh, haptic]);

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
    pullState,
  };
};
