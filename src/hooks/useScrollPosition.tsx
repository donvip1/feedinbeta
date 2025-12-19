import { useEffect, useRef, useCallback } from 'react';

const scrollPositions = new Map<string, number>();

/**
 * Hook to preserve and restore scroll position for a route
 * Like Instagram/TikTok - remembers where you were
 */
export const useScrollPosition = (key: string) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const isRestoringRef = useRef(false);

  // Save scroll position when unmounting or navigating away
  const savePosition = useCallback(() => {
    if (containerRef.current && !isRestoringRef.current) {
      scrollPositions.set(key, containerRef.current.scrollTop);
    }
  }, [key]);

  // Restore scroll position on mount
  useEffect(() => {
    const savedPosition = scrollPositions.get(key);
    if (savedPosition !== undefined && containerRef.current) {
      isRestoringRef.current = true;
      // Use requestAnimationFrame for smooth restoration
      requestAnimationFrame(() => {
        if (containerRef.current) {
          containerRef.current.scrollTop = savedPosition;
        }
        // Allow saving again after a short delay
        setTimeout(() => {
          isRestoringRef.current = false;
        }, 100);
      });
    }

    // Save position when component unmounts
    return () => {
      savePosition();
    };
  }, [key, savePosition]);

  // Save position on scroll (debounced)
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let timeoutId: NodeJS.Timeout;
    const handleScroll = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(savePosition, 150);
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      clearTimeout(timeoutId);
      container.removeEventListener('scroll', handleScroll);
    };
  }, [savePosition]);

  return { containerRef, savePosition };
};

/**
 * Clear saved scroll position for a route
 */
export const clearScrollPosition = (key: string) => {
  scrollPositions.delete(key);
};

/**
 * Clear all saved scroll positions
 */
export const clearAllScrollPositions = () => {
  scrollPositions.clear();
};
